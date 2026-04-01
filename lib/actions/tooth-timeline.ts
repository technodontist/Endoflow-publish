'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'

// =============================================
// TOOTH TIMELINE — Server Actions
// =============================================

export interface ToothTimelineEventData {
  patientId: string
  toothNumber: string
  eventType: 'diagnosis' | 'treatment_start' | 'treatment_visit' | 'treatment_complete' | 'follow_up' | 'new_finding' | 'status_change'
  episodeId?: string
  consultationId?: string
  eventDate?: string
  description: string
  previousStatus?: string
  newStatus?: string
  dataSnapshot?: Record<string, unknown>
  createdBy?: string
}

/**
 * Add a tooth timeline event
 */
export async function addToothTimelineEventAction(
  data: ToothTimelineEventData
): Promise<{ success: boolean; event?: any; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const supabase = await createServiceClient()

    const { data: event, error } = await supabase
      .schema('api')
      .from('tooth_timeline')
      .insert({
        patient_id: data.patientId,
        tooth_number: data.toothNumber,
        event_type: data.eventType,
        episode_id: data.episodeId || null,
        consultation_id: data.consultationId || null,
        event_date: data.eventDate || new Date().toISOString(),
        description: data.description,
        previous_status: data.previousStatus || null,
        new_status: data.newStatus || null,
        data_snapshot: data.dataSnapshot || null,
        created_by: data.createdBy || user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [TIMELINE] Failed to add event:', error.message)
      return { success: false, error: 'Failed to add timeline event' }
    }

    console.log('✅ [TIMELINE] Added event:', data.eventType, 'for tooth', data.toothNumber)

    return { success: true, event }
  } catch (err) {
    console.error('❌ [TIMELINE] Exception adding event:', err)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Get timeline for a specific tooth or all teeth of a patient
 */
export async function getToothTimelineAction(
  patientId: string,
  toothNumber?: string
): Promise<{ success: boolean; events?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Access control: patients can only see their own, staff can see all
    if (user.role === 'patient' && user.id !== patientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    let query = supabase
      .schema('api')
      .from('tooth_timeline')
      .select('*')
      .eq('patient_id', patientId)
      .order('event_date', { ascending: false })

    if (toothNumber) {
      query = query.eq('tooth_number', toothNumber)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('❌ [TIMELINE] Failed to fetch timeline:', error.message)
      return { success: false, error: 'Failed to fetch timeline' }
    }

    return { success: true, events: events || [] }
  } catch (err) {
    console.error('❌ [TIMELINE] Exception fetching timeline:', err)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Get a comprehensive patient timeline combining tooth events,
 * consultations, and appointments into a single chronological view.
 */
export async function getPatientFullTimelineAction(
  patientId: string
): Promise<{ success: boolean; timeline?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    if (user.role === 'patient' && user.id !== patientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    // Fetch all three data sources in parallel
    const [toothEvents, consultations, appointments] = await Promise.all([
      supabase
        .schema('api')
        .from('tooth_timeline')
        .select('*')
        .eq('patient_id', patientId)
        .order('event_date', { ascending: false }),

      supabase
        .schema('api')
        .from('consultations')
        .select('id, patient_id, dentist_id, consultation_date, status, chief_complaint, diagnosis, treatment_plan, consultation_mode, episode_id')
        .eq('patient_id', patientId)
        .order('consultation_date', { ascending: false }),

      supabase
        .schema('api')
        .from('appointments')
        .select('id, patient_id, dentist_id, scheduled_date, scheduled_time, appointment_type, status, consultation_id, notes')
        .eq('patient_id', patientId)
        .order('scheduled_date', { ascending: false }),
    ])

    // Normalize into a unified timeline
    const timeline: any[] = []

    // Add tooth timeline events
    if (toothEvents.data) {
      toothEvents.data.forEach((event: any) => {
        timeline.push({
          type: 'tooth_event',
          date: event.event_date,
          eventType: event.event_type,
          toothNumber: event.tooth_number,
          description: event.description,
          previousStatus: event.previous_status,
          newStatus: event.new_status,
          episodeId: event.episode_id,
          consultationId: event.consultation_id,
          dataSnapshot: event.data_snapshot,
          rawData: event,
        })
      })
    }

    // Add consultations
    if (consultations.data) {
      consultations.data.forEach((consult: any) => {
        timeline.push({
          type: 'consultation',
          date: consult.consultation_date,
          eventType: consult.consultation_mode || 'new_consultation',
          description: consult.chief_complaint
            ? `Consultation: ${consult.chief_complaint.substring(0, 100)}`
            : 'Consultation',
          status: consult.status,
          consultationId: consult.id,
          episodeId: consult.episode_id,
          rawData: consult,
        })
      })
    }

    // Add appointments
    if (appointments.data) {
      appointments.data.forEach((appt: any) => {
        timeline.push({
          type: 'appointment',
          date: appt.scheduled_date + 'T' + (appt.scheduled_time || '00:00:00'),
          eventType: appt.appointment_type,
          description: `${appt.appointment_type} appointment`,
          status: appt.status,
          appointmentId: appt.id,
          consultationId: appt.consultation_id,
          rawData: appt,
        })
      })
    }

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { success: true, timeline }
  } catch (err) {
    console.error('❌ [TIMELINE] Exception fetching full timeline:', err)
    return { success: false, error: 'Unexpected error' }
  }
}
