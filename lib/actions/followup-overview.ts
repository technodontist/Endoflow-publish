'use server'

import { createServiceClient } from '@/lib/supabase/server'

export interface FollowUpWithAppointment {
  id: string
  patient_id: string
  dentist_id: string
  appointment_id: string
  scheduled_date: string
  scheduled_time: string
  appointment_type: string
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  duration_minutes?: number
  notes?: string
  created_at: string
  updated_at: string
  
  // Related data
  consultation_id?: string
  treatment_id?: string
  
  // Treatment relationship data
  parent_treatment?: {
    id: string
    treatment_type: string
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    tooth_number?: string
    completed_at?: string
    parent_appointment?: {
      id: string
      scheduled_date: string
      scheduled_time: string
      status: string
    }
  }
  
  // Tooth/diagnosis data
  linked_teeth?: Array<{
    tooth_number: string
    diagnosis?: string
    tooth_diagnosis_id?: string
  }>
  
  // Dentist info
  dentist_name?: string
  
  // Timeline calculation
  days_since_treatment?: number
  timeline_description?: string
}

export interface FollowUpStats {
  total: number
  scheduled: number
  completed: number
  overdue: number
  upcoming_week: number
  by_treatment_type: Record<string, number>
}

export async function getPatientFollowUpOverviewAction(
  patientId: string
): Promise<{ success: boolean; data?: FollowUpWithAppointment[]; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // Fetch all follow-up appointments for the patient with related data
    const { data: followUps, error: followUpError } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        scheduled_date,
        scheduled_time,
        appointment_type,
        status,
        duration_minutes,
        notes,
        consultation_id,
        treatment_id,
        created_at,
        updated_at,
        treatments!treatment_id (
          id,
          treatment_type,
          status,
          tooth_number,
          completed_at,
          appointment_id
        )
      `)
      .eq('patient_id', patientId)
      .in('appointment_type', ['follow_up', 'follow-up'])
      .order('scheduled_date', { ascending: false })

    if (followUpError) {
      console.error('[FOLLOWUP-OVERVIEW] Error fetching follow-ups:', followUpError)
      return { success: false, error: 'Failed to fetch follow-ups' }
    }

    // Get appointment_teeth data for tooth linkage
    const followUpIds = (followUps || []).map(f => f.id)
    const { data: appointmentTeeth } = await supabase
      .schema('api')
      .from('appointment_teeth')
      .select('appointment_id, tooth_number, diagnosis, tooth_diagnosis_id')
      .in('appointment_id', followUpIds)

    // Get parent treatment appointments for timeline calculation
    const treatmentIds = (followUps || [])
      .filter(f => f.treatment_id)
      .map(f => f.treatment_id)
      .filter(Boolean)

    let parentAppointments: any[] = []
    if (treatmentIds.length > 0) {
      const { data: treatments } = await supabase
        .schema('api')
        .from('treatments')
        .select(`
          id,
          appointment_id,
          appointments!fk_treatments_appointments (
            id,
            scheduled_date,
            scheduled_time,
            status
          )
        `)
        .in('id', treatmentIds)
      
      parentAppointments = treatments || []
    }

    // Get dentist names
    const dentistIds = new Set((followUps || []).map(f => f.dentist_id).filter(Boolean))
    let dentistNameById = new Map<string, string>()
    if (dentistIds.size > 0) {
      const { data: dentists } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(dentistIds))
      dentistNameById = new Map((dentists || []).map(d => [d.id, d.full_name || 'Unknown Dentist']))
    }

    // Process and enrich follow-up data
    const enrichedFollowUps: FollowUpWithAppointment[] = (followUps || []).map(followUp => {
      // Get linked teeth for this follow-up
      const linkedTeeth = (appointmentTeeth || [])
        .filter(at => at.appointment_id === followUp.id)
        .map(at => ({
          tooth_number: at.tooth_number,
          diagnosis: at.diagnosis,
          tooth_diagnosis_id: at.tooth_diagnosis_id
        }))

      // Get parent treatment info
      let parentTreatment = null
      let daysSinceTreatment = null
      let timelineDescription = null

      if (followUp.treatment_id && followUp.treatments) {
        const treatment = followUp.treatments
        const parentAppt = parentAppointments.find(pa => pa.id === followUp.treatment_id)?.appointments

        parentTreatment = {
          id: treatment.id,
          treatment_type: treatment.treatment_type,
          status: treatment.status,
          tooth_number: treatment.tooth_number,
          completed_at: treatment.completed_at,
          parent_appointment: parentAppt ? {
            id: parentAppt.id,
            scheduled_date: parentAppt.scheduled_date,
            scheduled_time: parentAppt.scheduled_time,
            status: parentAppt.status
          } : null
        }

        // Calculate timeline
        if (treatment.completed_at) {
          const treatmentDate = new Date(treatment.completed_at)
          const followUpDate = new Date(followUp.scheduled_date)
          daysSinceTreatment = Math.floor((followUpDate.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysSinceTreatment <= 7) {
            timelineDescription = `${daysSinceTreatment} day${daysSinceTreatment !== 1 ? 's' : ''} post-treatment`
          } else if (daysSinceTreatment <= 30) {
            const weeks = Math.floor(daysSinceTreatment / 7)
            timelineDescription = `${weeks} week${weeks !== 1 ? 's' : ''} post-treatment`
          } else {
            const months = Math.floor(daysSinceTreatment / 30)
            timelineDescription = `${months} month${months !== 1 ? 's' : ''} post-treatment`
          }
        } else if (parentAppt?.scheduled_date) {
          // Use parent appointment date if treatment completion date not available
          const parentDate = new Date(parentAppt.scheduled_date)
          const followUpDate = new Date(followUp.scheduled_date)
          daysSinceTreatment = Math.floor((followUpDate.getTime() - parentDate.getTime()) / (1000 * 60 * 60 * 24))
          timelineDescription = `${daysSinceTreatment} days since treatment appointment`
        }
      }

      return {
        id: followUp.id,
        patient_id: followUp.patient_id,
        dentist_id: followUp.dentist_id,
        appointment_id: followUp.id,
        scheduled_date: followUp.scheduled_date,
        scheduled_time: followUp.scheduled_time,
        appointment_type: followUp.appointment_type,
        status: followUp.status,
        duration_minutes: followUp.duration_minutes,
        notes: followUp.notes,
        consultation_id: followUp.consultation_id,
        treatment_id: followUp.treatment_id,
        created_at: followUp.created_at,
        updated_at: followUp.updated_at,
        parent_treatment: parentTreatment,
        linked_teeth: linkedTeeth,
        dentist_name: followUp.dentist_id ? dentistNameById.get(followUp.dentist_id) : undefined,
        days_since_treatment: daysSinceTreatment,
        timeline_description: timelineDescription
      }
    })

    return { success: true, data: enrichedFollowUps }
  } catch (error) {
    console.error('[FOLLOWUP-OVERVIEW] Exception:', error)
    return { success: false, error: 'Unexpected error fetching follow-up overview' }
  }
}

export async function getPatientFollowUpStatsAction(
  patientId: string
): Promise<{ success: boolean; data?: FollowUpStats; error?: string }> {
  try {
    const { success, data: followUps, error } = await getPatientFollowUpOverviewAction(patientId)
    
    if (!success || !followUps) {
      return { success: false, error }
    }

    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const stats: FollowUpStats = {
      total: followUps.length,
      scheduled: followUps.filter(f => ['scheduled', 'confirmed'].includes(f.status)).length,
      completed: followUps.filter(f => f.status === 'completed').length,
      overdue: followUps.filter(f => {
        const scheduled = new Date(f.scheduled_date)
        return ['scheduled', 'confirmed'].includes(f.status) && scheduled < now
      }).length,
      upcoming_week: followUps.filter(f => {
        const scheduled = new Date(f.scheduled_date)
        return ['scheduled', 'confirmed'].includes(f.status) && scheduled >= now && scheduled <= weekFromNow
      }).length,
      by_treatment_type: {}
    }

    // Count by treatment type
    followUps.forEach(f => {
      const treatmentType = f.parent_treatment?.treatment_type || 'General'
      stats.by_treatment_type[treatmentType] = (stats.by_treatment_type[treatmentType] || 0) + 1
    })

    return { success: true, data: stats }
  } catch (error) {
    console.error('[FOLLOWUP-STATS] Exception:', error)
    return { success: false, error: 'Failed to calculate follow-up statistics' }
  }
}

// Get follow-ups for a specific treatment
export async function getTreatmentFollowUpsAction(
  treatmentId: string
): Promise<{ success: boolean; data?: FollowUpWithAppointment[]; error?: string }> {
  try {
    const supabase = await createServiceClient()

    const { data: followUps, error } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        scheduled_date,
        scheduled_time,
        appointment_type,
        status,
        duration_minutes,
        notes,
        consultation_id,
        treatment_id,
        created_at,
        updated_at
      `)
      .eq('treatment_id', treatmentId)
      .in('appointment_type', ['follow_up', 'follow-up'])
      .order('scheduled_date', { ascending: true })

    if (error) {
      console.error('[TREATMENT-FOLLOWUPS] Error:', error)
      return { success: false, error: 'Failed to fetch treatment follow-ups' }
    }

    // Convert to standard format (simplified since we know the treatment)
    const enrichedFollowUps: FollowUpWithAppointment[] = (followUps || []).map(f => ({
      id: f.id,
      patient_id: f.patient_id,
      dentist_id: f.dentist_id,
      appointment_id: f.id,
      scheduled_date: f.scheduled_date,
      scheduled_time: f.scheduled_time,
      appointment_type: f.appointment_type,
      status: f.status,
      duration_minutes: f.duration_minutes,
      notes: f.notes,
      consultation_id: f.consultation_id,
      treatment_id: f.treatment_id,
      created_at: f.created_at,
      updated_at: f.updated_at,
      parent_treatment: null, // Would need additional query
      linked_teeth: [],       // Would need additional query
      dentist_name: undefined // Would need additional query
    }))

    return { success: true, data: enrichedFollowUps }
  } catch (error) {
    console.error('[TREATMENT-FOLLOWUPS] Exception:', error)
    return { success: false, error: 'Unexpected error fetching treatment follow-ups' }
  }
}

