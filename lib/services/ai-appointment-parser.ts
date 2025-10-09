'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface ParsedAppointmentRequest {
  patientName: string
  patientFirstName?: string
  patientLastName?: string
  treatmentType: string
  appointmentType: 'treatment' | 'consultation' | 'follow_up' | 'first_visit'
  toothNumber?: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  duration?: number // minutes
  notes?: string
  confidence: number // 0-100
  rawInput: string
}

/**
 * Parse natural language appointment request using Gemini AI
 * 
 * Examples:
 * - "Schedule a treatment appointment for John Doe for RCT on tooth 34 on December 15th at 2 PM"
 * - "Make an appointment for final patient for root canal treatment on tooth 11 tomorrow at 10am"
 * - "Book Sarah for crown prep on tooth 16 next Monday at 3:30 PM"
 */
export async function parseAppointmentRequest(
  naturalLanguageInput: string,
  currentUserId?: string,
  availablePatients?: Array<{ id: string; first_name: string; last_name: string }>,
  pendingRequests?: Array<{ id: string; patient_id: string; patients?: { first_name: string; last_name: string } }>
): Promise<{ success: boolean; data?: ParsedAppointmentRequest; error?: string }> {
  
  try {
    console.log('🤖 [AI APPOINTMENT] Parsing request:', naturalLanguageInput)

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

    // Build patient context if available
    let patientContext = ''
    if (availablePatients && availablePatients.length > 0) {
      const patientList = availablePatients.map(p => `${p.first_name} ${p.last_name}`).join(', ')
      patientContext = `\n\nAvailable Patients in Database:\n${patientList}\n\nIMPORTANT: If the request mentions a patient name that could match one of these patients, use the exact name from this list. If no clear patient name is provided, set patientName to null.`
    }
    
    // Build pending requests context (for contextual references like "final patient", "last patient")
    if (pendingRequests && pendingRequests.length > 0) {
      const requestsList = pendingRequests.map((req, idx) => {
        const patientName = req.patients ? `${req.patients.first_name} ${req.patients.last_name}` : 'Unknown'
        return `Patient #${idx + 1}: ${patientName}`
      }).join('\n')
      
      patientContext += `\n\nPending Appointment Requests (in order):\n${requestsList}\n\nCONTEXT RULES:\n- "final patient", "last patient" = Patient #${pendingRequests.length} (${pendingRequests[pendingRequests.length - 1]?.patients?.first_name} ${pendingRequests[pendingRequests.length - 1]?.patients?.last_name})\n- "first patient" = Patient #1 (${pendingRequests[0]?.patients?.first_name} ${pendingRequests[0]?.patients?.last_name})\n- "patient #X" or "patient X" = refer to the numbered list above\n- Use the actual patient NAME from the list, not the positional reference`
    }

    const prompt = `You are an AI appointment scheduling assistant for a dental clinic. Parse the following natural language appointment request into structured JSON.

Current Date: ${currentDate}
Current Time: ${currentTime}

Natural Language Request: "${naturalLanguageInput}"${patientContext}

Extract the following information and return ONLY a valid JSON object (no markdown, no explanation):

{
  "patientName": "Full name of the patient (REQUIRED - must be a specific person's name, not a description like 'new patient' or 'final patient'). Set to null if no actual patient name is provided.",
  "patientFirstName": "First name only (if you can split it)",
  "patientLastName": "Last name only (if you can split it)",
  "treatmentType": "The specific treatment mentioned (e.g., 'RCT', 'Root Canal', 'Crown', 'Filling', 'Extraction', 'Consultation', 'Check-up', 'Follow-up', etc.)",
  "appointmentType": "One of: 'treatment', 'consultation', 'follow_up', 'first_visit'. RULES: Use 'first_visit' if explicitly mentioned as new patient or first visit. Use 'treatment' for specific procedures (RCT, crown, filling, extraction, etc.). Use 'follow_up' for post-treatment check-ups or follow-up visits. Use 'consultation' for general consultations, examinations, or when unclear.",
  "toothNumber": "FDI tooth number if mentioned (e.g., '11', '34', '46'), null if not specified",
  "date": "YYYY-MM-DD format (required). Parse relative dates like 'tomorrow', 'next Monday', etc. based on current date",
  "time": "HH:MM in 24-hour format (required). Parse times like '2 PM' as '14:00', '10am' as '10:00'",
  "duration": "Estimated duration in minutes (default 60 for treatment, 30 for consultation)",
  "notes": "Any additional notes or special instructions mentioned",
  "confidence": "Your confidence in parsing accuracy (0-100)"
}

IMPORTANT RULES:
1. For relative dates: "tomorrow" = add 1 day, "next Monday" = find next Monday from current date
2. Convert all times to 24-hour format
3. Default duration: 60 minutes for treatment, 30 minutes for consultation/follow-up/first_visit
4. APPOINTMENT TYPE DETECTION:
   - "first_visit": When request explicitly mentions "first visit", "new patient", "initial visit"
   - "treatment": For specific procedures like RCT, root canal, crown, filling, extraction, implant, bridge, veneer, scaling, cleaning (when therapeutic)
   - "follow_up": When mentions "follow-up", "check-up", "post-treatment", "review", "follow up"
   - "consultation": For general consultation, examination, assessment, evaluation, or when type is unclear
5. If tooth number uses different notation (like "#34" or "tooth 34"), extract just the number
6. Confidence should be high (80+) if all key info is clear, medium (50-79) if some info is inferred, low (<50) if critical info is missing
7. CRITICAL: patientName must be an actual person's name (e.g., "John Doe", "Sarah Smith"). Phrases like "final patient", "new patient", "next patient" are NOT valid patient names - set to null if these are used.
8. If the request is ambiguous about the patient (e.g., "schedule appointment for final patient"), set patientName to null and reduce confidence to <50.

Return ONLY the JSON object, no other text.`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    
    console.log('🤖 [AI APPOINTMENT] Raw AI response:', responseText)

    // Clean the response - remove markdown code blocks if present
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim()
    }

    // Parse the JSON
    const parsed: ParsedAppointmentRequest = JSON.parse(jsonText)
    
    // Add the raw input for reference
    parsed.rawInput = naturalLanguageInput

    // Validate required fields
    if (!parsed.patientName || !parsed.date || !parsed.time) {
      console.error('❌ [AI APPOINTMENT] Missing required fields:', parsed)
      
      // Provide more specific error messages
      const missing: string[] = []
      if (!parsed.patientName) missing.push('patient name')
      if (!parsed.date) missing.push('date')
      if (!parsed.time) missing.push('time')
      
      const missingStr = missing.join(', ')
      
      return {
        success: false,
        error: `Unable to schedule appointment. Missing ${missingStr}. Please provide the patient's full name, date, and time. Example: "Schedule appointment for John Doe tomorrow at 2 PM"`
      }
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      return {
        success: false,
        error: 'Invalid date format. Expected YYYY-MM-DD.'
      }
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(parsed.time)) {
      return {
        success: false,
        error: 'Invalid time format. Expected HH:MM.'
      }
    }

    // Ensure date is not in the past
    const appointmentDate = new Date(parsed.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (appointmentDate < today) {
      return {
        success: false,
        error: 'Cannot schedule appointments in the past.'
      }
    }

    console.log('✅ [AI APPOINTMENT] Successfully parsed:', parsed)

    return {
      success: true,
      data: parsed
    }

  } catch (error) {
    console.error('❌ [AI APPOINTMENT] Parsing error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        return {
          success: false,
          error: 'Failed to parse AI response. The request might be too ambiguous. Please provide more details.'
        }
      }
      return {
        success: false,
        error: `Parsing error: ${error.message}`
      }
    }
    
    return {
      success: false,
      error: 'An unexpected error occurred while parsing the appointment request.'
    }
  }
}

/**
 * Generate natural language confirmation message for appointment
 * This is a utility function, not a server action
 */
function generateAppointmentConfirmationInternal(parsed: ParsedAppointmentRequest): string {
  const date = new Date(parsed.date)
  const dateStr = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  const time = parsed.time
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`

  const toothInfo = parsed.toothNumber ? ` on tooth #${parsed.toothNumber}` : ''
  
  return `✅ Appointment scheduled for **${parsed.patientName}** on **${dateStr}** at **${timeStr}** for **${parsed.treatmentType}**${toothInfo}.`
}

// Export utility function (not a server action)
export const generateAppointmentConfirmation = generateAppointmentConfirmationInternal
