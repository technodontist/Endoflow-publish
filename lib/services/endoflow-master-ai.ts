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
import { 
  parseTemporalExpression, 
  extractPatientName, 
  isCountQuery, 
  determineQueryDirection 
} from '@/lib/utils/temporal-parser'

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

LANGUAGE SUPPORT:
- The system supports English (US), English (India), and Hindi (हिंदी)
- User queries may be in English, Hindi, or a mix of both (code-switching)
- For Hindi queries: Understand the intent and extract entities, but respond in English
- For mixed Hindi-English queries: Process both languages and unify the intent
- Common Hindi medical terms: दांत (tooth), दर्द (pain), इलाज (treatment), मरीज़/रोगी (patient), अपॉइंटमेंट (appointment)

TASK: Classify the user's query into ONE of these categories:
1. clinical_research - Questions about patients, cohorts, statistics, diagnoses, treatments
2. appointment_inquiry - Viewing schedule, listing appointments, checking availability
   - Examples: "How many patients today?", "What's my schedule?", "Show appointments", "How many appointments tomorrow?", "Tell me about my upcoming patients"
3. appointment_booking - Creating/scheduling NEW appointments
   - Examples: "Schedule appointment for John", "Book RCT tomorrow", "Create appointment"
4. treatment_planning - Treatment suggestions, protocols, clinical recommendations
5. patient_inquiry - Specific patient information, history, records  
6. general_question - General dental questions, how-to queries
7. clarification_needed - Ambiguous query that needs more information

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
Output: {"type": "appointment_inquiry", "confidence": 0.95, "entities": {}, "requiresClarification": false}

Input: "आज के मरीज़ कितने हैं" (How many patients today)
Output: {"type": "appointment_inquiry", "confidence": 0.95, "entities": {}, "requiresClarification": false}

Input: "John के लिए कल appointment book करो" (Book appointment for John tomorrow)
Output: {"type": "appointment_booking", "confidence": 0.90, "entities": {"patientName": "John", "appointmentDate": "tomorrow"}, "requiresClarification": false}

Input: "How many patients do I have today in my appointment"
Output: {"type": "appointment_inquiry", "confidence": 0.95, "entities": {}, "requiresClarification": false}

Input: "Show me today's appointments"
Output: {"type": "appointment_inquiry", "confidence": 0.95, "entities": {}, "requiresClarification": false}

Input: "Tell me about my upcoming patients"
Output: {"type": "appointment_inquiry", "confidence": 0.95, "entities": {}, "requiresClarification": false}

Input: "How many appointments tomorrow on 14th October"
Output: {"type": "appointment_inquiry", "confidence": 0.95, "entities": {"appointmentDate": "2025-10-14"}, "requiresClarification": false}

Input: "Schedule RCT for John tomorrow at 2 PM"
Output: {"type": "appointment_booking", "confidence": 0.96, "entities": {"patientName": "John", "treatmentType": "RCT", "appointmentDate": "2025-10-10", "appointmentTime": "14:00"}, "requiresClarification": false}

Input: "Tell me about patient John's follow-up protocol"
Output: {"type": "patient_inquiry", "confidence": 0.85, "entities": {"patientName": "John"}, "requiresClarification": false}

Input: "What should I do for pulpitis on tooth 46"
Output: {"type": "treatment_planning", "confidence": 0.92, "entities": {"diagnosis": "pulpitis", "toothNumber": "46"}, "requiresClarification": false}

Input: "Schedule appointment"
Output: {"type": "appointment_booking", "confidence": 0.70, "entities": {}, "requiresClarification": true, "clarificationQuestion": "Sure! I can help schedule an appointment. Could you please tell me: 1) Patient name, 2) Date and time, and 3) Type of appointment (consultation, treatment, follow-up)?"}
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
// CONTEXT EXTRACTION & MANAGEMENT
// ============================================================================

interface ConversationContext {
  lastPatientName?: string
  lastToothNumber?: string
  lastDiagnosis?: string
  lastTreatmentType?: string
  lastAppointmentDetails?: any
  recentEntities: string[]
}

/**
 * Extract key entities from conversation history to maintain context
 */
