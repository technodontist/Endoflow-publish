'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

export function PatientBirdsEyeTimeline({ patientId }: { patientId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const supabase = createClient();

        // Consultations
        const { data: consultations, error: cErr } = await supabase
          .schema('api')
          .from('consultations')
          .select('id, consultation_date')
          .eq('patient_id', patientId)
          .order('consultation_date', { ascending: true });
        if (cErr) throw cErr;

        // Appointments
        const { data: appts, error: aErr } = await supabase
          .schema('api')
          .from('appointments')
          .select('id, patient_id, scheduled_date, scheduled_time, appointment_type, treatment_id')
          .eq('patient_id', patientId)
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true });
        if (aErr) throw aErr;

        // Appointment teeth mapping
        const apptIds = (appts || []).map(a => a.id);
        let teethByAppt = new Map<string, string[]>();
        if (apptIds.length > 0) {
          const { data: apptTeeth, error: tErr } = await supabase
            .schema('api')
            .from('appointment_teeth')
            .select('appointment_id, tooth_number')
            .in('appointment_id', apptIds);
          if (tErr) throw tErr;
          for (const row of apptTeeth || []) {
            const k = (row as any).appointment_id as string;
            const tn = String((row as any).tooth_number);
            const arr = teethByAppt.get(k) || [];
            arr.push(tn);
            teethByAppt.set(k, arr);
          }
        }

        const ev: any[] = [];
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
          const ts = `${a.scheduled_date}T${String(a.scheduled_time).slice(0,8) || '00:00:00'}`;
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
            tooth_numbers: teethByAppt.get(a.id) || [],
          });
        }
        ev.sort((x, y) => x.ts.localeCompare(y.ts));
        setEvents(ev);
      } catch (e: any) {
        console.error('[Birdseye] load error:', e);
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [patientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Timeline (Bird&apos;s-eye)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="text-sm text-gray-500">Loading...</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && events.length === 0 && <div className="text-sm text-gray-500">No events</div>}
        {events.map((e, idx) => (
          <div key={idx} className="p-2 border rounded">
            <div className="text-xs text-gray-500">{new Date(e.ts).toLocaleString()}</div>
            <div className="text-sm font-medium">{e.title}</div>
            {e.event_type === 'appointment' && e.treatment_id && (
              <div className="text-xs text-gray-600">Linked Treatment: {e.treatment_id}</div>
            )}
            {e.event_type === 'appointment' && Array.isArray(e.tooth_numbers) && e.tooth_numbers.length > 0 && (
              <div className="text-xs text-gray-600">Teeth: {e.tooth_numbers.join(', ')}</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
