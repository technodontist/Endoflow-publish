/**
 * Consultation AI Orchestrator
 *
 * Main entry point that coordinates the multi-agent diagnostic pipeline:
 *
 * STEP 1: Agents A + B run in PARALLEL
 *   - Agent A (Checklist Matcher): maps conversation → questionnaire answers
 *   - Agent B (Subspecialty Classifier): deterministic + LLM classification
 *
 * STEP 1b: Agent C (Gap Finder) — needs A + B results
 *
 * STEP 2: Focused RAG retrieval + clinical data (PARALLEL)
 *   - RAG uses subspecialty weights from Agent B
 *   - Clinical data queries clinic's own outcome history
 *
 * STEP 3: Diagnostic Synthesis — single LLM call, two-phase reasoning
 *
 * Phase 3.2 of Session 6: Unified Synthesis Pipeline
 */

import { runChecklistMatcher, type ChecklistResult } from './checklist-matcher-agent'
import { runSubspecialtyClassifier, type SubspecialtyClassification } from './subspecialty-classifier-agent'
import { runGapFinder, type GapAnalysis } from './gap-finder-agent'
import {
  runDiagnosticSynthesis,
  incrementalReSynthesis,
  getSynthesisSession,
  clearSynthesisSession,
  type SynthesisOutput,
  type SynthesisSession,
  type PatientHistory,
  type ClinicalDataContext,
} from './diagnostic-synthesis-agent'
import { runConductor, extractTrackSummaries, type ConductorOutput } from './conductor-agent'
import { performRAGQuery, type RAGDocument } from '@/lib/services/rag-service'
import { createServiceClient } from '@/lib/supabase/server'
import type { ConversationContext } from '@/lib/services/medical-conversation-parser'
import type { FullPatientContext } from '@/lib/services/patient-context-assembler'

// =====================================================
// MAIN PIPELINE
// =====================================================

export interface PipelineParams {
  conversationContext: ConversationContext
  toothNumber: string
  patientHistory: PatientHistory
  dentistId: string
  rawTranscript?: string
  /** Full longitudinal patient context (Session 10). Passed through to synthesis agent. */
  fullPatientContext?: FullPatientContext
}

export interface PipelineResult {
  synthesis: SynthesisOutput
  checklistResults: ChecklistResult[]
  subspecialtyClassification: SubspecialtyClassification
  gapAnalysis: GapAnalysis
  ragDocuments: RAGDocument[]
  clinicalDataContext: ClinicalDataContext
  timing: {
    agentsMs: number
    ragMs: number
    synthesisMs: number
    totalMs: number
  }
  // Dual-track extensions (Session 7)
  hasRestorativeTrack: boolean
  endoConfidence: number
  restorativeConfidence: number
  // Persistent synthesis session (Session 7)
  synthesisSessionId: string
  // Conductor output (Session 7: N-track orchestration)
  conductorOutput: ConductorOutput | null
}

/**
 * Run the full consultation AI pipeline.
 *
 * This is THE entry point for getting AI diagnosis + treatment from a consultation.
 * Call this instead of the old separate diagnosis/treatment actions.
 */
