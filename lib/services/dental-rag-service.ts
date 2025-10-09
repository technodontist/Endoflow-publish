/**
 * Dental RAG Service
 * Provides evidence-based diagnosis and treatment suggestions
 * using medical knowledge base and research papers
 */

import { performRAGQuery, formatRAGContext, extractCitations, type RAGDocument } from './rag-service'
import { generateChatCompletion, GeminiChatMessage } from './gemini-ai'
import type { ToothFinding } from './dental-voice-parser'

export interface TreatmentSuggestion {
  treatment_name: string
  description: string
  success_rate?: number
  evidence_level?: 'high' | 'moderate' | 'low'
  indications: string[]
  contraindications: string[]
  alternative_options: string[]
  supporting_evidence: RAGDocument[]
  citations: ReturnType<typeof extractCitations>
  confidence: number
}

export interface DiagnosisSuggestion {
  tooth_number: string
  primary_diagnosis: string
  differential_diagnoses: string[]
  clinical_tests_recommended: string[]
  treatment_suggestions: TreatmentSuggestion[]
  urgency_assessment: 'immediate' | 'urgent' | 'routine' | 'observation'
  prognosis: string
  evidence_summary: string
  total_evidence_documents: number
}

/**
 * Get evidence-based diagnosis and treatment suggestions for dental findings
 * @param toothFindings - Array of tooth findings from voice extraction
 * @param patientHistory - Optional patient medical history for context
 * @returns Array of diagnosis suggestions with evidence
 */
export async function getDentalRAGSuggestions(
  toothFindings: ToothFinding[],
  patientHistory?: {
    medical_conditions?: string[]
    medications?: string[]
    allergies?: string[]
    previous_treatments?: string[]
  }
): Promise<DiagnosisSuggestion[]> {
  console.log('🔬 [DENTAL RAG] Getting evidence-based suggestions for', toothFindings.length, 'teeth')
  
  const suggestions: DiagnosisSuggestion[] = []
  
  for (const finding of toothFindings) {
    try {
      console.log(`🦷 [DENTAL RAG] Processing tooth ${finding.tooth_number}:`, finding.diagnosis.join(', '))
      
      // Step 1: Query medical knowledge base for each diagnosis
      const ragDocuments: RAGDocument[] = []
      
      for (const diagnosis of finding.diagnosis) {
        const ragResult = await performRAGQuery({
          query: `${diagnosis} treatment options endodontic restorative dentistry best practices`,
          diagnosisFilter: [diagnosis],
          specialtyFilter: 'dentistry',
          matchThreshold: 0.65,
          matchCount: 5
        })
        
        ragDocuments.push(...ragResult.documents)
      }
      
      // Remove duplicates based on document ID
      const uniqueDocuments = Array.from(
        new Map(ragDocuments.map(doc => [doc.id, doc])).values()
      )
      
      console.log(`📚 [DENTAL RAG] Found ${uniqueDocuments.length} relevant research documents`)
      
      // Step 2: Use AI to synthesize treatment suggestions from evidence
      const treatmentSuggestions = await synthesizeTreatmentSuggestions(
        finding,
        uniqueDocuments,
        patientHistory
      )
      
      // Step 3: Create comprehensive suggestion
      const suggestion: DiagnosisSuggestion = {
        tooth_number: finding.tooth_number,
        primary_diagnosis: finding.diagnosis[0] || 'Requires evaluation',
        differential_diagnoses: finding.diagnosis.slice(1),
        clinical_tests_recommended: getRecommendedTests(finding.diagnosis[0]),
        treatment_suggestions: treatmentSuggestions,
        urgency_assessment: finding.urgency,
        prognosis: assessPrognosis(finding),
        evidence_summary: formatEvidenceSummary(uniqueDocuments),
        total_evidence_documents: uniqueDocuments.length
      }
      
      suggestions.push(suggestion)
      
    } catch (error) {
      console.error(`❌ [DENTAL RAG] Error processing tooth ${finding.tooth_number}:`, error)
      
      // Add fallback suggestion without evidence
      suggestions.push({
        tooth_number: finding.tooth_number,
        primary_diagnosis: finding.diagnosis[0] || 'Requires evaluation',
        differential_diagnoses: finding.diagnosis.slice(1),
        clinical_tests_recommended: [],
        treatment_suggestions: mapDefaultTreatments(finding),
        urgency_assessment: finding.urgency,
        prognosis: 'Requires clinical assessment',
        evidence_summary: 'Evidence-based suggestions unavailable',
        total_evidence_documents: 0
      })
    }
  }
  
  return suggestions
}

