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
  previous_treatments?: string[]
}

export interface MedicalHistoryData {
  medical_conditions: string[] // e.g., ["Diabetes", "Hypertension"]
  current_medications: string[] // e.g., ["Lisinopril 10mg daily", "Metformin 500mg"]
  allergies: string[] // e.g., ["Penicillin", "Latex"]
  previous_dental_treatments: string[] // e.g., ["Fillings", "Root canal"]
  family_medical_history?: string // Free text
  additional_notes?: string // Free text
}

export interface PersonalHistoryData {
  smoking: {
    status: 'never' | 'current' | 'former'
    details?: string // e.g., "1 pack per day for 10 years"
  }
  alcohol: {
    status: 'never' | 'occasional' | 'regular' | 'heavy'
    details?: string // e.g., "2-3 drinks on weekends"
  }
  tobacco: {
    status: 'never' | 'current' | 'former'
    type?: string[] // e.g., ["Chewing tobacco", "Betel nut"]
    details?: string
  }
  dietary_habits: string[] // e.g., ["High sugar diet", "Frequent snacking"]
  oral_hygiene: {
    brushing_frequency?: string // e.g., "twice daily"
    flossing?: string // e.g., "rarely"
    last_cleaning?: string // e.g., "6 months ago"
  }
  other_habits: string[] // e.g., ["Nail biting", "Teeth grinding"]
  occupation?: string
  lifestyle_notes?: string
}

export interface ClinicalExaminationData {
  extraoral_findings: string[] // e.g., ["Facial asymmetry", "TMJ tenderness"]
  intraoral_findings: string[] // e.g., ["Caries present", "Gingival inflammation"]
  oral_hygiene: string // e.g., "Fair", "Poor"
  gingival_condition: string // e.g., "Mild gingivitis"
  periodontal_status: string // e.g., "Healthy"
  occlusion_notes: string[] // e.g., ["Class II", "Crossbite"]
  additional_observations?: string
}