function extractConversationContext(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): ConversationContext {
  const context: ConversationContext = {
    recentEntities: []
  }

  if (!conversationHistory || conversationHistory.length === 0) {
    return context
  }

  // Analyze last 5 messages to extract entities
  const recentMessages = conversationHistory.slice(-5)
  
  for (const msg of recentMessages) {
    const content = msg.content.toLowerCase()
    
    // Extract patient names (look for capitalized full names)
    const nameMatches = msg.content.match(/\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g)
    if (nameMatches && nameMatches.length > 0) {
      context.lastPatientName = nameMatches[nameMatches.length - 1]
      context.recentEntities.push(context.lastPatientName)
    }
    
    // Extract tooth numbers (FDI notation: 11-48)
    const toothMatches = content.match(/\btooth\s+(\d{2})\b|\b(\d{2})\s+tooth\b/gi)
    if (toothMatches) {
      const toothNum = toothMatches[toothMatches.length - 1].match(/\d{2}/)
      if (toothNum) {
        context.lastToothNumber = toothNum[0]
        context.recentEntities.push(`tooth ${toothNum[0]}`)
      }
    }
    
    // Extract common diagnoses
    const diagnosisKeywords = ['pulpitis', 'periodontitis', 'abscess', 'caries', 'necrosis']
    for (const keyword of diagnosisKeywords) {
      if (content.includes(keyword)) {
        context.lastDiagnosis = keyword
        context.recentEntities.push(keyword)
        break
      }
    }
    
    // Extract treatment types
    const treatmentKeywords = ['rct', 'root canal', 'extraction', 'filling', 'crown', 'pulpotomy']
    for (const keyword of treatmentKeywords) {
      if (content.includes(keyword)) {
        context.lastTreatmentType = keyword
        context.recentEntities.push(keyword)
        break
      }
    }
    
    // Extract appointment information if present
    if (content.includes('tomorrow') || content.includes('today') || content.includes('scheduled')) {
      context.lastAppointmentDetails = {
        mentioned: true,
        timeframe: content.includes('tomorrow') ? 'tomorrow' : content.includes('today') ? 'today' : 'scheduled'
      }
    }
  }
  
  return context
}

// ============================================================================
// CONTEXT ENHANCEMENT HELPER
// ============================================================================

/**
 * Enhance user query with conversation context
 * Resolves pronouns, implicit references, and incomplete information
 */
