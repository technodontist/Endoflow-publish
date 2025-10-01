"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Calendar, Clock, CheckCircle, Activity, FileText, Pill, AlertTriangle } from "lucide-react"
import { format } from "date-fns"

export interface PatientTimelineProps {
  patientId: string
}

type TimelineType = 'appointment' | 'treatment' | 'diagnosis' | 'follow_up' | 'prescription'

interface TimelineItem {
  id: string
  type: TimelineType
  date: string // ISO date
  time?: string | null
  title: string
  subtitle?: string
  status?: string | null
  meta?: any
}

function statusBadge(status?: string | null) {
  if (!status) return null
  const s = status.toLowerCase()
  const cls = s === 'completed'
    ? 'bg-green-100 text-green-800 border-green-200'
    : s === 'in_progress' || s === 'active'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : s === 'scheduled' || s === 'pending'
        ? 'bg-teal-100 text-teal-800 border-teal-200'
        : s === 'cancelled' || s === 'discontinued'
          ? 'bg-red-100 text-red-800 border-red-200'
          : s === 'no_show'
            ? 'bg-orange-100 text-orange-800 border-orange-200'
            : 'bg-gray-100 text-gray-800 border-gray-200'
  return <Badge className={cls}>{s.replace(/_/g, ' ')}</Badge>
}

function typeBadge(type: TimelineType) {
  const map: Record<TimelineType, { cls: string; icon: JSX.Element; label: string }> = {
    appointment: { cls: 'bg-teal-100 text-teal-800 border-teal-200', icon: <Calendar className="h-3 w-3" />, label: 'Appointment' },
    treatment:   { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Activity className="h-3 w-3" />, label: 'Treatment' },
    diagnosis:   { cls: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: <FileText className="h-3 w-3" />, label: 'Diagnosis' },
    follow_up:   { cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="h-3 w-3" />, label: 'Follow-up' },
    prescription:{ cls: 'bg-sky-100 text-sky-800 border-sky-200', icon: <Pill className="h-3 w-3" />, label: 'Prescription' },
  }
  const it = map[type]
  return <Badge className={`${it.cls} gap-1`}>{it.icon}<span>{it.label}</span></Badge>
}

