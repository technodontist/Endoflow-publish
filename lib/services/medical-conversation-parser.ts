/**
 * Medical Conversation Parser using Gemini AI
 * Analyzes dentist-patient voice conversations and extracts structured medical data
 * for Chief Complaint and HOPI tabs
 */

import { generateChatCompletion, GeminiChatMessage } from './gemini-ai'

export interface ChiefComplaintData {
  primary_complaint: string
  patient_description: string
  pain_scale: number
  location_detail: string
  onset_duration: string
  associated_symptoms: string[]
  triggers?: string[]
}

export interface HOPIData {
  pain_characteristics: {
    quality: string
    intensity: number
    frequency: string
    duration: string
  }
  onset_details: {
    when_started: string
    how_started: string
    precipitating_factors: string[]
  }
  aggravating_factors: string[]
  relieving_factors: string[]
  associated_symptoms: string[]
  previous_episodes?: string
  pattern_changes?: string
}

export interface VoiceTranscriptAnalysis {
  chiefComplaint: ChiefComplaintData
  hopi: HOPIData
  confidence: number
  auto_extracted: boolean
  extraction_timestamp: string
}

/**
 * Analyze medical conversation transcript using Gemini AI
 * Extracts structured Chief Complaint and HOPI data from dentist-patient conversation
 *
 * @param transcript - Raw voice transcript text
 * @returns Structured medical data with confidence scores
 */
export async function analyzeMedicalConversation(
  transcript: string
): Promise<VoiceTranscriptAnalysis> {
  console.log('🤖 [MEDICAL PARSER] Starting Gemini AI analysis...')
  console.log('📝 [MEDICAL PARSER] Transcript length:', transcript.length, 'characters')

  const systemInstruction = `You are an expert dental AI assistant analyzing dentist-patient conversations.
Your task is to extract structured medical information from voice transcripts.

EXTRACTION RULES:
1. Extract information ONLY if explicitly mentioned in the conversation
2. Leave fields empty ("") or use empty arrays ([]) if information is not discussed
3. Use the patient's actual words when possible for descriptions
4. Convert verbal pain descriptions to numeric scales (0-10)
5. Identify temporal information (when, how long, frequency)
6. Distinguish between aggravating and relieving factors
7. Calculate confidence based on clarity and completeness of information

PAIN SCALE MAPPING:
- "no pain" → 0
- "mild" → 1-3
- "moderate" → 4-6
- "severe" → 7-9
- "worst pain ever" → 10

PAIN QUALITY KEYWORDS:
- Sharp, stabbing, shooting → "sharp"
- Dull, aching → "dull"
- Throbbing, pulsating → "throbbing"
- Burning → "burning"
- Constant → "constant"
- Intermittent, comes and goes → "intermittent"

RESPOND ONLY WITH VALID JSON in this exact format:
{
  "chiefComplaint": {
    "primary_complaint": "Main issue patient came in for",
    "patient_description": "Patient's own words describing the problem",
    "pain_scale": 0-10,
    "location_detail": "Which tooth/area (e.g., 'upper right molar', 'tooth #14')",
    "onset_duration": "When it started and how long (e.g., '3 days ago', 'last week')",
    "associated_symptoms": ["symptom1", "symptom2"],
    "triggers": ["what makes it worse"]
  },
  "hopi": {
    "pain_characteristics": {
      "quality": "sharp/dull/throbbing/aching/burning/constant/intermittent",
      "intensity": 0-10,
      "frequency": "constant/intermittent/occasional",
      "duration": "hours/days/weeks/months"
    },
    "onset_details": {
      "when_started": "Specific time/date mentioned",
      "how_started": "sudden/gradual/after trauma/after procedure",
      "precipitating_factors": ["factor1", "factor2"]
    },
    "aggravating_factors": ["cold", "hot", "chewing", "pressure", "sweet"],
    "relieving_factors": ["painkillers", "rest", "cold compress", "specific position"],
    "associated_symptoms": ["swelling", "bleeding", "fever", "bad taste", "sensitivity"],
    "previous_episodes": "Has this happened before?",
    "pattern_changes": "Is the pain getting better or worse?"
  },
  "confidence": 0-100,
  "auto_extracted": true,
  "extraction_timestamp": "${new Date().toISOString()}"
}

CONFIDENCE SCORING:
- 90-100: Clear, complete information with specific details
- 70-89: Most key information present, some details missing
- 50-69: Basic information present, many details missing
- 30-49: Vague symptoms, limited information
- 0-29: Very little relevant medical information extracted`

  try {
    const messages: GeminiChatMessage[] = [{
      role: 'user',
      parts: [{
        text: `Analyze this dentist-patient conversation and extract Chief Complaint and HOPI data:\n\n${transcript}\n\nProvide structured JSON output as specified.`
      }]
    }]

    console.log('🔄 [MEDICAL PARSER] Calling Gemini API...')
    const response = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.2, // Low temperature for consistent medical data extraction
      maxOutputTokens: 2048,
      systemInstruction,
      responseFormat: 'json'
    })

    console.log('✅ [MEDICAL PARSER] Received Gemini response')
    console.log('📄 [MEDICAL PARSER] Response preview:', response.substring(0, 200) + '...')

    // Parse and validate the JSON response
    const analysis = JSON.parse(response)

    // Validate required fields
    if (!analysis.chiefComplaint || !analysis.hopi) {
      throw new Error('Invalid response structure: missing required fields')
    }

    console.log(`✅ [MEDICAL PARSER] Analysis complete with ${analysis.confidence}% confidence`)
    console.log('🎯 [MEDICAL PARSER] Chief Complaint:', analysis.chiefComplaint.primary_complaint)
    console.log('🎯 [MEDICAL PARSER] Pain Quality:', analysis.hopi.pain_characteristics.quality)

    return analysis

  } catch (error) {
    console.error('❌ [MEDICAL PARSER] Analysis failed:', error)

    // Return empty structure with low confidence instead of throwing
    return {
      chiefComplaint: {
        primary_complaint: '',
        patient_description: transcript.substring(0, 200), // Keep first 200 chars as fallback
        pain_scale: 0,
        location_detail: '',
        onset_duration: '',
        associated_symptoms: [],
        triggers: []
      },
      hopi: {
        pain_characteristics: {
          quality: '',
          intensity: 0,
          frequency: '',
          duration: ''
        },
        onset_details: {
          when_started: '',
          how_started: '',
          precipitating_factors: []
        },
        aggravating_factors: [],
        relieving_factors: [],
        associated_symptoms: [],
        previous_episodes: '',
        pattern_changes: ''
      },
      confidence: 0,
      auto_extracted: false,
      extraction_timestamp: new Date().toISOString()
    }
  }
}

