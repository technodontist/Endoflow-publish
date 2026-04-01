/**
 * Diagnostic Synthesis Agent
 *
 * Unified diagnosis + treatment pipeline that replaces three separate pipelines:
 * - getDentalRAGSuggestions() from dental-rag-service.ts
 * - getAIDiagnosisSuggestionAction() from ai-diagnosis-suggestions.ts
 * - getAITreatmentSuggestionAction() from ai-treatment-suggestions.ts
 *
 * Uses two-phase reasoning: form clinical impression from conversation FIRST,
 * then verify/refine against agent reports and evidence.
 *
 * Phase 3.1 of Session 6: Unified Synthesis Pipeline
 */

import { aiChatCompletion, createChatSession, sendSessionMessage, type AIChatSession } from '@/lib/services/ai-provider'
import { formatRAGContext, type RAGDocument } from '@/lib/services/rag-service'
import type { ConversationContext } from '@/lib/services/medical-conversation-parser'
import type { ChecklistResult } from './checklist-matcher-agent'
import type { SubspecialtyClassification } from './subspecialty-classifier-agent'
import type { GapAnalysis, PrioritizedGapQuestion } from './gap-finder-agent'
import { formatPatientContextForPrompt, type FullPatientContext } from '@/lib/services/patient-context-assembler'

// =====================================================
// INTERFACES
// =====================================================

export interface PatientHistory {
  age?: number
  gender?: string
  medicalConditions?: string[]
  currentMedications?: string[]
  allergies?: string[]
  previousDentalTreatments?: string[]
}

export interface ClinicalDataContext {
  totalSimilarCases?: number
  outcomesSummary?: string
  averageSuccessRate?: number
  commonComplications?: string[]
}

export interface Citation {
  title: string
  authors?: string
  journal?: string
  year?: number
  doi?: string
  relevance: string
}

export interface TreatmentOption {
  name: string
  description: string
  success_rate: number
  evidence_level: 'high' | 'moderate' | 'low'
  from_literature: boolean
  from_clinic_data: boolean
  indications: string[]
  contraindications: string[]
}

export interface SynthesisInput {
  structuredConversation: ConversationContext
  toothNumber: string
  patientHistory: PatientHistory
  checklistReport: ChecklistResult[]
  subspecialtyClassification: SubspecialtyClassification
  gapAnalysis: GapAnalysis
  ragEvidence: RAGDocument[]
  clinicalDataContext: ClinicalDataContext
  rawTranscript?: string
  /** Full longitudinal patient context (Session 10). When present, replaces thin patientHistory in prompt. */
  fullPatientContext?: FullPatientContext
}

export interface RestorativeDiagnosisOutput {
  primary: string                   // e.g., "Deep caries"
  caries_classification: string     // e.g., "Class II MOD"
  surfaces_involved: string[]       // e.g., ['M', 'O', 'D']
  caries_depth: string              // e.g., "deep_dentin"
  restoration_type: string          // e.g., "indirect_onlay"
  restoration_material: string      // e.g., "zirconia"
  confidence: number                // 0-100
  treatment_options: TreatmentOption[]
  clinical_notes?: string
}

export interface SynthesisOutput {
  // Endodontic Diagnosis (always present)
  primary_diagnosis: string
  differential_diagnoses: { diagnosis: string; probability: number }[]
  aae_classification: string
  diagnosis_confidence: number // 0-100

  // Endodontic Treatment
  treatment_options: TreatmentOption[]
  recommended_treatment: string
  treatment_confidence: number // 0-100

  // Gaps
  needs_more_info: boolean
  priority_questions: PrioritizedGapQuestion[]

  // Evidence
  literature_citations: Citation[]
  clinic_outcomes_summary: string

  // Prognosis
  prognosis: string
  prognosis_factors: string[]

  // Restorative Diagnosis (Session 7 — optional, only when caries/restorative findings)
  restorative_diagnosis?: RestorativeDiagnosisOutput
  combined_treatment_sequence?: string // e.g., "1. RCT → 2. Post & core → 3. Zirconia crown"
}

// =====================================================
// SYNTHESIS SESSION (Session 7: persistent multi-turn)
// =====================================================

/**
 * Wraps an AI chat session with the latest synthesis output.
 * Lives in server memory for the duration of one patient encounter.
 * NOT serializable to client — the orchestrator holds it, server actions access it.
 */
export interface SynthesisSession {
  chatSession: AIChatSession
  latestOutput: SynthesisOutput
  input: SynthesisInput
  turnCount: number
}

