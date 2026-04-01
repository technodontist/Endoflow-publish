'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'
import { revalidatePath } from 'next/cache'

// =============================================
// EPISODE VISITS — CRUD Server Actions
// =============================================

export interface EpisodeVisitData {
  episodeId: string
  consultationId?: string
  appointmentId?: string
  visitNumber?: number
  visitType?: 'treatment' | 'follow_up' | 'emergency' | 'review'
  proceduresDone?: string[]
  materialsUsed?: Record<string, unknown>
  complications?: string
  clinicalNotes?: string
  nextVisitPlan?: string
  visitDate?: string
}

/**
 * Create a new episode visit and auto-increment the episode's completed visits.
 * If completed_visits >= planned_visits, auto-updates episode status to 'completed'.
 */
export async function createEpisodeVisitAction(
  data: EpisodeVisitData
): Promise<{ success: boolean; visit?: any; episodeCompleted?: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    // Get current episode to determine visit number and check status
    const { data: episode, error: epError } = await supabase
      .schema('api')
      .from('treatment_episodes')
      .select('id, completed_visits, planned_visits, status')
      .eq('id', data.episodeId)
      .single()

    if (epError || !episode) {
      console.error('❌ [VISITS] Episode not found:', data.episodeId)
      return { success: false, error: 'Episode not found' }
    }

    const visitNumber = data.visitNumber || (episode.completed_visits + 1)

    // Insert the visit
    const { data: visit, error: visitError } = await supabase
      .schema('api')
      .from('episode_visits')
      .insert({
        episode_id: data.episodeId,
        consultation_id: data.consultationId || null,
        appointment_id: data.appointmentId || null,
        visit_number: visitNumber,
        visit_type: data.visitType || 'treatment',
        procedures_done: data.proceduresDone || [],
        materials_used: data.materialsUsed || {},
        complications: data.complications || null,
        clinical_notes: data.clinicalNotes || null,
        next_visit_plan: data.nextVisitPlan || null,
        visit_date: data.visitDate || new Date().toISOString(),
        dentist_confirmed: false,
      })
      .select()
      .single()

    if (visitError) {
      console.error('❌ [VISITS] Failed to create visit:', visitError.message)
      return { success: false, error: 'Failed to create visit' }
    }

    // Increment completed_visits on the episode
    const newCompletedVisits = episode.completed_visits + 1
    const episodeCompleted = newCompletedVisits >= episode.planned_visits

    const episodeUpdate: Record<string, unknown> = {
      completed_visits: newCompletedVisits,
    }

    // Auto-update status based on progress
    if (episode.status === 'planned') {
      episodeUpdate.status = 'in_progress'
      episodeUpdate.started_at = new Date().toISOString()
    }

    if (episodeCompleted) {
      episodeUpdate.status = 'completed'
      episodeUpdate.completed_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .schema('api')
      .from('treatment_episodes')
      .update(episodeUpdate)
      .eq('id', data.episodeId)

    if (updateError) {
      console.error('⚠️ [VISITS] Visit created but episode update failed:', updateError.message)
    }

    console.log(
      '✅ [VISITS] Created visit #' + visitNumber,
      'for episode:', data.episodeId,
      episodeCompleted ? '(EPISODE COMPLETED)' : `(${newCompletedVisits}/${episode.planned_visits})`
    )

    revalidatePath('/dentist')
    revalidatePath('/patient')

    return { success: true, visit, episodeCompleted }
  } catch (err) {
    console.error('❌ [VISITS] Exception creating visit:', err)
    return { success: false, error: 'Unexpected error creating visit' }
  }
}

/**
 * Get all visits for an episode, ordered by visit number
 */
export async function getEpisodeVisitsAction(
  episodeId: string
): Promise<{ success: boolean; visits?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    const { data: visits, error } = await supabase
      .schema('api')
      .from('episode_visits')
      .select('*')
      .eq('episode_id', episodeId)
      .order('visit_number', { ascending: true })

    if (error) {
      console.error('❌ [VISITS] Failed to fetch visits:', error.message)
      return { success: false, error: 'Failed to fetch visits' }
    }

    return { success: true, visits: visits || [] }
  } catch (err) {
    console.error('❌ [VISITS] Exception fetching visits:', err)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Update an episode visit
 */
export async function updateEpisodeVisitAction(
  visitId: string,
  updates: Partial<{
    proceduresDone: string[]
    materialsUsed: Record<string, unknown>
    complications: string
    clinicalNotes: string
    nextVisitPlan: string
    aiProgressAssessment: Record<string, unknown>
  }>
): Promise<{ success: boolean; visit?: any; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    const updateData: Record<string, unknown> = {}
    if (updates.proceduresDone !== undefined) updateData.procedures_done = updates.proceduresDone
    if (updates.materialsUsed !== undefined) updateData.materials_used = updates.materialsUsed
    if (updates.complications !== undefined) updateData.complications = updates.complications
    if (updates.clinicalNotes !== undefined) updateData.clinical_notes = updates.clinicalNotes
    if (updates.nextVisitPlan !== undefined) updateData.next_visit_plan = updates.nextVisitPlan
    if (updates.aiProgressAssessment !== undefined) updateData.ai_progress_assessment = updates.aiProgressAssessment

    const { data: visit, error } = await supabase
      .schema('api')
      .from('episode_visits')
      .update(updateData)
      .eq('id', visitId)
      .select()
      .single()

    if (error) {
      console.error('❌ [VISITS] Failed to update visit:', error.message)
      return { success: false, error: 'Failed to update visit' }
    }

    revalidatePath('/dentist')
    return { success: true, visit }
  } catch (err) {
    console.error('❌ [VISITS] Exception updating visit:', err)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Confirm the AI assessment for a visit (human-in-the-loop gate)
 * This marks the visit as dentist-confirmed, meaning the AI assessment
 * has been reviewed and approved by the dentist.
 */
export async function confirmVisitAssessmentAction(
  visitId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    const { error } = await supabase
      .schema('api')
      .from('episode_visits')
      .update({ dentist_confirmed: true })
      .eq('id', visitId)

    if (error) {
      console.error('❌ [VISITS] Failed to confirm assessment:', error.message)
      return { success: false, error: 'Failed to confirm assessment' }
    }

    console.log('✅ [VISITS] Dentist confirmed assessment for visit:', visitId)

    revalidatePath('/dentist')
    return { success: true }
  } catch (err) {
    console.error('❌ [VISITS] Exception confirming assessment:', err)
    return { success: false, error: 'Unexpected error' }
  }
}
