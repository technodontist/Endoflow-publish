/**
 * AI Persistence Service
 *
 * Bridges the AI pipeline output to Supabase persistence.
 * Saves full SynthesisOutput, gap analysis Q&A, and literature evidence
 * to the new ai_synthesis_results, gap_analysis_answers, and
 * consultation_evidence tables.
 *
 * Session 14: Created to close the persistence gap where AI output
 * was lost after each consultation session.
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { SynthesisOutput, Citation, TreatmentOption } from '@/lib/agents/diagnostic-synthesis-agent'
import type { SubspecialtyClassification } from '@/lib/agents/subspecialty-classifier-agent'
import type { RAGDocument } from '@/lib/services/rag-service'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SaveSynthesisParams {
  consultationId: string
  patientId: string
  dentistId: string
  toothNumber: string
  synthesis: SynthesisOutput
  subspecialtyClassification?: SubspecialtyClassification
  conductorOutput?: Record<string, unknown>
  aiModel?: string
  processingTimeMs?: number
  gapQuestionsAsked?: number
  gapQuestionsAnswered?: number
  toothDiagnosisId?: string
}

export interface SaveGapAnswerParams {
  synthesisId: string
  consultationId: string
  patientId: string
  toothNumber: string
  questionId: string
  questionnaireSource?: string
  questionText: string
  questionCategory?: string
  rawAnswer: string
  parsedValue?: string
  answerSource?: 'manual' | 'voice' | 'auto_context' | 'from_consultation'
  diagnosticWeight?: string
  confidenceDelta?: number
  isPositiveFinding?: boolean
  sequenceNumber: number
}

export interface SaveEvidenceParams {
  synthesisId?: string
  consultationId: string
  patientId: string
  toothNumber?: string
  ragDocuments: RAGDocument[]
  usedFor?: 'diagnosis' | 'treatment' | 'prognosis' | 'general'
}

// ─── Save Synthesis Result ──────────────────────────────────────────────────

/**
 * Persist the full AI synthesis output to Supabase.
 * Returns the created synthesis record ID for linking gap answers and evidence.
 */
export async function saveSynthesisResult(params: SaveSynthesisParams): Promise<{ id: string } | null> {
  try {
    const supabase = await createServiceClient()

    const record = {
      consultation_id: params.consultationId,
      patient_id: params.patientId,
      dentist_id: params.dentistId,
      tooth_number: params.toothNumber,
      tooth_diagnosis_id: params.toothDiagnosisId || null,

      // Diagnosis
      primary_diagnosis: params.synthesis.primary_diagnosis,
      diagnosis_confidence: params.synthesis.diagnosis_confidence,
      aae_classification: params.synthesis.aae_classification || null,
      differential_diagnoses: params.synthesis.differential_diagnoses || [],

      // Treatment
      recommended_treatment: params.synthesis.recommended_treatment,
      treatment_confidence: params.synthesis.treatment_confidence,
      treatment_options: params.synthesis.treatment_options || [],
      combined_treatment_sequence: params.synthesis.combined_treatment_sequence || null,

      // Prognosis
      prognosis: params.synthesis.prognosis || null,
      prognosis_factors: params.synthesis.prognosis_factors || [],

      // Subspecialty
      subspecialty_classification: params.subspecialtyClassification || null,

      // Restorative
      restorative_diagnosis: params.synthesis.restorative_diagnosis || null,

      // Conductor
      conductor_output: params.conductorOutput || null,

      // Evidence
      literature_citations: params.synthesis.literature_citations || [],
      clinic_outcomes_summary: params.synthesis.clinic_outcomes_summary || null,

      // Metadata
      pipeline_version: 'v1',
      ai_model: params.aiModel || null,
      processing_time_ms: params.processingTimeMs || null,
      gap_questions_asked: params.gapQuestionsAsked || 0,
      gap_questions_answered: params.gapQuestionsAnswered || 0,
      status: 'draft',
    }

    const { data, error } = await supabase
      .from('ai_synthesis_results')
      .insert(record)
      .select('id')
      .single()

    if (error) {
      console.error('❌ [AI-PERSIST] Failed to save synthesis result:', error.message)
      return null
    }

    console.log(`💾 [AI-PERSIST] Saved synthesis for tooth ${params.toothNumber} → ${data.id}`)
    return { id: data.id }
  } catch (err) {
    console.error('❌ [AI-PERSIST] Unexpected error saving synthesis:', err)
    return null
  }
}