export interface VoiceTranscriptAnalysis {
  chiefComplaint: ChiefComplaintData
  hopi: HOPIData
  medicalHistory?: MedicalHistoryData
  personalHistory?: PersonalHistoryData
  clinicalExamination?: ClinicalExaminationData
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
1. Extract information if explicitly mentioned OR can be reasonably inferred from context
2. Use your medical knowledge to interpret conversational language into clinical terms
3. For missing information, leave fields empty ("") or use empty arrays ([])
4. Use the patient's actual words when possible, but standardize medical terminology
5. Convert verbal pain descriptions to numeric scales (0-10) using clinical judgment
6. Map conversational phrases to medical terms:
   - "hurts" / "aching" / "sore" → pain
   - "back tooth" → posterior teeth / molars
   - "killing me" → severe pain (8-9/10)
   - "a little uncomfortable" → mild pain (2-3/10)
7. Identify temporal information (when, how long, frequency) and calculate actual timeframes
8. IMPORTANT: Extract specific tooth numbers when mentioned:
   - "tooth 44" / "tooth number 44" / "#44" → Include exact tooth number in location_detail
   - "upper right molar" → Include quadrant and tooth type
   - Always preserve tooth numbers in the location_detail field
8. Distinguish between aggravating and relieving factors, including synonyms:
   - "worse with" / "triggered by" / "bothers me when" → aggravating
   - "better with" / "helped by" / "relief from" → relieving
9. Handle speech corrections: if patient corrects themselves, use the corrected information
10. Extract previous treatments mentioned:
   - "took ibuprofen" / "tried painkillers" → pain medication
   - "went to ER" / "saw another dentist" → previous dental visit
   - "antibiotics" / "amoxicillin" → antibiotics
   - "home remedy" / "salt water rinse" → home remedies
11. Extract medical history information:
   - Medical conditions: "diabetes", "hypertension", "heart disease", "asthma", etc.
   - Medications: Extract drug names with dosages if mentioned
   - Allergies: "allergic to penicillin", "latex allergy", etc.
   - Previous dental treatments: "had fillings", "root canal done", etc.
12. Extract personal history habits:
   - Smoking: "I smoke", "pack a day", "quit 2 years ago" → current/former/never
   - Alcohol: "drink socially", "few beers a week" → occasional/regular/heavy/never
   - Tobacco: "chew tobacco", "paan", "betel nut" → current/former/never
   - Other habits: "grind teeth", "bite nails", "clench jaw"
   - Oral hygiene: "brush twice", "don't floss", "last cleaning was..."
13. Extract clinical examination findings (only if dentist performs/mentions exam):
   - Extraoral: "face is symmetric", "TMJ clicking", "swelling present"
   - Intraoral: "see cavities", "gums are inflamed", "plaque buildup"
   - Oral hygiene status: "good hygiene", "fair", "poor"
   - Gingival/periodontal: "healthy gums", "gingivitis", "periodontitis"
14. Calculate confidence based on clarity, completeness, and how much inference was needed

PAIN SCALE MAPPING:
- "no pain" → 0
- "mild" → 1-3
- "moderate" → 4-6
- "severe" → 7-9
- "worst pain ever" → 10

PAIN QUALITY MAPPING (include synonyms and conversational phrases):
- Sharp, stabbing, shooting, like a knife, piercing → "sharp"
- Dull, aching, sore, annoying → "dull"
- Throbbing, pulsating, pounding, beating → "throbbing"
- Burning, hot, on fire → "burning"
- Constant, all the time, doesn't stop, continuous → "constant"
- Intermittent, comes and goes, on and off, sometimes → "intermittent"
- Pressure, tight, squeezing, heavy → "pressure"
- Radiating, spreading, moving → "radiating"

RESPOND ONLY WITH VALID JSON in this exact format:
{
  "chiefComplaint": {
    "primary_complaint": "Main issue patient came in for",
    "patient_description": "Patient's own words describing the problem",
    "pain_scale": 0-10,
    "location_detail": "MUST include specific tooth numbers if mentioned (e.g., 'tooth 44', 'tooth #14', 'upper right molar')",
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
    "pattern_changes": "Is the pain getting better or worse?",
    "previous_treatments": ["antibiotics", "pain medication", "filling", "root canal", "home remedies"]
  },
  "medicalHistory": {
    "medical_conditions": ["Diabetes", "Hypertension", "Heart Disease"],
    "current_medications": ["Lisinopril 10mg daily", "Metformin 500mg twice daily"],
    "allergies": ["Penicillin", "Latex"],
    "previous_dental_treatments": ["Fillings", "Root canal", "Dental cleaning"],
    "family_medical_history": "Any relevant family history mentioned",
    "additional_notes": "Any other medical information"
  },
  "personalHistory": {
    "smoking": {
      "status": "never/current/former",
      "details": "1 pack per day for 10 years" or ""
    },
    "alcohol": {
      "status": "never/occasional/regular/heavy",
      "details": "2-3 drinks on weekends" or ""
    },
    "tobacco": {
      "status": "never/current/former",
      "type": ["Chewing tobacco", "Betel nut"],
      "details": "Additional information" or ""
    },
    "dietary_habits": ["High sugar diet", "Frequent snacking", "Carbonated drinks"],
    "oral_hygiene": {
      "brushing_frequency": "twice daily",
      "flossing": "rarely",
      "last_cleaning": "6 months ago"
    },
    "other_habits": ["Nail biting", "Teeth grinding", "Jaw clenching"],
    "occupation": "Patient's occupation if mentioned",
    "lifestyle_notes": "Any lifestyle information"
  },
  "clinicalExamination": {
    "extraoral_findings": ["Facial asymmetry", "TMJ tenderness", "Swelling"],
    "intraoral_findings": ["Caries present", "Gingival inflammation", "Plaque buildup"],
    "oral_hygiene": "Excellent/Good/Fair/Poor",
    "gingival_condition": "Healthy/Mild gingivitis/Moderate gingivitis",
    "periodontal_status": "Healthy/Mild periodontitis/Moderate periodontitis",
    "occlusion_notes": ["Class II", "Crossbite", "Deep bite"],
    "additional_observations": "Any other findings"
  },
  "confidence": 0-100,
  "auto_extracted": true,
  "extraction_timestamp": "${new Date().toISOString()}"
}

NOTE: Only include medicalHistory, personalHistory, and clinicalExamination sections if relevant information is mentioned in the conversation. If these sections are not discussed, omit them from the response rather than returning empty objects.

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
        text: `Analyze this dentist-patient conversation and extract all relevant medical data:\n\n${transcript}\n\nProvide structured JSON output as specified. Include medicalHistory, personalHistory, and clinicalExamination sections ONLY if the conversation discusses these topics.`
      }]
    }]

    console.log('🔄 [MEDICAL PARSER] Calling Gemini API...')
    const response = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.2, // Low temperature for consistent medical data extraction
      maxOutputTokens: 4096, // Increased to handle comprehensive extraction
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
    
    if (analysis.medicalHistory) {
      console.log('📊 [MEDICAL PARSER] Medical History:', {
        conditions: analysis.medicalHistory.medical_conditions?.length || 0,
        medications: analysis.medicalHistory.current_medications?.length || 0,
        allergies: analysis.medicalHistory.allergies?.length || 0
      })
    }
    
    if (analysis.personalHistory) {
      console.log('👤 [MEDICAL PARSER] Personal History:', {
        smoking: analysis.personalHistory.smoking?.status,
        alcohol: analysis.personalHistory.alcohol?.status,
        habits: analysis.personalHistory.other_habits?.length || 0
      })
    }
    
    if (analysis.clinicalExamination) {
      console.log('🔍 [MEDICAL PARSER] Clinical Examination:', {
        extraoral: analysis.clinicalExamination.extraoral_findings?.length || 0,
        intraoral: analysis.clinicalExamination.intraoral_findings?.length || 0,
        oralHygiene: analysis.clinicalExamination.oral_hygiene
      })
    }

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
        pattern_changes: '',
        previous_treatments: []
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
