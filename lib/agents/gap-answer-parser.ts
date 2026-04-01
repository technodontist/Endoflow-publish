/**
 * Gap Answer Parser
 *
 * Parses natural language answers (voice transcript or typed text) back into
 * structured questionnaire responses that can be merged into the conversation
 * context and fed back to the synthesis agent.
 *
 * Example:
 *   Input:  "cold test was lingering positive, about 30 seconds"
 *   Output: { question_id: 'cold_test', structured_value: 'lingering', details: '30 seconds duration', confidence: 0.95 }
 *
 * Phase 4.2 of Session 6: Conversational Gap-Filling
 */

import { aiChatCompletion } from '@/lib/services/ai-provider'
import type { PrioritizedGapQuestion } from './gap-finder-agent'
import { QUESTIONNAIRE_TEMPLATES } from '@/lib/services/diagnostic-questionnaires'
import type { ConversationContext } from '@/lib/services/medical-conversation-parser'

// =====================================================
// INTERFACES
// =====================================================

export interface ParsedGapAnswer {
  question_id: string
  structured_value: string
  details: string
  confidence: number
}

// =====================================================
// PARSER
// =====================================================

/**
 * Parse a natural language answer into a structured questionnaire response.
 */
export async function parseGapAnswer(
  question: PrioritizedGapQuestion,
  answer: string
): Promise<ParsedGapAnswer> {
  console.log(`📝 [GAP PARSER] Parsing answer for: ${question.question_id}`)
  console.log(`   Answer text: "${answer.substring(0, 100)}"`)

  // Find the question definition to get expected_values
  const expectedValues = findExpectedValues(question.question_id)

  const systemInstruction = `You parse clinical answers into structured questionnaire values.

Given a question and the dentist's natural language answer, extract:
1. structured_value: Must be one of the expected values (pick closest match)
2. details: Any additional details from the answer
3. confidence: 0.0-1.0 how certain the answer maps to the structured value

Return valid JSON only:
{ "structured_value": "string", "details": "string", "confidence": number }`

  const userPrompt = `Question: "${question.natural_language}"
Question ID: ${question.question_id}
Expected values: ${expectedValues.join(' | ')}

Dentist's answer: "${answer}"

Parse this into a structured response.`

  try {
    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'data_extraction',
        provider: 'gemini', // Fast task
        temperature: 0.05,
        responseFormat: 'json',
        systemInstruction,
      }
    )

    const parsed = JSON.parse(response || '{}')

    // Validate structured_value against expected values
    let structuredValue = parsed.structured_value || 'unknown'
    if (expectedValues.length > 0 && !expectedValues.includes(structuredValue)) {
      // Find closest match
      structuredValue = findClosestValue(structuredValue, expectedValues)
    }

    const result: ParsedGapAnswer = {
      question_id: question.question_id,
      structured_value: structuredValue,
      details: parsed.details || answer,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    }

    console.log(`✅ [GAP PARSER] Parsed: ${result.structured_value} (${(result.confidence * 100).toFixed(0)}% confidence)`)
    return result
  } catch (error) {
    console.warn('⚠️ [GAP PARSER] LLM parsing failed, using heuristic:', error)
    return heuristicParse(question, answer, expectedValues)
  }
}

/**
 * Merge a parsed gap answer back into the conversation context.
 * Returns a new ConversationContext with the answer incorporated.
 */