async function enhanceQueryWithContext(
  userQuery: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  extractedContext?: ConversationContext
): Promise<string> {
  
  // If no history or query seems complete, return as-is
  if (!conversationHistory || conversationHistory.length === 0) {
    return userQuery
  }

  // Build context string from last 3 messages
  const contextString = conversationHistory
    .slice(-3)
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n')

  // Add extracted entities to context if available
  let entityContext = ''
  if (extractedContext && extractedContext.recentEntities.length > 0) {
    entityContext = `\n\nKEY ENTITIES FROM CONVERSATION: ${extractedContext.recentEntities.join(', ')}`
    if (extractedContext.lastPatientName) {
      entityContext += `\nLast mentioned patient: ${extractedContext.lastPatientName}`
    }
    if (extractedContext.lastToothNumber) {
      entityContext += `\nLast mentioned tooth: ${extractedContext.lastToothNumber}`
    }
    if (extractedContext.lastTreatmentType) {
      entityContext += `\nLast mentioned treatment: ${extractedContext.lastTreatmentType}`
    }
  }

  const systemInstruction = `You are a query enhancement system for a dental clinic AI assistant.

TASK: Given a user query and conversation history, enhance the query by:
1. Resolving pronouns ("him", "her", "them", "it") to actual names/entities
2. Completing implicit references ("the patient", "that tooth") with specific details
3. Filling in missing information that can be inferred from context

OUTPUT: Return ONLY the enhanced query as plain text. No explanations, no JSON, just the enhanced query.

EXAMPLES:

History: "User: Find patients with RCT on tooth 36\nAssistant: Found 5 patients: John Doe, Maria Garcia, Sarah Johnson, David Lee, Lisa Chen"
Query: "Name them in detail"
Enhanced: "Provide detailed information about patients John Doe, Maria Garcia, Sarah Johnson, David Lee, and Lisa Chen who had RCT on tooth 36"

History: "User: Tell me about patient John Doe\nAssistant: John Doe is 42 years old, male, has had 5 consultations..."
Query: "Schedule RCT for him tomorrow at 2 PM"
Enhanced: "Schedule RCT appointment for patient John Doe tomorrow at 2 PM"

History: "User: How many RCT treatments last month?\nAssistant: You performed 12 RCT treatments last month"
Query: "Who were the patients?"
Enhanced: "List the patient names for the 12 RCT treatments performed last month"

If the query is already complete and doesn't need context, return it unchanged.`

  const prompt = `CONVERSATION HISTORY:\n${contextString}${entityContext}\n\nCURRENT QUERY: ${userQuery}\n\nEnhanced query:`

  const messages: GeminiChatMessage[] = [
    { role: 'user', parts: [{ text: prompt }] }
  ]

  try {
    const enhanced = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.2, // Low temperature for consistent enhancement
      systemInstruction
    })

    const enhancedQuery = enhanced.trim()
    
    // Only use enhanced version if it's different and meaningful
    if (enhancedQuery && enhancedQuery.length > userQuery.length * 0.8) {
      console.log('📝 [CONTEXT ENHANCEMENT] Original:', userQuery)
      console.log('📝 [CONTEXT ENHANCEMENT] Enhanced:', enhancedQuery)
      return enhancedQuery
    }
    
    return userQuery
  } catch (error) {
    console.error('❌ [CONTEXT ENHANCEMENT] Failed:', error)
    return userQuery // Fallback to original query
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
  dentistId: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('🔬 [CLINICAL RESEARCH AGENT] Processing query...')

    // Extract context from conversation history
    const extractedContext = conversationHistory ? extractConversationContext(conversationHistory) : undefined
    
    // Enhance query with conversation context
    let enhancedQuery = userQuery
    if (conversationHistory && conversationHistory.length > 0) {
      enhancedQuery = await enhanceQueryWithContext(userQuery, conversationHistory, extractedContext)
    }

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

    // Use Gemini to analyze the cohort with enriched data (use enhanced query)
    const analysis = await analyzePatientCohort({
      cohortData: enrichedPatients || [],
      query: enhancedQuery // Use context-enhanced query
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
 * Delegate to Appointment Inquiry Agent (View Schedule)
 * Enhanced with:
 * - Advanced temporal parsing (October, last month, Q4, etc.)
 * - Patient name filtering
 * - Historical data support (past appointments)
 * - Statistical summaries (count queries)
 */
async function delegateToAppointmentInquiry(
  userQuery: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('📅 [APPOINTMENT INQUIRY AGENT] Processing query...')

    // Extract context from conversation history
    const extractedContext = conversationHistory ? extractConversationContext(conversationHistory) : undefined
    
    // Enhance query with conversation context
    let enhancedQuery = userQuery
    if (conversationHistory && conversationHistory.length > 0) {
      enhancedQuery = await enhanceQueryWithContext(userQuery, conversationHistory, extractedContext)
    }

    const supabase = await createServiceClient()
    
    // === NEW: Advanced temporal parsing ===
    let startDate: string
    let endDate: string | undefined
    let temporalExpression: string | undefined
    
    // Try advanced temporal parser first
    const dateRange = await parseTemporalExpression(enhancedQuery)
    
    if (dateRange) {
      // ✅ Advanced parser succeeded
      startDate = dateRange.startDate
      endDate = dateRange.endDate
      temporalExpression = dateRange.originalExpression
      console.log(`📅 [APPOINTMENT INQUIRY] Parsed temporal expression: "${temporalExpression}" → ${startDate} to ${endDate}`)
    } else {
      // ✅ Fallback to original logic (backward compatible)
      startDate = new Date().toISOString().split('T')[0]
      
      if (enhancedQuery.toLowerCase().includes('today')) {
        endDate = startDate
        temporalExpression = 'today'
      } else if (enhancedQuery.toLowerCase().includes('tomorrow')) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        startDate = tomorrow.toISOString().split('T')[0]
        endDate = startDate
        temporalExpression = 'tomorrow'
      } else if (enhancedQuery.toLowerCase().includes('upcoming') || enhancedQuery.toLowerCase().includes('next')) {
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        endDate = nextWeek.toISOString().split('T')[0]
        temporalExpression = 'upcoming'
      } else if (entities.appointmentDate) {
        startDate = entities.appointmentDate
        endDate = entities.appointmentDate
        temporalExpression = entities.appointmentDate
      }
      
      console.log(`📅 [APPOINTMENT INQUIRY] Using fallback date logic: ${startDate} to ${endDate || 'indefinite'}`)
    }

    // === NEW: Patient name filtering ===
    let patientName = entities.patientName || extractPatientName(enhancedQuery)
    let patientId: string | undefined
    
    if (patientName) {
      console.log(`👤 [APPOINTMENT INQUIRY] Filtering by patient: ${patientName}`)
      
      // Search for patient
      const nameParts = patientName.split(' ')
      let patientQuery = supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name')
      
      if (nameParts.length >= 2) {
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ')
        patientQuery = patientQuery
          .ilike('first_name', `%${firstName}%`)
          .ilike('last_name', `%${lastName}%`)
      } else {
        patientQuery = patientQuery
          .or(`first_name.ilike.%${patientName}%,last_name.ilike.%${patientName}%`)
      }
      
      const { data: patients } = await patientQuery.limit(1)
      
      if (patients && patients.length > 0) {
        patientId = patients[0].id
        patientName = `${patients[0].first_name} ${patients[0].last_name}`
        console.log(`✅ [APPOINTMENT INQUIRY] Found patient: ${patientName} (${patientId})`)
      } else {
        console.log(`⚠️ [APPOINTMENT INQUIRY] Patient "${patientName}" not found`)
      }
    }

    // === NEW: Determine query direction (past/future/all) ===
    const queryDirection = determineQueryDirection(enhancedQuery)
    console.log(`🔄 [APPOINTMENT INQUIRY] Query direction: ${queryDirection}`)

    // Build query with filters
    console.log(`📅 [APPOINTMENT INQUIRY] Fetching appointments from ${startDate} to ${endDate || 'indefinite'}`)

    let query = supabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('dentist_id', dentistId)
    
    // Apply patient filter if specified
    if (patientId) {
      query = query.eq('patient_id', patientId)
    }
    
    // Apply date filters based on direction
    if (queryDirection === 'past') {
      // Past appointments: date <= endDate
      query = query.lte('scheduled_date', endDate || startDate)
      if (startDate) {
        query = query.gte('scheduled_date', startDate)
      }
      query = query.order('scheduled_date', { ascending: false }) // Most recent first
    } else if (queryDirection === 'future') {
      // Future appointments: date >= startDate
      query = query.gte('scheduled_date', startDate)
      if (endDate) {
        query = query.lte('scheduled_date', endDate)
      }
      query = query.order('scheduled_date', { ascending: true }) // Soonest first
    } else {
      // All appointments in range
      query = query.gte('scheduled_date', startDate)
      if (endDate) {
        query = query.lte('scheduled_date', endDate)
      }
      query = query.order('scheduled_date', { ascending: true })
    }
    
    query = query.order('scheduled_time').limit(50) // Increased limit from 20 to 50

    const { data: appointments, error } = await query

    if (error) throw error

    // Enrich with patient data (if not already filtered by patient)
    let enrichedAppointments = appointments || []
    if (appointments && appointments.length > 0 && !patientId) {
      const patientIds = [...new Set(appointments.map(apt => apt.patient_id).filter(Boolean))]

      const { data: patients } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name, phone, email')
        .in('id', patientIds)

      if (patients) {
        const patientMap = new Map(patients.map(p => [p.id, p]))
        enrichedAppointments = appointments.map(apt => ({
          ...apt,
          patients: apt.patient_id ? patientMap.get(apt.patient_id) : null
        }))
      }
    } else if (appointments && appointments.length > 0 && patientId) {
      // Already filtered by patient, just add patient data
      enrichedAppointments = appointments.map(apt => ({
        ...apt,
        patients: patientName ? { first_name: patientName.split(' ')[0], last_name: patientName.split(' ').slice(1).join(' ') } : null
      }))
    }

    console.log(`✅ [APPOINTMENT INQUIRY] Found ${enrichedAppointments.length} appointments`)

    // === NEW: Statistical summary for count queries ===
    const isStatisticalQuery = isCountQuery(enhancedQuery)
    let statistics: any = undefined
    
    if (isStatisticalQuery) {
      statistics = {
        total: enrichedAppointments.length,
        byType: enrichedAppointments.reduce((acc, apt) => {
          const type = apt.appointment_type || 'Unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        byStatus: enrichedAppointments.reduce((acc, apt) => {
          const status = apt.status || 'Unknown'
          acc[status] = (acc[status] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        dateRange: {
          start: startDate,
          end: endDate,
          expression: temporalExpression
        }
      }
      
      console.log('📊 [APPOINTMENT INQUIRY] Statistical summary:', statistics)
    }

    return {
      agentName: 'Appointment Inquiry AI',
      success: true,
      data: { 
        appointments: enrichedAppointments, 
        query: 'appointment_inquiry',
        dateRange: { start: startDate, end: endDate, expression: temporalExpression },
        patientFilter: patientName || undefined,
        queryDirection,
        statistics: isStatisticalQuery ? statistics : undefined
      },
      processingTime: Date.now() - startTime
    }
  } catch (error) {
    console.error('❌ [APPOINTMENT INQUIRY AGENT] Error:', error)
    return {
      agentName: 'Appointment Inquiry AI',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Delegate to Appointment Scheduler AI Agent (Create/Book Appointment)
 */
async function delegateToScheduler(
  userQuery: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('📅 [SCHEDULER AGENT] Processing query...')

    // Extract context from conversation history
    const extractedContext = conversationHistory ? extractConversationContext(conversationHistory) : undefined
    
    // Enhance query with conversation context
    let enhancedQuery = userQuery
    if (conversationHistory && conversationHistory.length > 0) {
      enhancedQuery = await enhanceQueryWithContext(userQuery, conversationHistory, extractedContext)
    }

    // Check if this is a booking request (schedule, book, create appointment)
    const isBookingRequest =
      userQuery.toLowerCase().includes('book') ||
      userQuery.toLowerCase().includes('create appointment') ||
      userQuery.toLowerCase().includes('schedule appointment') ||
      userQuery.toLowerCase().includes('set up appointment') ||
      userQuery.toLowerCase().includes('make appointment')

    // Check if this is a schedule query (view schedule, my schedule, today's appointments)
    const isScheduleQuery =
      userQuery.toLowerCase().includes('my schedule') ||
      userQuery.toLowerCase().includes('today\'s schedule') ||
      userQuery.toLowerCase().includes('show schedule') ||
      userQuery.toLowerCase().includes('view schedule') ||
      userQuery.toLowerCase().includes('what\'s my schedule') ||
      userQuery.toLowerCase().includes('how many patients') ||
      userQuery.toLowerCase().includes('how many appointments') ||  // NEW - specifically for appointment count queries
      userQuery.toLowerCase().includes('today\'s appointments') ||
      userQuery.toLowerCase().includes('today appointment') ||
      userQuery.toLowerCase().includes('today in my appointment') ||
      userQuery.toLowerCase().includes('appointments today') ||
      (userQuery.toLowerCase().includes('count') && userQuery.toLowerCase().includes('appointment')) ||
      (userQuery.toLowerCase().includes('list') && userQuery.toLowerCase().includes('appointment')) ||
      (userQuery.toLowerCase().includes('how many') && userQuery.toLowerCase().includes('today'))

    console.log('🔍 [SCHEDULER AGENT] Query analysis:', { isBookingRequest, isScheduleQuery, query: userQuery })

    if (isBookingRequest) {
      // Attempt to create appointment - let scheduleAppointmentWithAI handle validation
      console.log('🎯 [SCHEDULER AGENT] Detected booking request, calling AI scheduler...')
      const result = await scheduleAppointmentWithAI(enhancedQuery, dentistId)

      return {
        agentName: 'Appointment Scheduler AI',
        success: result.success,
        data: result,
        error: result.error,
        processingTime: Date.now() - startTime
      }
    } else if (isScheduleQuery) {
      // Query schedule - fetch appointments and patients separately
      console.log('📅 [SCHEDULER AGENT] Detected schedule query, fetching appointments...')
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
    } else {
      // Fallback: Unclear intent - attempt to book anyway
      console.log('⚠️ [SCHEDULER AGENT] Unclear intent, attempting AI scheduler as fallback...')
      const result = await scheduleAppointmentWithAI(enhancedQuery, dentistId)

      return {
        agentName: 'Appointment Scheduler AI',
        success: result.success,
        data: result,
        error: result.error,
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
  dentistId: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('💊 [TREATMENT PLANNING AGENT] Processing query...')

    // Extract context from conversation history
    const extractedContext = conversationHistory ? extractConversationContext(conversationHistory) : undefined
    
    // Enhance query with conversation context
    let enhancedQuery = userQuery
    if (conversationHistory && conversationHistory.length > 0) {
      enhancedQuery = await enhanceQueryWithContext(userQuery, conversationHistory, extractedContext)
    }

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
  dentistId: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('👤 [PATIENT INQUIRY AGENT] Processing query...')

    // Extract context from conversation history
    const extractedContext = conversationHistory ? extractConversationContext(conversationHistory) : undefined
    
    // Enhance query with conversation context
    let enhancedQuery = userQuery
    if (conversationHistory && conversationHistory.length > 0) {
      enhancedQuery = await enhanceQueryWithContext(userQuery, conversationHistory, extractedContext)
    }
    
    // If no patient name in entities but we have one from context, use it
    if (!entities.patientName && extractedContext?.lastPatientName) {
      console.log('📝 [PATIENT INQUIRY] Using patient name from context:', extractedContext.lastPatientName)
      entities.patientName = extractedContext.lastPatientName
    }

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
// TOPIC CHANGE DETECTION
// ============================================================================

/**
 * Detect if the current query represents a new topic requiring fresh context
 * Uses both explicit phrase detection and AI-powered semantic analysis
 */
async function detectTopicChange(
  userQuery: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<boolean> {
  
  // If no history, it's a new conversation
  if (!conversationHistory || conversationHistory.length === 0) {
    console.log('🆕 [TOPIC CHANGE] No history - new conversation')
    return true
  }

  // Explicit topic change phrases - user is clearly changing subject
  const topicChangePhrases = [
    'new question',
    'different topic',
    'different question',
    'by the way',
    'btw',
    'changing topic',
    'change topic',
    'let me ask something else',
    'let me ask about',
    'unrelated question',
    'on another note',
    'on a different note',
    'forget that',
    'never mind',
    'start over',
    'new topic',
    'different subject',
    'moving on',
    'let\'s start a new chat',
    'new conversation',
    'new chat',  // Added to detect "new chat" phrase
    'start fresh'
  ]
  
  // Context continuation indicators - these suggest follow-up questions
  const continuationIndicators = [
    'what about',
    'how about',
    'and',
    'also',
    'what treatment',
    'which tooth',
    'tell me about',
    'show me',
    'can you find',
    'tooth number',
    'patient'
  ]

  const queryLower = userQuery.toLowerCase()
  
  // Check for explicit topic change phrases
  for (const phrase of topicChangePhrases) {
    if (queryLower.includes(phrase)) {
      console.log(`🔄 [TOPIC CHANGE] Explicit phrase detected: "${phrase}"`)
      return true
    }
  }
  
  // Check for continuation indicators - if present, likely a follow-up
  for (const indicator of continuationIndicators) {
    if (queryLower.includes(indicator)) {
      console.log(`➡️ [TOPIC CHANGE] Continuation indicator found: "${indicator}" - treating as follow-up`)
      return false
    }
  }
  
  // Extract context entities to check if query references them
  const extractedContext = extractConversationContext(conversationHistory)
  
  // Check if current query mentions any recent entities
  const mentionsRecentEntity = extractedContext.recentEntities.some(entity => 
    queryLower.includes(entity.toLowerCase())
  )
  
  if (mentionsRecentEntity) {
    console.log('🔗 [TOPIC CHANGE] Query references recent entity - treating as follow-up')
    return false
  }
  
  // Short queries (< 10 words) are likely follow-ups unless explicitly changing topic
  const wordCount = userQuery.trim().split(/\s+/).length
  if (wordCount <= 10 && !queryLower.includes('new')) {
    console.log(`📏 [TOPIC CHANGE] Short query (${wordCount} words) - likely follow-up`)
    return false
  }

  // Get the last assistant message for semantic comparison
  const lastAssistantMessage = [...conversationHistory]
    .reverse()
    .find(msg => msg.role === 'assistant')

  if (!lastAssistantMessage) {
    console.log('ℹ️ [TOPIC CHANGE] No previous assistant message - continuing')
    return false
  }

  // Use Gemini AI to detect semantic topic changes
  try {
    const systemInstruction = `You are a topic change detector for a dental clinic AI assistant.

TASK: Determine if the new user query is:
1. A FOLLOW-UP to the previous conversation (same topic/context)
2. A NEW TOPIC (different subject/unrelated question)

CONSIDER:
- Follow-ups often use pronouns ("them", "him", "it"), short references ("name them", "book it")
- Follow-ups continue the same subject (asking for more details, clarification)
- New topics introduce completely different subjects
- Questions about schedule, treatments, patients CAN be follow-ups if related to previous context

OUTPUT: Respond with ONLY "FOLLOW_UP" or "NEW_TOPIC" (one word only)`

    // Truncate long messages for efficiency
    const previousContext = lastAssistantMessage.content.substring(0, 300)
    const hasMore = lastAssistantMessage.content.length > 300
    
    const prompt = `Previous AI response: "${previousContext}${hasMore ? '...' : ''}"

New user query: "${userQuery}"

Is this a follow-up to the previous topic or a new topic?`

    const messages: GeminiChatMessage[] = [
      { role: 'user', parts: [{ text: prompt }] }
    ]

    const response = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.1, // Low temperature for consistent detection
      systemInstruction
    })

    const result = response.trim().toUpperCase()
    const isNewTopic = result.includes('NEW_TOPIC') || result.includes('NEW TOPIC')
    
    console.log(`🧠 [TOPIC CHANGE] AI Detection: ${isNewTopic ? 'NEW TOPIC' : 'FOLLOW-UP'}`)
    console.log(`   Previous: "${previousContext.substring(0, 60)}..."`)
    console.log(`   Current: "${userQuery}"`)
    
    return isNewTopic
  } catch (error) {
    console.error('❌ [TOPIC CHANGE] AI detection failed:', error)
    // Fallback: assume follow-up (safer to maintain context on error)
    return false
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
    // Step 0: Detect topic changes
    const isNewTopic = await detectTopicChange(userQuery, conversationHistory)
    
    // If new topic detected, clear conversation context for fresh start
    const effectiveHistory = isNewTopic ? [] : conversationHistory
    
    if (isNewTopic && conversationHistory && conversationHistory.length > 0) {
      console.log('🆕 [ENDOFLOW MASTER] Topic change detected - starting fresh context')
    }

    // Step 1: Classify Intent (with effective history)
    const intent = await classifyIntent(userQuery, effectiveHistory)

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
          await delegateToClinicalResearch(userQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'appointment_inquiry':
        // View schedule, list appointments
        agentResponses.push(
          await delegateToAppointmentInquiry(userQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'appointment_booking':
        // Create/schedule new appointment
        agentResponses.push(
          await delegateToScheduler(userQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'treatment_planning':
        agentResponses.push(
          await delegateToTreatmentPlanning(userQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'patient_inquiry':
        agentResponses.push(
          await delegateToPatientInquiry(userQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'general_question':
      default:
        agentResponses.push(
          await delegateToGeneralAI(userQuery, effectiveHistory)
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
 * 
 * Note: Responses are always in English, even if the query was in Hindi or mixed language.
 * This ensures consistency and readability in the UI.
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

    case 'appointment_inquiry': {
      const data = successfulResponses[0]?.data
      const appointments = data?.appointments || []
      const dateRange = data?.dateRange
      const patientFilter = data?.patientFilter
      const statistics = data?.statistics
      const queryDirection = data?.queryDirection
      
      // Build context-aware opening
      let contextPhrase = ''
      if (dateRange?.expression) {
        contextPhrase = ` for ${dateRange.expression}`
      } else if (dateRange?.start && dateRange?.end) {
        if (dateRange.start === dateRange.end) {
          contextPhrase = ` on ${dateRange.start}`
        } else {
          contextPhrase = ` from ${dateRange.start} to ${dateRange.end}`
        }
      }
      
      if (patientFilter) {
        contextPhrase += ` for patient ${patientFilter}`
      }
      
      // Handle empty results
      if (appointments.length === 0) {
        if (queryDirection === 'past') {
          return `You had no appointments${contextPhrase}.`
        } else if (queryDirection === 'future') {
          return `You have no upcoming appointments${contextPhrase}.`
        }
        return `You have no appointments scheduled${contextPhrase}.`
      }

      // If statistical query, provide count-focused response
      if (statistics) {
        let response = `You ${queryDirection === 'past' ? 'had' : 'have'} **${statistics.total}** appointment${statistics.total > 1 ? 's' : ''}${contextPhrase}.`
        
        // Add breakdown by type if multiple types
        if (Object.keys(statistics.byType).length > 1) {
          response += '\n\n**Breakdown by type:**\n'
          Object.entries(statistics.byType).forEach(([type, count]) => {
            response += `• ${type}: ${count}\n`
          })
        }
        
        // Add appointment list summary (first 5)
        if (appointments.length <= 5) {
          response += '\n**Appointments:**\n'
          appointments.forEach((apt: any, idx: number) => {
            const patientName = apt.patients
              ? `${apt.patients.first_name} ${apt.patients.last_name}`
              : 'Unknown Patient'
            response += `${idx + 1}. ${patientName} - ${apt.scheduled_date} at ${apt.scheduled_time} (${apt.appointment_type || 'Consultation'})\n`
          })
        } else {
          response += '\n**Sample appointments:**\n'
          appointments.slice(0, 5).forEach((apt: any, idx: number) => {
            const patientName = apt.patients
              ? `${apt.patients.first_name} ${apt.patients.last_name}`
              : 'Unknown Patient'
            response += `${idx + 1}. ${patientName} - ${apt.scheduled_date} at ${apt.scheduled_time}\n`
          })
          response += `\n*Showing 5 of ${appointments.length} appointments*`
        }
        
        return response.trim()
      }

      // Standard detailed list response
      let response = `You ${queryDirection === 'past' ? 'had' : 'have'} ${appointments.length} appointment${appointments.length > 1 ? 's' : ''}${contextPhrase}:\n\n`
      
      appointments.slice(0, 15).forEach((apt: any, idx: number) => {
        const patientName = apt.patients
          ? `${apt.patients.first_name} ${apt.patients.last_name}`
          : 'Unknown Patient'
        response += `${idx + 1}. **${patientName}** - ${apt.scheduled_date} at ${apt.scheduled_time}\n`
        response += `   Type: ${apt.appointment_type || 'Consultation'}`
        
        if (apt.status) {
          response += ` | Status: ${apt.status}`
        }
        
        response += '\n'
        
        if (apt.notes) {
          response += `   Notes: ${apt.notes}\n`
        }
        response += '\n'
      })

      if (appointments.length > 15) {
        response += `\n*... and ${appointments.length - 15} more appointment${appointments.length - 15 > 1 ? 's' : ''}*`
      }

      return response.trim()
    }

    case 'appointment_booking': {
      const data = successfulResponses[0]?.data
      
      if (data?.success && data?.message) {
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

    case 'appointment_inquiry':
      suggestions.push('View next week\'s schedule')
      suggestions.push('Book a new appointment')
      suggestions.push('Show patient details')
      break

    case 'appointment_booking':
      suggestions.push('View today\'s schedule')
      suggestions.push('Reschedule this appointment')
      suggestions.push('Book another appointment')
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
