'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Shared types (duplicated locally to avoid importing a `use server` file into a client component)
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
  toothNumbers?: string[];
  toothDiagnosisIds?: string[];
}

interface Props {
  patientId: string;
  defaultDentistId?: string;
  onSuccess?: () => void;
}

type PlannedItem = { id: string; label: string; toothNumber?: string | null; toothDiagnosisId?: string | null };

export default function ContextualAppointmentForm({ patientId, defaultDentistId, onSuccess }: Props) {
  const supabase = createClient();

  // Core form state
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('consultation');
  const [dentistId, setDentistId] = useState(defaultDentistId || '');
  const [consultations, setConsultations] = useState<any[]>([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');
  const [plannedTreatments, setPlannedTreatments] = useState<PlannedItem[]>([]);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>('');

  // Derived meta for selected item
  const selectedPlanned = useMemo(() => plannedTreatments.find(p => p.id === selectedTreatmentId) || null, [plannedTreatments, selectedTreatmentId]);

  // Enhance date/time UX: default date to today; use native pickers
  const initialDate = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(initialDate);
  const [time, setTime] = useState<string>('10:00');
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Extra context for better UI
  const [dentists, setDentists] = useState<{ id: string; full_name: string }[]>([]);
  const [patientName, setPatientName] = useState<string>('');

  // Load dentists and set default
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      const { data } = await supabase
        .schema('api')
        .from('dentists')
        .select('id, full_name')
        .order('full_name');
      if (!ignore) {
        setDentists(data || []);
        if (!dentistId) {
          setDentistId(defaultDentistId || (data && data[0]?.id) || '');
        }
      }
    };
    run();
    return () => { ignore = true; };
    // intentionally exclude dentistId to avoid early-return blocking default selection
  }, [supabase, defaultDentistId]);

  // Load patient display name
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!patientId) return;
      const { data } = await supabase
        .schema('api')
        .from('patients')
        .select('first_name, last_name')
        .eq('id', patientId)
        .limit(1);
      if (!ignore) {
        const p = data && data[0];
        if (p) setPatientName(`${p.first_name || ''} ${p.last_name || ''}`.trim());
      }
    };
    run();
    return () => { ignore = true; };
  }, [patientId, supabase]);

  // Load consultations if needed by type
  useEffect(() => {
    const needConsult = appointmentType === 'treatment' || appointmentType === 'follow_up';
    if (!needConsult) return;

    const run = async () => {
      const { data } = await supabase
        .schema('api')
        .from('consultations')
        .select('id, consultation_date, clinical_data, treatment_plan, chief_complaint')
        .eq('patient_id', patientId)
        .order('consultation_date', { ascending: false })
        .limit(30);
      setConsultations(data || []);
    };
    run();
  }, [appointmentType, patientId, supabase]);

  // Derive planned treatments from selected consultation when needed
  useEffect(() => {
    async function loadPlanned() {
      if (appointmentType !== 'treatment' || !selectedConsultationId) {
        setPlannedTreatments([]);
        setSelectedTreatmentId('');
        return;
      }

      const list: PlannedItem[] = [];

      try {
        // 1) DB treatments linked to this consultation (preferred, has real IDs)
        const { data: dbTreat } = await supabase
          .schema('api')
          .from('treatments')
          .select('id, treatment_type, description, status, planned_status, tooth_number, consultation_id, patient_id')
          .eq('patient_id', patientId)
          .eq('consultation_id', selectedConsultationId);

        for (const t of dbTreat || []) {
          const s = String((t as any)?.planned_status || (t as any)?.status || '').toLowerCase();
          if (s === 'planned' || s === 'pending') {
            const name = (t as any).treatment_type || (t as any).description || 'Treatment';
            const toothNum = (t as any).tooth_number || null;
            const tooth = toothNum ? ` (Tooth ${toothNum})` : '';
            list.push({ id: (t as any).id, label: `${name}${tooth}` , toothNumber: toothNum, toothDiagnosisId: (t as any).tooth_diagnosis_id || null });
          }
        }

        // 2) Fallback to tooth diagnoses recommendations for this consultation
        if (list.length === 0) {
          const { data: td } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .select('id, tooth_number, recommended_treatment, status')
            .eq('consultation_id', selectedConsultationId);
          for (const row of td || []) {
            const rec = (row as any).recommended_treatment;
            if (!rec) continue;
            const tn = (row as any).tooth_number || null;
            const tooth = tn ? ` (Tooth ${tn})` : '';
            // Use a virtual id; server will ignore non-UUIDs
            list.push({ id: `td:${(row as any).id}`, label: `${rec}${tooth}`, toothNumber: tn, toothDiagnosisId: (row as any).id });
          }
        }

        // 3) Fallback to consultation.treatment_plan or clinical_data if still nothing
        if (list.length === 0) {
          const c: any = consultations.find((c: any) => c.id === selectedConsultationId);
          let plan: any = null;
          try { plan = typeof c?.treatment_plan === 'string' ? JSON.parse(c.treatment_plan) : c?.treatment_plan; } catch {}
          const cd = c?.clinical_data || {};

          const names: string[] = [];
          if (Array.isArray(plan?.plan)) names.push(...plan.plan);
          if (plan?.recommended) names.push(plan.recommended);
          if (Array.isArray(cd?.treatments)) {
            for (const t of cd.treatments) {
              const nm = t?.name || t?.description;
              if (nm) names.push(nm);
            }
          }
          const uniq = Array.from(new Set(names.filter(Boolean)));
          uniq.forEach((nm, idx) => list.push({ id: `plan:${idx}` as string, label: String(nm), toothNumber: null, toothDiagnosisId: null }));
        }

        setPlannedTreatments(list);
      } catch (e) {
        console.warn('[CTX_APPT] Planned treatments load failed:', e);
        setPlannedTreatments([]);
      }
    }

    loadPlanned();
  }, [appointmentType, selectedConsultationId, consultations, patientId, supabase]);

  function isUUID(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  async function onSubmit() {
    try {
      setIsSubmitting(true);
      setMsg(null);

      if (!dentistId || !date || !time) {
        setMsg('Please select dentist, date and time.');
        return;
      }

      const treatmentIdToSend = (appointmentType === 'treatment' && isUUID(selectedTreatmentId)) ? selectedTreatmentId : undefined;

      const payload: CreateContextualAppointmentInput = {
        patientId,
        dentistId,
        scheduledDate: date,
        scheduledTime: time.length === 5 ? `${time}:00` : time,
        durationMinutes: duration,
        notes: notes || undefined,
        appointmentType,
        consultationId: selectedConsultationId || undefined,
        treatmentId: treatmentIdToSend,
        toothNumbers: selectedPlanned?.toothNumber ? [selectedPlanned.toothNumber] : undefined,
        toothDiagnosisIds: selectedPlanned?.toothDiagnosisId && isUUID(selectedPlanned.toothDiagnosisId) ? [selectedPlanned.toothDiagnosisId] : undefined,
      };

      const res = await fetch('/api/contextual-appointments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json?.success) {
        setMsg(json?.error || 'Failed to create appointment');
      } else {
        setMsg('Appointment created successfully');
        setSelectedTreatmentId('');
        setSelectedConsultationId('');
        setNotes('');
        // Call success callback if provided
        if (onSuccess) {
          setTimeout(onSuccess, 1000); // Small delay to show success message
        }
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to create appointment');
    } finally {
      setIsSubmitting(false);
    }
  }

  const needConsult = appointmentType === 'treatment' || appointmentType === 'follow_up';
  const needTreatment = appointmentType === 'treatment';

  return (
    <div className="space-y-3">
      {/* Patient context */}
      <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
        <span className="text-gray-600">Patient:</span>{' '}
        <span className="font-medium">{patientName || patientId}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600">Appointment Type</label>
          <Select value={appointmentType} onValueChange={(v: any) => setAppointmentType(v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="first_visit">First Visit</SelectItem>
              <SelectItem value="consultation">Consultation</SelectItem>
              <SelectItem value="treatment">Treatment</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-600">Dentist</label>
          <Select value={dentistId} onValueChange={(v) => setDentistId(v)}>
            <SelectTrigger><SelectValue placeholder="Select dentist" /></SelectTrigger>
            <SelectContent>
              {dentists.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-600">Date (YYYY-MM-DD)</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-600">Time (HH:MM)</label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-600">Duration (minutes)</label>
          <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value || '60'))} />
        </div>
        <div>
          <label className="text-xs text-gray-600">Notes</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      {needConsult && (
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="text-xs text-gray-600">Select Consultation</label>
            <Select value={selectedConsultationId} onValueChange={(v) => setSelectedConsultationId(v)}>
              <SelectTrigger><SelectValue placeholder="Select consultation" /></SelectTrigger>
              <SelectContent>
                {consultations.map(c => {
                  const d = (c.consultation_date || '').slice(0, 10);
                  return <SelectItem key={c.id} value={c.id}>{d || c.id}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          {needTreatment && (
            <div>
              <label className="text-xs text-gray-600">Select Planned Treatment</label>
              <Select value={selectedTreatmentId} onValueChange={(v) => setSelectedTreatmentId(v)}>
                <SelectTrigger><SelectValue placeholder="Select planned treatment" /></SelectTrigger>
                <SelectContent>
                  {plannedTreatments.length === 0 && (
                    <SelectItem value="__none" disabled>No planned treatments found</SelectItem>
                  )}
                  {plannedTreatments.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div>
        <Button disabled={isSubmitting} onClick={onSubmit}>
          {isSubmitting ? 'Creating...' : 'Create Contextual Appointment'}
        </Button>
      </div>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}
