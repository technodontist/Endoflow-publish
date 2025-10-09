/**
 * EndoFlow Master AI Orchestrator
 *
 * This service acts as the central intelligence that:
 * 1. Classifies user intents from natural language
 * 2. Routes queries to specialized AI agents
 * 3. Synthesizes responses from multiple agents
 * 4. Maintains conversation context
 *
 * Architecture: Master-Worker Pattern
 * - Master: Intent classifier + response synthesizer
 * - Workers: Specialized AI agents (research, scheduler, treatment, patient)
 */

import { generateChatCompletion, GeminiChatMessage } from './gemini-ai'
import { analyzePatientCohort } from './gemini-ai'
import { scheduleAppointmentWithAI } from '@/lib/actions/ai-appointment-scheduler'
import { getAITreatmentSuggestionAction } from '@/lib/actions/ai-treatment-suggestions'
import { createServiceClient } from '@/lib/supabase/server'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type IntentType =
  | 'clinical_research'      // "Find patients with RCT on tooth 36"
  | 'appointment_scheduling' // "What's my schedule today", "Book appointment"
  | 'treatment_planning'     // "Suggest treatment for pulpitis", "Follow-up protocol"
  | 'patient_inquiry'        // "Tell me about John Doe", "Patient history"
  | 'general_question'       // "How do I...", "What is..."
  | 'clarification_needed'   // Ambiguous query requiring more info

export interface ClassifiedIntent {
  type: IntentType
  confidence: number
  entities: {
    patientName?: string
    toothNumber?: string
    dateRange?: { start: string; end: string }
    treatmentType?: string
    diagnosis?: string
    appointmentDate?: string
    appointmentTime?: string
  }
  requiresClarification: boolean
  clarificationQuestion?: string
}

