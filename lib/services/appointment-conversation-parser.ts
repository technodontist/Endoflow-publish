import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface AppointmentExtraction {
  patientName?: string
  patientId?: string
  appointmentType: string
  preferredDate: string
  preferredTime: string
  dentistPreference?: string
  painLevel?: number
  urgencyLevel: 'low' | 'medium' | 'high' | 'urgent'
  reasonForVisit: string
  additionalNotes?: string
  durationMinutes: number
  confidence: number
  auto_extracted: boolean
  extraction_timestamp: string
}

export async function analyzeAppointmentConversation(
  transcript: string
): Promise<AppointmentExtraction> {
  console.log('🤖 [GEMINI AI] Starting appointment conversation analysis...')

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are an AI assistant helping to schedule dental appointments. Analyze the following voice transcript and extract appointment scheduling information.

TRANSCRIPT:
${transcript}

Extract the following information if mentioned:
1. Patient name (full name if mentioned)
2. Patient ID (if mentioned)
3. Appointment type (e.g., "routine checkup", "teeth cleaning", "root canal", "emergency", "consultation", "filling", "extraction", "crown", etc.)
4. Preferred date (parse natural language like "tomorrow", "next Monday", "this Friday", specific dates)
5. Preferred time (e.g., "2 PM", "morning", "afternoon", "evening", specific times)
6. Dentist preference (if a specific dentist is mentioned)
7. Pain level (0-10 scale if mentioned)
8. Urgency (assess as: low, medium, high, or urgent based on context)
9. Reason for visit (brief description of the problem or need)
10. Additional notes (any special requests or information)
11. Duration estimate in minutes (default 60 for routine, 90 for complex procedures)

Today's date is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "patientName": "string or null",
  "patientId": "string or null",
  "appointmentType": "string (default: 'General Consultation')",
  "preferredDate": "YYYY-MM-DD format",
  "preferredTime": "HH:MM format (24-hour)",
  "dentistPreference": "string or null",
  "painLevel": number (0-10) or null,
  "urgencyLevel": "low" | "medium" | "high" | "urgent",
  "reasonForVisit": "string",
  "additionalNotes": "string or null",
  "durationMinutes": number (default 60),
  "confidence": number (0-100)
}

