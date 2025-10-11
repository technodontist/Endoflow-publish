'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface ParsedTaskRequest {
  taskTitle: string
  taskDescription: string
  assignedToName?: string // Assistant name
  assignedToId?: string // Will be resolved from name
  priority: 'urgent' | 'high' | 'medium' | 'low'
  category?: string
  dueDate?: string // YYYY-MM-DD
  dueTime?: string // HH:MM
  patientName?: string
  patientId?: string // Will be resolved from name
  isUrgent: boolean
  notes?: string
  confidence: number // 0-100
  rawInput: string
}

/**
 * Parse natural language task request using Gemini AI
 *
 * Examples:
 * - "Assign high priority task to verify Sarah's insurance by tomorrow"
 * - "Create urgent task for John to call patient Mike about appointment confirmation"
 * - "Add task to prepare treatment room for RCT patient tomorrow at 2 PM"
 * - "Schedule file organization task for next Monday with medium priority"
 */
export async function parseTaskRequest(
  naturalLanguageInput: string,
  availableAssistants?: Array<{ id: string; full_name: string }>,
  availablePatients?: Array<{ id: string; first_name: string; last_name: string }>,
  defaultAssistantId?: string
): Promise<{ success: boolean; data?: ParsedTaskRequest; error?: string }> {

  try {
    console.log('🤖 [AI TASK PARSER] Parsing request:', naturalLanguageInput)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent parsing
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    })

    const currentDate = new Date().toISOString().split('T')[0]
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5)

    // Build assistant context if available
    let assistantContext = ''
    if (availableAssistants && availableAssistants.length > 0) {
      const assistantList = availableAssistants.map(a => a.full_name).join(', ')
      assistantContext = `\n\nAvailable Assistants:\n${assistantList}\n\nIMPORTANT: If the request mentions an assistant name, match it to one from this list. If no assistant is specified, set assignedToName to null (task will be unassigned or auto-assigned).`
    }

    // Build patient context if available
    let patientContext = ''
    if (availablePatients && availablePatients.length > 0) {
      const patientList = availablePatients.map(p => `${p.first_name} ${p.last_name}`).join(', ')
      patientContext = `\n\nAvailable Patients:\n${patientList}\n\nIMPORTANT: If the request mentions a patient name, match it to one from this list. Set patientName to null if no patient is mentioned.`
    }

    const prompt = `You are an AI task management assistant for a dental clinic. Parse the following natural language task request into structured JSON.

Current Date: ${currentDate}
Current Time: ${currentTime}

Natural Language Request: "${naturalLanguageInput}"${assistantContext}${patientContext}

Extract the following information and return ONLY a valid JSON object (no markdown, no explanation):

{
  "taskTitle": "Clear, concise task title (40 characters max, REQUIRED)",
  "taskDescription": "Detailed description of what needs to be done (REQUIRED)",
  "assignedToName": "Full name of the assistant if mentioned, null if not specified",
  "priority": "One of: 'urgent', 'high', 'medium', 'low'. RULES: 'urgent' for time-sensitive emergencies, 'high' for important/ASAP tasks, 'medium' for normal priority, 'low' for when-possible tasks",
  "category": "Task category (e.g., 'Patient Verification', 'Appointment', 'File Management', 'Treatment Prep', 'Follow-up', 'Administrative', 'Communication', etc.)",
  "dueDate": "YYYY-MM-DD format if mentioned (null if not specified). Parse relative dates like 'tomorrow', 'next Monday', etc.",
  "dueTime": "HH:MM in 24-hour format if mentioned (null if not specified)",
  "patientName": "Full name of the patient if task is related to a specific patient, null otherwise",
  "isUrgent": "true if priority is 'urgent' or request emphasizes urgency/emergency, false otherwise",
  "notes": "Any additional context, special instructions, or important details",
  "confidence": "Your confidence in parsing accuracy (0-100)"
}

IMPORTANT RULES:
1. TASK TITLE: Keep concise, action-oriented (e.g., "Verify patient insurance", "Prepare treatment room", "Call patient for confirmation")
2. PRIORITY DETECTION:
   - "urgent": Emergency keywords like "urgent", "ASAP", "immediately", "emergency", "critical"
   - "high": Important keywords like "high priority", "important", "soon", "quickly"
   - "medium": Default for most tasks, or keywords like "normal", "standard", "medium"
   - "low": When-possible keywords like "low priority", "when free", "sometime", "eventually"
3. DATE PARSING: "tomorrow" = add 1 day, "next Monday" = find next Monday from current date, "by Friday" = this/next Friday
4. CATEGORY INFERENCE: Detect from context:
   - Patient verification/registration → "Patient Verification"
   - Appointment-related → "Appointment"
   - File/document work → "File Management"
   - Treatment preparation → "Treatment Prep"
   - Follow-up calls/emails → "Follow-up"
   - General admin → "Administrative"
   - Communication → "Communication"
5. PATIENT CONTEXT: Extract patient name if task mentions a specific patient (e.g., "call John Doe", "verify Sarah's insurance")
6. ASSISTANT ASSIGNMENT: Match names to available assistants. If unspecified, set to null for auto-assignment
7. URGENCY FLAG: Set true only for genuinely urgent/time-critical tasks
8. Confidence should be high (80+) if all key info is clear, medium (50-79) if some info is inferred, low (<50) if critical info is missing

Return ONLY the JSON object, no other text.`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    console.log('🤖 [AI TASK PARSER] Raw AI response:', responseText)

    // Clean the response - remove markdown code blocks if present
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim()
    }

    // Parse the JSON
    const parsed: ParsedTaskRequest = JSON.parse(jsonText)

    // Add the raw input for reference
    parsed.rawInput = naturalLanguageInput

    // Validate required fields
    if (!parsed.taskTitle || !parsed.taskDescription) {
      console.error('❌ [AI TASK PARSER] Missing required fields:', parsed)

      const missing: string[] = []
      if (!parsed.taskTitle) missing.push('task title')
      if (!parsed.taskDescription) missing.push('task description')

      const missingStr = missing.join(', ')

      return {
        success: false,
        error: `Unable to create task. Missing ${missingStr}. Please provide clear task details. Example: "Create high priority task to verify new patient registration by tomorrow"`
      }
    }

    // Validate priority
    const validPriorities = ['urgent', 'high', 'medium', 'low']
    if (!validPriorities.includes(parsed.priority)) {
      parsed.priority = 'medium' // Default to medium if invalid
    }

    // Resolve assistant ID from name
    if (parsed.assignedToName && availableAssistants) {
      const matchedAssistant = availableAssistants.find(
        a => a.full_name.toLowerCase().includes(parsed.assignedToName!.toLowerCase()) ||
             parsed.assignedToName!.toLowerCase().includes(a.full_name.toLowerCase())
      )
      if (matchedAssistant) {
        parsed.assignedToId = matchedAssistant.id
        console.log(`✅ [AI TASK PARSER] Matched assistant: ${matchedAssistant.full_name} (${matchedAssistant.id})`)
      } else {
        console.warn(`⚠️ [AI TASK PARSER] Could not match assistant name: ${parsed.assignedToName}`)
      }
    } else if (defaultAssistantId) {
      // Auto-assign to default assistant if no assignment specified
      parsed.assignedToId = defaultAssistantId
      console.log(`✅ [AI TASK PARSER] Auto-assigned to default assistant: ${defaultAssistantId}`)
    }

    // Resolve patient ID from name
    if (parsed.patientName && availablePatients) {
      const nameParts = parsed.patientName.trim().split(' ')
      const matchedPatient = availablePatients.find(p => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
        const searchName = parsed.patientName!.toLowerCase()
        return fullName.includes(searchName) || searchName.includes(fullName)
      })
      if (matchedPatient) {
        parsed.patientId = matchedPatient.id
        parsed.patientName = `${matchedPatient.first_name} ${matchedPatient.last_name}`
        console.log(`✅ [AI TASK PARSER] Matched patient: ${parsed.patientName} (${parsed.patientId})`)
      } else {
        console.warn(`⚠️ [AI TASK PARSER] Could not match patient name: ${parsed.patientName}`)
      }
    }

    // Validate date format if provided
    if (parsed.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
      console.warn(`⚠️ [AI TASK PARSER] Invalid date format: ${parsed.dueDate}, removing`)
      parsed.dueDate = undefined
    }

    // Validate time format if provided
    if (parsed.dueTime && !/^\d{2}:\d{2}$/.test(parsed.dueTime)) {
      console.warn(`⚠️ [AI TASK PARSER] Invalid time format: ${parsed.dueTime}, removing`)
      parsed.dueTime = undefined
    }

    // Ensure date is not in the past if provided
    if (parsed.dueDate) {
      const dueDate = new Date(parsed.dueDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (dueDate < today) {
        console.warn(`⚠️ [AI TASK PARSER] Due date is in the past: ${parsed.dueDate}, removing`)
        parsed.dueDate = undefined
      }
    }

    // Sync isUrgent with priority
    if (parsed.priority === 'urgent') {
      parsed.isUrgent = true
    }

    console.log('✅ [AI TASK PARSER] Successfully parsed:', parsed)

    return {
      success: true,
      data: parsed
    }

  } catch (error) {
    console.error('❌ [AI TASK PARSER] Parsing error:', error)

    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        return {
          success: false,
          error: 'Failed to parse AI response. The request might be too ambiguous. Please provide more details about what needs to be done.'
        }
      }
      return {
        success: false,
        error: `Parsing error: ${error.message}`
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred while parsing the task request.'
    }
  }
}