// Create a follow-up appointment for a specific treatment
export async function createFollowUpForTreatmentAction(input: {
  patientId: string
  dentistId: string
  treatmentId: string
  consultationId: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes?: number
  notes?: string
  toothNumbers?: string[]
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // Create the follow-up appointment
    const { data: appointment, error: createError } = await supabase
      .schema('api')
      .from('appointments')
      .insert({
        patient_id: input.patientId,
        dentist_id: input.dentistId,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime,
        duration_minutes: input.durationMinutes || 30,
        appointment_type: 'follow_up',
        consultation_id: input.consultationId,
        treatment_id: input.treatmentId,
        status: 'scheduled',
        notes: input.notes || null
      })
      .select('*')
      .single()

    if (createError) {
      console.error('[CREATE-FOLLOWUP] Error:', createError)
      return { success: false, error: 'Failed to create follow-up appointment' }
    }

    // Link teeth if provided
    if (input.toothNumbers && input.toothNumbers.length > 0) {
      const toothRows = input.toothNumbers.map(tooth => ({
        appointment_id: appointment.id,
        consultation_id: input.consultationId,
        tooth_number: tooth,
        diagnosis: null
      }))

      const { error: teethError } = await supabase
        .schema('api')
        .from('appointment_teeth')
        .insert(toothRows)

      if (teethError) {
        console.warn('[CREATE-FOLLOWUP] Tooth linking warning:', teethError)
      }
    }

    return { success: true, data: appointment }
  } catch (error) {
    console.error('[CREATE-FOLLOWUP] Exception:', error)
    return { success: false, error: 'Unexpected error creating follow-up' }
  }
}