'use server';

import { createServiceClient } from '@/lib/supabase/server';

export type AppointmentType = 'first_visit' | 'consultation' | 'treatment' | 'follow_up';

export interface CreateContextualAppointmentInput {
  patientId: string;
  dentistId: string;
  scheduledDate: string;    // 'YYYY-MM-DD'
  scheduledTime: string;    // 'HH:MM:SS' or 'HH:MM'
  durationMinutes?: number; // default 60
  notes?: string;

  appointmentType: AppointmentType;
  consultationId?: string;
  treatmentId?: string;

  // New optional fields for tooth linkage
  toothNumbers?: string[];
  toothDiagnosisIds?: string[]; // uuid[]
}

function validateContext(input: CreateContextualAppointmentInput) {
  const t = input.appointmentType;
  if (!t) throw new Error('appointmentType is required');

  // For treatment or follow-up, a consultation context must exist
  if ((t === 'treatment' || t === 'follow_up') && !input.consultationId) {
    throw new Error('consultationId is required for Treatment or Follow-up');
  }
  // Note: treatmentId is optional. If provided, we will update the treatment status.
}

export async function createContextualAppointment(input: CreateContextualAppointmentInput) {
  const supabase = await createServiceClient();
  validateContext(input);

  const {
    patientId, dentistId, scheduledDate, scheduledTime,
    durationMinutes = 60, notes,
    appointmentType, consultationId, treatmentId,
    toothNumbers, toothDiagnosisIds
  } = input;

  const time = scheduledTime.length === 5 ? `${scheduledTime}:00` : scheduledTime;

  // 1) Insert the appointment with the new contextual columns
  const { data: appt, error: insErr } = await supabase
    .schema('api')
    .from('appointments')
    .insert({
      patient_id: patientId,
      dentist_id: dentistId,
      scheduled_date: scheduledDate,
      scheduled_time: time,
      duration_minutes: durationMinutes,
      appointment_type: appointmentType,
      consultation_id: consultationId || null,
      treatment_id: treatmentId || null,
      status: 'scheduled',
      notes: notes || null
    })
    .select('*')
    .single();

  if (insErr) {
    console.error('[CTX_APPT] Insert error:', insErr);
    return { success: false, error: 'Failed to create contextual appointment' };
  }

  // 2) If Treatment: move treatment to In Progress in both planned and legacy flows
  if (appointmentType === 'treatment' && treatmentId) {
    const { error: treatErr } = await supabase
      .schema('api')
      .from('treatments')
      .update({
        planned_status: 'In Progress',
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', treatmentId);

    if (treatErr) {
      console.warn('[CTX_APPT] Could not bump treatment to In Progress:', treatErr);
    }
  }

  // 3) Link teeth/diagnosis to appointment (non-fatal on failure)
  try {
    const rows: { appointment_id: string; consultation_id: string | null; tooth_number: string; tooth_diagnosis_id?: string | null; diagnosis?: string | null }[] = [];

    // a) Derive from treatment row if present and not already included
    if (treatmentId) {
      const { data: tr } = await supabase
        .schema('api')
        .from('treatments')
        .select('tooth_number, tooth_diagnosis_id')
        .eq('id', treatmentId)
        .single();
      if (tr?.tooth_number) {
        rows.push({
          appointment_id: appt.id,
          consultation_id: consultationId || null,
          tooth_number: tr.tooth_number,
          tooth_diagnosis_id: tr.tooth_diagnosis_id || null,
          diagnosis: null,
        });
      }
    }

    // b) From explicit toothDiagnosisIds → fetch teeth and primary_diagnosis
    if (Array.isArray(toothDiagnosisIds) && toothDiagnosisIds.length > 0) {
      const { data: tds } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select('id, tooth_number, primary_diagnosis')
        .in('id', toothDiagnosisIds);
      for (const td of tds || []) {
        if (!td?.tooth_number) continue;
        rows.push({
          appointment_id: appt.id,
          consultation_id: consultationId || null,
          tooth_number: td.tooth_number as string,
          tooth_diagnosis_id: td.id as string,
          diagnosis: (td as any).primary_diagnosis || null,
        });
      }
    }

    // c) From explicit toothNumbers (when we only know the tooth, try to fill diagnosis from consultation if available)
    if (Array.isArray(toothNumbers) && toothNumbers.length > 0) {
      let tdForTooth: any[] | null = null;
      if (consultationId) {
        const { data: tdsByTooth } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('id, tooth_number, primary_diagnosis')
          .eq('consultation_id', consultationId)
          .in('tooth_number', toothNumbers);
        tdForTooth = tdsByTooth || [];
      }
      const mapDiag = new Map<string, { id?: string; diagnosis?: string }>();
      for (const td of tdForTooth || []) {
        mapDiag.set(String(td.tooth_number), { id: td.id, diagnosis: (td as any).primary_diagnosis });
      }
      for (const t of toothNumbers) {
        // Avoid duplicating rows if already added above
        const already = rows.find(r => r.tooth_number === t);
        if (already) continue;
        const meta = mapDiag.get(String(t));
        rows.push({
          appointment_id: appt.id,
          consultation_id: consultationId || null,
          tooth_number: String(t),
          tooth_diagnosis_id: meta?.id || null,
          diagnosis: meta?.diagnosis || null,
        });
      }
    }

    if (rows.length > 0) {
      const { error: linkErr } = await supabase
        .schema('api')
        .from('appointment_teeth')
        .insert(rows);
      if (linkErr) {
        console.warn('[CTX_APPT] appointment_teeth insert warning:', linkErr);
      }

      // 3b) Nudge tooth_diagnoses so the FDI chart reflects that this tooth needs attention.
      // We do this on creation for treatment/follow_up context.
      if (appointmentType === 'treatment' || appointmentType === 'follow_up') {
        for (const r of rows) {
          try {
            if (r.tooth_diagnosis_id) {
              // Update linked diagnosis row to attention
              await supabase
                .schema('api')
                .from('tooth_diagnoses')
                .update({ status: 'attention', follow_up_required: true, updated_at: new Date().toISOString(), color_code: '#f97316' })
                .eq('id', r.tooth_diagnosis_id as any)
            } else if (consultationId) {
              // Try update existing diagnosis for this consultation + tooth, else insert a lightweight row
              const { data: existing, error: checkErr } = await supabase
                .schema('api')
                .from('tooth_diagnoses')
                .select('id, status')
                .eq('patient_id', patientId)
                .eq('consultation_id', consultationId)
                .eq('tooth_number', r.tooth_number)
                .maybeSingle()

              if (checkErr && (checkErr as any).code !== 'PGRST116') {
                console.warn('[CTX_APPT] tooth_diagnoses check warning:', checkErr)
              }

              if (existing?.id) {
                // Only bump if still healthy (don't override a real diagnosis)
                if ((existing as any).status === 'healthy') {
                  await supabase
                    .schema('api')
                    .from('tooth_diagnoses')
                    .update({ status: 'attention', follow_up_required: true, updated_at: new Date().toISOString(), color_code: '#f97316' })
                    .eq('id', (existing as any).id)
                }
              } else {
                // Insert a minimal row so the chart shows orange for this tooth
                await supabase
                  .schema('api')
                  .from('tooth_diagnoses')
                  .insert({
                    consultation_id: consultationId,
                    patient_id: patientId,
                    tooth_number: r.tooth_number,
                    status: 'attention',
                    primary_diagnosis: r.diagnosis || null,
                    recommended_treatment: appointmentType === 'treatment' ? 'Planned treatment' : null,
                    follow_up_required: true,
                    examination_date: new Date().toISOString().slice(0, 10),
                    color_code: '#f97316',
                    notes: 'Auto-marked from contextual appointment creation'
                  })
              }
            }
          } catch (toothErr) {
            console.warn('[CTX_APPT] Non-fatal: could not bump tooth status to attention:', toothErr)
          }
        }
      }
    }
  } catch (e) {
    console.warn('[CTX_APPT] Tooth linkage non-fatal error:', e);
  }

  return { success: true, data: appt };
}

export async function completeTreatment(appointmentId: string) {
  const supabase = await createServiceClient();

  // A) Find the treatment_id and consultation_id linked to the appointment
  const { data: appt, error: getErr } = await supabase
    .schema('api')
    .from('appointments')
    .select('id, treatment_id, consultation_id')
    .eq('id', appointmentId)
    .single();

  if (getErr || !appt) {
    return { success: false, error: 'Appointment not found' };
  }
  if (!appt.treatment_id) {
    return { success: false, error: 'No treatment linked to this appointment' };
  }

  // B) Mark treatment as Completed (both planned and legacy flows)
  const { error: upErr } = await supabase
    .schema('api')
    .from('treatments')
    .update({
      planned_status: 'Completed',
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', appt.treatment_id);

  if (upErr) {
    console.error('[CTX_APPT] Failed to complete treatment:', upErr);
    return { success: false, error: 'Failed to complete treatment' };
  }

  // C) Update consultations.clinical_data JSONB: set treatments[i].status = 'Completed'
  if (appt.consultation_id) {
    const { error: rpcErr } = await supabase.rpc('update_consultation_treatment_status', {
      p_consultation_id: appt.consultation_id,
      p_treatment_id: appt.treatment_id,
      p_new_status: 'Completed'
    });

    if (rpcErr) {
      console.warn('[CTX_APPT] JSONB update warning:', rpcErr);
      
      // Note: The treatment status was already updated in step B above
      // This RPC call is for updating the consultation's JSONB field
      // If it fails, the core functionality still works
      if (rpcErr.message?.includes('schema cache')) {
        console.log('[CTX_APPT] RPC function not found in schema cache - treatment status already updated in treatments table');
      }
    }
  }

  return { success: true };
}