Important:
- For relative dates like "tomorrow", calculate the actual date
- For "next Monday/Tuesday/etc", calculate the date of the next occurrence
- For "this week", assume within the next 7 days
- If time mentions "morning", use "09:00", "afternoon" use "14:00", "evening" use "17:00"
- Assess confidence based on clarity and completeness of information (0-100%)
- If appointment type is unclear, use "General Consultation"
- Urgency should be "urgent" if pain level >= 8 or words like "emergency", "urgent", "ASAP" are used
- Urgency should be "high" if pain level 5-7 or words like "soon", "quickly" are used`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    console.log('🤖 [GEMINI AI] Raw response:', text.substring(0, 200))

    // Clean up response to extract JSON
    let jsonText = text.trim()
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    
    // Try to find JSON object in the response
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    const extraction: AppointmentExtraction = JSON.parse(jsonText)

    // Add metadata
    extraction.auto_extracted = true
    extraction.extraction_timestamp = new Date().toISOString()

    console.log(`✅ [GEMINI AI] Appointment analysis complete with ${extraction.confidence}% confidence`)
    console.log('📅 [GEMINI AI] Extracted appointment:', {
      type: extraction.appointmentType,
      date: extraction.preferredDate,
      time: extraction.preferredTime,
      urgency: extraction.urgencyLevel
    })

    return extraction

  } catch (error) {
    console.error('❌ [GEMINI AI] Appointment analysis failed:', error)
    
    // Fallback to basic keyword extraction
    return fallbackAppointmentExtraction(transcript)
  }
}

function fallbackAppointmentExtraction(transcript: string): AppointmentExtraction {
  console.log('⚠️ [FALLBACK] Using basic keyword extraction for appointment')
  
  const lowerTranscript = transcript.toLowerCase()
  
  // Extract appointment type
  let appointmentType = 'General Consultation'
  const types = [
    { keywords: ['cleaning', 'hygiene', 'scale', 'polish'], type: 'Teeth Cleaning' },
    { keywords: ['checkup', 'check-up', 'routine', 'regular'], type: 'Routine Checkup' },
    { keywords: ['root canal', 'endodontic'], type: 'Root Canal Treatment' },
    { keywords: ['filling', 'cavity'], type: 'Filling' },
    { keywords: ['extraction', 'remove tooth', 'pull tooth'], type: 'Tooth Extraction' },
    { keywords: ['crown', 'cap'], type: 'Crown Placement' },
    { keywords: ['emergency', 'urgent', 'pain'], type: 'Emergency Visit' },
    { keywords: ['consultation', 'consult'], type: 'Consultation' },
  ]
  
  for (const typeInfo of types) {
    if (typeInfo.keywords.some(keyword => lowerTranscript.includes(keyword))) {
      appointmentType = typeInfo.type
      break
    }
  }
  
  // Extract pain level
  let painLevel: number | undefined
  const painMatch = lowerTranscript.match(/pain.*?(\d+).*?(?:out of|\/)\s*10/i)
  if (painMatch) {
    painLevel = parseInt(painMatch[1])
  }
  
  // Determine urgency
  let urgencyLevel: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  if (lowerTranscript.includes('emergency') || lowerTranscript.includes('urgent') || lowerTranscript.includes('asap')) {
    urgencyLevel = 'urgent'
  } else if (painLevel && painLevel >= 8) {
    urgencyLevel = 'urgent'
  } else if (painLevel && painLevel >= 5) {
    urgencyLevel = 'high'
  } else if (lowerTranscript.includes('soon') || lowerTranscript.includes('quickly')) {
    urgencyLevel = 'high'
  }
  
  // Extract time preference
  let preferredTime = '09:00'
  if (lowerTranscript.includes('afternoon')) {
    preferredTime = '14:00'
  } else if (lowerTranscript.includes('evening')) {
    preferredTime = '17:00'
  } else if (lowerTranscript.includes('morning')) {
    preferredTime = '09:00'
  }
  
  // Time pattern matching (e.g., "2 PM", "14:00")
  const timeMatch = lowerTranscript.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = timeMatch[2] || '00'
    const meridiem = timeMatch[3]?.toLowerCase()
    
    if (meridiem === 'pm' && hours < 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0
    
    preferredTime = `${hours.toString().padStart(2, '0')}:${minutes}`
  }
  
  // Calculate preferred date (default to tomorrow)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  let preferredDate = tomorrow.toISOString().split('T')[0]
  
  if (lowerTranscript.includes('today')) {
    preferredDate = new Date().toISOString().split('T')[0]
  } else if (lowerTranscript.includes('tomorrow')) {
    preferredDate = tomorrow.toISOString().split('T')[0]
  }
  
  return {
    appointmentType,
    preferredDate,
    preferredTime,
    painLevel,
    urgencyLevel,
    reasonForVisit: appointmentType,
    durationMinutes: appointmentType.includes('Root Canal') || appointmentType.includes('Crown') ? 90 : 60,
    confidence: 25,
    auto_extracted: true,
    extraction_timestamp: new Date().toISOString()
  }
}

// Helper function to detect appointment keywords in real-time
export function detectAppointmentKeywords(transcript: string) {
  const lowerTranscript = transcript.toLowerCase()
  
  return {
    hasPatientName: /patient|for ([a-z]+\s[a-z]+)/i.test(transcript),
    hasAppointmentType: /cleaning|checkup|root canal|filling|extraction|crown|emergency/i.test(transcript),
    hasDateMention: /tomorrow|today|monday|tuesday|wednesday|thursday|friday|next week|this week/i.test(transcript),
    hasTimeMention: /morning|afternoon|evening|\d+\s*(?:am|pm)|o'clock/i.test(transcript),
    hasUrgency: /urgent|emergency|asap|pain|hurts?/i.test(transcript),
    estimatedConfidence: calculateQuickConfidence(transcript)
  }
}

function calculateQuickConfidence(transcript: string): number {
  let score = 0
  const lowerTranscript = transcript.toLowerCase()
  
  // Check for key elements
  if (/appointment|schedule|book/.test(lowerTranscript)) score += 20
  if (/cleaning|checkup|root canal|filling|extraction/.test(lowerTranscript)) score += 20
  if (/tomorrow|today|monday|tuesday|wednesday|thursday|friday/.test(lowerTranscript)) score += 20
  if (/morning|afternoon|evening|\d+\s*(?:am|pm)/.test(lowerTranscript)) score += 20
  if (transcript.length > 50) score += 20
  
  return Math.min(100, score)
}