/**
 * Helper: Detect medical keywords in transcript for real-time UI feedback
 * @param transcript - Voice transcript text
 * @param keywords - Keywords to search for
 * @returns Array of detected keywords
 */
export function detectKeywords(transcript: string, keywords: string[]): string[] {
  const lowerTranscript = transcript.toLowerCase()
  return keywords.filter(keyword => lowerTranscript.includes(keyword.toLowerCase()))
}

/**
 * Helper: Analyze conversation completeness for UI indicators
 * @param transcript - Voice transcript text
 * @returns Object with detected sections and confidence
 */
export function analyzeConversationCompleteness(transcript: string): {
  hasChiefComplaint: boolean
  hasHOPI: boolean
  hasPainDescription: boolean
  estimatedConfidence: number
} {
  const lowerTranscript = transcript.toLowerCase()

  // Chief complaint indicators
  const chiefComplaintKeywords = ['complaint', 'problem', 'pain', 'hurt', 'ache', 'came in for']
  const hasChiefComplaint = chiefComplaintKeywords.some(kw => lowerTranscript.includes(kw))

  // HOPI indicators
  const hopiKeywords = ['started', 'began', 'when', 'how long', 'sharp', 'dull', 'throbbing']
  const hasHOPI = hopiKeywords.some(kw => lowerTranscript.includes(kw))

  // Pain description indicators
  const painDescriptors = ['sharp', 'dull', 'throbbing', 'aching', 'burning', 'shooting']
  const hasPainDescription = painDescriptors.some(kw => lowerTranscript.includes(kw))

  // Estimate confidence based on detected elements
  let estimatedConfidence = 0
  if (hasChiefComplaint) estimatedConfidence += 40
  if (hasHOPI) estimatedConfidence += 30
  if (hasPainDescription) estimatedConfidence += 30

  return {
    hasChiefComplaint,
    hasHOPI,
    hasPainDescription,
    estimatedConfidence
  }
}