// Server-side session store (keyed by a session ID)
// Lifetime: one patient encounter. Cleaned up on new consultation.
const activeSessions = new Map<string, SynthesisSession>()

export function getSynthesisSession(sessionId: string): SynthesisSession | null {
  return activeSessions.get(sessionId) || null
}

export function clearSynthesisSession(sessionId: string): void {
  activeSessions.delete(sessionId)
  console.log(`🧹 [SYNTHESIS] Cleared session: ${sessionId}`)
}

// =====================================================
// SYNTHESIS AGENT
// =====================================================

/**
 * Run initial diagnostic synthesis and create a persistent chat session.
 * Returns both the output AND a sessionId for subsequent gap-filling turns.
 */
export async function runDiagnosticSynthesis(
  input: SynthesisInput
): Promise<{ output: SynthesisOutput; sessionId: string }> {
  console.log(`🧬 [SYNTHESIS] Running diagnostic synthesis for tooth ${input.toothNumber}...`)

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(input)

  // Create persistent chat session
  const chatSession = createChatSession(systemPrompt, {
    task: 'diagnosis',
    provider: 'claude',
    temperature: 0.15,
    maxOutputTokens: 4096, // Session 20: Reduced from 8192 — typical synthesis JSON is ~1500-2000 tokens
    responseFormat: 'json',
  })

  try {
    // First turn: send full context
    const response = await sendSessionMessage(chatSession, userPrompt)

    const parsed = JSON.parse(response || '{}')
    const output = validateAndNormalize(parsed, input)

    // Store session for gap-filling
    const sessionId = `synth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const session: SynthesisSession = {
      chatSession,
      latestOutput: output,
      input,
      turnCount: 1,
    }
    activeSessions.set(sessionId, session)

    console.log(
      `✅ [SYNTHESIS] Complete: ${output.primary_diagnosis} (${output.diagnosis_confidence}% confidence), ` +
      `${output.treatment_options.length} treatment options, needs_more_info=${output.needs_more_info}, ` +
      `sessionId=${sessionId}`
    )

    return { output, sessionId }
  } catch (error) {
    console.error('❌ [SYNTHESIS] Diagnostic synthesis failed:', error)
    return { output: buildFallbackOutput(input), sessionId: '' }
  }
}

/**
 * Legacy wrapper for backward compatibility (returns just SynthesisOutput).
 * Used by the test script and any code that doesn't need sessions.
 */
export async function runDiagnosticSynthesisLegacy(
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const { output } = await runDiagnosticSynthesis(input)
  return output
}

// =====================================================
// INCREMENTAL RE-SYNTHESIS (session-based gap-filling)
// =====================================================

/**
 * Send a follow-up message to an existing synthesis session.
 * Only sends the NEW information (~50 tokens) instead of rebuilding
 * the entire prompt (~8000 tokens).
 *
 * Falls back to stateless re-synthesis if no valid session exists.
 */
export async function incrementalReSynthesis(
  sessionId: string,
  newAnswer: { question_id: string; structured_value: string; details?: string },
  updatedConversation?: ConversationContext, // only needed for stateless fallback
  previousOutput?: SynthesisOutput,         // only needed for stateless fallback
  fallbackInput?: Omit<SynthesisInput, 'structuredConversation'>, // only needed for stateless fallback
): Promise<{ output: SynthesisOutput; sessionId: string }> {
  console.log(`🔄 [SYNTHESIS] Incremental re-synthesis after answering: ${newAnswer.question_id}`)

  const session = activeSessions.get(sessionId)

  if (session) {
    // ── SESSION-BASED (fast path: ~50 tokens) ──
    try {
      const followUpMessage = `The dentist has now provided additional clinical information:

**${newAnswer.question_id.replace(/_/g, ' ')}**: ${newAnswer.structured_value}${newAnswer.details ? ` (${newAnswer.details})` : ''}

Based on this new finding, revise your diagnosis and treatment plan. Return the complete updated JSON in the same format as before.`

      const response = await sendSessionMessage(session.chatSession, followUpMessage)
      const parsed = JSON.parse(response || '{}')
      const output = validateAndNormalize(parsed, session.input)

      session.latestOutput = output
      session.turnCount++

      console.log(
        `✅ [SYNTHESIS] Session turn ${session.turnCount}: ${output.primary_diagnosis} (${output.diagnosis_confidence}%), ` +
        `~${followUpMessage.length} chars sent (vs ~8000 stateless)`
      )

      return { output, sessionId }
    } catch (error) {
      console.warn('⚠️ [SYNTHESIS] Session-based re-synthesis failed, falling back to stateless:', error)
      // Fall through to stateless
    }
  } else {
    console.warn(`⚠️ [SYNTHESIS] No active session for ID: ${sessionId}, using stateless fallback`)
  }

  // ── STATELESS FALLBACK (full rebuild: ~8000 tokens) ──
  // Used when: session expired, page refreshed, or session call failed
  if (!updatedConversation || !previousOutput || !fallbackInput) {
    console.error('❌ [SYNTHESIS] Stateless fallback called without required params')
    return {
      output: previousOutput || buildFallbackOutput({ structuredConversation: {} as ConversationContext, toothNumber: '', patientHistory: {}, checklistReport: [], subspecialtyClassification: { classifications: [], primary_subspecialty: '', confidence: 0 }, gapAnalysis: { total_gaps: 0, diagnosis_changing_gaps: 0, prioritized_questions: [], estimated_confidence_current: 0, estimated_confidence_if_all_answered: 0, active_tracks: [], track_confidences: {}, has_restorative_track: false, endo_confidence_current: 0, endo_confidence_if_all_answered: 0, restorative_confidence_current: 0, restorative_confidence_if_all_answered: 0 }, ragEvidence: [], clinicalDataContext: {} }),
      sessionId: '',
    }
  }

  const systemPrompt = buildSystemPrompt()
  const restorativePrev = previousOutput.restorative_diagnosis
    ? `\nRestorative: ${previousOutput.restorative_diagnosis.primary} (${previousOutput.restorative_diagnosis.caries_classification}, confidence: ${previousOutput.restorative_diagnosis.confidence}%)`
    : ''

  const previousContext = `## Previous Diagnosis (before new information)
Primary: ${previousOutput.primary_diagnosis}
AAE Classification: ${previousOutput.aae_classification}
Confidence: ${previousOutput.diagnosis_confidence}%
Differentials: ${previousOutput.differential_diagnoses.map(d => `${d.diagnosis} (${d.probability}%)`).join(', ')}${restorativePrev}

## New Information Received
Question: ${newAnswer.question_id}
Answer: ${newAnswer.structured_value}${newAnswer.details ? ` (${newAnswer.details})` : ''}`

  const userPrompt = buildUserPrompt({
    ...fallbackInput,
    structuredConversation: updatedConversation,
  }) + '\n\n' + previousContext + '\n\nRevise the diagnosis and treatment plan with this new information.'

  try {
    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'diagnosis',
        provider: 'claude',
        temperature: 0.15,
        responseFormat: 'json',
        systemInstruction: systemPrompt,
        maxOutputTokens: 4096, // Session 20: Reduced from 8192 — typical synthesis JSON is ~1500-2000 tokens
      }
    )

    const parsed = JSON.parse(response || '{}')
    return {
      output: validateAndNormalize(parsed, { ...fallbackInput, structuredConversation: updatedConversation }),
      sessionId: '',
    }
  } catch (error) {
    console.error('❌ [SYNTHESIS] Stateless fallback also failed:', error)
    return { output: previousOutput, sessionId: '' }
  }
}

// =====================================================
// BATCH RE-SYNTHESIS (Session 12: gap-filling optimization)
// =====================================================

/**
 * Re-synthesize diagnosis with ALL gap answers at once.
 * Uses compressed context (no growing session history).
 * Called ONCE after all gap questions are answered.
 *
 * This replaces the per-turn incrementalReSynthesis loop:
 * - Before: 5 Claude calls with growing context (71s→120s each = ~482s total)
 * - After:  1 Claude call with compressed context (~80s total)
 *
 * ~92% fewer input tokens, ~80% faster overall.
 */
export async function batchReSynthesis(params: {
  previousSynthesis: SynthesisOutput
  gapAnswers: { questionId: string; questionText: string; answer: string; parsedValue: string }[]
  toothNumber: string
  fullPatientContext?: FullPatientContext
  patientHistory?: PatientHistory
  checklistReport?: ChecklistResult[]
  subspecialtyClassification?: SubspecialtyClassification
  ragEvidence?: RAGDocument[]
}): Promise<{ output: SynthesisOutput; sessionId: string }> {
  const { previousSynthesis, gapAnswers, toothNumber } = params
  console.log(`🧬 [SYNTHESIS] Batch re-synthesis with ${gapAnswers.length} gap answers for tooth ${toothNumber}...`)

  const systemPrompt = buildSystemPrompt()

  // Build compressed prompt — includes previous diagnosis + all answers at once
  const sections: string[] = []

  sections.push('═══════════════════════════════════════════')
  sections.push('PREVIOUS DIAGNOSIS (before gap-filling)')
  sections.push('═══════════════════════════════════════════')
  sections.push(`Primary Diagnosis: ${previousSynthesis.primary_diagnosis}`)
  sections.push(`AAE Classification: ${previousSynthesis.aae_classification}`)
  sections.push(`Confidence: ${previousSynthesis.diagnosis_confidence}%`)
  sections.push(`Differentials: ${previousSynthesis.differential_diagnoses.map(d => `${d.diagnosis} (${d.probability}%)`).join(', ')}`)
  sections.push(`Recommended Treatment: ${previousSynthesis.recommended_treatment}`)

  if (previousSynthesis.restorative_diagnosis) {
    sections.push(`\nRestorative: ${previousSynthesis.restorative_diagnosis.primary}`)
    sections.push(`  Classification: ${previousSynthesis.restorative_diagnosis.caries_classification}`)
    sections.push(`  Surfaces: ${previousSynthesis.restorative_diagnosis.surfaces_involved.join(', ')}`)
    sections.push(`  Depth: ${previousSynthesis.restorative_diagnosis.caries_depth}`)
    sections.push(`  Confidence: ${previousSynthesis.restorative_diagnosis.confidence}%`)
  }

  if (previousSynthesis.combined_treatment_sequence) {
    sections.push(`\nTreatment Sequence: ${previousSynthesis.combined_treatment_sequence}`)
  }

  // All gap answers in a single block
  sections.push('\n═══════════════════════════════════════════')
  sections.push(`NEW CLINICAL INFORMATION (${gapAnswers.length} answers collected)`)
  sections.push('═══════════════════════════════════════════')
  gapAnswers.forEach((ga, i) => {
    sections.push(`${i + 1}. Q: "${ga.questionText}"`)
    sections.push(`   A: ${ga.parsedValue}`)
  })

  // Patient context (compressed)
  if (params.fullPatientContext) {
    sections.push('\n═══════════════════════════════════════════')
    sections.push('PATIENT CONTEXT')
    sections.push('═══════════════════════════════════════════')
    sections.push(formatPatientContextForPrompt(params.fullPatientContext))
  } else if (params.patientHistory) {
    const ph = params.patientHistory
    sections.push('\n═══════════════════════════════════════════')
    sections.push('PATIENT HISTORY')
    sections.push('═══════════════════════════════════════════')
    if (ph.age) sections.push(`Age: ${ph.age}${ph.gender ? `, ${ph.gender}` : ''}`)
    if (ph.medicalConditions?.length) sections.push(`Medical: ${ph.medicalConditions.join(', ')}`)
    if (ph.allergies?.length) sections.push(`Allergies: ${ph.allergies.join(', ')}`)
  }

  sections.push('\n\nBased on ALL this new clinical information together, provide your UPDATED and COMPLETE diagnosis and treatment plan as JSON.')
  sections.push('Consider how the new findings collectively affect your diagnostic confidence, differential ranking, and treatment recommendations.')

  const userPrompt = sections.join('\n')

  try {
    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'diagnosis',
        provider: 'claude',
        temperature: 0.15,
        responseFormat: 'json',
        systemInstruction: systemPrompt,
        maxOutputTokens: 4096, // Session 20: Reduced from 8192 — typical synthesis JSON is ~1500-2000 tokens
      }
    )

    const parsed = JSON.parse(response || '{}')
    // Build a minimal SynthesisInput for validation — we only need it for fallback priority_questions
    const minimalInput: SynthesisInput = {
      structuredConversation: {} as ConversationContext,
      toothNumber,
      patientHistory: params.patientHistory || {},
      checklistReport: params.checklistReport || [],
      subspecialtyClassification: params.subspecialtyClassification || { classifications: [], primary_subspecialty: '', confidence: 0 },
      gapAnalysis: { total_gaps: 0, diagnosis_changing_gaps: 0, prioritized_questions: [], estimated_confidence_current: 0, estimated_confidence_if_all_answered: 0, active_tracks: [], track_confidences: {}, has_restorative_track: false, endo_confidence_current: 0, endo_confidence_if_all_answered: 0, restorative_confidence_current: 0, restorative_confidence_if_all_answered: 0 },
      ragEvidence: params.ragEvidence || [],
      clinicalDataContext: {},
    }
    const output = validateAndNormalize(parsed, minimalInput)

    console.log(
      `✅ [SYNTHESIS] Batch complete: ${output.primary_diagnosis} (${output.diagnosis_confidence}%), ` +
      `~${userPrompt.length} chars (compressed, no growing history)`
    )

    return { output, sessionId: '' }
  } catch (error) {
    console.error('❌ [SYNTHESIS] Batch re-synthesis failed:', error)
    return { output: previousSynthesis, sessionId: '' }
  }
}

// =====================================================
// PROMPT BUILDERS
// =====================================================

function buildSystemPrompt(): string {
  return `You are an endodontic diagnostic and treatment planning AI with expert-level knowledge.

## REASONING PROTOCOL

You receive PRIMARY evidence (the dentist-patient conversation) and SUPPLEMENTARY evidence (agent reports, literature, clinic data).

PHASE 1 — DIAGNOSIS:
Read the conversation. Form your own clinical impression FIRST, before looking at agent reports.
Then verify against the supplementary data. If agents conflict with the conversation, TRUST THE CONVERSATION.

- Classify using AAE categories for BOTH pulp status AND periapical status
- AAE Pulp: Normal Pulp, Reversible Pulpitis, Symptomatic Irreversible Pulpitis, Asymptomatic Irreversible Pulpitis, Pulp Necrosis, Previously Treated, Previously Initiated Therapy
- AAE Periapical: Normal Apical Tissues, Symptomatic Apical Periodontitis, Asymptomatic Apical Periodontitis, Acute Apical Abscess, Chronic Apical Abscess, Condensing Osteitis
- List differential diagnoses with probability percentages (must sum to ~100%)
- Note what critical information is MISSING (from the gap analysis)
- REDUCE confidence proportionally to the number and weight of missing diagnosis-changing questions

PHASE 2 — ENDODONTIC TREATMENT:
Based on YOUR Phase 1 diagnosis (not the agents' classification):
- List treatment options with evidence levels
- Reference the literature evidence provided
- Include clinic outcome data if available
- If treatment evidence suggests a diagnosis revision, revise Phase 1

PHASE 3 — RESTORATIVE ASSESSMENT (CONDITIONAL):
If the conversation mentions caries, cavity, breakdown, surfaces (MOD, OB, etc.), restoration, filling, crown, or tooth structure loss:
- Classify caries by Black's classification + surface notation (e.g., "Class II MOD")
- Determine caries depth (superficial_enamel, into_dentin, deep_dentin, near_pulp, into_pulp)
- List affected surfaces using individual letters: M, O, D, B, L
- Determine restoration type (direct_composite, indirect_inlay, indirect_onlay, indirect_overlay, indirect_crown, endocrown, post_and_core)
- Recommend material (composite, amalgam, ceramic, zirconia, emax, pfm, gold)
- Consider endo-restorative interaction (e.g., post-RCT crown need)
- Generate "combined_treatment_sequence" (e.g., "1. RCT → 2. Post & core → 3. Zirconia crown")
If NO caries/restorative findings exist, OMIT the restorative_diagnosis field entirely.

## CONFIDENCE SCORING
- 90-100%: All diagnosis-changing tests performed, clear picture
- 70-89%: Most key tests done, some gaps but confident pattern
- 50-69%: Significant gaps in critical tests, multiple viable differentials
- Below 50%: Major information missing, cannot reliably diagnose

## OUTPUT FORMAT
Return valid JSON matching SynthesisOutput interface. Do not include markdown or explanation outside JSON.

{
  "primary_diagnosis": "string",
  "differential_diagnoses": [{"diagnosis": "string", "probability": number}],
  "aae_classification": "Pulp: X; Periapical: Y",
  "diagnosis_confidence": number,
  "treatment_options": [{
    "name": "string", "description": "string", "success_rate": number,
    "evidence_level": "high|moderate|low", "from_literature": boolean,
    "from_clinic_data": boolean, "indications": ["string"], "contraindications": ["string"]
  }],
  "recommended_treatment": "string",
  "treatment_confidence": number,
  "needs_more_info": boolean,
  "literature_citations": [{"title": "string", "authors": "string", "journal": "string", "year": number, "doi": "string", "relevance": "string"}],
  "clinic_outcomes_summary": "string",
  "prognosis": "string",
  "prognosis_factors": ["string"],
  "restorative_diagnosis": {
    "primary": "string", "caries_classification": "string",
    "surfaces_involved": ["M", "O", "D"], "caries_depth": "string",
    "restoration_type": "string", "restoration_material": "string",
    "confidence": number, "treatment_options": [same format as above],
    "clinical_notes": "string"
  },
  "combined_treatment_sequence": "string"
}`
}

function buildUserPrompt(input: SynthesisInput): string {
  const sections: string[] = []

  // ── PRIMARY EVIDENCE ──
  sections.push('═══════════════════════════════════════════')
  sections.push('PRIMARY EVIDENCE: DENTIST-PATIENT CONVERSATION')
  sections.push('═══════════════════════════════════════════')
  sections.push(`Tooth: ${input.toothNumber}`)
  sections.push(formatConversation(input.structuredConversation))

  if (input.rawTranscript) {
    sections.push(`\nRaw Transcript Excerpt:\n${input.rawTranscript.substring(0, 2000)}`)
  }

  // ── PATIENT HISTORY & LONGITUDINAL CONTEXT ──
  sections.push('\n═══════════════════════════════════════════')
  sections.push('PATIENT HISTORY & LONGITUDINAL CONTEXT')
  sections.push('═══════════════════════════════════════════')

  if (input.fullPatientContext) {
    // Session 10: Rich longitudinal context from patient-context-assembler
    sections.push(formatPatientContextForPrompt(input.fullPatientContext))
  } else if (input.patientHistory) {
    // Fallback: thin patient history (pre-Session 10 callers)
    const ph = input.patientHistory
    if (ph.age) sections.push(`Age: ${ph.age}${ph.gender ? `, ${ph.gender}` : ''}`)
    if (ph.medicalConditions?.length) sections.push(`Medical Conditions: ${ph.medicalConditions.join(', ')}`)
    if (ph.currentMedications?.length) sections.push(`Medications: ${ph.currentMedications.join(', ')}`)
    if (ph.allergies?.length) sections.push(`Allergies: ${ph.allergies.join(', ')}`)
    if (ph.previousDentalTreatments?.length) sections.push(`Previous Dental: ${ph.previousDentalTreatments.join(', ')}`)
  }

  // ── SUPPLEMENTARY: AGENT REPORTS ──
  sections.push('\n═══════════════════════════════════════════')
  sections.push('SUPPLEMENTARY: AGENT REPORTS')
  sections.push('═══════════════════════════════════════════')

  // Checklist coverage
  sections.push('\n## Questionnaire Coverage (Agent A)')
  for (const cl of input.checklistReport) {
    if (cl.match_score > 0.05) {
      sections.push(`${cl.questionnaire_name}: ${(cl.match_score * 100).toFixed(0)}% covered`)
      if (cl.answered.length > 0) {
        const topAnswers = cl.answered.slice(0, 5).map(a => `  ${a.question_id}: ${a.extracted_answer} (${(a.confidence * 100).toFixed(0)}%)`).join('\n')
        sections.push(topAnswers)
      }
    }
  }

  // Subspecialty classification
  sections.push('\n## Subspecialty Classification (Agent B)')
  sections.push(`Primary: ${input.subspecialtyClassification.primary_subspecialty} (${(input.subspecialtyClassification.confidence * 100).toFixed(0)}%)`)
  const otherClassifications = input.subspecialtyClassification.classifications
    .filter(c => c.subspecialty !== input.subspecialtyClassification.primary_subspecialty && c.probability > 0.05)
    .map(c => `${c.subspecialty}: ${(c.probability * 100).toFixed(0)}%`)
  if (otherClassifications.length > 0) {
    sections.push(`Others: ${otherClassifications.join(', ')}`)
  }

  // Gap analysis
  sections.push('\n## Gap Analysis (Agent C)')
  sections.push(`Confidence: ${(input.gapAnalysis.estimated_confidence_current * 100).toFixed(0)}% current → ${(input.gapAnalysis.estimated_confidence_if_all_answered * 100).toFixed(0)}% if all answered`)
  sections.push(`Diagnosis-changing gaps: ${input.gapAnalysis.diagnosis_changing_gaps}`)
  if (input.gapAnalysis.prioritized_questions.length > 0) {
    sections.push('Top missing:')
    for (const q of input.gapAnalysis.prioritized_questions.slice(0, 5)) {
      sections.push(`  #${q.priority}: ${q.natural_language} — ${q.why_it_matters}`)
    }
  }

  // ── SUPPLEMENTARY: LITERATURE EVIDENCE ──
  if (input.ragEvidence && input.ragEvidence.length > 0) {
    sections.push('\n' + formatRAGContext(input.ragEvidence))
  }

  // ── SUPPLEMENTARY: CLINIC OUTCOMES ──
  if (input.clinicalDataContext) {
    const cd = input.clinicalDataContext
    sections.push('\n═══════════════════════════════════════════')
    sections.push('CLINIC OUTCOME DATA')
    sections.push('═══════════════════════════════════════════')
    if (cd.totalSimilarCases) sections.push(`Similar cases in this clinic: ${cd.totalSimilarCases}`)
    if (cd.averageSuccessRate) sections.push(`Average success rate: ${cd.averageSuccessRate}%`)
    if (cd.outcomesSummary) sections.push(cd.outcomesSummary)
    if (cd.commonComplications?.length) sections.push(`Common complications: ${cd.commonComplications.join(', ')}`)
  }

  sections.push('\n\nProvide your diagnosis and treatment plan as JSON.')

  return sections.join('\n')
}

