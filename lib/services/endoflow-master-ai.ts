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

import { GeminiChatMessage } from './gemini-ai'
import { aiChatCompletion } from './ai-provider'
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
import { refineVoiceQuery, type RefinedQuery } from './prompt-refinement-agent'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type IntentType =
  | 'navigation'             // "Go to clinical mode", "Open patients", "Go home"
  | 'consultation_start'     // "Start consultation with X", "Open consultation", "Let's begin"
  | 'consultation_stop'      // "Stop recording", "Done", "Process it", "We're done"
  | 'recording_control'      // "Pause", "Resume", "Read back findings"
  | 'patient_lookup'         // "Tell me about X", "What's X's status", "Show patient X"
  | 'appointment_view'       // "Show schedule", "How many patients today"
  | 'appointment_book'       // "Book appointment for X tomorrow", "Schedule RCT"
  | 'clinical_question'      // "What's the protocol for X", "How to treat Y", clinical research
  | 'task_command'           // "Create task", "Tell assistant to X", "Show pending tasks"
  | 'report_command'         // "Generate report", "Create PDF", "Download report"
  | 'tooth_command'          // "Select tooth 46", "Accept diagnosis", "Reject"
  | 'general_question'       // Anything else
  // Legacy aliases (kept for backward compatibility with existing delegate functions)
  | 'clinical_research'
  | 'appointment_scheduling'
  | 'appointment_inquiry'
  | 'appointment_booking'
  | 'treatment_planning'
  | 'patient_inquiry'
  | 'task_management'
  | 'patient_status'
  | 'generate_report'
  | 'clarification_needed'
  | 'tooth_selection'
  | 'diagnosis_action'
  | 'gap_interaction'
  | 'task_creation'

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
    // Session 10: Navigation & consultation entities
    targetMode?: 'home' | 'clinical' | 'pms' | 'research' | 'management'
    targetTab?: string
    consultationAction?: 'start_recording' | 'stop_recording' | 'open' | 'close'
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
// INTENT NORMALIZATION (Session 14)
// ============================================================================

/**
 * Map legacy intent names to the canonical 12 intents.
 * The classifier prompt examples still produce old names (appointment_inquiry,
 * patient_inquiry, etc.) which fall through the switch/case to general_question.
 * This normalizer ensures every response maps to a canonical case.
 */
const INTENT_ALIAS_MAP: Record<string, IntentType> = {
  // Canonical 12 (pass through)
  'navigation': 'navigation',
  'consultation_start': 'consultation_start',
  'consultation_stop': 'consultation_stop',
  'recording_control': 'recording_control',
  'patient_lookup': 'patient_lookup',
  'appointment_view': 'appointment_view',
  'appointment_book': 'appointment_book',
  'clinical_question': 'clinical_question',
  'task_command': 'task_command',
  'report_command': 'report_command',
  'tooth_command': 'tooth_command',
  'general_question': 'general_question',
  // Legacy aliases → canonical
  'clinical_research': 'clinical_question',
  'appointment_inquiry': 'appointment_view',
  'appointment_scheduling': 'appointment_book',
  'appointment_booking': 'appointment_book',
  'treatment_planning': 'clinical_question',
  'patient_inquiry': 'patient_lookup',
  'patient_status': 'patient_lookup',
  'task_management': 'task_command',
  'task_creation': 'task_command',
  'generate_report': 'report_command',
  'tooth_selection': 'tooth_command',
  'diagnosis_action': 'tooth_command',
  'gap_interaction': 'clinical_question',
  'clarification_needed': 'general_question',
}

