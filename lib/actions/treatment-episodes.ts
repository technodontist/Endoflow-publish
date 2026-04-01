'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'
import { revalidatePath } from 'next/cache'

// =============================================
// TREATMENT EPISODES — CRUD Server Actions
// =============================================

export interface TreatmentEpisodeData {
  id?: string
  patientId: string
  dentistId: string
  clinicId?: string
  episodeType: 'single_tooth' | 'prosthetic_unit' | 'surgical' | 'periodontal'
  linkedTeeth: string[]
  originalDiagnosis: string
  originalDiagnosisConsultationId?: string
  treatmentPlan: string
  combinedTreatmentSequence?: string
  plannedVisits?: number
  status?: 'planned' | 'in_progress' | 'completed' | 'on_hold' | 'failed' | 'cancelled'
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  estimatedCompletionDate?: string
  outcome?: 'success' | 'partial_success' | 'failure' | 'ongoing' | null
  outcomeNotes?: string
  aiPrognosis?: Record<string, unknown>
}

/**
 * Create a new treatment episode
 */
export async function createTreatmentEpisodeAction(
  data: TreatmentEpisodeData
): Promise<{ success: boolean; episode?: any; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    const { data: episode, error } = await supabase
      .schema('api')
      .from('treatment_episodes')
      .insert({
        patient_id: data.patientId,
        dentist_id: data.dentistId,
        clinic_id: data.clinicId || null,
        episode_type: data.episodeType,
        linked_teeth: data.linkedTeeth,
        original_diagnosis: data.originalDiagnosis,
        original_diagnosis_consultation_id: data.originalDiagnosisConsultationId || null,
        treatment_plan: data.treatmentPlan,
        combined_treatment_sequence: data.combinedTreatmentSequence || null,
        planned_visits: data.plannedVisits || 1,
        status: data.status || 'planned',
        priority: data.priority || 'medium',
        estimated_completion_date: data.estimatedCompletionDate || null,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [EPISODES] Failed to create episode:', error.message)
      return { success: false, error: 'Failed to create treatment episode' }
    }

    console.log('✅ [EPISODES] Created episode:', episode.id, 'for teeth:', data.linkedTeeth)

    revalidatePath('/dentist')
    revalidatePath('/patient')

    return { success: true, episode }
  } catch (err) {
    console.error('❌ [EPISODES] Exception creating episode:', err)
    return { success: false, error: 'Unexpected error creating episode' }
  }
}

/**
 * Get all treatment episodes for a patient
 */
export async function getTreatmentEpisodesForPatientAction(
  patientId: string,
  filters?: { status?: string; toothNumber?: string }
): Promise<{ success: boolean; episodes?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    let query = supabase
      .schema('api')
      .from('treatment_episodes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.toothNumber) {
      query = query.contains('linked_teeth', [filters.toothNumber])
    }

    const { data: episodes, error } = await query

    if (error) {
      console.error('❌ [EPISODES] Failed to fetch episodes:', error.message)
      return { success: false, error: 'Failed to fetch episodes' }
    }

    return { success: true, episodes: episodes || [] }
  } catch (err) {
    console.error('❌ [EPISODES] Exception fetching episodes:', err)
    return { success: false, error: 'Unexpected error fetching episodes' }
  }
}

/**
 * Get active (planned or in_progress) episodes for a patient
 */