// ─── Update Synthesis Status ────────────────────────────────────────────────

/**
 * Mark a synthesis as accepted (when dentist clicks "Accept Diagnosis/Treatment").
 */
export async function acceptSynthesisResult(
  synthesisId: string,
  dentistId: string,
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()

    const { error } = await supabase
      .from('ai_synthesis_results')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: dentistId,
      })
      .eq('id', synthesisId)

    if (error) {
      console.error('❌ [AI-PERSIST] Failed to accept synthesis:', error.message)
      return false
    }

    console.log(`✅ [AI-PERSIST] Synthesis ${synthesisId} accepted by ${dentistId}`)
    return true
  } catch (err) {
    console.error('❌ [AI-PERSIST] Error accepting synthesis:', err)
    return false
  }
}

/**
 * Supersede a previous synthesis (when re-running pipeline for same tooth).
 */
export async function supersedePreviousSynthesis(
  consultationId: string,
  toothNumber: string,
): Promise<void> {
  try {
    const supabase = await createServiceClient()

    await supabase
      .from('ai_synthesis_results')
      .update({ status: 'superseded' })
      .eq('consultation_id', consultationId)
      .eq('tooth_number', toothNumber)
      .in('status', ['draft'])

    console.log(`🔄 [AI-PERSIST] Superseded previous drafts for tooth ${toothNumber}`)
  } catch (err) {
    console.error('❌ [AI-PERSIST] Error superseding synthesis:', err)
  }
}

// ─── Save Gap Analysis Answers ──────────────────────────────────────────────

/**
 * Persist a batch of gap analysis Q&A answers.
 */
export async function saveGapAnalysisAnswers(
  answers: SaveGapAnswerParams[],
): Promise<boolean> {
  if (answers.length === 0) return true

  try {
    const supabase = await createServiceClient()

    const records = answers.map(a => ({
      synthesis_id: a.synthesisId,
      consultation_id: a.consultationId,
      patient_id: a.patientId,
      tooth_number: a.toothNumber,
      question_id: a.questionId,
      questionnaire_source: a.questionnaireSource || null,
      question_text: a.questionText,
      question_category: a.questionCategory || null,
      raw_answer: a.rawAnswer,
      parsed_value: a.parsedValue || null,
      answer_source: a.answerSource || 'manual',
      diagnostic_weight: a.diagnosticWeight || null,
      confidence_delta: a.confidenceDelta?.toString() || null,
      is_positive_finding: a.isPositiveFinding || false,
      sequence_number: a.sequenceNumber,
    }))

    const { error } = await supabase
      .from('gap_analysis_answers')
      .insert(records)

    if (error) {
      console.error('❌ [AI-PERSIST] Failed to save gap answers:', error.message)
      return false
    }

    console.log(`💾 [AI-PERSIST] Saved ${answers.length} gap analysis answers`)
    return true
  } catch (err) {
    console.error('❌ [AI-PERSIST] Error saving gap answers:', err)
    return false
  }
}

// ─── Save Evidence (RAG Retrieval Log) ──────────────────────────────────────

/**
 * Persist RAG retrieval results as consultation evidence.
 */
