/**
 * Agent A — Checklist Matcher
 *
 * Takes a structured conversation and cross-checks against ALL questionnaire
 * templates in a single LLM call. Returns which questions are answered (ticked)
 * and which are missing (unticked) for each questionnaire.
 *
 * Phase 2.2 of Session 6: Multi-Agent Pre-Processing Layer
 */

import { aiChatCompletion } from '@/lib/services/ai-provider'
import {
  QUESTIONNAIRE_TEMPLATES,
  questionnairesToPromptContext,
  type QuestionnaireTemplate,
  type QuestionPriority,
} from '@/lib/services/diagnostic-questionnaires'
import type { ConversationContext } from '@/lib/services/medical-conversation-parser'

// =====================================================
// INTERFACES
// =====================================================

export interface AnsweredQuestion {
  question_id: string
  question_text: string
  extracted_answer: string
  confidence: number
}

export interface MissingQuestion {
  question_id: string
  question_text: string
  priority: QuestionPriority
  diagnostic_weight: number
  natural_language_prompt: string
}

export interface ChecklistResult {
  questionnaire_id: string
  questionnaire_name: string
  match_score: number // 0-1
  answered: AnsweredQuestion[]
  missing: MissingQuestion[]
}

// =====================================================
// AGENT IMPLEMENTATION
// =====================================================

/**
 * Run the Checklist Matcher agent.
 *
 * Single LLM call maps the full conversation against ALL questionnaire templates
 * simultaneously. NOT a per-questionnaire loop.
 */
export async function runChecklistMatcher(
  conversationContext: ConversationContext,
  toothNumber: string,
  rawTranscript?: string
): Promise<ChecklistResult[]> {
  console.log(`🔍 [AGENT A] Running Checklist Matcher for tooth ${toothNumber}...`)

  const conversationSummary = formatConversationForPrompt(conversationContext, toothNumber, rawTranscript)
  const questionnaireContext = questionnairesToPromptContext()

  const systemInstruction = `You are a clinical checklist extraction engine for endodontic diagnosis.

You receive:
1. A structured summary of a dentist-patient consultation
2. All diagnostic questionnaire templates

Your task: For EACH questionnaire, determine which questions are answered by the conversation data and which are missing.

Rules:
- ONLY mark a question as answered if the conversation clearly provides the information
- Extract the answer value using the expected_values list (pick the closest match)
- Set confidence 0.0-1.0 based on how explicit the answer is (0.5 = inferred, 0.9 = explicitly stated)
- For missing questions, write a natural language prompt the AI could ask the dentist
- Return valid JSON only

Output format:
{
  "results": [
    {
      "questionnaire_id": "aae_pulp_diagnosis",
      "answered": [
        { "question_id": "cold_test", "extracted_answer": "lingering", "confidence": 0.9 }
      ],
      "missing": [
        { "question_id": "ept_response", "natural_language_prompt": "Was an EPT test performed on tooth 46? What was the reading?" }
      ]
    }
  ]
}`

  const userPrompt = `## Consultation Data (Tooth ${toothNumber})

${conversationSummary}

## Diagnostic Questionnaire Templates

${questionnaireContext}

Cross-check the consultation data against ALL questionnaires. Return the JSON.`

  try {
    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'medical_parsing',
        provider: 'claude',
        temperature: 0.1,
        responseFormat: 'json',
        systemInstruction,
      }
    )

    const parsed = JSON.parse(response || '{}')
    const rawResults: any[] = parsed.results || []

    // Merge LLM output with template metadata to produce full ChecklistResults
    const results: ChecklistResult[] = QUESTIONNAIRE_TEMPLATES.map((template) => {
      const llmResult = rawResults.find((r: any) => r.questionnaire_id === template.id)
      return buildChecklistResult(template, llmResult)
    })

    console.log(
      `✅ [AGENT A] Checklist matching complete. Scores: ${results.map((r) => `${r.questionnaire_id}=${(r.match_score * 100).toFixed(0)}%`).join(', ')}`
    )

    return results
  } catch (error) {
    console.error('❌ [AGENT A] Checklist Matcher failed:', error)
    // Return empty results (all questions missing) as fallback
    return QUESTIONNAIRE_TEMPLATES.map((t) => buildChecklistResult(t, null))
  }
}

// =====================================================
// HELPERS
// =====================================================