export interface AgentResponse {
  agentName: string
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

export interface OrchestratedResponse {
  success: boolean
  response: string // Natural language response for the user
  agentResponses: AgentResponse[]
  intent: ClassifiedIntent
  conversationContext?: any
  suggestions?: string[] // Follow-up suggestions
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

/**
 * Classify user intent using Gemini AI
 * This is the "brain" that decides which specialized agent should handle the query
 */
export async function classifyIntent(
  userQuery: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ClassifiedIntent> {

  const systemInstruction = `You are an intent classification system for EndoFlow, a dental clinic AI assistant.

TASK: Classify the user's query into ONE of these categories:
1. clinical_research - Questions about patients, cohorts, statistics, diagnoses, treatments
2. appointment_scheduling - Schedule management, booking, rescheduling, availability
3. treatment_planning - Treatment suggestions, protocols, clinical recommendations
4. patient_inquiry - Specific patient information, history, records
5. general_question - General dental questions, how-to queries
6. clarification_needed - Ambiguous query that needs more information

IMPORTANT: Also extract relevant entities:
- patientName: Full name of patient mentioned
- toothNumber: FDI tooth notation (e.g., "36", "46")
- dateRange: If "last month", "this week", etc. mentioned
- treatmentType: Type of treatment (RCT, extraction, etc.)
- diagnosis: Clinical diagnosis mentioned
- appointmentDate: Date for appointment
- appointmentTime: Time for appointment

RESPONSE FORMAT (JSON only):
{
  "type": "clinical_research",
  "confidence": 0.95,
  "entities": {
    "toothNumber": "36",
    "treatmentType": "RCT",
    "dateRange": {"start": "2025-09-01", "end": "2025-09-30"}
  },
  "requiresClarification": false,
  "clarificationQuestion": null
}

If the query is ambiguous or missing critical information, set requiresClarification: true and provide a clarificationQuestion.

EXAMPLES:
Input: "Find patients with RCT on tooth 36 and 46 last month"
Output: {"type": "clinical_research", "confidence": 0.98, "entities": {"toothNumber": "36", "treatmentType": "RCT", "dateRange": {...}}, "requiresClarification": false}

Input: "What's my schedule today"
Output: {"type": "appointment_scheduling", "confidence": 0.95, "entities": {}, "requiresClarification": false}

Input: "Schedule RCT for John tomorrow at 2 PM"
Output: {"type": "appointment_scheduling", "confidence": 0.96, "entities": {"patientName": "John", "treatmentType": "RCT", "appointmentDate": "2025-10-10", "appointmentTime": "14:00"}, "requiresClarification": false}

Input: "Tell me about patient John's follow-up protocol"
Output: {"type": "patient_inquiry", "confidence": 0.85, "entities": {"patientName": "John"}, "requiresClarification": false}

Input: "What should I do for pulpitis on tooth 46"
Output: {"type": "treatment_planning", "confidence": 0.92, "entities": {"diagnosis": "pulpitis", "toothNumber": "46"}, "requiresClarification": false}

Input: "Schedule appointment"
Output: {"type": "appointment_scheduling", "confidence": 0.70, "entities": {}, "requiresClarification": true, "clarificationQuestion": "Sure! I can help schedule an appointment. Could you please tell me: 1) Patient name, 2) Date and time, and 3) Type of appointment (consultation, treatment, follow-up)?"}
`

  // Build context from conversation history
  let contextString = ''
  if (conversationHistory && conversationHistory.length > 0) {
    contextString = '\n\nCONVERSATION CONTEXT:\n'
    conversationHistory.slice(-3).forEach((msg) => {
      contextString += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`
    })
  }

  const userPrompt = `${contextString}\n\nCURRENT QUERY: ${userQuery}\n\nClassify this query and extract entities.`

  const messages: GeminiChatMessage[] = [
    {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  ]

  try {
    const response = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.1, // Low temperature for consistent classification
      systemInstruction,
      responseFormat: 'json'
    })

    const classified = JSON.parse(response) as ClassifiedIntent
    console.log('🎯 [ENDOFLOW MASTER] Intent classified:', classified.type, `(${(classified.confidence * 100).toFixed(0)}%)`)

    return classified
  } catch (error) {
    console.error('❌ [ENDOFLOW MASTER] Intent classification failed:', error)

    // Fallback: treat as general question
    return {
      type: 'general_question',
      confidence: 0.5,
      entities: {},
      requiresClarification: true,
      clarificationQuestion: "I'm not quite sure what you're asking. Could you rephrase that?"
    }
  }
}

// ============================================================================
// SPECIALIZED AGENT DELEGATION
// ============================================================================

/**
 * Delegate to Clinical Research AI Agent
 */
async function delegateToClinicalResearch(
  userQuery: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('🔬 [CLINICAL RESEARCH AGENT] Processing query...')

    // Get patient cohort based on extracted filters
    const supabase = await createServiceClient()

    // Build query based on entities - fetch patients first
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .limit(100)

    if (patientsError) {
      throw new Error(`Database query failed: ${patientsError.message}`)
    }

    if (!patients || patients.length === 0) {
      return {
        agentName: 'Clinical Research AI',
        success: true,
        data: {
          summary: 'No patients found in the database.',
          insights: [],
          statistics: {},
          recommendations: []
        },
        processingTime: Date.now() - startTime
      }
    }

    // Fetch related data separately for each patient
    const enrichedPatients = await Promise.all(
      patients.map(async (patient) => {
        const [consultations, treatments, appointments] = await Promise.all([
          supabase.schema('api').from('consultations').select('*').eq('patient_id', patient.id),
          supabase.schema('api').from('treatments').select('*').eq('patient_id', patient.id),
          supabase.schema('api').from('appointments').select('*').eq('patient_id', patient.id)
        ])

        return {
          ...patient,
          consultations: consultations.data || [],
          treatments: treatments.data || [],
          appointments: appointments.data || []
        }
      })
    )

    // Use Gemini to analyze the cohort with enriched data
    const analysis = await analyzePatientCohort({
      cohortData: enrichedPatients || [],
      query: userQuery
    })

    return {
      agentName: 'Clinical Research AI',
      success: true,
      data: analysis,
      processingTime: Date.now() - startTime
    }
  } catch (error) {
    console.error('❌ [CLINICAL RESEARCH AGENT] Error:', error)
    return {
      agentName: 'Clinical Research AI',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Delegate to Appointment Scheduler AI Agent
 */
async function delegateToScheduler(
  userQuery: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('📅 [SCHEDULER AGENT] Processing query...')

    // Check if this is a query about schedule or a booking request
    const isBooking = userQuery.toLowerCase().includes('schedule') ||
                      userQuery.toLowerCase().includes('book') ||
                      userQuery.toLowerCase().includes('create appointment')

    if (isBooking && entities.patientName) {
      // Use AI appointment scheduler
      const result = await scheduleAppointmentWithAI(userQuery, dentistId)

      return {
        agentName: 'Appointment Scheduler AI',
        success: result.success,
        data: result,
        error: result.error,
        processingTime: Date.now() - startTime
      }
    } else {
      // Query schedule - fetch appointments and patients separately
      const supabase = await createServiceClient()
      const today = new Date().toISOString().split('T')[0]

      const { data: appointments, error } = await supabase
        .schema('api')
        .from('appointments')
        .select('*')
        .eq('dentist_id', dentistId)
        .gte('scheduled_date', today)
        .order('scheduled_date')
        .order('scheduled_time')
        .limit(10)

      if (error) throw error

      // Enrich with patient data
      let enrichedAppointments = appointments
      if (appointments && appointments.length > 0) {
        const patientIds = [...new Set(appointments.map(apt => apt.patient_id).filter(Boolean))]

        const { data: patients } = await supabase
          .schema('api')
          .from('patients')
          .select('id, first_name, last_name')
          .in('id', patientIds)

        if (patients) {
          const patientMap = new Map(patients.map(p => [p.id, p]))
          enrichedAppointments = appointments.map(apt => ({
            ...apt,
            patients: apt.patient_id ? patientMap.get(apt.patient_id) : null
          }))
        }
      }

      return {
        agentName: 'Appointment Scheduler AI',
        success: true,
        data: { appointments: enrichedAppointments, query: 'schedule_view' },
        processingTime: Date.now() - startTime
      }
    }
  } catch (error) {
    console.error('❌ [SCHEDULER AGENT] Error:', error)
    return {
      agentName: 'Appointment Scheduler AI',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Delegate to Treatment Planning AI Agent
 */
async function delegateToTreatmentPlanning(
  userQuery: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('💊 [TREATMENT PLANNING AGENT] Processing query...')

    if (!entities.diagnosis && !entities.toothNumber) {
      // Need more info for treatment planning
      return {
        agentName: 'Treatment Planning AI',
        success: false,
        error: 'Please specify diagnosis and/or tooth number for treatment recommendations',
        processingTime: Date.now() - startTime
      }
    }

    const result = await getAITreatmentSuggestionAction({
      diagnosis: entities.diagnosis || 'General consultation',
      toothNumber: entities.toothNumber || 'Not specified',
      patientContext: undefined
    })

    return {
      agentName: 'Treatment Planning AI',
      success: result.success,
      data: result.data,
      error: result.error,
      processingTime: Date.now() - startTime
    }
  } catch (error) {
    console.error('❌ [TREATMENT PLANNING AGENT] Error:', error)
    return {
      agentName: 'Treatment Planning AI',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Delegate to Patient Inquiry Agent
 */
async function delegateToPatientInquiry(
  userQuery: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('👤 [PATIENT INQUIRY AGENT] Processing query...')

    if (!entities.patientName) {
      return {
        agentName: 'Patient Inquiry AI',
        success: false,
        error: 'Please specify the patient name',
        processingTime: Date.now() - startTime
      }
    }

    const supabase = await createServiceClient()

    // Search for patient - separate queries
    const nameParts = entities.patientName.split(' ')
    let patientQuery = supabase
      .schema('api')
      .from('patients')
      .select('*')

    if (nameParts.length >= 2) {
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')
      patientQuery = patientQuery
        .ilike('first_name', `%${firstName}%`)
        .ilike('last_name', `%${lastName}%`)
    } else {
      patientQuery = patientQuery
        .or(`first_name.ilike.%${entities.patientName}%,last_name.ilike.%${entities.patientName}%`)
    }

    const { data: patients, error } = await patientQuery.limit(1)

    if (error) throw error

    if (!patients || patients.length === 0) {
      return {
        agentName: 'Patient Inquiry AI',
        success: false,
        error: `Patient "${entities.patientName}" not found in the system`,
        processingTime: Date.now() - startTime
      }
    }

    const patient = patients[0]

    // Fetch related data separately
    const [consultations, treatments, appointments] = await Promise.all([
      supabase.schema('api').from('consultations').select('*').eq('patient_id', patient.id),
      supabase.schema('api').from('treatments').select('*').eq('patient_id', patient.id),
      supabase.schema('api').from('appointments').select('*').eq('patient_id', patient.id)
    ])

    const enrichedPatient = {
      ...patient,
      consultations: consultations.data || [],
      treatments: treatments.data || [],
      appointments: appointments.data || []
    }

    return {
      agentName: 'Patient Inquiry AI',
      success: true,
      data: enrichedPatient,
      processingTime: Date.now() - startTime
    }
  } catch (error) {
    console.error('❌ [PATIENT INQUIRY AGENT] Error:', error)
    return {
      agentName: 'Patient Inquiry AI',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Handle general questions using Gemini
 */
async function delegateToGeneralAI(
  userQuery: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('🤖 [GENERAL AI] Processing query...')

    const systemInstruction = `You are EndoFlow AI, a helpful assistant for dental professionals specializing in endodontics.

Provide clear, concise answers to general questions about:
- Dental procedures and protocols
- Endodontic terminology
- System usage and features
- Clinical best practices

Keep responses conversational and under 200 words unless more detail is requested.`

    const messages: GeminiChatMessage[] = []

    // Add conversation history
    if (conversationHistory) {
      conversationHistory.slice(-3).forEach((msg) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })
      })
    }

    // Add current query
    messages.push({
      role: 'user',
      parts: [{ text: userQuery }]
    })

    const response = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      systemInstruction
    })

    return {
      agentName: 'General AI',
      success: true,
      data: { response },
      processingTime: Date.now() - startTime
    }
  } catch (error) {
    console.error('❌ [GENERAL AI] Error:', error)
    return {
      agentName: 'General AI',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

// ============================================================================
// MASTER ORCHESTRATOR
// ============================================================================

/**
 * Main orchestration function - the "conductor" of all AI agents
 *
 * Flow:
 * 1. Classify user intent
 * 2. Route to appropriate specialized agent(s)
 * 3. Synthesize agent responses into natural language
 * 4. Return unified response with context
 */
export async function orchestrateQuery(params: {
  userQuery: string
  dentistId: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<OrchestratedResponse> {
  const { userQuery, dentistId, conversationHistory } = params

  console.log('🎭 [ENDOFLOW MASTER] Orchestrating query:', userQuery)

  try {
    // Step 1: Classify Intent
    const intent = await classifyIntent(userQuery, conversationHistory)

    // Step 2: Handle clarification requests
    if (intent.requiresClarification) {
      return {
        success: true,
        response: intent.clarificationQuestion || 'Could you please provide more details?',
        agentResponses: [],
        intent,
        suggestions: []
      }
    }

    // Step 3: Delegate to appropriate agent(s)
    let agentResponses: AgentResponse[] = []

    switch (intent.type) {
      case 'clinical_research':
        agentResponses.push(
          await delegateToClinicalResearch(userQuery, intent.entities, dentistId)
        )
        break

      case 'appointment_scheduling':
        agentResponses.push(
          await delegateToScheduler(userQuery, intent.entities, dentistId)
        )
        break

      case 'treatment_planning':
        agentResponses.push(
          await delegateToTreatmentPlanning(userQuery, intent.entities, dentistId)
        )
        break

      case 'patient_inquiry':
        agentResponses.push(
          await delegateToPatientInquiry(userQuery, intent.entities, dentistId)
        )
        break

      case 'general_question':
      default:
        agentResponses.push(
          await delegateToGeneralAI(userQuery, conversationHistory)
        )
        break
    }

    // Step 4: Synthesize natural language response
    const synthesizedResponse = await synthesizeResponse(
      userQuery,
      intent,
      agentResponses
    )

    // Step 5: Generate follow-up suggestions
    const suggestions = generateSuggestions(intent, agentResponses)

    console.log('✅ [ENDOFLOW MASTER] Orchestration complete')

    return {
      success: true,
      response: synthesizedResponse,
      agentResponses,
      intent,
      suggestions
    }

  } catch (error) {
    console.error('❌ [ENDOFLOW MASTER] Orchestration failed:', error)

    return {
      success: false,
      response: "I'm sorry, I encountered an error processing your request. Please try again.",
      agentResponses: [],
      intent: {
        type: 'general_question',
        confidence: 0,
        entities: {},
        requiresClarification: false
      },
      suggestions: []
    }
  }
}

// ============================================================================
// RESPONSE SYNTHESIS
// ============================================================================

/**
 * Synthesize natural language response from agent outputs
 */
async function synthesizeResponse(
  userQuery: string,
  intent: ClassifiedIntent,
  agentResponses: AgentResponse[]
): Promise<string> {

  // If any agent failed, handle gracefully
  const failedAgents = agentResponses.filter(r => !r.success)
  if (failedAgents.length > 0) {
    return failedAgents[0].error || "I couldn't process your request. Please try rephrasing."
  }

  const successfulResponses = agentResponses.filter(r => r.success)

  // Intent-specific synthesis
  switch (intent.type) {
    case 'clinical_research': {
      const data = successfulResponses[0]?.data
      if (data?.summary) {
        let response = data.summary

        if (data.insights && data.insights.length > 0) {
          response += '\n\n**Key Insights:**\n'
          data.insights.slice(0, 3).forEach((insight: string) => {
            response += `• ${insight}\n`
          })
        }

        if (data.recommendations && data.recommendations.length > 0) {
          response += '\n**Recommendations:**\n'
          data.recommendations.slice(0, 2).forEach((rec: string) => {
            response += `• ${rec}\n`
          })
        }

        return response
      }
      return 'I analyzed the patient data but found no specific results for your query.'
    }

    case 'appointment_scheduling': {
      const data = successfulResponses[0]?.data

      if (data?.query === 'schedule_view') {
        const appointments = data.appointments || []
        if (appointments.length === 0) {
          return "You have no upcoming appointments scheduled."
        }

        let response = `You have ${appointments.length} upcoming appointment${appointments.length > 1 ? 's' : ''}:\n\n`
        appointments.slice(0, 5).forEach((apt: any) => {
          const patientName = apt.patients
            ? `${apt.patients.first_name} ${apt.patients.last_name}`
            : 'Unknown Patient'
          response += `• ${patientName} - ${apt.scheduled_date} at ${apt.scheduled_time} (${apt.appointment_type})\n`
        })

        return response
      } else if (data?.success && data?.message) {
        return data.message
      }

      return 'Appointment processed successfully.'
    }

    case 'treatment_planning': {
      const data = successfulResponses[0]?.data
      if (data?.treatment && data?.reasoning) {
        let response = `**Recommended Treatment:** ${data.treatment}\n\n`
        response += `**Clinical Reasoning:** ${data.reasoning}\n`

        if (data.alternativeTreatments && data.alternativeTreatments.length > 0) {
          response += `\n**Alternatives:** ${data.alternativeTreatments.join(', ')}`
        }

        if (data.confidence) {
          response += `\n\n*Confidence: ${data.confidence}%*`
        }

        return response
      }
      return 'Treatment recommendation generated. Please review the detailed analysis.'
    }

    case 'patient_inquiry': {
      const patient = successfulResponses[0]?.data
      if (patient) {
        let response = `**Patient: ${patient.first_name} ${patient.last_name}**\n\n`
        response += `• Consultations: ${patient.consultations?.length || 0}\n`
        response += `• Treatments: ${patient.treatments?.length || 0}\n`
        response += `• Appointments: ${patient.appointments?.length || 0}\n`

        if (patient.medical_history_summary) {
          response += `\n**Medical History:** ${patient.medical_history_summary}`
        }

        return response
      }
      return 'Patient information retrieved.'
    }

    case 'general_question':
    default: {
      const data = successfulResponses[0]?.data
      return data?.response || "I'm here to help! What would you like to know?"
    }
  }
}

/**
 * Generate contextual follow-up suggestions
 */
function generateSuggestions(
  intent: ClassifiedIntent,
  agentResponses: AgentResponse[]
): string[] {
  const suggestions: string[] = []

  switch (intent.type) {
    case 'clinical_research':
      suggestions.push('Show statistical analysis')
      suggestions.push('Compare treatment outcomes')
      suggestions.push('Generate research report')
      break

    case 'appointment_scheduling':
      if (agentResponses[0]?.data?.query === 'schedule_view') {
        suggestions.push('Book a new appointment')
        suggestions.push('View next week\'s schedule')
      } else {
        suggestions.push('View today\'s schedule')
        suggestions.push('Reschedule this appointment')
      }
      break

    case 'treatment_planning':
      suggestions.push('View contraindications')
      suggestions.push('Show alternative treatments')
      suggestions.push('Find similar cases')
      break

    case 'patient_inquiry':
      suggestions.push('View recent consultations')
      suggestions.push('Schedule follow-up')
      suggestions.push('View treatment history')
      break

    case 'general_question':
      suggestions.push('Search patient database')
      suggestions.push('View today\'s schedule')
      break
  }

  return suggestions.slice(0, 3)
}