export function mergeAnswerIntoConversation(
  ctx: ConversationContext,
  answer: ParsedGapAnswer
): ConversationContext {
  // Deep clone to avoid mutation
  const updated: ConversationContext = JSON.parse(JSON.stringify(ctx))

  // Map question_id to the appropriate section of ConversationContext
  const clinicalTestMappings: Record<string, (ctx: ConversationContext, value: string, details: string) => void> = {
    // Vitality tests
    cold_test: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Cold test: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    ept_response: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `EPT: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    thermal_sensitivity: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Thermal sensitivity: ${v}${d ? ` (${d})` : ''}`,
      ]
    },

    // Clinical tests
    percussion: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Percussion: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    percussion_pa: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Percussion: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    palpation: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Palpation: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    palpation_pa: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Palpation: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    bite_pain: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Bite test: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    tooth_mobility: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Mobility: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    probing_depths: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Probing depths: ${v}${d ? ` (${d})` : ''}`,
      ]
    },

    // Radiographic
    periapical_radiolucency: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Periapical radiolucency: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    periapical_radiolucency_pa: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Periapical radiolucency: ${v}${d ? ` (${d})` : ''}`,
      ]
    },

    // Symptoms
    spontaneous_pain: (c, v, d) => {
      if (!c.hopi) c.hopi = {}
      c.hopi.associated_symptoms = [
        ...(c.hopi.associated_symptoms || []),
        `Spontaneous pain: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    swelling: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Swelling: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    sinus_tract: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Sinus tract: ${v}${d ? ` (${d})` : ''}`,
      ]
    },

    // History
    pain_duration: (c, v, d) => {
      if (!c.chiefComplaint) c.chiefComplaint = { primary_complaint: '' }
      c.chiefComplaint.onset_duration = `${v}${d ? ` (${d})` : ''}`
    },
    previous_treatment: (c, v, d) => {
      if (!c.hopi) c.hopi = {}
      c.hopi.previous_treatments = [
        ...(c.hopi.previous_treatments || []),
        `${v}${d ? ` (${d})` : ''}`,
      ]
    },

    // ── Restorative / Caries (Session 7) ──
    caries_location: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      // Parse surface notation (e.g., "MOD") into individual surfaces
      const surfaces = v.toUpperCase().split('').filter(ch => 'MODBL'.includes(ch))
      c.restorationAssessment.surfaces_involved = surfaces.length > 0 ? surfaces : [v]
      if (d) c.restorationAssessment.caries_extent = `${c.restorationAssessment.caries_extent || ''}${d ? ` ${d}` : ''}`.trim()
    },
    caries_depth: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.caries_extent = `${v}${d ? ` (${d})` : ''}`
    },
    caries_activity: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.caries_extent = `${c.restorationAssessment.caries_extent || ''} [${v}]`.trim()
    },
    existing_restoration_status: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.existing_restoration = `${v}${d ? ` (${d})` : ''}`
    },
    remaining_tooth_structure: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.remaining_tooth_structure = `${v}${d ? ` (${d})` : ''}`
    },
    cusp_involvement: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.cusp_involvement = [
        ...(c.restorationAssessment.cusp_involvement || []),
        `${v}${d ? ` (${d})` : ''}`,
      ]
    },
    proximal_contact: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Proximal contact: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    pulp_proximity: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.caries_extent = `${c.restorationAssessment.caries_extent || ''} [pulp distance: ${v}]`.trim()
    },
    restoration_type_indicated: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.restoration_type_preference = `${v}${d ? ` (${d})` : ''}`
    },
    material_preference: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.material_preference = `${v}${d ? ` (${d})` : ''}`
    },
    occlusal_load: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.occlusal_load = `${v}${d ? ` (${d})` : ''}`
    },
    isolation_feasibility: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.isolation_feasibility = `${v}${d ? ` (${d})` : ''}`
    },
    esthetic_zone: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.esthetic_zone = `${v}${d ? ` (${d})` : ''}`
    },
    opposing_dentition: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Opposing dentition: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    ferrule_assessment: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.ferrule_assessment = `${v}${d ? ` (${d})` : ''}`
    },

    // ── Periodontal (Session 7: N-track) ──
    probing_depths_perio: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Probing depths: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    clinical_attachment_loss: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `CAL: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    bone_loss_pattern: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Bone loss: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    bone_loss_percentage: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Bone loss extent: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    bleeding_on_probing: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `BOP: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    tooth_mobility_perio: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Mobility: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    furcation_involvement: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Furcation: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    perio_risk_factors: (c, v, d) => {
      if (!c.medicalHistory) c.medicalHistory = {}
      c.medicalHistory.medical_conditions = [
        ...(c.medicalHistory.medical_conditions || []),
        `Perio risk: ${v}${d ? ` (${d})` : ''}`,
      ]
    },

    // ── Prosthodontic (Session 7: N-track) ──
    restorability: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.remaining_tooth_structure = `Restorability: ${v}${d ? ` (${d})` : ''}`
    },
    ferrule_height: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.ferrule_assessment = `${v}${d ? ` (${d})` : ''}`
    },
    crown_root_ratio: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Crown:root ratio: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    post_core_needed: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.restoration_type_preference = `Post: ${v}${d ? ` (${d})` : ''}`
    },
    prosth_type_indicated: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.restoration_type_preference = `${v}${d ? ` (${d})` : ''}`
    },
    occlusal_scheme: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Occlusal scheme: ${v}${d ? ` (${d})` : ''}`,
      ]
    },

    // ── Surgical (Session 7: N-track) ──
    extraction_indicated: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Extraction indicated: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    surgical_endo_indicated: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Surgical endo: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    surgical_access: (c, v, d) => {
      if (!c.clinicalExamination) c.clinicalExamination = {}
      c.clinicalExamination.intraoral_findings = [
        ...(c.clinicalExamination.intraoral_findings || []),
        `Surgical access: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    medical_clearance: (c, v, d) => {
      if (!c.medicalHistory) c.medicalHistory = {}
      c.medicalHistory.medical_conditions = [
        ...(c.medicalHistory.medical_conditions || []),
        `Surgical clearance: ${v}${d ? ` (${d})` : ''}`,
      ]
    },
    replacement_plan: (c, v, d) => {
      if (!c.restorationAssessment) c.restorationAssessment = {}
      c.restorationAssessment.restoration_type_preference = `Post-extraction: ${v}${d ? ` (${d})` : ''}`
    },
  }

  // Apply the mapping if one exists
  const mapper = clinicalTestMappings[answer.question_id]
  if (mapper) {
    mapper(updated, answer.structured_value, answer.details)
  } else {
    // Generic fallback: add to intraoral findings
    if (!updated.clinicalExamination) updated.clinicalExamination = {}
    updated.clinicalExamination.intraoral_findings = [
      ...(updated.clinicalExamination.intraoral_findings || []),
      `${answer.question_id.replace(/_/g, ' ')}: ${answer.structured_value}${answer.details ? ` (${answer.details})` : ''}`,
    ]
  }

  return updated
}