function formatConversation(ctx: ConversationContext): string {
  const lines: string[] = []

  if (ctx.chiefComplaint) {
    const cc = ctx.chiefComplaint
    lines.push(`Chief Complaint: ${cc.primary_complaint}`)
    if (cc.patient_description) lines.push(`Patient says: "${cc.patient_description}"`)
    if (cc.onset_duration) lines.push(`Onset/Duration: ${cc.onset_duration}`)
    if (cc.associated_symptoms?.length) lines.push(`Associated symptoms: ${cc.associated_symptoms.join(', ')}`)
    if (cc.triggers?.length) lines.push(`Triggers: ${cc.triggers.join(', ')}`)
  }

  if (ctx.hopi) {
    const h = ctx.hopi
    if (h.pain_characteristics) {
      lines.push(`Pain: ${h.pain_characteristics.quality}, intensity ${h.pain_characteristics.intensity}/10, ${h.pain_characteristics.frequency}, lasting ${h.pain_characteristics.duration}`)
    }
    if (h.aggravating_factors?.length) lines.push(`Aggravating factors: ${h.aggravating_factors.join(', ')}`)
    if (h.relieving_factors?.length) lines.push(`Relieving factors: ${h.relieving_factors.join(', ')}`)
    if (h.associated_symptoms?.length) lines.push(`HOPI associated symptoms: ${h.associated_symptoms.join(', ')}`)
    if (h.previous_treatments?.length) lines.push(`Previous treatments: ${h.previous_treatments.join(', ')}`)
  }

  if (ctx.medicalHistory) {
    const m = ctx.medicalHistory
    if (m.medical_conditions?.length) lines.push(`PMH: ${m.medical_conditions.join(', ')}`)
    if (m.current_medications?.length) lines.push(`Medications: ${m.current_medications.join(', ')}`)
    if (m.allergies?.length) lines.push(`Allergies: ${m.allergies.join(', ')}`)
    if (m.previous_dental_treatments?.length) lines.push(`Past dental: ${m.previous_dental_treatments.join(', ')}`)
  }

  if (ctx.clinicalExamination) {
    const c = ctx.clinicalExamination
    if (c.extraoral_findings?.length) lines.push(`Extraoral: ${c.extraoral_findings.join(', ')}`)
    if (c.intraoral_findings?.length) lines.push(`Intraoral: ${c.intraoral_findings.join(', ')}`)
    if (c.oral_hygiene) lines.push(`Oral hygiene: ${c.oral_hygiene}`)
    if (c.gingival_condition) lines.push(`Gingival: ${c.gingival_condition}`)
  }

  // Restorative assessment (Session 7)
  if (ctx.restorationAssessment) {
    const r = ctx.restorationAssessment
    if (r.caries_extent) lines.push(`Caries extent: ${r.caries_extent}`)
    if (r.surfaces_involved?.length) lines.push(`Surfaces involved: ${r.surfaces_involved.join(', ')}`)
    if (r.existing_restoration) lines.push(`Existing restoration: ${r.existing_restoration}`)
    if (r.restoration_quality) lines.push(`Restoration quality: ${r.restoration_quality}`)
    if (r.remaining_tooth_structure) lines.push(`Remaining structure: ${r.remaining_tooth_structure}`)
    if (r.cusp_involvement?.length) lines.push(`Cusp involvement: ${r.cusp_involvement.join(', ')}`)
    if (r.ferrule_assessment) lines.push(`Ferrule: ${r.ferrule_assessment}`)
    if (r.isolation_feasibility) lines.push(`Isolation: ${r.isolation_feasibility}`)
    if (r.esthetic_zone) lines.push(`Esthetic zone: ${r.esthetic_zone}`)
    if (r.occlusal_load) lines.push(`Occlusal load: ${r.occlusal_load}`)
    if (r.material_preference) lines.push(`Material preference: ${r.material_preference}`)
    if (r.restoration_type_preference) lines.push(`Restoration type preference: ${r.restoration_type_preference}`)
  }

  return lines.length > 0 ? lines.join('\n') : 'No structured conversation data available.'
}