/**
 * Generate natural language confirmation message for task
 */
function generateTaskConfirmationInternal(parsed: ParsedTaskRequest): string {
  const priorityEmoji = {
    urgent: '🚨',
    high: '⚡',
    medium: '📋',
    low: '📝'
  }[parsed.priority]

  const assignmentInfo = parsed.assignedToName
    ? ` and assigned to **${parsed.assignedToName}**`
    : ' (unassigned - will auto-assign)'

  let dueDateInfo = ''
  if (parsed.dueDate) {
    const date = new Date(parsed.dueDate)
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })

    if (parsed.dueTime) {
      const [hours, minutes] = parsed.dueTime.split(':').map(Number)
      const period = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
      const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
      dueDateInfo = ` Due by **${dateStr}** at **${timeStr}**`
    } else {
      dueDateInfo = ` Due by **${dateStr}**`
    }
  }

  const patientInfo = parsed.patientName ? `\n📌 Related to patient: **${parsed.patientName}**` : ''
  const categoryInfo = parsed.category ? `\n🏷️ Category: ${parsed.category}` : ''

  return `✅ ${priorityEmoji} Task created${assignmentInfo}!

**${parsed.taskTitle}**
${parsed.taskDescription}${dueDateInfo}${patientInfo}${categoryInfo}`
}

// Export utility function
export const generateTaskConfirmation = generateTaskConfirmationInternal
