'use server'

/**
 * Server Action wrapper for the consultation AI pipeline.
 * Bridges the client-side gap dialog with the server-side agent orchestrator.
 *
 * Session 7: handleGapAnswer now uses persistent chat sessions.
 * The synthesisSessionId lives server-side (in-memory Map) — only the ID
 * is passed to/from the client.
 */

import { runConsultationAIPipeline, handleGapAnswer, type PipelineResult } from '@/lib/agents/consultation-ai-orchestrator'
import { parseGapAnswer, mergeAnswerIntoConversation } from '@/lib/agents/gap-answer-parser'
import type { ConversationContext } from '@/lib/services/medical-conversation-parser'
import { assemblePatientContext } from '@/lib/services/patient-context-assembler'
import { batchReSynthesis, type SynthesisOutput } from '@/lib/agents/diagnostic-synthesis-agent'
import { parseAnswerFast, type CollectedAnswer } from '@/lib/agents/gap-interviewer-agent'
import type { PrioritizedGapQuestion } from '@/lib/agents/gap-finder-agent'
import {
  saveSynthesisResult,
  supersedePreviousSynthesis,
  saveGapAnalysisAnswers,
  saveConsultationEvidence,
  type SaveGapAnswerParams,
} from '@/lib/services/ai-persistence-service'

export async function runPipelineAction(params: {
  conversationContext: ConversationContext
  toothNumber: string
  patientAge?: number | null
  patientId?: string | null
  dentistId?: string
  consultationId?: string
  rawTranscript?: string
}) {
  // Session 10: Assemble full patient longitudinal context if patientId is provided
  let fullPatientContext = undefined
  if (params.patientId) {
    try {
      fullPatientContext = await assemblePatientContext(
        params.patientId,
        params.toothNumber
      )
      console.log(`📋 [PIPELINE ACTION] Patient context assembled — ${fullPatientContext.visitCount} visits, ${fullPatientContext.activeEpisodes.length} active episodes`)
    } catch (err) {
      console.warn('⚠️ [PIPELINE ACTION] Failed to assemble patient context, continuing without:', err)
    }
  }

  const result = await runConsultationAIPipeline({
    conversationContext: params.conversationContext,
    toothNumber: params.toothNumber,
    patientHistory: {
      age: fullPatientContext?.demographics.age ?? params.patientAge ?? undefined,
      gender: fullPatientContext?.demographics.gender ?? undefined,
      medicalConditions: fullPatientContext?.demographics.medicalConditions.length
        ? fullPatientContext.demographics.medicalConditions
        : params.conversationContext.medicalHistory?.medical_conditions,
      currentMedications: fullPatientContext?.demographics.medications.length
        ? fullPatientContext.demographics.medications
        : params.conversationContext.medicalHistory?.current_medications,
      allergies: fullPatientContext?.demographics.allergies.length
        ? fullPatientContext.demographics.allergies
        : params.conversationContext.medicalHistory?.allergies,
      previousDentalTreatments: params.conversationContext.medicalHistory?.previous_dental_treatments,
    },
    dentistId: params.dentistId || 'current-dentist',
    rawTranscript: params.rawTranscript,
    fullPatientContext,
  })

  // Session 14→20: Persist AI synthesis to Supabase (non-blocking)
  // Use real consultationId when available, fall back to prefixed dentistId placeholder.
  // The prefixed placeholder makes it easy to identify and update later.
  const effectiveConsultationId = params.consultationId || `pre_${params.dentistId}`
  if (result.synthesis && params.patientId && params.dentistId) {
    try {
      const synthesisRecord = await saveSynthesisResult({
        consultationId: effectiveConsultationId,
        patientId: params.patientId,
        dentistId: params.dentistId,
        toothNumber: params.toothNumber,
        synthesis: result.synthesis,
        subspecialtyClassification: result.subspecialtyClassification,
        aiModel: 'claude-synthesis-pipeline-v1',
        processingTimeMs: result.timing?.totalMs,
        gapQuestionsAsked: result.gapAnalysis?.total_gaps || 0,
        gapQuestionsAnswered: 0,
      })

      // Save RAG evidence trail
      if (synthesisRecord && result.ragDocuments?.length) {
        await saveConsultationEvidence({
          synthesisId: synthesisRecord.id,
          consultationId: effectiveConsultationId,
          patientId: params.patientId,
          toothNumber: params.toothNumber,
          ragDocuments: result.ragDocuments,
          usedFor: 'diagnosis',
        })
      }

      // Attach synthesis ID to result for downstream gap answer persistence
      if (synthesisRecord) {
        ;(result as any).synthesisDbId = synthesisRecord.id
      }

      console.log(`💾 [PIPELINE] Initial synthesis persisted to Supabase`)
    } catch (err) {
      console.warn('⚠️ [PIPELINE] Failed to persist synthesis (non-blocking):', err)
    }
  }

  // Serialize the result — PipelineResult is a plain object, safe for client transport.
  // The synthesisSessionId is a string ID referencing the server-side session.
  return result
}