// =====================================================
// VALIDATION & FALLBACK
// =====================================================

function validateAndNormalize(parsed: any, input: SynthesisInput): SynthesisOutput {
  return {
    primary_diagnosis: parsed.primary_diagnosis || 'Unable to determine',
    differential_diagnoses: Array.isArray(parsed.differential_diagnoses)
      ? parsed.differential_diagnoses.map((d: any) => ({
          diagnosis: d.diagnosis || d.name || 'Unknown',
          probability: typeof d.probability === 'number' ? d.probability : 0,
        }))
      : [],
    aae_classification: parsed.aae_classification || 'Not classified',
    diagnosis_confidence: clamp(parsed.diagnosis_confidence ?? 30, 0, 100),

    treatment_options: Array.isArray(parsed.treatment_options)
      ? parsed.treatment_options.map((t: any) => ({
          name: t.name || 'Unknown',
          description: t.description || '',
          success_rate: typeof t.success_rate === 'number' ? t.success_rate : 0,
          evidence_level: (['high', 'moderate', 'low'].includes(t.evidence_level) ? t.evidence_level : 'low') as 'high' | 'moderate' | 'low',
          from_literature: !!t.from_literature,
          from_clinic_data: !!t.from_clinic_data,
          indications: Array.isArray(t.indications) ? t.indications : [],
          contraindications: Array.isArray(t.contraindications) ? t.contraindications : [],
        }))
      : [],
    recommended_treatment: parsed.recommended_treatment || '',
    treatment_confidence: clamp(parsed.treatment_confidence ?? 30, 0, 100),

    needs_more_info: parsed.needs_more_info ?? input.gapAnalysis.diagnosis_changing_gaps > 2,
    priority_questions: input.gapAnalysis.prioritized_questions,

    literature_citations: Array.isArray(parsed.literature_citations)
      ? parsed.literature_citations.map((c: any) => ({
          title: c.title || '',
          authors: c.authors,
          journal: c.journal,
          year: c.year,
          doi: c.doi,
          relevance: c.relevance || '',
        }))
      : [],
    clinic_outcomes_summary: parsed.clinic_outcomes_summary || 'No clinic outcome data available.',

    prognosis: parsed.prognosis || 'Unable to determine without complete data.',
    prognosis_factors: Array.isArray(parsed.prognosis_factors) ? parsed.prognosis_factors : [],

    // Restorative diagnosis (Session 7 — optional)
    restorative_diagnosis: parsed.restorative_diagnosis ? {
      primary: parsed.restorative_diagnosis.primary || 'Caries',
      caries_classification: parsed.restorative_diagnosis.caries_classification || '',
      surfaces_involved: Array.isArray(parsed.restorative_diagnosis.surfaces_involved)
        ? parsed.restorative_diagnosis.surfaces_involved
        : [],
      caries_depth: parsed.restorative_diagnosis.caries_depth || '',
      restoration_type: parsed.restorative_diagnosis.restoration_type || '',
      restoration_material: parsed.restorative_diagnosis.restoration_material || '',
      confidence: clamp(parsed.restorative_diagnosis.confidence ?? 30, 0, 100),
      treatment_options: Array.isArray(parsed.restorative_diagnosis.treatment_options)
        ? parsed.restorative_diagnosis.treatment_options.map((t: any) => ({
            name: t.name || 'Unknown',
            description: t.description || '',
            success_rate: typeof t.success_rate === 'number' ? t.success_rate : 0,
            evidence_level: (['high', 'moderate', 'low'].includes(t.evidence_level) ? t.evidence_level : 'low') as 'high' | 'moderate' | 'low',
            from_literature: !!t.from_literature,
            from_clinic_data: !!t.from_clinic_data,
            indications: Array.isArray(t.indications) ? t.indications : [],
            contraindications: Array.isArray(t.contraindications) ? t.contraindications : [],
          }))
        : [],
      clinical_notes: parsed.restorative_diagnosis.clinical_notes,
    } : undefined,
    combined_treatment_sequence: parsed.combined_treatment_sequence,
  }
}

function buildFallbackOutput(input: SynthesisInput): SynthesisOutput {
  return {
    primary_diagnosis: 'Unable to generate diagnosis — AI service error',
    differential_diagnoses: [],
    aae_classification: 'Not classified',
    diagnosis_confidence: 0,
    treatment_options: [],
    recommended_treatment: '',
    treatment_confidence: 0,
    needs_more_info: true,
    priority_questions: input.gapAnalysis.prioritized_questions,
    literature_citations: [],
    clinic_outcomes_summary: '',
    prognosis: 'Unable to determine',
    prognosis_factors: [],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
