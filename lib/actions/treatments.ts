"use server"

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { mapFinalStatusFromTreatment, mapAppointmentStatusToToothStatus, getStatusColorCode, type ToothStatus } from '@/lib/utils/toothStatus'

export interface LinkTreatmentPayload {
  appointmentId: string
  patientId?: string
  dentistId?: string
  treatmentType: string
  notes?: string
  consultationId?: string
  toothNumber?: string
  toothDiagnosisId?: string
  totalVisits?: number
}

export async function linkAppointmentToTreatmentAction(payload: LinkTreatmentPayload): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // Fetch appointment for defaults if patient/dentist are not provided
    let { appointmentId, patientId, dentistId, treatmentType, notes, consultationId, toothNumber, toothDiagnosisId, totalVisits } = payload

    const shouldLookupAppointment = !patientId || !dentistId || !treatmentType
    let appointment: any = null

    if (shouldLookupAppointment) {
      const { data: appt, error: apptErr } = await supabase
        .schema('api')
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single()

      if (apptErr || !appt) {
        return { success: false, error: 'Appointment not found for linking' }
      }
      appointment = appt
      patientId = patientId || appt.patient_id
      dentistId = dentistId || appt.dentist_id
      // If treatmentType omitted, default to appointment_type
      treatmentType = treatmentType || appt.appointment_type || 'Treatment'
    }

    // Determine initial status based on appointment status
    let initialStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled' = 'pending'
    const apptStatus = appointment?.status
    if (apptStatus === 'in_progress') initialStatus = 'in_progress'
    if (apptStatus === 'completed') initialStatus = 'completed'

    const { data: created, error: insertErr } = await supabase
      .schema('api')
      .from('treatments')
      .insert({
        patient_id: patientId,
        dentist_id: dentistId,
        appointment_id: appointmentId,
        treatment_type: treatmentType,
        description: null,
        notes: notes || null,
        status: initialStatus,
        consultation_id: consultationId || null,
        tooth_number: toothNumber || null,
        tooth_diagnosis_id: toothDiagnosisId || null,
        total_visits: totalVisits && totalVisits > 0 ? totalVisits : 1,
        completed_visits: 0,
        started_at: initialStatus === 'in_progress' ? new Date().toISOString() : null,
        completed_at: initialStatus === 'completed' ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[TREATMENTS] Error linking appointment to treatment:', insertErr)
      return { success: false, error: 'Failed to link appointment to treatment' }
    }

    // Also record tooth linkage to this appointment (non-fatal if it fails)
    try {
      const toothNum = toothNumber || (created as any)?.tooth_number
      const diagId = toothDiagnosisId || (created as any)?.tooth_diagnosis_id
      if (appointmentId && toothNum) {
        await supabase
          .schema('api')
          .from('appointment_teeth')
          .insert({
            appointment_id: appointmentId,
            consultation_id: consultationId || (created as any)?.consultation_id || null,
            tooth_number: String(toothNum),
            tooth_diagnosis_id: diagId || null,
            diagnosis: null
          })
      }
    } catch (linkErr) {
      console.warn('[TREATMENTS] appointment_teeth insert warning:', linkErr)
    }

    // Revalidate dashboards
    revalidatePath('/dentist')
    revalidatePath('/assistant')
    revalidatePath('/patient')

    return { success: true, data: created }
  } catch (error) {
    console.error('[TREATMENTS] Exception linking appointment to treatment:', error)
    return { success: false, error: 'Unexpected error linking appointment to treatment' }
  }
}

function mapTreatmentTypeToToothStatus(treatmentType?: string): string | null {
  return mapFinalStatusFromTreatment(treatmentType)
}

