/**
 * Dental Voice Parser
 * Extracts tooth-specific findings from voice transcripts using AI
 * Supports FDI notation and clinical terminology
 */

import { generateChatCompletion, GeminiChatMessage } from './gemini-ai'
import { ToothStatus, mapInitialStatusFromDiagnosis, getStatusColorCode } from '@/lib/utils/toothStatus'

export interface ToothFinding {
  tooth_number: string  // FDI notation: "11", "16", "36", etc.
  status: ToothStatus
  diagnosis: string[]
  treatment: string[]
  urgency: 'immediate' | 'urgent' | 'routine' | 'observation'
  confidence: number
  notes?: string
  colorCode?: string
}

export interface DentalExaminationData {
  tooth_findings: ToothFinding[]
  general_findings: {
    periodontal_status?: string
    occlusion?: string
    oral_hygiene?: string
    additional_notes?: string
  }
  confidence: number
  auto_extracted: boolean
  extraction_timestamp: string
}

/**
 * Extract dental findings from voice transcript using Gemini AI
 * @param transcript - Raw voice transcript
 * @param patientId - Patient ID for context (optional)
 * @returns Structured dental examination data with tooth findings
 */
export async function extractDentalFindings(
  transcript: string,
  patientId?: string
): Promise<DentalExaminationData> {
  console.log('🦷 [DENTAL PARSER] Starting dental finding extraction...')
  console.log('📝 [DENTAL PARSER] Transcript length:', transcript.length, 'characters')

  const systemInstruction = `You are an expert dental AI assistant analyzing dentist examination voice transcripts.
Your task is to extract structured tooth-specific findings and map them to FDI notation.

TOOTH NUMBERING SYSTEMS:
1. FDI (International): Two-digit system
   - First digit: Quadrant (1=upper right, 2=upper left, 3=lower left, 4=lower right)
   - Second digit: Tooth position (1-8, from central to wisdom)
   - Examples: 11=upper right central, 16=upper right first molar, 36=lower left first molar
   
2. Universal: Single/double digit (1-32)
   - 1-16: Upper teeth (right to left)
   - 17-32: Lower teeth (left to right)
   
3. Palmer: Quadrant system with symbols
   - Numbers 1-8 with quadrant indicators

EXTRACTION RULES:
1. Identify tooth numbers from various naming conventions
2. Convert all tooth references to FDI notation
3. Extract diagnosis for each tooth mentioned
4. Identify recommended treatments
5. Assess urgency based on clinical terms
6. Map common phrases to clinical terms:
   - "cavity" / "hole" → "caries"
   - "needs filling" → "restoration required"
   - "root canal needed" → "endodontic treatment"
   - "needs to come out" → "extraction indicated"
   - "crown broken" → "crown fracture"
   - "gum disease" → "periodontal disease"
   - "wisdom tooth problem" → consider teeth 18, 28, 38, 48

TOOTH STATUS MAPPING:
- healthy: No issues mentioned
- caries: Cavity, decay, demineralization
- filled: Has filling, restoration, composite, amalgam
- crown: Has crown, cap, onlay
- missing: Extracted, absent, missing
- attention: Needs evaluation, problem tooth
- root_canal: RCT done or needed
- extraction_needed: Needs extraction
- implant: Has implant

URGENCY ASSESSMENT:
- immediate: Severe pain, abscess, infection, swelling
- urgent: Moderate pain, deep caries, fracture
- routine: Small cavity, routine check
- observation: Watch, monitor, no immediate action

RESPOND ONLY WITH VALID JSON in this exact format:
{
  "tooth_findings": [
    {
      "tooth_number": "16",
      "status": "caries",
      "diagnosis": ["deep caries", "possible pulp involvement"],
      "treatment": ["root canal treatment", "crown placement"],
      "urgency": "urgent",
      "confidence": 0.95,
      "notes": "Patient reports pain on chewing"
    }
  ],
  "general_findings": {
    "periodontal_status": "mild gingivitis",
    "occlusion": "Class I",
    "oral_hygiene": "fair",
    "additional_notes": "Multiple restorations present"
  },
  "confidence": 0-100,
  "auto_extracted": true,
  "extraction_timestamp": "${new Date().toISOString()}"
}

IMPORTANT:
- Only include teeth that are explicitly mentioned
- Be specific about tooth numbers - don't guess
- Include all mentioned diagnoses and treatments
- Set appropriate confidence levels based on clarity of information`

  try {
    const messages: GeminiChatMessage[] = [{
      role: 'user',
      parts: [{
        text: `Extract dental findings from this examination transcript:\n\n${transcript}\n\nProvide structured JSON output with tooth-specific findings in FDI notation.`
      }]
    }]

    console.log('🔄 [DENTAL PARSER] Calling Gemini API for dental extraction...')
    const response = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.2, // Low temperature for accurate extraction
      maxOutputTokens: 2048,
      systemInstruction,
      responseFormat: 'json'
    })

    console.log('✅ [DENTAL PARSER] Received Gemini response')
    
    // Parse and validate the JSON response
    const analysis = JSON.parse(response)
    
    // Add color codes to each tooth finding
    if (analysis.tooth_findings && Array.isArray(analysis.tooth_findings)) {
      analysis.tooth_findings = analysis.tooth_findings.map((finding: ToothFinding) => ({
        ...finding,
        colorCode: getStatusColorCode(finding.status)
      }))
    }
    
    console.log(`✅ [DENTAL PARSER] Extracted ${analysis.tooth_findings?.length || 0} tooth findings with ${analysis.confidence}% confidence`)
    
    // Log extracted teeth for debugging
    if (analysis.tooth_findings?.length > 0) {
      console.log('🦷 [DENTAL PARSER] Teeth identified:', 
        analysis.tooth_findings.map((f: ToothFinding) => 
          `Tooth ${f.tooth_number}: ${f.status} (${f.confidence * 100}%)`
        ).join(', ')
      )
    }
    
    return analysis

  } catch (error) {
    console.error('❌ [DENTAL PARSER] Extraction failed:', error)
    
    // Return empty structure on error
    return {
      tooth_findings: [],
      general_findings: {},
      confidence: 0,
      auto_extracted: false,
      extraction_timestamp: new Date().toISOString()
    }
  }
}