export async function saveConsultationEvidence(
  params: SaveEvidenceParams,
): Promise<boolean> {
  if (!params.ragDocuments || params.ragDocuments.length === 0) return true

  try {
    const supabase = await createServiceClient()

    const records = params.ragDocuments.map((doc, idx) => ({
      synthesis_id: params.synthesisId || null,
      consultation_id: params.consultationId,
      patient_id: params.patientId,
      tooth_number: params.toothNumber || null,
      medical_knowledge_id: doc.id || null,
      citation_title: doc.title || 'Unknown',
      citation_authors: doc.authors || null,
      citation_journal: doc.journal || null,
      citation_year: doc.publication_year || null,
      citation_doi: doc.doi || null,
      citation_url: null,
      similarity_score: doc.similarity?.toFixed(4) || null,
      search_mode: 'hybrid',
      relevance_note: null,
      retrieval_rank: idx + 1,
      used_for: params.usedFor || 'diagnosis',
    }))

    const { error } = await supabase
      .from('consultation_evidence')
      .insert(records)

    if (error) {
      console.error('❌ [AI-PERSIST] Failed to save evidence:', error.message)
      return false
    }

    console.log(`💾 [AI-PERSIST] Saved ${records.length} evidence records for consultation ${params.consultationId}`)
    return true
  } catch (err) {
    console.error('❌ [AI-PERSIST] Error saving evidence:', err)
    return false
  }
}

// ─── Link Placeholders to Real Consultation ─────────────────────────────────

/**
 * Session 20: When a consultation is finalized, update any synthesis records
 * that used a placeholder consultationId (prefixed with 'pre_') to the real ID.
 * Also updates linked gap_analysis_answers and consultation_evidence records.
 */
export async function linkSynthesisToConsultation(
  dentistId: string,
  realConsultationId: string,
  patientId?: string,
): Promise<number> {
  try {
    const supabase = await createServiceClient()
    const placeholderId = `pre_${dentistId}`

    // Update synthesis results
    const { data: updated, error: synthError } = await supabase
      .from('ai_synthesis_results')
      .update({ consultation_id: realConsultationId })
      .eq('consultation_id', placeholderId)
      .eq('dentist_id', dentistId)
      .select('id')

    if (synthError) {
      console.warn('⚠️ [AI-PERSIST] Failed to link synthesis records:', synthError.message)
      return 0
    }

    const count = updated?.length || 0

    if (count > 0) {
      // Update linked gap answers
      await supabase
        .from('gap_analysis_answers')
        .update({ consultation_id: realConsultationId })
        .eq('consultation_id', placeholderId)

      // Update linked evidence
      await supabase
        .from('consultation_evidence')
        .update({ consultation_id: realConsultationId })
        .eq('consultation_id', placeholderId)

      console.log(`🔗 [AI-PERSIST] Linked ${count} synthesis record(s) to consultation ${realConsultationId}`)
    }

    return count
  } catch (err) {
    console.error('❌ [AI-PERSIST] Error linking synthesis to consultation:', err)
    return 0
  }
}

// ─── Retrieval Helpers (for PDF reports and UI) ─────────────────────────────

/**
 * Get the latest AI synthesis for a patient+tooth combination.
 * Used by dental chart tooltips and follow-up consultations.
 */
export async function getLatestSynthesis(
  patientId: string,
  toothNumber: string,
): Promise<Record<string, unknown> | null> {
  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('ai_synthesis_results')
      .select('*')
      .eq('patient_id', patientId)
      .eq('tooth_number', toothNumber)
      .in('status', ['draft', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

/**
 * Get all synthesis results for a consultation (for PDF report).
 */
export async function getSynthesisForConsultation(
  consultationId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('ai_synthesis_results')
      .select('*')
      .eq('consultation_id', consultationId)
      .in('status', ['draft', 'accepted'])
      .order('tooth_number')

    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

/**
 * Get all evidence citations for a consultation (for PDF report).
 */
export async function getEvidenceForConsultation(
  consultationId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('consultation_evidence')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('retrieval_rank')

    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

/**
 * Get gap analysis answers for a synthesis result.
 */
export async function getGapAnswersForSynthesis(
  synthesisId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('gap_analysis_answers')
      .select('*')
      .eq('synthesis_id', synthesisId)
      .order('sequence_number')

    if (error || !data) return []
    return data
  } catch {
    return []
  }
}