export async function updateTreatmentsForAppointmentStatusAction(appointmentId: string, newStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'):
  Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const supabase = await createServiceClient()

    // Fetch the appointment once (for patient/consultation context and appointment_teeth fallback)
    const { data: appt, error: apptErr } = await supabase
      .schema('api')
      .from('appointments')
      .select('id, patient_id, consultation_id')
      .eq('id', appointmentId)
      .single()

    if (apptErr) {
      console.warn('[TREATMENTS] Could not load appointment context for status sync:', apptErr)
    }

    const apptPatientId = (appt as any)?.patient_id as string | undefined
    const apptConsultationId = (appt as any)?.consultation_id as string | undefined

    const { data: treatments, error: tErr } = await supabase
      .schema('api')
      .from('treatments')
      .select('*')
      .eq('appointment_id', appointmentId)

    if (tErr) {
      console.error('[TREATMENTS] Error fetching treatments for appointment:', tErr)
      return { success: false, error: 'Failed to fetch linked treatments' }
    }

    if (!treatments || treatments.length === 0) {
      return { success: true, updatedCount: 0 }
    }

    let updatedCount = 0
    for (const tr of treatments) {
      const patch: any = { updated_at: new Date().toISOString() }

      if (newStatus === 'in_progress') {
        if (tr.status !== 'completed') {
          patch.status = 'in_progress'
          if (!tr.started_at) patch.started_at = new Date().toISOString()
        }
      } else if (newStatus === 'completed') {
        const total = tr.total_visits || 1
        const done = (tr.completed_visits || 0) + 1
        if (done >= total) {
          patch.status = 'completed'
          patch.completed_visits = total
          patch.completed_at = new Date().toISOString()
        } else {
          patch.status = 'in_progress'
          patch.completed_visits = done
          if (!tr.started_at) patch.started_at = new Date().toISOString()
        }
      } else if (newStatus === 'cancelled') {
        patch.status = 'cancelled'
      }

      let finalizedToCompleted = false
      if (Object.keys(patch).length > 1) {
        const { data: updatedRow, error: upErr } = await supabase
          .schema('api')
          .from('treatments')
          .update(patch)
          .eq('id', tr.id)
          .select('*')
          .single()
        if (!upErr) {
          updatedCount++
          finalizedToCompleted = (updatedRow?.status === 'completed')
        }
      }

      // Update tooth status based on appointment status using enhanced mapping
      if (newStatus === 'scheduled' || newStatus === 'in_progress' || newStatus === 'completed' || newStatus === 'cancelled') {
        try {
          await updateToothStatusForAppointmentStatus(
            supabase,
            appointmentId,
            newStatus,
            tr,
            apptConsultationId,
            apptPatientId
          )
        } catch (e) {
          console.warn(`[TREATMENTS] Tooth status sync warning for ${newStatus}:`, e)
        }
      }

    }

    // Revalidate dashboards
    revalidatePath('/dentist')
    revalidatePath('/assistant')
    revalidatePath('/patient')

    return { success: true, updatedCount }
  } catch (error) {
    console.error('[TREATMENTS] Exception updating treatments for appointment status:', error)
    return { success: false, error: 'Unexpected error updating treatments' }
  }
}

/**
 * Enhanced helper function to update tooth status based on appointment status changes
 * Uses the new mapping utilities for more accurate status transitions
 */