export async function runConsultationAIPipeline(
  params: PipelineParams
): Promise<PipelineResult> {
  const pipelineStart = Date.now()
  console.log(`\n🚀 [ORCHESTRATOR] Starting consultation AI pipeline for tooth ${params.toothNumber}`)

  // ────────────────────────────────────────────────
  // STEP 1: Run Agents A + B in PARALLEL
  // ────────────────────────────────────────────────
  const agentsStart = Date.now()
  console.log('⚡ [ORCHESTRATOR] Step 1: Running Agent A (Checklist) + Agent B (Classifier) in parallel...')

  const [checklistResults, initialClassification] = await Promise.all([
    runChecklistMatcher(params.conversationContext, params.toothNumber, params.rawTranscript),
    runSubspecialtyClassifier(params.conversationContext, []), // empty checklists initially — B uses conversation only
  ])

  // Re-run classifier with checklist data for refinement
  const subspecialtyClassification = await runSubspecialtyClassifier(
    params.conversationContext,
    checklistResults
  )

  // ────────────────────────────────────────────────
  // STEP 1b: Agent C (Gap Finder) — needs A + B
  // ────────────────────────────────────────────────
  console.log('⚡ [ORCHESTRATOR] Step 1b: Running Agent C (Gap Finder)...')
  const gapAnalysis = await runGapFinder(checklistResults, subspecialtyClassification, params.rawTranscript)

  const agentsMs = Date.now() - agentsStart
  console.log(`✅ [ORCHESTRATOR] Agents complete in ${agentsMs}ms`)

  // ────────────────────────────────────────────────
  // STEP 2: Focused RAG + Clinical Data in PARALLEL
  // ────────────────────────────────────────────────
  const ragStart = Date.now()
  console.log('⚡ [ORCHESTRATOR] Step 2: RAG retrieval + clinic data in parallel...')

  // Build subspecialty weights map for focused retrieval
  const subspecialtyWeights = subspecialtyClassification.classifications.reduce(
    (acc, c) => ({ ...acc, [c.subspecialty]: c.probability }),
    {} as Record<string, number>
  )

  // Build a rich query from the conversation
  const ragQuery = buildRAGQuery(params.conversationContext, params.toothNumber)

  const [ragResult, clinicalDataContext] = await Promise.all([
    performRAGQuery({
      query: ragQuery,
      subspecialtyWeights,
      matchCount: 10,
      matchThreshold: 0.3,
      searchMode: 'hybrid',
    }).catch((err) => {
      console.warn('⚠️ [ORCHESTRATOR] RAG search failed, continuing without evidence:', err.message)
      return { documents: [] as RAGDocument[], queryEmbedding: [], totalMatches: 0 }
    }),
    getClinicalDataContext({
      subspecialty: subspecialtyClassification.primary_subspecialty,
      toothNumber: params.toothNumber,
      dentistId: params.dentistId,
    }),
  ])

  const ragMs = Date.now() - ragStart
  console.log(`✅ [ORCHESTRATOR] RAG: ${ragResult.documents.length} docs, clinic data ready. ${ragMs}ms`)

  // ────────────────────────────────────────────────
  // STEP 3: Diagnostic Synthesis
  // ────────────────────────────────────────────────
  const synthesisStart = Date.now()
  console.log('⚡ [ORCHESTRATOR] Step 3: Running diagnostic synthesis...')

  const { output: synthesis, sessionId: synthesisSessionId } = await runDiagnosticSynthesis({
    structuredConversation: params.conversationContext,
    toothNumber: params.toothNumber,
    patientHistory: params.patientHistory,
    checklistReport: checklistResults,
    subspecialtyClassification,
    gapAnalysis,
    ragEvidence: ragResult.documents,
    clinicalDataContext,
    rawTranscript: params.rawTranscript,
    fullPatientContext: params.fullPatientContext,
  })

  const synthesisMs = Date.now() - synthesisStart

  // ────────────────────────────────────────────────
  // STEP 4: Conductor — Cross-Domain Orchestration
  // ────────────────────────────────────────────────
  let conductorOutput: ConductorOutput | null = null
  const activeTracks = gapAnalysis.active_tracks || ['endodontic']

  if (activeTracks.length > 1) {
    console.log(`🎼 [ORCHESTRATOR] Step 4: Running Conductor for ${activeTracks.length} active tracks...`)
    const trackSummaries = extractTrackSummaries(synthesis, activeTracks)

    conductorOutput = await runConductor(
      trackSummaries,
      params.toothNumber,
      {
        age: params.patientHistory.age,
        medicalConditions: params.patientHistory.medicalConditions,
        allergies: params.patientHistory.allergies,
      }
    )
  } else {
    console.log('🎼 [ORCHESTRATOR] Step 4: Skipped (single track — no cross-domain reasoning needed)')
  }

  const totalMs = Date.now() - pipelineStart

  const hasRestorativeTrack = gapAnalysis.has_restorative_track
  const restorativeInfo = synthesis.restorative_diagnosis
    ? `\n   Restorative: ${synthesis.restorative_diagnosis.primary} (${synthesis.restorative_diagnosis.caries_classification}, ${synthesis.restorative_diagnosis.confidence}%)`
    : ''
  const conductorInfo = conductorOutput
    ? `\n   Conductor: ${conductorOutput.treatment_sequence.length} steps, prognosis: ${conductorOutput.prognosis_grade}`
    : ''

  console.log(
    `\n✅ [ORCHESTRATOR] Pipeline complete in ${totalMs}ms (agents: ${agentsMs}ms, RAG: ${ragMs}ms, synthesis: ${synthesisMs}ms)\n` +
    `   Active tracks: ${activeTracks.join(', ')}\n` +
    `   Diagnosis: ${synthesis.primary_diagnosis} (${synthesis.diagnosis_confidence}%)\n` +
    `   Treatment: ${synthesis.recommended_treatment} (${synthesis.treatment_confidence}%)\n` +
    `   Needs more info: ${synthesis.needs_more_info}` +
    restorativeInfo + conductorInfo
  )

  return {
    synthesis,
    checklistResults,
    subspecialtyClassification,
    gapAnalysis,
    ragDocuments: ragResult.documents,
    clinicalDataContext,
    timing: { agentsMs, ragMs, synthesisMs, totalMs },
    hasRestorativeTrack,
    endoConfidence: gapAnalysis.endo_confidence_current,
    restorativeConfidence: gapAnalysis.restorative_confidence_current,
    synthesisSessionId,
    conductorOutput,
  }
}