/**
 * Convert common tooth naming to FDI notation
 * @param toothDescription - Natural language tooth description
 * @returns FDI tooth number or null if cannot be determined
 */
export function convertToFDI(toothDescription: string): string | null {
  const desc = toothDescription.toLowerCase()
  
  // Universal to FDI mapping (partial - most common)
  const universalToFDI: { [key: string]: string } = {
    '1': '18', '2': '17', '3': '16', '4': '15', '5': '14',
    '6': '13', '7': '12', '8': '11', '9': '21', '10': '22',
    '11': '23', '12': '24', '13': '25', '14': '26', '15': '27',
    '16': '28', '17': '38', '18': '37', '19': '36', '20': '35',
    '21': '34', '22': '33', '23': '32', '24': '31', '25': '41',
    '26': '42', '27': '43', '28': '44', '29': '45', '30': '46',
    '31': '47', '32': '48'
  }
  
  // Check for direct FDI notation (two digits)
  const fdiMatch = desc.match(/\b([1-4][1-8])\b/)
  if (fdiMatch) return fdiMatch[1]
  
  // Check for Universal notation
  const universalMatch = desc.match(/\b(\d{1,2})\b/)
  if (universalMatch && universalToFDI[universalMatch[1]]) {
    return universalToFDI[universalMatch[1]]
  }
  
  // Natural language patterns
  const patterns: { [key: string]: string } = {
    'upper right central': '11',
    'upper right lateral': '12',
    'upper right canine': '13',
    'upper right first premolar': '14',
    'upper right second premolar': '15',
    'upper right first molar': '16',
    'upper right second molar': '17',
    'upper right wisdom': '18',
    'upper left central': '21',
    'upper left lateral': '22',
    'upper left canine': '23',
    'upper left first premolar': '24',
    'upper left second premolar': '25',
    'upper left first molar': '26',
    'upper left second molar': '27',
    'upper left wisdom': '28',
    'lower left central': '31',
    'lower left lateral': '32',
    'lower left canine': '33',
    'lower left first premolar': '34',
    'lower left second premolar': '35',
    'lower left first molar': '36',
    'lower left second molar': '37',
    'lower left wisdom': '38',
    'lower right central': '41',
    'lower right lateral': '42',
    'lower right canine': '43',
    'lower right first premolar': '44',
    'lower right second premolar': '45',
    'lower right first molar': '46',
    'lower right second molar': '47',
    'lower right wisdom': '48'
  }
  
  // Check natural language patterns
  for (const [pattern, fdi] of Object.entries(patterns)) {
    if (desc.includes(pattern)) return fdi
  }
  
  return null
}

/**
 * Validate FDI tooth number
 * @param toothNumber - FDI notation string
 * @returns true if valid FDI number
 */
export function isValidFDI(toothNumber: string): boolean {
  if (!toothNumber || toothNumber.length !== 2) return false
  
  const quadrant = parseInt(toothNumber[0])
  const position = parseInt(toothNumber[1])
  
  return quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8
}

/**
 * Map voice findings to FDI chart update format
 * @param findings - Extracted tooth findings
 * @returns Formatted data for FDI chart update
 */
export function mapFindingsToChartUpdate(findings: ToothFinding[]): Record<string, any> {
  const chartUpdate: Record<string, any> = {}
  
  findings.forEach(finding => {
    if (isValidFDI(finding.tooth_number)) {
      chartUpdate[finding.tooth_number] = {
        status: finding.status,
        primaryDiagnosis: finding.diagnosis[0] || '',
        additionalDiagnoses: finding.diagnosis.slice(1),
        recommendedTreatment: finding.treatment[0] || '',
        alternativeTreatments: finding.treatment.slice(1),
        urgency: finding.urgency,
        notes: finding.notes || '',
        colorCode: finding.colorCode,
        confidence: finding.confidence,
        lastUpdated: new Date().toISOString(),
        source: 'voice_extraction'
      }
    }
  })
  
  return chartUpdate
}