// =====================================================
// HELPERS
// =====================================================

function findExpectedValues(questionId: string): string[] {
  for (const template of QUESTIONNAIRE_TEMPLATES) {
    const question = template.questions.find((q) => q.id === questionId)
    if (question) return question.expected_values
  }
  return []
}

function findClosestValue(input: string, expectedValues: string[]): string {
  const lower = input.toLowerCase().replace(/[_\s-]+/g, '')

  // Exact match after normalization
  for (const val of expectedValues) {
    if (val.toLowerCase().replace(/[_\s-]+/g, '') === lower) return val
  }

  // Partial match
  for (const val of expectedValues) {
    const normalizedVal = val.toLowerCase().replace(/[_\s-]+/g, '')
    if (normalizedVal.includes(lower) || lower.includes(normalizedVal)) return val
  }

  // Default: return first expected value or input as-is
  return expectedValues[0] || input
}

function heuristicParse(
  question: PrioritizedGapQuestion,
  answer: string,
  expectedValues: string[]
): ParsedGapAnswer {
  const lower = answer.toLowerCase()

  // Simple keyword matching against expected values
  let bestMatch = expectedValues[0] || 'unknown'
  let bestScore = 0

  for (const val of expectedValues) {
    const keywords = val.split('_')
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = val
    }
  }

  // Check for common negations
  if (/\b(no|none|negative|absent|not)\b/i.test(lower)) {
    const negativeValues = expectedValues.filter(v => /no|negative|none|absent|normal/i.test(v))
    if (negativeValues.length > 0) bestMatch = negativeValues[0]
  }

  // Check for common positives
  if (/\b(yes|positive|present)\b/i.test(lower)) {
    const positiveValues = expectedValues.filter(v => /yes|positive|present/i.test(v))
    if (positiveValues.length > 0) bestMatch = positiveValues[0]
  }

  return {
    question_id: question.question_id,
    structured_value: bestMatch,
    details: answer,
    confidence: bestScore > 0 ? 0.6 : 0.3,
  }
}