// =====================================================
// GAP-FILLING RE-SYNTHESIS
// =====================================================

/**
 * When the dentist answers a gap question, send a follow-up to the synthesis session.
 * Uses persistent session (~50 tokens per turn) instead of full rebuild (~8000 tokens).
 * Falls back to stateless if session is unavailable.
 */
export async function handleGapAnswer(
  previousResult: PipelineResult,
  updatedConversation: ConversationContext,
  newAnswer: { question_id: string; structured_value: string; details?: string }
): Promise<{ synthesis: SynthesisOutput; sessionId: string }> {
  const { output, sessionId } = await incrementalReSynthesis(
    previousResult.synthesisSessionId,
    newAnswer,
    // Stateless fallback params (only used if session expired)
    updatedConversation,
    previousResult.synthesis,
    {
      toothNumber: '',
      patientHistory: {} as PatientHistory,
      checklistReport: previousResult.checklistResults,
      subspecialtyClassification: previousResult.subspecialtyClassification,
      gapAnalysis: previousResult.gapAnalysis,
      ragEvidence: previousResult.ragDocuments,
      clinicalDataContext: previousResult.clinicalDataContext,
    }
  )
  return { synthesis: output, sessionId }
}

// =====================================================
// HELPERS
// =====================================================

function buildRAGQuery(ctx: ConversationContext, toothNumber: string): string {
  const parts: string[] = [`Tooth ${toothNumber}`]

  if (ctx.chiefComplaint?.primary_complaint) {
    parts.push(ctx.chiefComplaint.primary_complaint)
  }
  if (ctx.hopi?.pain_characteristics) {
    const p = ctx.hopi.pain_characteristics
    parts.push(`${p.quality} pain, ${p.intensity}/10`)
  }
  if (ctx.clinicalExamination?.intraoral_findings?.length) {
    parts.push(ctx.clinicalExamination.intraoral_findings.join(', '))
  }
  if (ctx.hopi?.associated_symptoms?.length) {
    parts.push(ctx.hopi.associated_symptoms.join(', '))
  }
  // Include restorative context for RAG (Session 7)
  if (ctx.restorationAssessment) {
    const r = ctx.restorationAssessment
    if (r.caries_extent) parts.push(`caries: ${r.caries_extent}`)
    if (r.surfaces_involved?.length) parts.push(`surfaces: ${r.surfaces_involved.join('')}`)
    if (r.remaining_tooth_structure) parts.push(`remaining structure: ${r.remaining_tooth_structure}`)
  }

  return parts.join('. ') || `Endodontic diagnosis tooth ${toothNumber}`
}

/**
 * Get clinical outcome data from this clinic's own patient database.
 * Provides real-world success rates and complications from similar cases.
 */
async function getClinicalDataContext(params: {
  subspecialty: string
  toothNumber: string
  dentistId: string
}): Promise<ClinicalDataContext> {
  try {
    const supabase = await createServiceClient()

    // Query completed treatments for similar diagnoses by this dentist
    const { data: treatments, error } = await supabase
      .from('treatments')
      .select('treatment_type, status, notes, created_at')
      .eq('dentist_id', params.dentistId)
      .in('status', ['completed', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !treatments || treatments.length === 0) {
      return {
        totalSimilarCases: 0,
        outcomesSummary: 'No historical clinic data available for similar cases.',
      }
    }

    // Simple aggregation
    const completed = treatments.filter(t => t.status === 'completed').length
    const total = treatments.length

    return {
      totalSimilarCases: total,
      averageSuccessRate: total > 0 ? Math.round((completed / total) * 100) : undefined,
      outcomesSummary: `This clinic has ${total} similar treatment records (${completed} completed). Limited outcome data available for detailed analysis.`,
      commonComplications: [],
    }
  } catch (error) {
    console.warn('⚠️ [ORCHESTRATOR] Clinical data query failed:', error)
    return {
      totalSimilarCases: 0,
      outcomesSummary: 'Clinical data unavailable.',
    }
  }
}
