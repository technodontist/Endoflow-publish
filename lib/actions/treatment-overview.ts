"use server"

import { createServiceClient } from '@/lib/supabase/server'

export interface TreatmentWithAppointment {
  id: string
  patient_id: string
  dentist_id: string
  appointment_id?: string
  treatment_type: string
  description?: string
  notes?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  planned_status?: string
  consultation_id?: string
  tooth_number?: string
  tooth_diagnosis_id?: string
  total_visits?: number
  completed_visits?: number
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  // Joined appointment data
  appointment?: {
    id: string
    scheduled_date: string
    scheduled_time: string
    status: string
    duration?: number
    dentist_name?: string
  }
  // Joined consultation data
  consultation?: {
    consultation_date: string
    chief_complaint?: string
  }
  // Joined tooth diagnosis data
  tooth_diagnosis?: {
    primary_diagnosis?: string
    status?: string
    priority?: string
  }
}

export async function getPatientTreatmentOverviewAction(
  patientId: string
): Promise<{ success: boolean; data?: TreatmentWithAppointment[]; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // Fetch all treatments for the patient with joined data
    const { data: treatments, error: treatmentsError } = await supabase
      .schema('api')
      .from('treatments')
      .select(`
        *,
        appointments!fk_treatments_appointments (
          id,
          scheduled_date,
          scheduled_time,
          status,
          duration_minutes
        ),
        consultations!consultation_id (
          consultation_date,
          chief_complaint
        ),
        tooth_diagnoses!tooth_diagnosis_id (
          primary_diagnosis,
          status,
          treatment_priority
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (treatmentsError) {
      console.error('[TREATMENT-OVERVIEW] Error fetching treatments:', treatmentsError)
      return { success: false, error: 'Failed to fetch treatments' }
    }

    // Transform the data to include dentist names and format appointments
    const transformedTreatments: TreatmentWithAppointment[] = await Promise.all(
      (treatments || []).map(async (treatment) => {
        // Get dentist name if we have a dentist_id
        let dentistName = 'Unknown Dentist'
        if (treatment.dentist_id) {
          const { data: dentistProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', treatment.dentist_id)
            .single()
          
          if (dentistProfile) {
            dentistName = dentistProfile.full_name || 'Unknown Dentist'
          }
        }

        // Transform appointment data
        const appointment = treatment.appointments
          ? {
              ...treatment.appointments,
              dentist_name: dentistName
            }
          : undefined

        return {
          ...treatment,
          appointment,
          consultation: treatment.consultations,
          tooth_diagnosis: treatment.tooth_diagnoses
        }
      })
    )

    // Also fetch appointments that don't have linked treatments but might be treatment-type
    const { data: unlinkedAppointments, error: appointmentsError } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        *,
        profiles!dentist_id (
          full_name
        )
      `)
      .eq('patient_id', patientId)
      .in('appointment_type', ['treatment', 'follow-up', 'procedure'])
      .is('id', null) // This won't work, we need a different approach

    // Actually, let's get all appointments and filter client-side
    const { data: allAppointments } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        *,
        profiles!dentist_id (
          full_name
        ),
        appointment_teeth (
          tooth_number,
          diagnosis
        )
      `)
      .eq('patient_id', patientId)
      .in('appointment_type', ['treatment', 'follow-up', 'procedure', 'Treatment', 'Follow-up'])

    // Filter out appointments that already have treatments
    const linkedAppointmentIds = new Set(
      transformedTreatments
        .filter(t => t.appointment_id)
        .map(t => t.appointment_id)
    )

    const unlinkedTreatmentAppointments = (allAppointments || [])
      .filter(appt => !linkedAppointmentIds.has(appt.id))
      .map(appt => {
        // Create a pseudo-treatment record for unlinked treatment appointments
        const toothNumbers = appt.appointment_teeth?.map((at: any) => at.tooth_number).join(', ')
        
        return {
          id: `unlinked_${appt.id}`,
          patient_id: appt.patient_id,
          dentist_id: appt.dentist_id,
          appointment_id: appt.id,
          treatment_type: appt.reason_for_visit || appt.appointment_type || 'Treatment',
          description: appt.notes,
          notes: appt.additional_notes,
          status: mapAppointmentStatusToTreatmentStatus(appt.status),
          planned_status: 'Planned',
          consultation_id: appt.consultation_id,
          tooth_number: toothNumbers,
          tooth_diagnosis_id: null,
          total_visits: 1,
          completed_visits: appt.status === 'completed' ? 1 : 0,
          started_at: appt.status === 'in_progress' ? appt.created_at : null,
          completed_at: appt.status === 'completed' ? appt.updated_at : null,
          created_at: appt.created_at,
          updated_at: appt.updated_at,
          appointment: {
            id: appt.id,
            scheduled_date: appt.scheduled_date,
            scheduled_time: appt.scheduled_time,
            status: appt.status,
            duration: appt.duration_minutes || 30,
            dentist_name: appt.profiles?.full_name || 'Unknown Dentist'
          }
        } as TreatmentWithAppointment
      })

    // Combine all treatments
    const allTreatments = [...transformedTreatments, ...unlinkedTreatmentAppointments]
      .sort((a, b) => {
        // Sort by scheduled date if available, otherwise by created date
        const dateA = a.appointment?.scheduled_date 
          ? new Date(`${a.appointment.scheduled_date} ${a.appointment.scheduled_time || '00:00'}`)
          : new Date(a.created_at)
        const dateB = b.appointment?.scheduled_date 
          ? new Date(`${b.appointment.scheduled_date} ${b.appointment.scheduled_time || '00:00'}`)
          : new Date(b.created_at)
        return dateB.getTime() - dateA.getTime()
      })

    return { success: true, data: allTreatments }
  } catch (error) {
    console.error('[TREATMENT-OVERVIEW] Exception:', error)
    return { success: false, error: 'Unexpected error fetching treatment overview' }
  }
}

// Helper function to map appointment status to treatment status
function mapAppointmentStatusToTreatmentStatus(
  appointmentStatus: string
): 'pending' | 'in_progress' | 'completed' | 'cancelled' {
  switch (appointmentStatus) {
    case 'scheduled':
    case 'confirmed':
      return 'pending'
    case 'in_progress':
      return 'in_progress'
    case 'completed':
      return 'completed'
    case 'cancelled':
    case 'no_show':
      return 'cancelled'
    default:
      return 'pending'
  }
}

// Get treatment statistics for a patient
export async function getPatientTreatmentStatsAction(
  patientId: string
): Promise<{ 
  success: boolean; 
  data?: { 
    total: number
    planned: number
    inProgress: number
    completed: number
    cancelled: number
    totalCost: number
    totalDuration: number
  }; 
  error?: string 
}> {
  try {
    const { success, data: treatments, error } = await getPatientTreatmentOverviewAction(patientId)
    
    if (!success || !treatments) {
      return { success: false, error }
    }

    const stats = {
      total: treatments.length,
      planned: treatments.filter(t => t.status === 'pending' || (!t.appointment && t.planned_status === 'Planned')).length,
      inProgress: treatments.filter(t => t.status === 'in_progress').length,
      completed: treatments.filter(t => t.status === 'completed').length,
      cancelled: treatments.filter(t => t.status === 'cancelled').length,
      totalCost: 0, // TODO: Add cost field to treatments table
      totalDuration: treatments.reduce((sum, t) => sum + (t.appointment?.duration || 0), 0)
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('[TREATMENT-STATS] Exception:', error)
    return { success: false, error: 'Failed to calculate treatment statistics' }
  }
}