/**
 * Synthesize treatment suggestions from RAG documents using AI
 */
async function synthesizeTreatmentSuggestions(
  finding: ToothFinding,
  documents: RAGDocument[],
  patientHistory?: any
): Promise<TreatmentSuggestion[]> {
  
  if (documents.length === 0) {
    return mapDefaultTreatments(finding)
  }
  
  const systemInstruction = `You are an expert dental AI assistant synthesizing evidence-based treatment recommendations.
Analyze the provided research documents and patient context to suggest appropriate treatments.

TASK:
1. Review the research evidence provided
2. Consider patient history if available
3. Suggest 2-3 most appropriate treatments
4. Include success rates when mentioned in literature
5. List indications and contraindications
6. Provide alternative options

IMPORTANT:
- Base recommendations on the provided evidence
- Be specific about success rates if mentioned
- Consider patient factors (allergies, medical conditions)
- Rank treatments by evidence quality and appropriateness`

  const patientContext = patientHistory ? `
Patient History:
- Medical Conditions: ${patientHistory.medical_conditions?.join(', ') || 'None reported'}
- Current Medications: ${patientHistory.medications?.join(', ') || 'None'}
- Allergies: ${patientHistory.allergies?.join(', ') || 'None'}
- Previous Treatments: ${patientHistory.previous_treatments?.join(', ') || 'None'}
` : 'No patient history available'

  const prompt = `
Tooth ${finding.tooth_number} Diagnosis: ${finding.diagnosis.join(', ')}
Current Status: ${finding.status}
Urgency: ${finding.urgency}

${patientContext}

Research Evidence:
${formatRAGContext(documents)}

Based on the evidence provided, suggest appropriate treatment options with success rates and considerations.

Respond with a JSON array of treatment suggestions in this format:
[
  {
    "treatment_name": "Root Canal Treatment",
    "description": "Endodontic treatment to remove infected pulp",
    "success_rate": 92,
    "evidence_level": "high",
    "indications": ["Irreversible pulpitis", "Periapical abscess"],
    "contraindications": ["Unrestorable tooth", "Vertical root fracture"],
    "alternative_options": ["Extraction with implant", "Pulp capping if vital"]
  }
]`

  try {
    const messages: GeminiChatMessage[] = [{
      role: 'user',
      parts: [{ text: prompt }]
    }]
    
    const response = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      maxOutputTokens: 2048,
      systemInstruction,
      responseFormat: 'json'
    })
    
    const suggestions = JSON.parse(response)
    
    // Add evidence and citations to each suggestion
    return suggestions.map((sugg: any) => ({
      ...sugg,
      supporting_evidence: documents,
      citations: extractCitations(documents),
      confidence: finding.confidence
    }))
    
  } catch (error) {
    console.error('❌ [DENTAL RAG] AI synthesis failed:', error)
    return mapDefaultTreatments(finding)
  }
}

/**
 * Get recommended clinical tests based on diagnosis
 */
function getRecommendedTests(diagnosis: string): string[] {
  const diag = diagnosis?.toLowerCase() || ''
  const tests: string[] = []
  
  if (diag.includes('caries') || diag.includes('cavity')) {
    tests.push('Visual examination', 'Probing', 'Radiograph')
  }
  
  if (diag.includes('pulp') || diag.includes('periapical')) {
    tests.push('Vitality test', 'Percussion test', 'Palpation', 'Periapical radiograph')
  }
  
  if (diag.includes('fracture') || diag.includes('crack')) {
    tests.push('Transillumination', 'Bite test', 'Staining', 'CBCT if indicated')
  }
  
  if (diag.includes('periodontal') || diag.includes('gingiv')) {
    tests.push('Periodontal probing', 'Mobility test', 'Furcation involvement')
  }
  
  return tests.length > 0 ? tests : ['Clinical examination', 'Radiographic assessment']
}

/**
 * Assess prognosis based on findings
 */