export async function processGapAnswerAction(params: {
  questionId: string
  questionNaturalLanguage: string
  questionWhyItMatters: string
  questionPriority: number
  questionnaireSource: string
  diagnosticWeight: number
  track?: 'endodontic' | 'restorative'
  answerText: string
  currentConversation: ConversationContext
  previousPipelineResult: PipelineResult
}) {
  // Parse the answer
  const parsed = await parseGapAnswer(
    {
      question_id: params.questionId,
      natural_language: params.questionNaturalLanguage,
      why_it_matters: params.questionWhyItMatters,
      priority: params.questionPriority,
      questionnaire_source: params.questionnaireSource,
      diagnostic_weight: params.diagnosticWeight,
      track: params.track || 'endodontic',
    },
    params.answerText
  )

  // Merge into conversation
  const updatedConversation = mergeAnswerIntoConversation(params.currentConversation, parsed)

  // Re-run synthesis using persistent session (~50 tokens vs ~8000 stateless)
  const { synthesis: newSynthesis, sessionId: updatedSessionId } = await handleGapAnswer(
    params.previousPipelineResult,
    updatedConversation,
    {
      question_id: parsed.question_id,
      structured_value: parsed.structured_value,
      details: parsed.details,
    }
  )

  // Update the session ID in the pipeline result for the next call
  // (in case session was recreated during fallback)
  const updatedPipelineResult = {
    ...params.previousPipelineResult,
    synthesis: newSynthesis,
    synthesisSessionId: updatedSessionId || params.previousPipelineResult.synthesisSessionId,
  }

  return {
    synthesis: newSynthesis,
    updatedConversation,
    parsedAnswer: parsed,
    updatedPipelineResult, // Client should store this for the next gap answer
  }
}

// =====================================================
// FAST ANSWER PARSING (Session 12: gap-filling optimization)
// =====================================================

/**
 * Parse a single gap answer using Gemini (~3s) instead of Claude re-synthesis (~80-120s).
 * Used during the Q&A loop for instant feedback. No re-synthesis happens yet.
 */
export async function parseGapAnswerFastAction(params: {
  question: {
    question_id: string
    natural_language: string
    why_it_matters: string
    priority: number
    questionnaire_source: string
    diagnostic_weight: number
    track?: string
  }
  rawAnswer: string
}) {
  const result = await parseAnswerFast(
    params.question as PrioritizedGapQuestion,
    params.rawAnswer,
  )
  return result
}

// =====================================================
// BATCH RE-SYNTHESIS (Session 12: gap-filling optimization)
// =====================================================

/**
 * Process ALL gap answers at once with a single Claude call.
 * Replaces the per-turn processGapAnswerAction loop.
 *
 * Before: 5 serial Claude calls, growing context → ~482 seconds
 * After:  1 Claude call, compressed context → ~80 seconds
 */