async function updateToothStatusForAppointmentStatus(
  supabase: any,
  appointmentId: string,
  appointmentStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
  treatment: any,
  consultationId?: string,
  patientId?: string
): Promise<void> {
  const treatmentType = treatment?.treatment_type
  
  // First, try to get the current diagnosis status if available
  let currentDiagnosisStatus: ToothStatus | undefined
  
  if (treatment.tooth_diagnosis_id) {
    const { data: currentDiagnosis } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('status')
      .eq('id', treatment.tooth_diagnosis_id)
      .single()
    currentDiagnosisStatus = currentDiagnosis?.status as ToothStatus
  }
  
  // Map appointment status to tooth status using our enhanced function
  const newToothStatus = mapAppointmentStatusToToothStatus(
    appointmentStatus,
    treatmentType,
    currentDiagnosisStatus
  )
  
  const colorCode = getStatusColorCode(newToothStatus)
  const followUpRequired = appointmentStatus === 'in_progress' || 
                          (appointmentStatus === 'cancelled' && currentDiagnosisStatus === 'caries')
  
  const updateData = {
    status: newToothStatus,
    follow_up_required: followUpRequired,
    updated_at: new Date().toISOString(),
    color_code: colorCode
  }
  
  console.log(`[TREATMENTS] Updating tooth status: ${appointmentStatus} -> ${newToothStatus} for treatment ${treatmentType}`)
  
  let updatedTooth = false
  
  // Try to update via direct tooth_diagnosis_id link first
  if (treatment.tooth_diagnosis_id) {
    const { error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .update(updateData)
      .eq('id', treatment.tooth_diagnosis_id)
    
    if (!error) {
      updatedTooth = true
    } else {
      console.warn('[TREATMENTS] Direct tooth diagnosis update failed:', error)
    }
  }
  
  // Try via consultation_id + tooth_number
  if (!updatedTooth && treatment.consultation_id && treatment.tooth_number) {
    const { error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .update(updateData)
      .eq('consultation_id', treatment.consultation_id)
      .eq('tooth_number', treatment.tooth_number)
    
    if (!error) {
      updatedTooth = true
    } else {
      console.warn('[TREATMENTS] Consultation+tooth update failed:', error)
    }
  }
  
  // Fallback: try via appointment_teeth mapping
  if (!updatedTooth) {
    try {
      const { data: appointmentTeeth } = await supabase
        .schema('api')
        .from('appointment_teeth')
        .select('tooth_number, tooth_diagnosis_id')
        .eq('appointment_id', appointmentId)
      
      for (const row of appointmentTeeth || []) {
        const toothNumber = String(row.tooth_number)
        const diagnosisId = row.tooth_diagnosis_id
        
        if (diagnosisId) {
          // Direct diagnosis ID update
          await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .update(updateData)
            .eq('id', diagnosisId)
          updatedTooth = true
        } else if (consultationId) {
          // Try consultation + tooth number
          await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .update(updateData)
            .eq('consultation_id', consultationId)
            .eq('tooth_number', toothNumber)
          updatedTooth = true
        } else if (patientId) {
          // Last resort: update the latest diagnosis for this patient/tooth
          const { data: latestDiagnoses } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .select('id')
            .eq('patient_id', patientId)
            .eq('tooth_number', toothNumber)
            .order('updated_at', { ascending: false })
            .limit(1)
          
          const latestId = latestDiagnoses?.[0]?.id
          if (latestId) {
            await supabase
              .schema('api')
              .from('tooth_diagnoses')
              .update(updateData)
              .eq('id', latestId)
            updatedTooth = true
          }
        }
      }
    } catch (fallbackError) {
      console.warn('[TREATMENTS] Appointment teeth fallback failed:', fallbackError)
    }
  }
  
  // For completed treatments, also update consultation JSONB if applicable
  if (appointmentStatus === 'completed' && treatment.consultation_id) {
    try {
      const { error: rpcError } = await supabase.rpc('update_consultation_treatment_status', {
        p_consultation_id: treatment.consultation_id,
        p_treatment_id: treatment.id,
        p_new_status: 'Completed'
      })
      
      if (rpcError) {
        console.warn('[TREATMENTS] Consultation JSONB update warning:', rpcError)
        
        // Fallback: Try to update the treatments table directly if RPC fails
        if (rpcError.message?.includes('schema cache')) {
          console.log('[TREATMENTS] RPC function not found, updating treatments table directly')
          const { error: directError } = await supabase
            .schema('api')
            .from('treatments')
            .update({
              planned_status: 'Completed',
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', treatment.id)
            
          if (directError) {
            console.warn('[TREATMENTS] Direct treatment update also failed:', directError)
          }
        }
      }
    } catch (rpcException) {
      console.warn('[TREATMENTS] Consultation JSONB update exception:', rpcException)
    }
  }
  
  if (!updatedTooth) {
    console.warn(`[TREATMENTS] Could not update any tooth diagnosis for treatment ${treatment.id} (${treatmentType})`)
  } else {
    console.log(`[TREATMENTS] Successfully updated tooth status to ${newToothStatus} for appointment ${appointmentId}`)
  }
}