function assessPrognosis(finding: ToothFinding): string {
  const diagnosis = finding.diagnosis[0]?.toLowerCase() || ''
  const urgency = finding.urgency
  
  if (urgency === 'immediate') {
    return 'Guarded - immediate intervention required'
  }
  
  if (diagnosis.includes('deep caries') || diagnosis.includes('pulp')) {
    return 'Fair to Good with appropriate treatment'
  }
  
  if (diagnosis.includes('fracture') && diagnosis.includes('vertical')) {
    return 'Poor - may require extraction'
  }
  
  if (finding.status === 'healthy' || finding.status === 'filled') {
    return 'Good - routine maintenance'
  }
  
  return 'Fair - depends on treatment response'
}

/**
 * Format evidence summary for display
 */
function formatEvidenceSummary(documents: RAGDocument[]): string {
  if (documents.length === 0) {
    return 'No specific research evidence available'
  }
  
  const highConfidence = documents.filter(d => d.similarity > 0.8).length
  const sources = new Set(documents.map(d => d.journal || d.source_type))
  
  return `Based on ${documents.length} research documents from ${sources.size} sources. ` +
         `${highConfidence} highly relevant studies identified.`
}

/**
 * Map default treatments when no evidence is available
 */
function mapDefaultTreatments(finding: ToothFinding): TreatmentSuggestion[] {
  const suggestions: TreatmentSuggestion[] = []
  const diagnosis = finding.diagnosis[0]?.toLowerCase() || ''
  
  if (diagnosis.includes('caries')) {
    suggestions.push({
      treatment_name: 'Composite Restoration',
      description: 'Remove decay and restore with composite filling',
      success_rate: 85,
      evidence_level: 'moderate',
      indications: ['Caries', 'Small to moderate cavities'],
      contraindications: ['Extensive decay', 'Insufficient tooth structure'],
      alternative_options: ['Amalgam restoration', 'Inlay/Onlay'],
      supporting_evidence: [],
      citations: [],
      confidence: 0.7
    })
  }
  
  if (diagnosis.includes('pulp') || diagnosis.includes('periapical')) {
    suggestions.push({
      treatment_name: 'Root Canal Treatment',
      description: 'Endodontic therapy to remove infected pulp',
      success_rate: 90,
      evidence_level: 'high',
      indications: ['Irreversible pulpitis', 'Necrotic pulp', 'Periapical lesion'],
      contraindications: ['Unrestorable tooth', 'Poor periodontal support'],
      alternative_options: ['Extraction', 'Pulpotomy (if partial)'],
      supporting_evidence: [],
      citations: [],
      confidence: 0.8
    })
  }
  
  if (diagnosis.includes('fracture')) {
    suggestions.push({
      treatment_name: 'Crown Restoration',
      description: 'Full coverage crown to protect fractured tooth',
      success_rate: 88,
      evidence_level: 'high',
      indications: ['Crown fracture', 'Large restoration', 'Post-RCT'],
      contraindications: ['Insufficient ferrule', 'Active infection'],
      alternative_options: ['Onlay', 'Extraction if severe'],
      supporting_evidence: [],
      citations: [],
      confidence: 0.75
    })
  }
  
  // Default if no specific match
  if (suggestions.length === 0) {
    suggestions.push({
      treatment_name: 'Clinical Evaluation',
      description: 'Comprehensive examination to determine appropriate treatment',
      evidence_level: 'low',
      indications: ['Unclear diagnosis', 'Multiple treatment options'],
      contraindications: [],
      alternative_options: finding.treatment,
      supporting_evidence: [],
      citations: [],
      confidence: 0.5
    })
  }
  
  return suggestions
}

/**
 * Get treatment success statistics from evidence
 */
export function extractSuccessRates(documents: RAGDocument[]): {
  treatment: string
  success_rate: number
  sample_size?: number
  study_count: number
}[] {
  const stats: any[] = []
  
  // Simple pattern matching for success rates in documents
  documents.forEach(doc => {
    const content = doc.content.toLowerCase()
    
    // Look for patterns like "success rate of 92%" or "90% success"
    const successPattern = /(\d+(?:\.\d+)?)\s*%\s*success|success\s*rate\s*of\s*(\d+(?:\.\d+)?)\s*%/g
    let match
    
    while ((match = successPattern.exec(content)) !== null) {
      const rate = parseFloat(match[1] || match[2])
      if (rate > 0 && rate <= 100) {
        stats.push({
          treatment: doc.title,
          success_rate: rate,
          study_count: 1
        })
      }
    }
  })
  
  return stats
}