function formatConversationForPrompt(
  ctx: ConversationContext,
  toothNumber: string,
  rawTranscript?: string
): string {
  const sections: string[] = []

  sections.push(`Tooth Number: ${toothNumber}`)

  if (ctx.chiefComplaint) {
    const cc = ctx.chiefComplaint
    sections.push(`Chief Complaint: ${cc.primary_complaint}`)
    if (cc.patient_description) sections.push(`Patient Description: ${cc.patient_description}`)
    if (cc.onset_duration) sections.push(`Onset/Duration: ${cc.onset_duration}`)
    if (cc.associated_symptoms?.length) sections.push(`Associated Symptoms: ${cc.associated_symptoms.join(', ')}`)
    if (cc.triggers?.length) sections.push(`Triggers: ${cc.triggers.join(', ')}`)
  }

  if (ctx.hopi) {
    const h = ctx.hopi
    if (h.pain_characteristics) {
      const p = h.pain_characteristics
      sections.push(`Pain: ${p.quality}, intensity ${p.intensity}/10, ${p.frequency}, duration ${p.duration}`)
    }
    if (h.aggravating_factors?.length) sections.push(`Aggravating: ${h.aggravating_factors.join(', ')}`)
    if (h.relieving_factors?.length) sections.push(`Relieving: ${h.relieving_factors.join(', ')}`)
    if (h.previous_treatments?.length) sections.push(`Previous Treatments: ${h.previous_treatments.join(', ')}`)
  }

  if (ctx.medicalHistory) {
    const m = ctx.medicalHistory
    if (m.medical_conditions?.length) sections.push(`Medical Conditions: ${m.medical_conditions.join(', ')}`)
    if (m.current_medications?.length) sections.push(`Medications: ${m.current_medications.join(', ')}`)
    if (m.allergies?.length) sections.push(`Allergies: ${m.allergies.join(', ')}`)
  }

  if (ctx.clinicalExamination) {
    const c = ctx.clinicalExamination
    if (c.intraoral_findings?.length) sections.push(`Intraoral Findings: ${c.intraoral_findings.join(', ')}`)
    if (c.extraoral_findings?.length) sections.push(`Extraoral Findings: ${c.extraoral_findings.join(', ')}`)
  }

  // Session 20: Explicit investigations section — critical for gap analyzer accuracy
  if (ctx.investigations) {
    const inv = ctx.investigations
    const invParts: string[] = []
    if (inv.vitality_tests) invParts.push(`Vitality Tests: ${inv.vitality_tests}`)
    if (inv.percussion_test) invParts.push(`Percussion Test: ${inv.percussion_test}`)
    if (inv.palpation_test) invParts.push(`Palpation Test: ${inv.palpation_test}`)
    if (inv.radiographic_findings) invParts.push(`Radiographic Findings: ${inv.radiographic_findings}`)
    if (inv.radiographic_types?.length) invParts.push(`Radiographic Types: ${inv.radiographic_types.join(', ')}`)
    if (inv.additional_tests?.length) invParts.push(`Additional Tests: ${inv.additional_tests.join(', ')}`)
    if (invParts.length > 0) {
      sections.push(`\nInvestigations & Clinical Tests:\n${invParts.join('\n')}`)
    }
  }

  if (rawTranscript) {
    // Include a truncated raw transcript for additional context the structured data may miss
    const truncated = rawTranscript.length > 3000 ? rawTranscript.substring(0, 3000) + '...' : rawTranscript
    sections.push(`\nRaw Transcript:\n${truncated}`)
  }

  return sections.join('\n')
}

function buildChecklistResult(
  template: QuestionnaireTemplate,
  llmResult: any | null
): ChecklistResult {
  const answeredIds = new Set<string>()
  const answered: AnsweredQuestion[] = []
  const missing: MissingQuestion[] = []

  // Process LLM-identified answered questions
  if (llmResult?.answered) {
    for (const a of llmResult.answered) {
      const question = template.questions.find((q) => q.id === a.question_id)
      if (question) {
        answeredIds.add(a.question_id)
        answered.push({
          question_id: a.question_id,
          question_text: question.text,
          extracted_answer: a.extracted_answer || 'unknown',
          confidence: typeof a.confidence === 'number' ? a.confidence : 0.5,
        })
      }
    }
  }

  // Build missing list from unanswered questions
  for (const question of template.questions) {
    if (!answeredIds.has(question.id)) {
      // Use LLM-generated prompt if available, otherwise generate a default
      const llmMissing = llmResult?.missing?.find((m: any) => m.question_id === question.id)
      missing.push({
        question_id: question.id,
        question_text: question.text,
        priority: question.priority,
        diagnostic_weight: question.diagnostic_weight,
        natural_language_prompt:
          llmMissing?.natural_language_prompt || `${question.text}`,
      })
    }
  }

  // Calculate match score as weighted coverage
  let totalWeight = 0
  let answeredWeight = 0
  for (const q of template.questions) {
    totalWeight += q.diagnostic_weight
    if (answeredIds.has(q.id)) {
      answeredWeight += q.diagnostic_weight
    }
  }
  const matchScore = totalWeight > 0 ? answeredWeight / totalWeight : 0

  return {
    questionnaire_id: template.id,
    questionnaire_name: template.name,
    match_score: matchScore,
    answered,
    missing,
  }
}