export async function getActiveEpisodesForPatientAction(
  patientId: string
): Promise<{ success: boolean; episodes?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    const { data: episodes, error } = await supabase
      .schema('api')
      .from('treatment_episodes')
      .select('*')
      .eq('patient_id', patientId)
      .in('status', ['planned', 'in_progress'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [EPISODES] Failed to fetch active episodes:', error.message)
      return { success: false, error: 'Failed to fetch active episodes' }
    }

    return { success: true, episodes: episodes || [] }
  } catch (err) {
    console.error('❌ [EPISODES] Exception fetching active episodes:', err)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Update a treatment episode (partial update)
 */
export async function updateTreatmentEpisodeAction(
  episodeId: string,
  updates: Partial<{
    status: string
    priority: string
    completedVisits: number
    plannedVisits: number
    outcome: string
    outcomeNotes: string
    aiPrognosis: Record<string, unknown>
    startedAt: string
    completedAt: string
    estimatedCompletionDate: string
    combinedTreatmentSequence: string
    treatmentPlan: string
  }>
): Promise<{ success: boolean; episode?: any; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    // Map camelCase to snake_case
    const updateData: Record<string, unknown> = {}
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.priority !== undefined) updateData.priority = updates.priority
    if (updates.completedVisits !== undefined) updateData.completed_visits = updates.completedVisits
    if (updates.plannedVisits !== undefined) updateData.planned_visits = updates.plannedVisits
    if (updates.outcome !== undefined) updateData.outcome = updates.outcome
    if (updates.outcomeNotes !== undefined) updateData.outcome_notes = updates.outcomeNotes
    if (updates.aiPrognosis !== undefined) updateData.ai_prognosis = updates.aiPrognosis
    if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt
    if (updates.estimatedCompletionDate !== undefined) updateData.estimated_completion_date = updates.estimatedCompletionDate
    if (updates.combinedTreatmentSequence !== undefined) updateData.combined_treatment_sequence = updates.combinedTreatmentSequence
    if (updates.treatmentPlan !== undefined) updateData.treatment_plan = updates.treatmentPlan

    const { data: episode, error } = await supabase
      .schema('api')
      .from('treatment_episodes')
      .update(updateData)
      .eq('id', episodeId)
      .select()
      .single()

    if (error) {
      console.error('❌ [EPISODES] Failed to update episode:', error.message)
      return { success: false, error: 'Failed to update episode' }
    }

    console.log('✅ [EPISODES] Updated episode:', episodeId, 'with:', Object.keys(updateData))

    revalidatePath('/dentist')
    revalidatePath('/patient')

    return { success: true, episode }
  } catch (err) {
    console.error('❌ [EPISODES] Exception updating episode:', err)
    return { success: false, error: 'Unexpected error updating episode' }
  }
}

/**
 * Get a single episode with its visits
 */
export async function getEpisodeWithVisitsAction(
  episodeId: string
): Promise<{ success: boolean; episode?: any; visits?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    // Fetch episode
    const { data: episode, error: epError } = await supabase
      .schema('api')
      .from('treatment_episodes')
      .select('*')
      .eq('id', episodeId)
      .single()

    if (epError) {
      console.error('❌ [EPISODES] Failed to fetch episode:', epError.message)
      return { success: false, error: 'Episode not found' }
    }

    // Fetch visits ordered by visit number
    const { data: visits, error: visitError } = await supabase
      .schema('api')
      .from('episode_visits')
      .select('*')
      .eq('episode_id', episodeId)
      .order('visit_number', { ascending: true })

    if (visitError) {
      console.error('❌ [EPISODES] Failed to fetch visits:', visitError.message)
      return { success: true, episode, visits: [] }
    }

    return { success: true, episode, visits: visits || [] }
  } catch (err) {
    console.error('❌ [EPISODES] Exception fetching episode with visits:', err)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Get all episodes involving a specific tooth
 */
export async function getEpisodesForToothAction(
  patientId: string,
  toothNumber: string
): Promise<{ success: boolean; episodes?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    const { data: episodes, error } = await supabase
      .schema('api')
      .from('treatment_episodes')
      .select('*')
      .eq('patient_id', patientId)
      .contains('linked_teeth', [toothNumber])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [EPISODES] Failed to fetch episodes for tooth:', error.message)
      return { success: false, error: 'Failed to fetch episodes for tooth' }
    }

    return { success: true, episodes: episodes || [] }
  } catch (err) {
    console.error('❌ [EPISODES] Exception:', err)
    return { success: false, error: 'Unexpected error' }
  }
}
