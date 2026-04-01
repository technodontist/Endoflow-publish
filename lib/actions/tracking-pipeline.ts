'use server'

import { getCurrentUser } from './auth'
import { getEpisodeWithVisitsAction } from './treatment-episodes'
import { runTrackingPipeline, type TrackingPipelineInput, type TrackingPipelineOutput } from '@/lib/services/tracking-pipeline'

/**
 * Run the tracking pipeline for a treatment/follow-up visit.
 *
 * This action fetches the episode context, builds the pipeline input,
 * and returns the AI assessment. It does NOT auto-apply anything —
 * the dentist must confirm via confirmVisitAssessmentAction.
 */
export async function runTrackingPipelineAction(params: {
  episodeId: string
  currentTranscript?: string
  currentFindings?: string
  currentProcedures?: string[]
  currentComplications?: string
  mode: 'treatment_visit' | 'follow_up'
  patientAge?: number
  medicalHistory?: string[]
  allergies?: string[]
}): Promise<{ success: boolean; assessment?: TrackingPipelineOutput; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Fetch episode with visits
    const result = await getEpisodeWithVisitsAction(params.episodeId)
    if (!result.success || !result.episode) {
      return { success: false, error: 'Episode not found' }
    }

    const episode = result.episode
    const visits = result.visits || []

    // Build pipeline input
    const input: TrackingPipelineInput = {
      episode: {
        id: episode.id,
        originalDiagnosis: episode.original_diagnosis,
        treatmentPlan: episode.treatment_plan,
        combinedTreatmentSequence: episode.combined_treatment_sequence,
        linkedTeeth: episode.linked_teeth || [],
        plannedVisits: episode.planned_visits,
        completedVisits: episode.completed_visits,
        status: episode.status,
        priority: episode.priority,
      },
      visitHistory: visits.map((v: any) => ({
        visitNumber: v.visit_number,
        visitType: v.visit_type,
        visitDate: v.visit_date,
        proceduresDone: v.procedures_done,
        clinicalNotes: v.clinical_notes,
        complications: v.complications,
      })),
      currentVisit: {
        voiceTranscript: params.currentTranscript,
        clinicalFindings: params.currentFindings,
        proceduresDone: params.currentProcedures,
        complications: params.currentComplications,
        mode: params.mode,
      },
      patientContext: {
        age: params.patientAge,
        medicalHistory: params.medicalHistory,
        allergies: params.allergies,
      },
    }

    // Run the pipeline
    const assessment = await runTrackingPipeline(input)

    console.log(
      '✅ [TRACKING ACTION] Assessment complete for episode:',
      params.episodeId,
      '| Confidence:', assessment.confidence,
      '| Rating:', assessment.progressAssessment.overallRating
    )

    return { success: true, assessment }
  } catch (err) {
    console.error('❌ [TRACKING ACTION] Pipeline failed:', err)
    return { success: false, error: 'Tracking pipeline failed' }
  }
}
