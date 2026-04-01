'use server';

import { createServiceClient } from '@/lib/supabase/server';

export interface FollowUpAppointmentData {
  id: string;
  patient_id: string;
  dentist_id: string;
  appointment_type: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  consultation_id?: string;
  treatment_id?: string;
  notes?: string;
  patients?: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    phone?: string;
  };
  treatment?: {
    id: string;
    treatment_type: string;
    tooth_number?: string;
    status: string;
    planned_status?: string;
  };
  linkedTeeth?: {
    tooth_number: string;
    tooth_diagnosis_id?: string;
  }[];
}

export async function loadFollowUpAppointmentData(appointmentId: string): Promise<{
  success: boolean;
  data?: FollowUpAppointmentData;
  error?: string;
}> {
  try {
    const supabase = await createServiceClient();

    console.log('Loading follow-up appointment data for ID:', appointmentId);

    // 1. Load appointment details
    const { data: appt, error: apptError } = await supabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptError) {
      console.error('Error querying appointment:', apptError);
      return { success: false, error: `Appointment not found: ${appointmentId}` };
    }

    console.log('Loaded appointment:', appt);

    // 2. Load patient details
    let patient = null;
    if (appt?.patient_id) {
      const { data: patientData, error: patientError } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name, date_of_birth, phone')
        .eq('id', appt.patient_id)
        .single();

      if (!patientError && patientData) {
        patient = patientData;
        console.log('Loaded patient:', patientData);
      } else {
        console.warn('Error loading patient:', patientError);
      }
    }

    // 3. Load treatment details if available
    let treatment = null;
    if (appt?.treatment_id) {
      const { data: treatmentData, error: treatmentError } = await supabase
        .schema('api')
        .from('treatments')
        .select('id, treatment_type, tooth_number, status, planned_status')
        .eq('id', appt.treatment_id)
        .single();

      if (!treatmentError && treatmentData) {
        treatment = treatmentData;
        console.log('Loaded treatment:', treatmentData);
      } else {
        console.warn('Error loading treatment:', treatmentError);
      }
    }

    // 4. Load linked teeth
    let linkedTeeth: any[] = [];
    const { data: teeth, error: teethError } = await supabase
      .schema('api')
      .from('appointment_teeth')
      .select('tooth_number, tooth_diagnosis_id')
      .eq('appointment_id', appointmentId);

    if (!teethError && teeth) {
      linkedTeeth = teeth;
      console.log('Loaded linked teeth:', teeth);
    } else {
      console.warn('Error loading linked teeth:', teethError);
    }

    // 5. Combine all data
    const appointmentData: FollowUpAppointmentData = {
      ...appt,
      patients: patient,
      treatment: treatment,
      linkedTeeth: linkedTeeth
    };

    return { success: true, data: appointmentData };

  } catch (error: any) {
    console.error('Error in loadFollowUpAppointmentData:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function saveFollowUpAssessment(
  appointmentId: string,
  patientId: string,
  formData: any,
  treatmentId?: string,
  consultationId?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServiceClient();

    // Get current user for created_by field
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Try to save to follow_up_assessments table if it exists
    try {
      const { data: assessment, error: assessmentError } = await supabase
        .schema('api')
        .from('follow_up_assessments')
        .insert({
          appointment_id: appointmentId,
          patient_id: patientId,
          treatment_id: treatmentId || null,
          consultation_id: consultationId || null,
          assessment_date: new Date().toISOString(),
          created_by: user.id,
          symptom_status: formData.symptomStatus,
          pain_level: formData.painLevel,
          swelling: formData.swelling,
          healing_progress: formData.healing,
          clinical_data: formData,
          linked_teeth: formData.linkedTeeth || [],
          next_follow_up_date: formData.nextFollowUp !== 'none' && formData.nextFollowUp !== 'as_needed' ?
            calculateNextFollowUpDate(formData.nextFollowUp) : null,
          additional_treatment_needed: formData.additionalTreatmentNeeded
        })
        .select()
        .single();

      if (!assessmentError) {
        console.log('Saved to follow_up_assessments table');
      }
    } catch (tableError) {
      console.warn('follow_up_assessments table might not exist, saving to appointment notes only');
    }

    // Always save summary to appointment notes
    const { error: updateError } = await supabase
      .schema('api')
      .from('appointments')
      .update({
        status: 'completed',
        notes: JSON.stringify({
          follow_up_assessment: {
            completed_date: new Date().toISOString(),
            summary: `Follow-up completed. Symptoms: ${formData.symptomStatus}, Pain: ${formData.painLevel}/10, Healing: ${formData.healing}`,
            clinical_data: formData
          }
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error updating appointment:', updateError);
      return { success: false, error: 'Failed to update appointment status' };
    }

    // Update treatment status if healing is complete
    if (treatmentId && formData.healingProgress === 'complete') {
      await supabase
        .schema('api')
        .from('treatments')
        .update({
          status: 'completed',
          planned_status: 'Completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', treatmentId);
    }

    return { success: true };

  } catch (error: any) {
    console.error('Error saving follow-up assessment:', error);
    return { success: false, error: error.message || 'Failed to save assessment' };
  }
}

function calculateNextFollowUpDate(interval: string): string {
  const daysMap: Record<string, number> = {
    '1_week': 7,
    '2_weeks': 14,
    '1_month': 30,
    '3_months': 90,
    '6_months': 180
  };

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + (daysMap[interval] || 30));
  return nextDate.toISOString().split('T')[0];
}