export async function processAllGapAnswersAction(params: {
  answers: CollectedAnswer[]
  previousSynthesis: any // Client-side mirror type — structurally matches SynthesisOutput
  toothNumber: string
  patientId?: string | null
  dentistId?: string
  consultationId?: string
  previousPipelineResult: any // Client-side mirror type — structurally matches PipelineResult
}) {
  console.log(`🧬 [PIPELINE] Batch processing ${params.answers.length} gap answers...`)

  // Assemble patient context for the batch call
  let fullPatientContext = undefined
  if (params.patientId) {
    try {
      fullPatientContext = await assemblePatientContext(
        params.patientId,
        params.toothNumber,
      )
    } catch (err) {
      console.warn('⚠️ [PIPELINE] Failed to assemble patient context for batch:', err)
    }
  }

  const startTime = Date.now()

  const { output } = await batchReSynthesis({
    previousSynthesis: params.previousSynthesis,
    gapAnswers: params.answers.map(a => ({
      questionId: a.questionId,
      questionText: a.questionText,
      answer: a.rawAnswer,
      parsedValue: a.parsedValue,
    })),
    toothNumber: params.toothNumber,
    fullPatientContext,
    patientHistory: fullPatientContext ? {
      age: fullPatientContext.demographics.age ?? undefined,
      gender: fullPatientContext.demographics.gender ?? undefined,
      medicalConditions: fullPatientContext.demographics.medicalConditions,
      currentMedications: fullPatientContext.demographics.medications,
      allergies: fullPatientContext.demographics.allergies,
    } : undefined,
    checklistReport: params.previousPipelineResult.checklistResults,
    subspecialtyClassification: params.previousPipelineResult.subspecialtyClassification,
    ragEvidence: params.previousPipelineResult.ragDocuments,
  })

  const elapsed = Date.now() - startTime
  console.log(`✅ [PIPELINE] Batch synthesis done in ${elapsed}ms → ${output.primary_diagnosis} (${output.diagnosis_confidence}%)`)

  // Session 14: Persist the post-gap-filling synthesis + gap answers
  let synthesisDbId: string | undefined
  const prevSynthesisDbId = params.previousPipelineResult?.synthesisDbId
  if (params.patientId && params.dentistId) {
    try {
      const dentistId = params.dentistId
      const consultationId = params.consultationId || prevSynthesisDbId || `pre_${dentistId}` // use real ID when available

      // Supersede previous draft and save new one
      await supersedePreviousSynthesis(consultationId, params.toothNumber)

      const synthesisRecord = await saveSynthesisResult({
        consultationId,
        patientId: params.patientId,
        dentistId,
        toothNumber: params.toothNumber,
        synthesis: output,
        subspecialtyClassification: params.previousPipelineResult.subspecialtyClassification,
        conductorOutput: params.previousPipelineResult.conductorOutput,
        aiModel: 'claude-batch-synthesis-v1',
        processingTimeMs: elapsed,
        gapQuestionsAsked: params.answers.length,
        gapQuestionsAnswered: params.answers.filter(a => a.rawAnswer).length,
      })

      if (synthesisRecord) {
        synthesisDbId = synthesisRecord.id

        // Persist gap analysis Q&A
        // Map CollectedAnswer (core fields) + any extended fields the client may pass
        const gapRecords: SaveGapAnswerParams[] = params.answers.map((a: any, idx: number) => ({
          synthesisId: synthesisRecord.id,
          consultationId,
          patientId: params.patientId!,
          toothNumber: params.toothNumber,
          questionId: a.questionId,
          questionnaireSource: a.questionnaireSource || a.track || undefined,
          questionText: a.questionText,
          questionCategory: a.questionCategory || undefined,
          rawAnswer: a.rawAnswer,
          parsedValue: a.parsedValue || undefined,
          answerSource: a.answerSource || 'manual',
          diagnosticWeight: a.diagnosticWeight || undefined,
          confidenceDelta: a.confidenceDelta || undefined,
          isPositiveFinding: a.isPositiveFinding || false,
          sequenceNumber: idx,
        }))

        await saveGapAnalysisAnswers(gapRecords)

        // Re-save evidence with new synthesis ID
        if (params.previousPipelineResult.ragDocuments?.length) {
          await saveConsultationEvidence({
            synthesisId: synthesisRecord.id,
            consultationId,
            patientId: params.patientId,
            toothNumber: params.toothNumber,
            ragDocuments: params.previousPipelineResult.ragDocuments,
            usedFor: 'diagnosis',
          })
        }

        console.log(`💾 [PIPELINE] Post-gap synthesis + ${gapRecords.length} answers persisted`)
      }
    } catch (err) {
      console.warn('⚠️ [PIPELINE] Failed to persist batch synthesis (non-blocking):', err)
    }
  }

  return {
    synthesis: output,
    batchTimeMs: elapsed,
    synthesisDbId,
  }
}
