'use server';

import { createServiceClient } from '@/lib/supabase/server';

export interface PatientEvent {
  patient_id: string;
  entity_id: string;
  ts: string; // ISO
  event_type: 'consultation' | 'appointment';
  title: string;
  appointment_id: string | null;
  treatment_id: string | null;
}

export async function getPatientEventsCombinedAction(patientId: string): Promise<{ success: boolean; data: PatientEvent[]; error?: string }> {
  try {
    const supabase = await createServiceClient();

    // Consultations
    const { data: consultations, error: cErr } = await supabase
      .schema('api')
      .from('consultations')
      .select('id, consultation_date')
      .eq('patient_id', patientId)
      .order('consultation_date', { ascending: true });

    if (cErr) {
      console.error('[PE] consultations error', cErr);
      return { success: false, data: [], error: 'Failed to fetch consultations' };
    }

    // Appointments
    const { data: appts, error: aErr } = await supabase
      .schema('api')
      .from('appointments')
      .select('id, patient_id, scheduled_date, scheduled_time, appointment_type, treatment_id')
      .eq('patient_id', patientId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (aErr) {
      console.error('[PE] appointments error', aErr);
      return { success: false, data: [], error: 'Failed to fetch appointments' };
    }

    const ev: PatientEvent[] = [];

    for (const c of consultations || []) {
      ev.push({
        patient_id: patientId,
        entity_id: c.id,
        ts: new Date(c.consultation_date).toISOString(),
        event_type: 'consultation',
        title: 'Consultation Created',
        appointment_id: null,
        treatment_id: null,
      });
    }

    for (const a of appts || []) {
      const ts = `${a.scheduled_date}T${String(a.scheduled_time).slice(0, 8) || '00:00:00'}`;
      let title = 'Appointment';
      switch ((a as any).appointment_type) {
        case 'treatment': title = 'Treatment Appointment'; break;
        case 'follow_up': title = 'Follow-up Scheduled'; break;
        case 'consultation': title = 'Consultation Appointment'; break;
        case 'first_visit': title = 'First Visit'; break;
      }
      ev.push({
        patient_id: patientId,
        entity_id: a.id,
        ts: new Date(ts).toISOString(),
        event_type: 'appointment',
        title,
        appointment_id: a.id,
        treatment_id: (a as any).treatment_id || null,
      });
    }

    ev.sort((x, y) => x.ts.localeCompare(y.ts));
    return { success: true, data: ev };
  } catch (e) {
    console.error('[PE] exception', e);
    return { success: false, data: [], error: 'Unexpected error' };
  }
}