export function PatientTimeline({ patientId }: PatientTimelineProps) {
  const supabase = createClient()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0) // trigger reload on realtime changes

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        // 1) Appointments
        const { data: appts } = await supabase
          .schema('api')
          .from('appointments')
          .select('*')
          .eq('patient_id', patientId)
          .order('scheduled_date', { ascending: false })
          .order('scheduled_time', { ascending: false })

        // 1a) Appointment teeth map
        const apptIds = (appts || []).map(a => a.id)
        let teethByAppt: Record<string, { tooth_number: string; tooth_diagnosis_id?: string | null }[]> = {}
        if (apptIds.length > 0) {
          const { data: apptTeeth } = await supabase
            .schema('api')
            .from('appointment_teeth')
            .select('appointment_id, tooth_number, tooth_diagnosis_id')
            .in('appointment_id', apptIds)
          for (const row of apptTeeth || []) {
            const k = (row as any).appointment_id as string
            if (!teethByAppt[k]) teethByAppt[k] = []
            teethByAppt[k].push({ tooth_number: String((row as any).tooth_number), tooth_diagnosis_id: (row as any).tooth_diagnosis_id || null })
          }
        }

        // 2) Treatments
        const { data: trts } = await supabase
          .schema('api')
          .from('treatments')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })

        // 3) Consultations (for diagnosis + follow-up JSON)
        const { data: consults } = await supabase
          .schema('api')
          .from('consultations')
          .select('id, consultation_date, diagnosis, treatment_plan, follow_up_data, prescription_data, additional_notes')
          .eq('patient_id', patientId)
          .order('consultation_date', { ascending: false })

        // 4) Tooth diagnoses for those consultations
        const consIds = (consults || []).map(c => c.id)
        const { data: teeth } = consIds.length > 0 ? await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('id, consultation_id, tooth_number, primary_diagnosis, recommended_treatment, status')
          .in('consultation_id', consIds) : { data: [] as any[] }

        // 5) Prescriptions (structured table)
        const { data: rx } = await supabase
          .schema('api')
          .from('patient_prescriptions')
          .select('*')
          .eq('patient_id', patientId)
          .order('start_date', { ascending: false })

        const timeline: TimelineItem[] = []

        // Map Appointments
        for (const a of appts || []) {
          const teeth = teethByAppt[a.id] || []
          const teethStr = teeth.length > 0 ? `Teeth: ${teeth.map(t => t.tooth_number).join(', ')}` : ''
          const note = a.notes || ''
          const subtitle = [note, teethStr].filter(Boolean).join(' • ')
          timeline.push({
            id: `apt_${a.id}`,
            type: 'appointment',
            date: a.scheduled_date,
            time: a.scheduled_time,
            title: a.appointment_type || 'Appointment',
            subtitle: subtitle || undefined,
            status: a.status,
            meta: { ...a, teeth },
          })
        }

        // Map Treatments
        for (const t of trts || []) {
          timeline.push({
            id: `trt_${t.id}`,
            type: 'treatment',
            date: (t.completed_at || t.started_at || t.created_at || '').slice(0,10) || (t.updated_at || '').slice(0,10),
            title: t.treatment_type || 'Treatment',
            subtitle: t.notes || undefined,
            status: t.status,
            meta: t,
          })
        }

        // Map Consultations -> diagnosis + follow-ups
        const safeParse = (v: any) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }

        for (const c of consults || []) {
          const diag = safeParse(c.diagnosis)
          const fu = safeParse(c.follow_up_data)

          // Diagnosis (summary)
          const diagText = (() => {
            if (!diag) return null
            if (typeof diag === 'string') return diag
            if (diag.final) return Array.isArray(diag.final) ? diag.final.join(', ') : (diag.final.description || diag.final.name || String(diag.final))
            if (diag.primary) return Array.isArray(diag.primary) ? diag.primary.join(', ') : (diag.primary.description || diag.primary.name || String(diag.primary))
            return null
          })()

          if (diagText) {
            timeline.push({
              id: `con_${c.id}`,
              type: 'diagnosis',
              date: (c.consultation_date || '').slice(0,10),
              title: diagText,
              subtitle: c.additional_notes || undefined,
              status: 'documented',
              meta: c,
            })
          }

          // Tooth-level diagnoses
          const toothForConsult = (teeth || []).filter((t: any) => t.consultation_id === c.id)
          for (const td of toothForConsult) {
            // Determine resolution by matching completed treatments
            const hasResolved = (trts || []).some((t: any) =>
              (t.tooth_diagnosis_id && t.tooth_diagnosis_id === td.id && t.status === 'completed') ||
              (!t.tooth_diagnosis_id && td.tooth_number && t.tooth_number === td.tooth_number && t.status === 'completed')
            )
            timeline.push({
              id: `tooth_${c.id}_${td.tooth_number}`,
              type: 'diagnosis',
              date: (c.consultation_date || '').slice(0,10),
              title: `Tooth ${td.tooth_number}: ${td.primary_diagnosis || td.status}`,
              subtitle: td.recommended_treatment || undefined,
              status: hasResolved ? 'resolved' : (td.status || 'noted'),
              meta: td,
            })
          }

          // Prescriptions fallback
          const px = safeParse((c as any).prescription_data)
          if (Array.isArray(px)) {
            for (const p of px) {
              const label = p.medication_name || p.name || 'Prescription'
              timeline.push({
                id: `rx_from_cons_${c.id}_${label}`,
                type: 'prescription',
                date: (c.consultation_date || '').slice(0,10),
                title: String(label),
                subtitle: p.instructions || p.sig || undefined,
                status: 'documented',
                meta: { consultationId: c.id, source: 'consultation.prescription_data' },
              })
            }
          }

          // Follow-up data (best-effort parse from JSON shape)
          if (fu) {
            // Common shapes: {appointments: []} or {tooth_specific_follow_ups: {...}}
            const pushFU = (date: string, label: string) => {
              if (!date) return
              const dateOnly = date.length > 10 ? date.slice(0, 10) : date
              timeline.push({
                id: `fu_${c.id}_${label}_${dateOnly}`,
                type: 'follow_up',
                date: dateOnly,
                title: label,
                status: 'scheduled',
                meta: { source: 'consultation.follow_up_data', consultationId: c.id },
              })
            }

            if (Array.isArray(fu.appointments)) {
              for (const ap of fu.appointments) {
                pushFU(ap.scheduled_date || ap.date || ap.when || '', ap.type || 'Follow-up')
              }
            }
            if (fu.tooth_specific_follow_ups && typeof fu.tooth_specific_follow_ups === 'object') {
              for (const tooth of Object.keys(fu.tooth_specific_follow_ups)) {
                const entry = fu.tooth_specific_follow_ups[tooth]
                if (entry && Array.isArray(entry.appointments)) {
                  for (const ap of entry.appointments) {
                    pushFU(ap.scheduled_date || ap.date || '', `${ap.type || 'Follow-up'} (Tooth ${tooth})`)
                  }
                }
              }
            }
          }
        }

        // Map Prescriptions
        for (const p of rx || []) {
          timeline.push({
            id: `rx_${p.id}`,
            type: 'prescription',
            date: (p.start_date || p.created_at || '').slice(0,10),
            title: p.medication_name || 'Prescription',
            subtitle: p.instructions || undefined,
            status: p.status || 'active',
            meta: p,
          })
        }

        // Sort by date-time desc
        const sorted = timeline.sort((a, b) => {
          const aKey = `${a.date} ${a.time || ''}`
          const bKey = `${b.date} ${b.time || ''}`
          return bKey.localeCompare(aKey)
        })

        if (mounted) setItems(sorted)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [patientId, version])

  const todayISO = new Date().toISOString().slice(0,10)
  const activeTreatments = useMemo(() => items.filter(i => i.type === 'treatment' && (i.status === 'in_progress' || i.status === 'pending')), [items])
  const upcomingFollowUps = useMemo(() => items.filter(i => (i.type === 'follow_up' || (i.type === 'appointment' && (i.title || '').toLowerCase().includes('follow'))) && i.date >= todayISO), [items, todayISO])
  const recentlyCompleted = useMemo(() => items.filter(i => (i.status || '').toLowerCase() === 'completed' || (i.status || '').toLowerCase() === 'resolved').slice(0,5), [items])

  // Realtime subscription to keep timeline fresh
  useEffect(() => {
    const client = createClient()
    const channel = client.channel(`pt-${patientId}-timeline`)
      .on('postgres_changes', { event: '*', schema: 'api', table: 'appointments', filter: `patient_id=eq.${patientId}` }, () => setVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'api', table: 'treatments', filter: `patient_id=eq.${patientId}` }, () => setVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'api', table: 'consultations', filter: `patient_id=eq.${patientId}` }, () => setVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'api', table: 'patient_prescriptions', filter: `patient_id=eq.${patientId}` }, () => setVersion(v => v + 1))
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [patientId])

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-emerald-700">Active Treatments</div>
                <div className="text-2xl font-bold text-emerald-900">{activeTreatments.length}</div>
              </div>
              <Activity className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-amber-700">Upcoming Follow-ups</div>
                <div className="text-2xl font-bold text-amber-900">{upcomingFollowUps.length}</div>
              </div>
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-700">Recently Completed</div>
                <div className="text-2xl font-bold text-blue-900">{recentlyCompleted.length}</div>
              </div>
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Patient Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading timeline...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No history found</div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto">
              {items.map((it) => (
                <div key={it.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {typeBadge(it.type)}
                        <div className="text-sm text-gray-600">
                          {format(new Date(it.date), 'MMM d, yyyy')}{it.time ? ` at ${String(it.time).slice(0,5)}` : ''}
                        </div>
                      </div>
                      <div className="font-medium">{it.title}</div>
                      {it.subtitle && <div className="text-sm text-gray-600">{it.subtitle}</div>}
                    </div>
                    <div>{statusBadge(it.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety hint if nothing present */}
      {!loading && items.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertTriangle className="h-3 w-3" />
          Start by recording a consultation, booking an appointment, or saving a treatment to populate the timeline.
        </div>
      )}
    </div>
  )
}