function normalizeIntentType(raw: string): IntentType {
  const normalized = INTENT_ALIAS_MAP[raw]
  if (normalized) return normalized
  console.warn(`⚠️ [INTENT NORM] Unknown intent type "${raw}", falling back to general_question`)
  return 'general_question'
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

  const systemInstruction = `You are the intent classification system for EndoFlow, a dental clinic AI assistant used by dentists during clinical practice.

CRITICAL CONTEXT:
- You serve DENTISTS in a clinical setting. They speak quickly, use shorthand, and may use voice input that garbles words.
- The user is ALWAYS a dentist. Every query relates to their clinical practice, patients, schedule, or clinic management.
- VOICE INPUT WARNING: Input may come from speech-to-text which often mishears dental terms:
  * "pull py this" → "pulpitis", "root can all" → "root canal", "end oh" → "endo"
  * "did headline" → "details", "pear e oh" → "perio", "crown and bridge" may appear garbled
  * Always try to interpret the INTENDED meaning, not the literal garbled text
  * When in doubt, assume a dental/clinical context

LANGUAGE SUPPORT:
- English (US), English (India), Hindi (हिंदी), and mixed Hindi-English (code-switching)
- Common Hindi: दांत (tooth), दर्द (pain), इलाज (treatment), मरीज़/रोगी (patient), अपॉइंटमेंट (appointment)

DENTAL SHORTHAND (common abbreviations dentists use):
- RCT = Root Canal Treatment, endo = endodontics, perio = periodontics
- FDI numbers: 11-48 are tooth numbers (e.g., "36" = lower left first molar)
- VPT = Vital Pulp Therapy, MTA = Mineral Trioxide Aggregate
- OPG = Orthopantomogram, IOPA = Intraoral Periapical (x-ray)
- Tx = Treatment, Dx = Diagnosis, Rx = Prescription, Hx = History
- F/U = Follow-up, N/S = No-show, WI = Walk-in

TASK: Classify the query into ONE of these 12 categories:

1. navigation - Navigate to a dashboard mode or section. NO patient data involved.
   - Examples: "Go to home", "Open clinical", "Go to patients", "Open research", "Manage clinic"
   - Hindi: "Patients dikhao", "Research kholo"
   - targetMode: home/clinical/pms/research/management

2. consultation_start - Start consultation with a patient. Implies clinical mode + recording.
   - Examples: "Start consultation with Sharma", "Open consultation", "Let's see the patient", "Begin my case", "Shuru karo"
   - ALWAYS extract patientName when present
   - Voice garbles: "start consolation" → "start consultation", "Pupatlal" → patient name (NOT dental term)

3. consultation_stop - Stop/finish active consultation. Triggers AI pipeline.
   - Examples: "Stop recording", "Done", "That's all", "Process it", "We're done", "Khatam", "Finish", "Bas"

4. recording_control - Pause, resume, or read back during recording.
   - Examples: "Pause", "Hold on", "Ruko", "Resume", "Continue", "Read back", "What do we have so far"

5. patient_lookup - Any question about a specific patient (history, status, records, progress).
   - Examples: "Tell me about Sharma", "What's Patel's status?", "Show patient records", "How is treatment going?"
   - Combines old patient_inquiry + patient_status into one intent

6. appointment_view - View schedule, list appointments, check availability.
   - Examples: "Show today's schedule", "How many patients?", "Next patient", "Kitne patients hain?"

7. appointment_book - Create/schedule a NEW appointment.
   - Examples: "Book appointment for John tomorrow at 2pm", "Schedule RCT next week"

8. clinical_question - Dental knowledge, treatment protocols, clinical research, "how to treat X".
   - Examples: "What's the protocol for pulpitis?", "How to do pulpotomy?", "Best material for VPT?"
   - Also covers: "Find patients with RCT on tooth 36" (data queries)

9. task_command - Create, assign, or view tasks for assistants.
   - Examples: "Create task prepare crown", "Tell Priya to ready the tray", "Show pending tasks"

10. report_command - Generate or download a report/PDF.
    - Examples: "Generate report", "Create PDF", "Download report"

11. tooth_command - Select a tooth on the chart, or accept/reject AI diagnosis.
    - Examples: "Select tooth 46", "Open tooth 36", "Accept diagnosis", "Reject", "That looks right"

12. general_question - Anything that doesn't fit the above categories.

IMPORTANT RULES:
- PREFER a specific category over general_question. If it could be clinical_question OR general_question, choose clinical_question.
- Set confidence HIGH (0.85+) when the intent is clear, even if voice has typos.
- The dentist speaks quickly and may say things many ways. Be FLEXIBLE with phrasing.
- "Start consultation with X" is ALWAYS consultation_start, never navigation.
- "What's my schedule" is appointment_view, NOT navigation.
- "Go to patients" is navigation. "Tell me about patient X" is patient_lookup.
- Words after "with", "for", "patient" are likely NAMES — don't convert to dental terms.
- "Process it", "Run diagnosis" mean consultation_stop (triggers AI pipeline).
- "Hold", "Wait", "Ek minute" during recording mean recording_control (pause).
- Never use clarification_needed — default to general_question if truly confused.

IMPORTANT: Also extract relevant entities:
- patientName: Full name of patient mentioned
- toothNumber: FDI tooth notation (e.g., "36", "46")
- dateRange: If "last month", "this week", etc. mentioned
- treatmentType: Type of treatment (RCT, extraction, etc.)
- diagnosis: Clinical diagnosis mentioned
- appointmentDate: Date for appointment
- appointmentTime: Time for appointment
- targetMode: Dashboard mode for navigation (home, clinical, pms, research, management)
- targetTab: Specific tab within a mode (e.g., "consultation-v3", "patients", "tasks")
- consultationAction: For consultation lifecycle (start_recording, stop_recording, open, close)

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

Input: "Create urgent task to verify Sarah's insurance by tomorrow"
Output: {"type": "task_management", "confidence": 0.96, "entities": {"patientName": "Sarah"}, "requiresClarification": false}

Input: "Assign task to John to call patient about appointment"
Output: {"type": "task_management", "confidence": 0.94, "entities": {}, "requiresClarification": false}

Input: "Show me pending tasks"
Output: {"type": "task_management", "confidence": 0.92, "entities": {}, "requiresClarification": false}

Input: "How many tasks are urgent?"
Output: {"type": "task_management", "confidence": 0.90, "entities": {}, "requiresClarification": false}

Input: "Schedule appointment"
Output: {"type": "appointment_booking", "confidence": 0.70, "entities": {}, "requiresClarification": true, "clarificationQuestion": "Sure! I can help schedule an appointment. Could you please tell me: 1) Patient name, 2) Date and time, and 3) Type of appointment (consultation, treatment, follow-up)?"}

Input: "Let's see the patient"
Output: {"type": "consultation_start", "confidence": 0.85, "entities": {}, "requiresClarification": true, "clarificationQuestion": "Which patient would you like to start a consultation with?"}

Input: "Popatlal ka case shuru karo"
Output: {"type": "consultation_start", "confidence": 0.90, "entities": {"patientName": "Popatlal"}, "requiresClarification": false}

Input: "Open my next patient"
Output: {"type": "consultation_start", "confidence": 0.85, "entities": {}, "requiresClarification": false}

Input: "Pause"
Output: {"type": "recording_control", "confidence": 0.88, "entities": {"consultationAction": "pause"}, "requiresClarification": false}

Input: "Select tooth forty six"
Output: {"type": "tooth_selection", "confidence": 0.95, "entities": {"toothNumber": "46"}, "requiresClarification": false}

Input: "That looks right, accept it"
Output: {"type": "diagnosis_action", "confidence": 0.90, "entities": {}, "requiresClarification": false}

Input: "Yes the patient has pain on biting and cold sensitivity"
Output: {"type": "gap_interaction", "confidence": 0.85, "entities": {}, "requiresClarification": false}

Input: "Tell Priya to prepare the composite tray"
Output: {"type": "task_creation", "confidence": 0.92, "entities": {"patientName": "Priya"}, "requiresClarification": false}

Input: "Read back what we have"
Output: {"type": "recording_control", "confidence": 0.90, "entities": {"consultationAction": "read_back"}, "requiresClarification": false}

Input: "Process it"
Output: {"type": "consultation_stop", "confidence": 0.88, "entities": {"consultationAction": "stop_recording"}, "requiresClarification": false}

Input: "We're done"
Output: {"type": "consultation_stop", "confidence": 0.85, "entities": {"consultationAction": "stop_recording"}, "requiresClarification": false}

Input: "Take me home"
Output: {"type": "navigation", "confidence": 0.90, "entities": {"targetMode": "home"}, "requiresClarification": false}

Input: "Skip this question"
Output: {"type": "gap_interaction", "confidence": 0.92, "entities": {}, "requiresClarification": false}
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
    const response = await aiChatCompletion(messages, {
      task: 'intent_classification',
      temperature: 0.1,
      systemInstruction,
      responseFormat: 'json'
    })

    const classified = JSON.parse(response) as ClassifiedIntent

    // Session 14: Normalize legacy intent names to canonical 12
    // The classifier prompt examples still use old names that the switch/case doesn't match
    classified.type = normalizeIntentType(classified.type)

    console.log('🎯 [ENDOFLOW MASTER] Intent classified:', classified.type, `(${(classified.confidence * 100).toFixed(0)}%)`)

    return classified
  } catch (error: any) {
    console.error('❌ [ENDOFLOW MASTER] Intent classification failed:', error?.message || error)
    console.error('❌ [ENDOFLOW MASTER] Error details:', JSON.stringify({
      name: error?.name,
      status: error?.status,
      stack: error?.stack?.slice(0, 300)
    }))

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
    const enhanced = await aiChatCompletion(messages, {
      task: 'conversation_context',
      temperature: 0.2,
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
// QUERY COMPLEXITY DETECTION
// ============================================================================

/**
 * Detect query complexity to determine appropriate RAG document count
 * Educational/procedural queries need more context (5 papers)
 * Simple diagnosis queries need less (2 papers)
 */
function detectQueryComplexity(query: string): 'simple' | 'educational' {
  const educationalKeywords = [
    // English keywords
    'how to', 'teach', 'steps', 'procedure', 'explain', 'guide', 'instruct',
    'demonstrate', 'show me how', 'walk me through', 'can you teach',
    'tell me how', 'educate', 'learn', 'tutorial', 'step by step',
    // Hindi keywords (transliteration and Devanagari)
    'kaise', 'sikhao', 'sikha', 'batao', 'kaise karte hain', 'kaise karu',
    'sikha sakte ho', 'bata sakte ho', 'procedure kya hai',
    'सिखा', 'बता', 'कैसे', 'प्रक्रिया'
  ]

  const lowerQuery = query.toLowerCase()

  // Check if query contains educational keywords
  const isEducational = educationalKeywords.some(keyword =>
    lowerQuery.includes(keyword.toLowerCase())
  )

  if (isEducational) {
    console.log('📚 [QUERY COMPLEXITY] Educational query detected - using comprehensive context (5 papers)')
    return 'educational'
  }

  console.log('⚡ [QUERY COMPLEXITY] Simple query detected - using fast mode (2 papers)')
  return 'simple'
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
      // Even without entities, try to proceed using the full query as diagnosis context
      console.log('⚠️ [TREATMENT PLANNING AGENT] No entities extracted, using full query as context')
    }

    // Detect query complexity
    const queryComplexity = detectQueryComplexity(enhancedQuery)

    // Resolve patient context if a patient name was mentioned
    let patientContext: { age?: number; medicalHistory?: string; previousTreatments?: string } | undefined
    if (entities.patientName) {
      try {
        const { createServiceClient } = await import('@/lib/supabase/server')
        const supabase = await createServiceClient()

        // Search for patient by name
        const { data: patients } = await supabase
          .schema('api')
          .from('patients')
          .select('id, first_name, last_name, date_of_birth, medical_history_summary')
          .or(`first_name.ilike.%${entities.patientName}%,last_name.ilike.%${entities.patientName}%`)
          .limit(1)

        if (patients && patients.length > 0) {
          const patient = patients[0]
          const age = patient.date_of_birth
            ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : undefined

          // Get recent consultations for this patient
          const { data: recentConsultations } = await supabase
            .schema('api')
            .from('consultations')
            .select('diagnosis, treatment_plan, medical_history, chief_complaint')
            .eq('patient_id', patient.id)
            .order('consultation_date', { ascending: false })
            .limit(3)

          const prevTreatments = recentConsultations?.map((c: any) =>
            `${c.chief_complaint || ''} → ${c.diagnosis || ''} → ${c.treatment_plan || ''}`
          ).join('; ') || ''

          patientContext = {
            age,
            medicalHistory: patient.medical_history_summary || 'No medical history recorded',
            previousTreatments: prevTreatments || 'No previous treatments recorded'
          }

          console.log(`👤 [TREATMENT PLANNING] Resolved patient: ${patient.first_name} ${patient.last_name}, age: ${age}`)
        }
      } catch (patientError) {
        console.warn('⚠️ [TREATMENT PLANNING] Patient lookup failed:', patientError)
      }
    }

    const result = await getAITreatmentSuggestionAction({
      diagnosis: entities.diagnosis || enhancedQuery.substring(0, 200), // Use full query if no diagnosis extracted
      toothNumber: entities.toothNumber || 'Not specified',
      dentistId,
      patientContext,
      queryComplexity
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

    // Session 15: Fuzzy search replaces rigid ilike for voice-friendly matching
    let patient: any
    try {
      const { fuzzySearchPatients } = await import('@/lib/utils/fuzzy-patient-search')
      const fuzzyResult = await fuzzySearchPatients(supabase, entities.patientName, { schema: 'api' })

      if (!fuzzyResult.bestMatch) {
        // If fuzzy found candidates but none above threshold, include them in error
        const nearMatches = fuzzyResult.patients.slice(0, 3)
          .map(p => `${p.first_name} ${p.last_name} (${(p.score * 100).toFixed(0)}%)`)
        const hint = nearMatches.length > 0
          ? ` Similar names found: ${nearMatches.join(', ')}`
          : ''
        return {
          agentName: 'Patient Inquiry AI',
          success: false,
          error: `Patient "${entities.patientName}" not found in the system.${hint}`,
          // Pass candidates for potential confirmation UI (Phase D)
          data: fuzzyResult.patients.length > 0 ? {
            action: 'patient_selection_confirm',
            candidates: fuzzyResult.patients.slice(0, 3),
            searchedName: entities.patientName,
          } : undefined,
          processingTime: Date.now() - startTime
        }
      }

      // Fetch full patient record using the matched ID
      const { data: fullPatient, error: fetchErr } = await supabase
        .schema('api')
        .from('patients')
        .select('*')
        .eq('id', fuzzyResult.bestMatch.id)
        .single()

      if (fetchErr || !fullPatient) throw fetchErr || new Error('Patient record not found')
      patient = fullPatient
      console.log(`✅ [PATIENT INQUIRY] Fuzzy matched "${entities.patientName}" → ${fuzzyResult.bestMatch.first_name} ${fuzzyResult.bestMatch.last_name} (${(fuzzyResult.bestMatch.score * 100).toFixed(1)}%)`)
    } catch (fuzzyError: any) {
      // Fallback: original ilike search if fuzzy utility fails
      console.warn('⚠️ [PATIENT INQUIRY] Fuzzy search failed, falling back to ilike:', fuzzyError.message)
      const nameParts = entities.patientName.split(' ')
      let patientQuery = supabase.schema('api').from('patients').select('*')
      if (nameParts.length >= 2) {
        patientQuery = patientQuery.ilike('first_name', `%${nameParts[0]}%`).ilike('last_name', `%${nameParts.slice(1).join(' ')}%`)
      } else {
        patientQuery = patientQuery.or(`first_name.ilike.%${entities.patientName}%,last_name.ilike.%${entities.patientName}%`)
      }
      const { data: patients, error } = await patientQuery.limit(1)
      if (error) throw error
      if (!patients || patients.length === 0) {
        return { agentName: 'Patient Inquiry AI', success: false, error: `Patient "${entities.patientName}" not found in the system`, processingTime: Date.now() - startTime }
      }
      patient = patients[0]
    }

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
 * Delegate to Task Management AI Agent
 * Handles: task creation, assignment, status updates, queries
 */
async function delegateToTaskManagement(
  userQuery: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResponse> {
  const startTime = Date.now()

  try {
    console.log('📋 [TASK MANAGEMENT AGENT] Processing query...')

    // Import task actions (dynamic import to avoid circular dependencies)
    const { scheduleTaskWithAI } = await import('@/lib/actions/ai-task-scheduler')
    const { getTasksAction, updateTaskStatusAction, getTaskStatsAction } = await import('@/lib/actions/assistant-tasks')

    // Extract context from conversation history
    const extractedContext = conversationHistory ? extractConversationContext(conversationHistory) : undefined

    // Enhance query with conversation context
    let enhancedQuery = userQuery
    if (conversationHistory && conversationHistory.length > 0) {
      enhancedQuery = await enhanceQueryWithContext(userQuery, conversationHistory, extractedContext)
    }

    // Determine task action type
    const queryLower = enhancedQuery.toLowerCase()

    // === CREATE/SCHEDULE TASK ===
    if (
      queryLower.includes('create task') ||
      queryLower.includes('add task') ||
      queryLower.includes('schedule task') ||
      queryLower.includes('assign task') ||
      queryLower.includes('new task') ||
      queryLower.includes('make task')
    ) {
      console.log('📝 [TASK MANAGEMENT] Detected task creation request')

      // Use existing AI scheduler
      const result = await scheduleTaskWithAI(enhancedQuery, dentistId)

      return {
        agentName: 'Task Management AI',
        success: result.success,
        data: result,
        error: result.error,
        processingTime: Date.now() - startTime
      }
    }

    // === LIST/QUERY TASKS ===
    else if (
      queryLower.includes('show tasks') ||
      queryLower.includes('list tasks') ||
      queryLower.includes('what tasks') ||
      queryLower.includes('pending tasks') ||
      queryLower.includes('my tasks') ||
      queryLower.includes('task status') ||
      queryLower.includes('how many tasks')
    ) {
      console.log('📊 [TASK MANAGEMENT] Detected task query request')

      // Determine filter
      let filter: any = {}

      if (queryLower.includes('pending') || queryLower.includes('todo')) {
        filter.status = 'todo'
      } else if (queryLower.includes('in progress') || queryLower.includes('active')) {
        filter.status = 'in_progress'
      } else if (queryLower.includes('completed') || queryLower.includes('done')) {
        filter.status = 'completed'
      } else if (queryLower.includes('urgent')) {
        filter.priority = 'urgent'
      }

      // Extract patient name from entities or context
      const patientName = entities.patientName || extractedContext?.lastPatientName
      if (patientName) {
        // Search for patient
        const supabase = await createServiceClient()
        const { data: patients } = await supabase
          .schema('api')
          .from('patients')
          .select('id')
          .or(`first_name.ilike.%${patientName}%,last_name.ilike.%${patientName}%`)
          .limit(1)

        if (patients && patients.length > 0) {
          filter.patientId = patients[0].id
        }
      }

      // Get tasks
      const tasksResult = await getTasksAction(filter)

      if (!tasksResult.success || !tasksResult.tasks) {
        return {
          agentName: 'Task Management AI',
          success: false,
          error: tasksResult.error || 'Failed to retrieve tasks',
          processingTime: Date.now() - startTime
        }
      }

      // Format response data
      const tasks = tasksResult.tasks

      return {
        agentName: 'Task Management AI',
        success: true,
        data: {
          tasks,
          count: tasks.length,
          filter,
          query: 'list_tasks'
        },
        processingTime: Date.now() - startTime
      }
    }

    // === UPDATE TASK STATUS ===
    else if (
      queryLower.includes('complete task') ||
      queryLower.includes('mark task') ||
      queryLower.includes('finish task') ||
      queryLower.includes('start task')
    ) {
      console.log('🔄 [TASK MANAGEMENT] Detected task status update request')

      // This requires task ID - request clarification
      return {
        agentName: 'Task Management AI',
        success: false,
        error: 'To update a task, please specify the task by name or view the task list first. Try: "Show my pending tasks"',
        processingTime: Date.now() - startTime
      }
    }

    // === GET TASK STATISTICS ===
    else if (
      queryLower.includes('task stats') ||
      queryLower.includes('task summary') ||
      queryLower.includes('how many tasks')
    ) {
      console.log('📊 [TASK MANAGEMENT] Detected task statistics request')

      const statsResult = await getTaskStatsAction()

      if (!statsResult.success || !statsResult.stats) {
        return {
          agentName: 'Task Management AI',
          success: false,
          error: statsResult.error || 'Failed to retrieve task statistics',
          processingTime: Date.now() - startTime
        }
      }

      return {
        agentName: 'Task Management AI',
        success: true,
        data: {
          stats: statsResult.stats,
          query: 'task_statistics'
        },
        processingTime: Date.now() - startTime
      }
    }

    // === FALLBACK: Treat as task creation ===
    else {
      console.log('📝 [TASK MANAGEMENT] Fallback - treating as task creation')

      const result = await scheduleTaskWithAI(enhancedQuery, dentistId)

      return {
        agentName: 'Task Management AI',
        success: result.success,
        data: result,
        error: result.error,
        processingTime: Date.now() - startTime
      }
    }

  } catch (error) {
    console.error('❌ [TASK MANAGEMENT AGENT] Error:', error)
    return {
      agentName: 'Task Management AI',
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

    const systemInstruction = `You are EndoFlow AI, an expert dental assistant built for practicing dentists. You specialize in endodontics but have comprehensive knowledge of all dental specialties.

You can help with:
- Dental procedures, protocols, and step-by-step clinical guidance
- Treatment planning, material selection, and evidence-based recommendations
- Endodontic terminology, FDI notation, clinical abbreviations
- Differential diagnosis and clinical decision support
- Drug dosages, prescriptions, and contraindications for dental use
- Patient management, consent, and communication strategies
- Clinic operations, scheduling workflow, and practice management
- Research summaries and evidence-based dentistry

IMPORTANT:
- The user is a DENTIST speaking via voice. Input may have speech-to-text errors.
- Always interpret in a dental context. "Pull py this" = pulpitis, "root can all" = root canal.
- Give practical, actionable advice. Be specific with dosages, materials, and techniques.
- Use bullet points for steps and lists. Keep responses under 300 words unless the question requires detailed clinical guidance.
- If the query seems garbled from voice input, do your BEST to interpret what the dentist meant and answer helpfully.`

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

    const response = await aiChatCompletion(messages, {
      task: 'conversation_context',
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

    const response = await aiChatCompletion(messages, {
      task: 'classification',
      provider: 'gemini', // Simple classification, keep fast
      temperature: 0.1,
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
  language?: 'en-US' | 'en-IN' | 'hi-IN'
  isVoiceInput?: boolean
}): Promise<OrchestratedResponse> {
  const { userQuery, dentistId, language = 'en-US', isVoiceInput = true } = params

  // Session 12→14: Use Supabase-persisted session memory if caller provides no history
  const { addToSession, updatePatientContext, getSessionHistory, logIntent } = await import('@/lib/services/master-ai-session')
  const sessionHistory = await getSessionHistory(dentistId)
  const conversationHistory = params.conversationHistory && params.conversationHistory.length > 0
    ? params.conversationHistory
    : sessionHistory

  console.log('🎭 [ENDOFLOW MASTER] Orchestrating query:', userQuery)
  console.log(`🧠 [SESSION] Using ${conversationHistory.length} messages from ${params.conversationHistory?.length ? 'caller' : 'server session'}`)

  try {
    // Step 0: Prompt Refinement Agent — clean voice transcript before anything else
    const refinement: RefinedQuery = await refineVoiceQuery(userQuery, {
      conversationHistory,
      isVoiceInput
    })
    const refinedQuery = refinement.refinedQuery

    if (refinement.corrections.length > 0) {
      console.log(`🔧 [ENDOFLOW MASTER] Refined: "${userQuery}" → "${refinedQuery}"`)
    }

    // Step 0.5: Detect topic changes (using refined query)
    const isNewTopic = await detectTopicChange(refinedQuery, conversationHistory)

    // If new topic detected, clear conversation context for fresh start
    const effectiveHistory = isNewTopic ? [] : conversationHistory

    if (isNewTopic && conversationHistory && conversationHistory.length > 0) {
      console.log('🆕 [ENDOFLOW MASTER] Topic change detected - starting fresh context')
    }

    // Session 15: Voice number selection — resolve "1", "number 1", "first one" to a candidate
    // Check if previous assistant response had patient_selection_confirm/prompt
    const numberMatch = refinedQuery.match(/^(?:number\s+)?(\d)$|^(one|two|three|first|second|third|the\s+first|the\s+second|the\s+third)$/i)
    if (numberMatch && effectiveHistory.length >= 2) {
      const lastAssistantMsg = effectiveHistory[effectiveHistory.length - 1]
      if (lastAssistantMsg?.role === 'assistant') {
        // Check if the last response mentioned candidates (by looking for numbered names)
        const candidatePattern = /(?:Did you mean|Today's patients).*?(\d+)\.\s+(\w[\w\s]+?)(?:,|\?|$)/g
        const candidates: string[] = []
        let candidateMatch
        while ((candidateMatch = candidatePattern.exec(lastAssistantMsg.content))) {
          candidates.push(candidateMatch[2].trim())
        }

        if (candidates.length > 0) {
          const numStr = numberMatch[1] || numberMatch[2]
          const numMap: Record<string, number> = {
            '1': 0, '2': 1, '3': 2,
            'one': 0, 'two': 1, 'three': 2,
            'first': 0, 'second': 1, 'third': 2,
            'the first': 0, 'the second': 1, 'the third': 2,
          }
          const idx = numMap[numStr.toLowerCase()] ?? -1
          if (idx >= 0 && idx < candidates.length) {
            const selectedName = candidates[idx]
            console.log(`✅ [VOICE SELECT] User chose #${idx + 1}: "${selectedName}"`)
            // Re-run with the actual patient name
            return orchestrateQuery({
              ...params,
              userQuery: `Start consultation with ${selectedName}`,
              conversationHistory: effectiveHistory,
            })
          }
        }
      }
    }

    // Step 1: Classify Intent (using refined query with effective history)
    const intent = await classifyIntent(refinedQuery, effectiveHistory)

    // Step 2: Handle clarification requests - but still try to be helpful
    // Session 13: Lowered threshold from 0.4 to 0.25 — dentists with hands in mouth won't repeat
    if (intent.requiresClarification && intent.confidence < 0.25) {
      // Only ask for clarification if confidence is very low
      return {
        success: true,
        response: intent.clarificationQuestion || 'Could you please provide more details?',
        agentResponses: [],
        intent,
        suggestions: []
      }
    }

    // If confidence is moderate (0.4-0.7) with clarification flag, proceed anyway
    // The AI will do its best with what it has
    if (intent.requiresClarification) {
      console.log(`⚠️ [ENDOFLOW MASTER] Low confidence (${intent.confidence}) but proceeding with best-effort interpretation`)
      intent.requiresClarification = false // Override - let it try
    }

    // Step 2.5 (Session 14): Check if this is a multi-step command → route to conductor
    const { isMultiStepIntent, executeConductorPipeline } = await import('@/lib/agents/mcp-conductor')
    if (isMultiStepIntent(intent.type, intent.entities)) {
      console.log(`🎯 [ENDOFLOW MASTER] Multi-step intent detected: ${intent.type} — routing to MCP Conductor`)

      const conductorResult = await executeConductorPipeline(
        intent.type,
        intent.entities,
        dentistId,
        {
          onStepStart: (step) => console.log(`  ▶ ${step.label}`),
          onStepComplete: (step) => console.log(`  ✅ ${step.id} done (${step.durationMs}ms)`),
          onStepFailed: (step) => console.log(`  ❌ ${step.id} failed: ${step.error}`),
        }
      )

      // Convert conductor result to OrchestratedResponse
      const agentResponse: AgentResponse = {
        agentName: 'MCPConductor',
        success: conductorResult.success,
        data: {
          steps: conductorResult.steps,
          actionCommands: conductorResult.actionCommands,
        },
        processingTime: conductorResult.totalDurationMs,
      }

      // Persist to Supabase session
      await addToSession(dentistId, 'user', userQuery, intent.type)
      await addToSession(dentistId, 'assistant', conductorResult.finalMessage)
      await logIntent(dentistId, intent.type, intent.confidence, userQuery)

      // Update patient context if consultation was started
      const patientStep = conductorResult.steps.find(s => s.id === 'search_patient' && s.status === 'completed')
      if (patientStep?.result?.patientId) {
        await updatePatientContext(dentistId, patientStep.result.patientId, patientStep.result.patientName)
      }

      return {
        success: conductorResult.success,
        response: conductorResult.finalMessage,
        agentResponses: [agentResponse],
        intent,
        suggestions: conductorResult.success
          ? ['How is the treatment going?', 'Show patient history', 'Open dental chart']
          : ['Try again', 'Search a different patient'],
        // Pass the LAST action command for frontend execution
        actionCommands: conductorResult.actionCommands,
      } as OrchestratedResponse & { actionCommands?: any[] }
    }

    // Step 3: Delegate to appropriate agent(s) — use refinedQuery for all agents
    let agentResponses: AgentResponse[] = []

    switch (intent.type) {
      case 'clinical_research':
      case 'clinical_question': // Session 13: consolidated alias
        agentResponses.push(
          await delegateToClinicalResearch(refinedQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'appointment_inquiry':
      case 'appointment_view': // Session 13: consolidated alias
        // View schedule, list appointments
        agentResponses.push(
          await delegateToAppointmentInquiry(refinedQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'appointment_booking':
      case 'appointment_book': // Session 13: consolidated alias
        // Create/schedule new appointment
        agentResponses.push(
          await delegateToScheduler(refinedQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'treatment_planning':
        agentResponses.push(
          await delegateToTreatmentPlanning(refinedQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'patient_inquiry':
      case 'patient_lookup': // Session 13: consolidated (merges patient_inquiry + patient_status)
        agentResponses.push(
          await delegateToPatientInquiry(refinedQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'task_management':
      case 'task_command': // Session 13: consolidated alias
        agentResponses.push(
          await delegateToTaskManagement(refinedQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      // Session 10: Navigation & consultation lifecycle intents
      case 'navigation':
        agentResponses.push(
          await delegateToNavigation(refinedQuery, intent.entities)
        )
        break

      case 'consultation_start':
        agentResponses.push(
          await delegateToConsultationStart(refinedQuery, intent.entities, dentistId)
        )
        break

      case 'consultation_stop':
        agentResponses.push(
          await delegateToConsultationStop(refinedQuery, intent.entities)
        )
        break

      case 'patient_status':
        agentResponses.push(
          await delegateToPatientStatus(refinedQuery, intent.entities, dentistId)
        )
        break

      case 'generate_report':
      case 'report_command': // Session 13: consolidated alias
        agentResponses.push({
          agentName: 'ReportAgent',
          success: true,
          data: {
            action: 'generate_report',
            message: 'Generating consultation report. The PDF will download shortly.',
          },
          processingTime: 0,
        })
        break

      // Session 13: Hands-free voice control intents
      case 'tooth_selection':
      case 'tooth_command': { // Session 13: consolidated — handles tooth select + diagnosis accept/reject
        // Determine if this is a tooth selection or diagnosis action
        const toothQuery = refinedQuery.toLowerCase()
        const isDiagnosisAccept = /accept|agree|right|correct|theek|sahi|confirm|apply|yes|haan/i.test(toothQuery)
        const isDiagnosisReject = /reject|no|wrong|galat|try again|alternative/i.test(toothQuery)

        if (isDiagnosisAccept) {
          agentResponses.push({
            agentName: 'DiagnosisActionAgent',
            success: true,
            data: { action: 'accept_diagnosis', message: 'Accepting the AI diagnosis.' },
            processingTime: 0,
          })
        } else if (isDiagnosisReject) {
          agentResponses.push({
            agentName: 'DiagnosisActionAgent',
            success: true,
            data: { action: 'reject_diagnosis', message: 'Rejecting diagnosis. Let me suggest alternatives.' },
            processingTime: 0,
          })
        } else {
          agentResponses.push({
            agentName: 'ToothSelectionAgent',
            success: true,
            data: {
              action: 'select_tooth',
              toothNumber: intent.entities.toothNumber || '',
              message: intent.entities.toothNumber
                ? `Opening tooth ${intent.entities.toothNumber} on the dental chart.`
                : 'Which tooth would you like to select?',
            },
            processingTime: 0,
          })
        }
        break
      }

      case 'recording_control': {
        // Determine specific recording action from query
        const queryLower = refinedQuery.toLowerCase()
        let recordingAction: 'pause' | 'resume' | 'process' | 'read_back' = 'pause'
        let message = 'Pausing recording.'

        if (/resum|continu|aage|chalo|keep going|go on/i.test(queryLower)) {
          recordingAction = 'resume'
          message = 'Resuming recording.'
        } else if (/read.?back|what.*(we|do we).*(have|got)|play.*back|sunao/i.test(queryLower)) {
          recordingAction = 'read_back'
          message = 'Reading back the current transcript.'
        } else if (/process|analyze|run.*diagnos|final/i.test(queryLower)) {
          recordingAction = 'process'
          message = 'Processing all recorded segments through the AI pipeline.'
        }

        agentResponses.push({
          agentName: 'RecordingControlAgent',
          success: true,
          data: {
            action: 'recording_control',
            recordingAction,
            message,
          },
          processingTime: 0,
        })
        break
      }

      case 'diagnosis_action': // Legacy — handled by tooth_command above
        break

      case 'gap_interaction': {
        const queryLower2 = refinedQuery.toLowerCase()
        let gapAction = 'answer_gap'
        let gapAnswer = refinedQuery

        if (/skip|next|aage|agla/i.test(queryLower2)) {
          gapAction = 'skip_gap'
          gapAnswer = ''
        } else if (/repeat|dobara|phir se|say.*again/i.test(queryLower2)) {
          gapAction = 'repeat_gap'
          gapAnswer = ''
        } else if (/done|that'?s all|bas|khatam|no more/i.test(queryLower2)) {
          gapAction = 'close_gap_dialog'
          gapAnswer = ''
        }

        agentResponses.push({
          agentName: 'GapInteractionAgent',
          success: true,
          data: {
            action: gapAction,
            gapAnswer,
            message: gapAction === 'answer_gap'
              ? 'Processing your answer.'
              : gapAction === 'skip_gap'
              ? 'Skipping to the next question.'
              : gapAction === 'repeat_gap'
              ? 'Repeating the current question.'
              : 'Finishing gap-filling and processing diagnosis.',
          },
          processingTime: 0,
        })
        break
      }

      case 'task_creation': // Legacy — now handled by task_command/task_management above
        agentResponses.push(
          await delegateToTaskManagement(refinedQuery, intent.entities, dentistId, effectiveHistory)
        )
        break

      case 'general_question':
      default:
        agentResponses.push(
          await delegateToGeneralAI(refinedQuery, effectiveHistory)
        )
        break
    }

    // Step 4: Synthesize natural language response (use refined query for better synthesis)
    const synthesizedResponse = await synthesizeResponse(
      refinedQuery,
      intent,
      agentResponses,
      language
    )

    // Step 5: Generate follow-up suggestions
    const suggestions = generateSuggestions(intent, agentResponses)

    console.log('✅ [ENDOFLOW MASTER] Orchestration complete')

    // Session 14: Persist to Supabase session
    await addToSession(dentistId, 'user', userQuery, intent.type)
    await addToSession(dentistId, 'assistant', synthesizedResponse)
    await logIntent(dentistId, intent.type, intent.confidence, userQuery)

    // If a patient was found via consultation_start, update active context
    const consultStartAgent = agentResponses.find(
      r => r.agentName === 'ConsultationStartAgent' && r.success && r.data?.patientId
    )
    if (consultStartAgent?.data?.patientId) {
      await updatePatientContext(dentistId, consultStartAgent.data.patientId, consultStartAgent.data.patientName || '')
    }

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
 * Supports multilingual responses based on user's language preference.
 * When language is 'hi-IN', responses are generated in Hindi using Devanagari script.
 */
async function synthesizeResponse(
  userQuery: string,
  intent: ClassifiedIntent,
  agentResponses: AgentResponse[],
  language: 'en-US' | 'en-IN' | 'hi-IN' = 'en-US'
): Promise<string> {
  console.log('🌐 [SYNTHESIS] synthesizeResponse called with language:', language)
  console.log('🌐 [SYNTHESIS] Intent type:', intent.type)

  // If any agent failed, handle gracefully
  const failedAgents = agentResponses.filter(r => !r.success)
  if (failedAgents.length > 0) {
    const errorMsg = failedAgents[0].error || "I couldn't process your request. Please try rephrasing."
    // Translate error message to Hindi if needed
    if (language === 'hi-IN') {
      return await translateToHindi(errorMsg, userQuery)
    }
    return errorMsg
  }

  const successfulResponses = agentResponses.filter(r => r.success)

  // Helper function to finalize response with translation if needed
  const finalizeResponse = async (englishResponse: string): Promise<string> => {
    if (language === 'hi-IN') {
      return await translateToHindi(englishResponse, userQuery)
    }
    return englishResponse
  }

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

        return await finalizeResponse(response)
      }
      return await finalizeResponse('I analyzed the patient data but found no specific results for your query.')
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
          return await finalizeResponse(`You had no appointments${contextPhrase}.`)
        } else if (queryDirection === 'future') {
          return await finalizeResponse(`You have no upcoming appointments${contextPhrase}.`)
        }
        return await finalizeResponse(`You have no appointments scheduled${contextPhrase}.`)
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
        
        return await finalizeResponse(response.trim())
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

      return await finalizeResponse(response.trim())
    }

    case 'appointment_booking': {
      const data = successfulResponses[0]?.data
      
      if (data?.success && data?.message) {
        return await finalizeResponse(data.message)
      }

      return await finalizeResponse('Appointment processed successfully.')
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

        return await finalizeResponse(response)
      }
      return await finalizeResponse('Treatment recommendation generated. Please review the detailed analysis.')
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

        return await finalizeResponse(response)
      }
      return await finalizeResponse('Patient information retrieved.')
    }

    case 'task_management': {
      const data = successfulResponses[0]?.data

      // Task creation response
      if (data?.message && data?.taskId) {
        let response = `✅ **Task Created Successfully!**\n\n${data.message}`

        if (data.parsedRequest) {
          const task = data.parsedRequest
          response += `\n\n**Task Details:**`
          response += `\n• **Title:** ${task.taskTitle}`
          response += `\n• **Priority:** ${task.priority.toUpperCase()}`
          if (task.assignedToName) {
            response += `\n• **Assigned to:** ${task.assignedToName}`
          }
          if (task.patientName) {
            response += `\n• **Patient:** ${task.patientName}`
          }
          if (task.dueDate) {
            response += `\n• **Due:** ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ''}`
          }
          if (data.confidence) {
            response += `\n\n*AI Confidence: ${(data.confidence * 100).toFixed(0)}%*`
          }
        }

        return await finalizeResponse(response)
      }

      // Task list response
      if (data?.query === 'list_tasks' && data?.tasks) {
        const tasks = data.tasks
        const filter = data.filter

        if (tasks.length === 0) {
          let filterDesc = 'tasks'
          if (filter.status) filterDesc = `${filter.status.replace('_', ' ')} tasks`
          if (filter.priority) filterDesc = `${filter.priority} priority tasks`

          return await finalizeResponse(`No ${filterDesc} found.`)
        }

        let response = `📋 **Found ${tasks.length} task${tasks.length > 1 ? 's' : ''}:**\n\n`

        tasks.slice(0, 10).forEach((task: any, idx: number) => {
          const priorityEmoji = {
            urgent: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
          }[task.priority] || '⚪'

          response += `${idx + 1}. ${priorityEmoji} **${task.title}**\n`
          response += `   Status: ${task.status.replace('_', ' ')} | Priority: ${task.priority}\n`

          if (task.assigned_to_profile) {
            response += `   Assigned to: ${task.assigned_to_profile.full_name}\n`
          }

          if (task.patient_name) {
            response += `   Patient: ${task.patient_name}\n`
          }

          if (task.due_date) {
            response += `   Due: ${new Date(task.due_date).toLocaleDateString()}\n`
          }

          response += '\n'
        })

        if (tasks.length > 10) {
          response += `\n*... and ${tasks.length - 10} more task${tasks.length - 10 > 1 ? 's' : ''}*`
        }

        return await finalizeResponse(response.trim())
      }

      // Task statistics response
      if (data?.query === 'task_statistics' && data?.stats) {
        const stats = data.stats

        let response = `📊 **Task Statistics:**\n\n`
        response += `• **Total Tasks:** ${stats.total}\n`
        response += `• **To Do:** ${stats.todo}\n`
        response += `• **In Progress:** ${stats.inProgress}\n`
        response += `• **Completed:** ${stats.completed}\n`
        response += `• **Urgent:** ${stats.urgent}\n`

        if (stats.overdue > 0) {
          response += `• **⚠️ Overdue:** ${stats.overdue}\n`
        }

        return await finalizeResponse(response)
      }

      // Error response
      if (data?.error) {
        return await finalizeResponse(data.error)
      }

      return await finalizeResponse('Task operation completed.')
    }

    // Session 10: Navigation & consultation lifecycle response formatting
    case 'navigation':
    case 'consultation_start':
    case 'consultation_stop':
    case 'patient_status':
    case 'generate_report': {
      const data = successfulResponses[0]?.data
      return await finalizeResponse(data?.message || 'Done.')
    }

    case 'general_question':
    default: {
      const data = successfulResponses[0]?.data
      return await finalizeResponse(data?.response || "I'm here to help! What would you like to know?")
    }
  }
}

/**
 * Translate English response to Hindi using Gemini AI
 */
async function translateToHindi(englishText: string, originalQuery: string): Promise<string> {
  console.log('🌐 [TRANSLATION] translateToHindi called')
  console.log('🌐 [TRANSLATION] English text length:', englishText.length)
  console.log('🌐 [TRANSLATION] Original query:', originalQuery.substring(0, 100))

  try {
    // Simplified system instruction for faster translation
    const systemInstruction = `You are a medical translator for dental communication.
Translate English to natural Hindi (हिंदी) using Devanagari script.

KEY TERMS:
tooth/teeth=दांत, appointment=अपॉइंटमेंट, patient=मरीज़, treatment=इलाज, pain=दर्द, today=आज, tomorrow=कल

RULES:
- Maintain medical accuracy
- Preserve markdown (**, *, bullets)
- Keep numbers, dates, names as-is
- Use conversational Hindi

Translate to Hindi:`

    const userPrompt = `${englishText}

(Context: "${originalQuery.substring(0, 100)}")`

    const messages: GeminiChatMessage[] = [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ]

    const hindiTranslation = await aiChatCompletion(messages, {
      task: 'summarization',
      provider: 'gemini', // Translation is fast/simple
      systemInstruction,
      temperature: 0.5,
      maxOutputTokens: 1024
    })

    return hindiTranslation.trim()
  } catch (error) {
    console.error('❌ [TRANSLATION] Failed to translate to Hindi:', error)
    // Fallback: return English if translation fails
    return englishText
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

    case 'task_management':
      suggestions.push('Show pending tasks')
      suggestions.push('Create another task')
      suggestions.push('View task statistics')
      break

    case 'navigation':
      suggestions.push('Open clinical mode')
      suggestions.push('Go to patients')
      suggestions.push('View today\'s schedule')
      break

    case 'consultation_start':
      suggestions.push('Stop recording')
      suggestions.push('Show patient history')
      break

    case 'consultation_stop':
      suggestions.push('View diagnosis')
      suggestions.push('Generate report')
      suggestions.push('Set follow-up appointment')
      break

    case 'patient_status':
      suggestions.push('Start consultation')
      suggestions.push('View treatment history')
      suggestions.push('Schedule next appointment')
      break

    case 'generate_report':
      suggestions.push('Send to patient')
      suggestions.push('View patient profile')
      suggestions.push('Set follow-up appointment')
      break

    case 'general_question':
      suggestions.push('Search patient database')
      suggestions.push('View today\'s schedule')
      break
  }

  return suggestions.slice(0, 3)
}

// ============================================================================
// SESSION 10: NAVIGATION & CONSULTATION LIFECYCLE HANDLERS
// ============================================================================

/**
 * Handle navigation commands.
 * Returns an action object that the frontend interprets to navigate.
 */
async function delegateToNavigation(
  query: string,
  entities: ClassifiedIntent['entities']
): Promise<AgentResponse> {
  const start = Date.now()

  // Resolve target mode from entities or infer from query
  let targetMode = entities.targetMode
  let targetTab = entities.targetTab

  if (!targetMode) {
    // Infer from common patterns
    const q = query.toLowerCase()
    if (q.includes('home') || q.includes('dashboard')) targetMode = 'home'
    else if (q.includes('clinical') || q.includes('consultation') || q.includes('consult')) targetMode = 'clinical'
    else if (q.includes('patient') || q.includes('pms') || q.includes('profile')) targetMode = 'pms'
    else if (q.includes('research') || q.includes('study') || q.includes('analysis')) targetMode = 'research'
    else if (q.includes('manage') || q.includes('task') || q.includes('organiz')) targetMode = 'management'
  }

  return {
    agentName: 'NavigationAgent',
    success: true,
    data: {
      action: 'navigate',
      targetMode: targetMode || 'home',
      targetTab,
      message: `Navigating to ${targetMode || 'home'} mode${targetTab ? `, ${targetTab} tab` : ''}.`
    },
    processingTime: Date.now() - start
  }
}

/**
 * Handle consultation start commands.
 * Looks up the patient, determines consultation mode, returns action for frontend.
 */
async function delegateToConsultationStart(
  query: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string
): Promise<AgentResponse> {
  const start = Date.now()

  try {
    const supabase = await createServiceClient()
    let patientId: string | null = null
    let patientName = entities.patientName || null
    let consultationMode: string = 'new_consultation'
    let appointmentId: string | null = null
    let appointmentType: string | null = null
    let appointmentMissing = false

    // Session 15: If no patient name provided, prompt with today's patients
    if (!patientName) {
      const today = new Date().toISOString().split('T')[0]
      const { data: todayPatients } = await supabase
        .from('appointments')
        .select('patient_id, patients!inner(id, first_name, last_name)')
        .gte('scheduled_date', today + 'T00:00:00')
        .lte('scheduled_date', today + 'T23:59:59')
        .in('status', ['scheduled', 'confirmed', 'checked_in'])
        .limit(10)

      let patientList: { id: string; name: string }[] = []
      if (todayPatients && todayPatients.length > 0) {
        const seen = new Set<string>()
        for (const appt of todayPatients) {
          const p = (appt as any).patients
          if (p && !seen.has(p.id)) {
            seen.add(p.id)
            patientList.push({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim() })
          }
        }
      }

      const listText = patientList.length > 0
        ? `Today's patients: ${patientList.map((p, i) => `${i + 1}. ${p.name}`).join(', ')}`
        : 'No patients scheduled for today'

      return {
        agentName: 'ConsultationStartAgent',
        success: true,
        data: {
          action: 'patient_selection_prompt',
          patientList,
          message: `Which patient would you like to start a consultation with? ${listText}`,
        },
        processingTime: Date.now() - start
      }
    }

    // Search for patient if name provided
    if (patientName) {
      // Session 15: Fuzzy search for voice-friendly name matching
      let matchFound = false
      let fuzzyPatients: any[] = []
      try {
        const { fuzzySearchPatients } = await import('@/lib/utils/fuzzy-patient-search')
        const fuzzyResult = await fuzzySearchPatients(supabase, patientName)
        fuzzyPatients = fuzzyResult.patients

        if (fuzzyResult.bestMatch) {
          patientId = fuzzyResult.bestMatch.id
          patientName = `${fuzzyResult.bestMatch.first_name} ${fuzzyResult.bestMatch.last_name}`
          matchFound = true
          console.log(`✅ [CONSULTATION START] Fuzzy matched "${entities.patientName}" → ${patientName} (${(fuzzyResult.bestMatch.score * 100).toFixed(1)}%)`)
        }
      } catch (fuzzyError: any) {
        // Fallback: original ilike search
        console.warn('⚠️ [CONSULTATION START] Fuzzy search failed, falling back to ilike:', fuzzyError.message)
        const nameParts = patientName.trim().split(/\s+/)
        let patientQuery = supabase.from('patients').select('id, first_name, last_name')
        if (nameParts.length >= 2) {
          patientQuery = patientQuery.ilike('first_name', `%${nameParts[0]}%`).ilike('last_name', `%${nameParts.slice(1).join(' ')}%`)
        } else {
          patientQuery = patientQuery.or(`first_name.ilike.%${nameParts[0]}%,last_name.ilike.%${nameParts[0]}%`)
        }
        const { data: patients } = await patientQuery.limit(5)
        if (patients && patients.length > 0) {
          patientId = patients[0].id
          patientName = `${patients[0].first_name} ${patients[0].last_name}`
          matchFound = true
        }
      }

      if (matchFound) {

        // Session 12: Check today's appointments first — appointment type drives mode
        const today = new Date().toISOString().split('T')[0]
        const { data: todayAppointments } = await supabase
          .from('appointments')
          .select('id, appointment_type, status, linked_episode_id')
          .eq('patient_id', patientId)
          .gte('scheduled_date', today + 'T00:00:00')
          .lte('scheduled_date', today + 'T23:59:59')
          .in('status', ['scheduled', 'confirmed', 'checked_in'])
          .limit(1)

        if (todayAppointments && todayAppointments.length > 0) {
          const appt = todayAppointments[0]
          appointmentId = appt.id
          appointmentType = appt.appointment_type || null
          // Use detectConsultationMode to drive mode from appointment type
          const { detectConsultationMode } = await import('@/lib/types/consultation-modes')
          consultationMode = detectConsultationMode({ appointmentType: appointmentType || undefined })
          console.log(`📅 [CONSULTATION START] Today's appointment found: ${appointmentType} → mode: ${consultationMode}`)
        } else {
          appointmentMissing = true
          // Fall back to episode/history-based detection
          // Determine consultation mode: check for active episodes
          const { data: activeEpisodes } = await supabase
            .from('treatment_episodes')
            .select('id, status, original_diagnosis, linked_teeth')
            .eq('patient_id', patientId)
            .in('status', ['planned', 'in_progress'])
            .limit(3)

          // Check for existing completed consultations (is this a first visit?)
          const { count } = await supabase
            .from('consultations')
            .select('id', { count: 'exact', head: true })
            .eq('patient_id', patientId)
            .eq('status', 'completed')

          const hasActiveEpisodes = activeEpisodes && activeEpisodes.length > 0
          const hasCompletedConsultations = (count || 0) > 0

          if (hasActiveEpisodes) {
            consultationMode = 'treatment_visit'
          } else if (hasCompletedConsultations) {
            consultationMode = 'new_consultation'
          } else {
            consultationMode = 'new_consultation'
          }
          console.log(`⚠️ [CONSULTATION START] No today's appointment found — using episode-based detection: ${consultationMode}`)
        }

        console.log(`🏥 [CONSULTATION START] Patient: ${patientName} (${patientId}), mode: ${consultationMode}, appointment: ${appointmentId || 'none'}`)
      } else {
        // Session 15: Include fuzzy candidates if available for confirmation UI
        const nearMatches = fuzzyPatients.slice(0, 3)
        const candidateNames = nearMatches.map((p: any) => `${p.first_name} ${p.last_name}`).join(', ')
        const hint = candidateNames ? ` Did you mean: ${candidateNames}?` : ''
        return {
          agentName: 'ConsultationStartAgent',
          success: false,
          data: {
            action: nearMatches.length > 0 ? 'patient_selection_confirm' : 'consultation_start_failed',
            reason: 'patient_not_found',
            searchedName: patientName,
            candidates: nearMatches,
            message: `I couldn't find a patient named "${patientName}".${hint}`
          },
          processingTime: Date.now() - start
        }
      }
    }

    return {
      agentName: 'ConsultationStartAgent',
      success: true,
      data: {
        action: 'consultation_start',
        patientId,
        patientName,
        consultationMode,
        appointmentId,
        appointmentType,
        appointmentMissing,
        startRecording: true,
        message: patientName
          ? `Starting ${consultationMode === 'treatment_visit' ? 'treatment visit' : consultationMode === 'follow_up' ? 'follow-up' : 'new consultation'} with ${patientName}. Recording will begin — you can start talking with the patient.`
          : 'Please select a patient to start the consultation.'
      },
      processingTime: Date.now() - start
    }
  } catch (err: any) {
    return {
      agentName: 'ConsultationStartAgent',
      success: false,
      error: err.message,
      processingTime: Date.now() - start
    }
  }
}

/**
 * Handle consultation stop commands.
 * Returns action for frontend to stop recording and trigger the AI pipeline.
 */
async function delegateToConsultationStop(
  query: string,
  entities: ClassifiedIntent['entities']
): Promise<AgentResponse> {
  return {
    agentName: 'ConsultationStopAgent',
    success: true,
    data: {
      action: 'consultation_stop',
      consultationAction: 'stop_recording',
      triggerAIPipeline: true,
      message: 'Stopping recording. The transcript will be processed through the AI diagnostic pipeline.'
    },
    processingTime: 0
  }
}

/**
 * Handle patient status queries.
 * Assembles the full longitudinal patient context and formats a summary.
 */
async function delegateToPatientStatus(
  query: string,
  entities: ClassifiedIntent['entities'],
  dentistId: string
): Promise<AgentResponse> {
  const start = Date.now()

  try {
    const supabase = await createServiceClient()
    const patientName = entities.patientName

    if (!patientName) {
      return {
        agentName: 'PatientStatusAgent',
        success: false,
        data: {
          action: 'patient_status_failed',
          reason: 'no_patient_name',
          message: 'Which patient would you like to know the status of?'
        },
        processingTime: Date.now() - start
      }
    }

    // Search for patient
    const nameParts = patientName.trim().split(/\s+/)
    let patientQuery = supabase.from('patients').select('id, first_name, last_name')

    if (nameParts.length >= 2) {
      patientQuery = patientQuery
        .ilike('first_name', `%${nameParts[0]}%`)
        .ilike('last_name', `%${nameParts.slice(1).join(' ')}%`)
    } else {
      patientQuery = patientQuery.or(
        `first_name.ilike.%${nameParts[0]}%,last_name.ilike.%${nameParts[0]}%`
      )
    }

    const { data: patients } = await patientQuery.limit(3)

    if (!patients || patients.length === 0) {
      return {
        agentName: 'PatientStatusAgent',
        success: false,
        data: {
          action: 'patient_status_failed',
          reason: 'patient_not_found',
          message: `I couldn't find a patient named "${patientName}".`
        },
        processingTime: Date.now() - start
      }
    }

    const patient = patients[0]
    const patientId = patient.id
    const fullName = `${patient.first_name} ${patient.last_name}`

    // Use the patient context assembler for full longitudinal data
    const { assemblePatientContext } = await import('@/lib/services/patient-context-assembler')
    const context = await assemblePatientContext(
      patientId,
      entities.toothNumber || undefined
    )

    // Build a structured status summary
    const statusParts: string[] = []
    statusParts.push(`**Patient: ${fullName}**`)

    if (context.demographics.age) {
      statusParts.push(`Age: ${context.demographics.age}${context.demographics.gender ? `, ${context.demographics.gender}` : ''}`)
    }

    statusParts.push(`Total visits: ${context.visitCount}${context.lastVisitDate ? `, last: ${new Date(context.lastVisitDate).toLocaleDateString()}` : ''}`)

    // Active episodes
    if (context.activeEpisodes.length > 0) {
      statusParts.push(`\n**Active Treatment Episodes (${context.activeEpisodes.length}):**`)
      for (const ep of context.activeEpisodes) {
        statusParts.push(`• Teeth ${ep.linkedTeeth.join(',')}: ${ep.diagnosis} — ${ep.status} (${ep.completedVisits}/${ep.plannedVisits} visits)`)
        if (ep.nextSteps) {
          statusParts.push(`  Next: ${ep.nextSteps}`)
        }
      }
    } else {
      statusParts.push('\nNo active treatment episodes.')
    }

    // Specific tooth context if requested
    if (context.toothContext) {
      const tc = context.toothContext
      statusParts.push(`\n**Tooth ${tc.toothNumber}:**`)
      statusParts.push(`Status: ${tc.currentStatus || 'no record'}`)
      if (tc.previousDiagnoses.length) statusParts.push(`Diagnoses: ${tc.previousDiagnoses.join(', ')}`)
      if (tc.previousTreatments.length) statusParts.push(`Treatments: ${tc.previousTreatments.join(', ')}`)
      if (tc.activeEpisode) {
        statusParts.push(`Episode: ${tc.activeEpisode.status}, ${tc.activeEpisode.completedVisits}/${tc.activeEpisode.plannedVisits} visits`)
      }
    }

    // Recent consultations
    if (context.previousConsultations.length > 0) {
      const recent = context.previousConsultations.slice(0, 3)
      statusParts.push(`\n**Recent Consultations:**`)
      for (const pc of recent) {
        const date = new Date(pc.date).toLocaleDateString()
        statusParts.push(`• ${date}: ${pc.chiefComplaint || 'No chief complaint'}`)
        if (pc.diagnoses.length) statusParts.push(`  Dx: ${pc.diagnoses.join('; ')}`)
      }
    }

    // Teeth overview
    const teethWithIssues = Object.entries(context.allTeethStatus).filter(([_, s]) => s !== 'healthy')
    if (teethWithIssues.length > 0) {
      statusParts.push(`\n**Dental Overview:** ${teethWithIssues.length} teeth with findings`)
    }

    return {
      agentName: 'PatientStatusAgent',
      success: true,
      data: {
        action: 'patient_status',
        patientId,
        patientName: fullName,
        context,  // Full context for frontend if needed
        message: statusParts.join('\n')
      },
      processingTime: Date.now() - start
    }
  } catch (err: any) {
    return {
      agentName: 'PatientStatusAgent',
      success: false,
      error: err.message,
      processingTime: Date.now() - start
    }
  }
}
