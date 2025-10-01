'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Plus, Trash2, AlertTriangle } from "lucide-react"
import { InteractiveDentalChart } from "@/components/dentist/interactive-dental-chart"
import { getConsultationsAction, createAppointmentRequestFromConsultationAction } from '@/lib/actions/consultation'
import { getPatientToothDiagnoses } from '@/lib/actions/tooth-diagnoses'

interface FollowUpAppointment {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  scheduled_date: string // ISO 8601 or datetime-local value
  duration: string // minutes as string
  notes: string
  tooth_specific?: string[]
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
}

interface PostCareInstruction {
  id: string
  title: string
  description: string
  duration: string
  tooth_specific?: string[]
  importance: 'low' | 'medium' | 'high'
}

interface ToothFollowUpBucket {
  appointments: FollowUpAppointment[]
  instructions: PostCareInstruction[]
  monitoring_notes: string
  healing_progress: string
}

interface FollowUpEncounter {
  id: string
  date: string // datetime-local
  scope: 'general' | 'tooth'
  toothNumber?: string
  linkedDiagnosis?: string
  symptomStatus: 'improved' | 'same' | 'worsened'
  painScore: number
  tenderness?: boolean
  swelling?: boolean
  bleeding?: boolean
  woundStatus?: 'normal' | 'delayed' | 'infected' | 'dry_socket' | 'na'
  sutureStatus?: 'intact' | 'removed' | 'loose' | 'na'
  medicationAdherence?: 'good' | 'partial' | 'poor'
  adverseEffects?: string
  notes?: string
  plan?: string
}

interface FollowUpData {
  appointments: FollowUpAppointment[]
  post_care_instructions: PostCareInstruction[]
  tooth_specific_follow_ups: Record<string, ToothFollowUpBucket>
  general_follow_up_notes: string
  next_visit_required: boolean
  emergency_contact_provided: boolean
  patient_education_completed: boolean
  recall_period: string
  evaluation_entries?: FollowUpEncounter[]
}

interface FollowUpTabProps {
  data?: FollowUpData
  onChange?: (data: FollowUpData) => void
  isReadOnly?: boolean
  onSave?: (data: FollowUpData) => void
  patientId?: string
  consultationId?: string
}

export function FollowUpTab({ data, onChange, isReadOnly = false, onSave, patientId, consultationId }: FollowUpTabProps) {
  const [localData, setLocalData] = useState<FollowUpData>(() => ({
    appointments: [],
    post_care_instructions: [],
    tooth_specific_follow_ups: {},
    general_follow_up_notes: '',
    next_visit_required: false,
    emergency_contact_provided: false,
    patient_education_completed: false,
    recall_period: '',
    evaluation_entries: []
  }))
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [toothLatest, setToothLatest] = useState<Record<string, any>>({})
  const [showFullChart, setShowFullChart] = useState(false)
  // Follow-up encounter form state
  const [evalSymptom, setEvalSymptom] = useState<'improved' | 'same' | 'worsened'>('same')
  const [evalPain, setEvalPain] = useState<number>(0)
  const [evalTenderness, setEvalTenderness] = useState<boolean>(false)
  const [evalSwelling, setEvalSwelling] = useState<boolean>(false)
  const [evalBleeding, setEvalBleeding] = useState<boolean>(false)
  const [evalWound, setEvalWound] = useState<'normal' | 'delayed' | 'infected' | 'dry_socket' | 'na'>('na')
  const [evalSuture, setEvalSuture] = useState<'intact' | 'removed' | 'loose' | 'na'>('na')
  const [evalAdherence, setEvalAdherence] = useState<'good' | 'partial' | 'poor'>('good')
  const [evalAdverse, setEvalAdverse] = useState<string>('')
  const [evalNotes, setEvalNotes] = useState<string>('')
  const [evalPlan, setEvalPlan] = useState<string>('')

  useEffect(() => {
    if (data) setLocalData(data)
  }, [data])

  // Load compact tooth statuses to relate past treatments
  useEffect(() => {
    const loadTeeth = async () => {
      try {
        if (!patientId) return
        const res = await getPatientToothDiagnoses(patientId, null, true)
        if (res?.success) setToothLatest(res.data || {})
      } catch (e) {
        console.warn('Failed to load tooth map', e)
      }
    }
    loadTeeth()
  }, [patientId])

  const update = (patch: Partial<FollowUpData>) => {
    const next = { ...localData, ...patch }
    setLocalData(next)
    onChange?.(next)
  }

  // Previous follow-ups across consultations for this patient
  const [history, setHistory] = useState<FollowUpAppointment[]>([])
  const [historyToothFilter, setHistoryToothFilter] = useState<string>('')
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      if (!patientId) return
      try {
        const res = await getConsultationsAction(patientId)
        if (res.success && Array.isArray(res.data)) {
          const all: FollowUpAppointment[] = []
          for (const c of res.data) {
            try {
              const fu = c.follow_up_data ? JSON.parse(c.follow_up_data) : null
              if (!fu) continue
              // support both array and object
              if (Array.isArray(fu)) {
                // legacy simple entries
                for (const item of fu) {
                  if (item?.scheduled_date) {
                    all.push({
                      id: `${c.id}_${item.scheduled_date}`,
                      type: item.type || 'follow-up',
                      priority: (item.priority || 'medium') as any,
                      scheduled_date: item.scheduled_date,
                      duration: (item.duration || '30').toString(),
                      notes: item.notes || '',
                      tooth_specific: item.tooth_specific || [],
                      status: (item.status || 'scheduled') as any
                    })
                  }
                }
              } else if (typeof fu === 'object') {
                (fu.appointments || []).forEach((a: any) => all.push({
                  id: `${c.id}_${a.id || a.scheduled_date || Math.random()}`,
                  type: a.type || 'follow-up',
                  priority: (a.priority || 'medium'),
                  scheduled_date: a.scheduled_date,
                  duration: (a.duration || '30').toString(),
                  notes: a.notes || '',
                  tooth_specific: a.tooth_specific || [],
                  status: (a.status || 'scheduled')
                }))
                const ts = fu.tooth_specific_follow_ups || {}
                Object.keys(ts).forEach(tooth => {
                  (ts[tooth]?.appointments || []).forEach((a: any) => all.push({
                    id: `${c.id}_${a.id || a.scheduled_date || Math.random()}`,
                    type: a.type || 'follow-up',
                    priority: (a.priority || 'medium'),
                    scheduled_date: a.scheduled_date,
                    duration: (a.duration || '30').toString(),
                    notes: a.notes || '',
                    tooth_specific: [tooth],
                    status: (a.status || 'scheduled')
                  }))
                })
              }
            } catch {}
          }
          setHistory(all.sort((a,b)=> new Date(b.scheduled_date).getTime()-new Date(a.scheduled_date).getTime()))
        }
      } catch (e) {
        console.warn('Failed loading follow-up history', e)
      }
    }
    load()
  }, [patientId])

  const getToothBucket = (tooth: string): ToothFollowUpBucket => {
    return localData.tooth_specific_follow_ups[tooth] || {
      appointments: [],
      instructions: [],
      monitoring_notes: '',
      healing_progress: ''
    }
  }

  const addAppointment = (isToothSpecific = false) => {
    const appt: FollowUpAppointment = {
      id: `appt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      type: '',
      priority: 'medium',
      scheduled_date: '',
      duration: '30',
      notes: '',
      tooth_specific: isToothSpecific && selectedTooth ? [selectedTooth] : undefined,
      status: 'scheduled'
    }
    if (isToothSpecific && selectedTooth) {
      const bucket = getToothBucket(selectedTooth)
      update({
        tooth_specific_follow_ups: {
          ...localData.tooth_specific_follow_ups,
          [selectedTooth]: { ...bucket, appointments: [...bucket.appointments, appt] }
        }
      })
    } else {
      update({ appointments: [...localData.appointments, appt] })
    }
  }

  const updateAppointment = (id: string, field: keyof FollowUpAppointment, value: any, isToothSpecific = false) => {
    if (isToothSpecific && selectedTooth) {
      const bucket = getToothBucket(selectedTooth)
      const next = bucket.appointments.map(a => a.id === id ? { ...a, [field]: value } : a)
      update({ tooth_specific_follow_ups: { ...localData.tooth_specific_follow_ups, [selectedTooth]: { ...bucket, appointments: next } } })
    } else {
      update({ appointments: localData.appointments.map(a => a.id === id ? { ...a, [field]: value } : a) })
    }
  }

  const removeAppointment = (id: string, isToothSpecific = false) => {
    if (isToothSpecific && selectedTooth) {
      const bucket = getToothBucket(selectedTooth)
      const next = bucket.appointments.filter(a => a.id !== id)
      update({ tooth_specific_follow_ups: { ...localData.tooth_specific_follow_ups, [selectedTooth]: { ...bucket, appointments: next } } })
    } else {
      update({ appointments: localData.appointments.filter(a => a.id !== id) })
    }
  }

  const priorityColor = (p: string) => p === 'urgent' ? 'bg-red-100 text-red-800 border-red-300' : p === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' : p === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-green-100 text-green-800 border-green-300'
  const QUICK_TYPES: { label: string; value: string; duration?: number }[] = [
    { label: 'Healing Check', value: 'healing_check', duration: 15 },
    { label: 'Suture Removal', value: 'suture_removal', duration: 15 },
    { label: 'Post-extraction Review', value: 'post_extraction_review', duration: 20 },
    { label: 'Medication Review', value: 'medication_review', duration: 15 },
  ]
  const statusColor = (s?: string) => {
    switch ((s || 'healthy')) {
      case 'caries': return 'bg-red-50 border-red-200 text-red-700'
      case 'filled': return 'bg-blue-50 border-blue-200 text-blue-700'
      case 'crown': return 'bg-amber-50 border-amber-200 text-amber-700'
      case 'root_canal': return 'bg-violet-50 border-violet-200 text-violet-700'
      case 'missing': return 'bg-gray-50 border-gray-200 text-gray-600'
      case 'attention':
      case 'extraction_needed': return 'bg-orange-50 border-orange-200 text-orange-700'
      default: return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    }
  }

  const filteredHistory = useMemo(() => history.filter(h => {
    if (historyToothFilter && !(h.tooth_specific||[]).includes(historyToothFilter)) return false
    if (historyTypeFilter && h.type !== historyTypeFilter) return false
    return true
  }), [history, historyToothFilter, historyTypeFilter])

  const formatDate = (d: Date) => d.toISOString().split('T')[0]
  const addMonths = (base: Date, months: number) => { const dt = new Date(base); dt.setMonth(dt.getMonth()+months); return dt }
  const requestFollowUp = async (opts: { tooth?: string; months: number; type?: string }) => {
    if (!patientId || !consultationId) { alert('Save draft first to create a request.'); return }
    try {
      const t = opts.tooth ? toothLatest[opts.tooth] : null
      const appointmentType = `Follow-up ${opts.months}m${opts.tooth ? ` (Tooth ${opts.tooth})` : ''}`
      const reason = `${opts.type || 'Clinical review'}${t?.primaryDiagnosis ? ` | Dx: ${t.primaryDiagnosis}` : ''}${t?.recommendedTreatment ? ` | Rx: ${t.recommendedTreatment}` : ''}`
      const reqDate = formatDate(addMonths(new Date(), opts.months))
      const res = await createAppointmentRequestFromConsultationAction({
        consultationId,
        patientId,
        appointmentType,
        reasonForVisit: reason,
        urgencyLevel: 'routine',
        delegateToAssistant: true,
        requestedDate: reqDate,
        requestedTime: '09:00:00',
        additionalNotes: 'Auto-generated from Follow-up tab'
      })
      if ((res as any)?.success) alert('Follow-up appointment request created')
      else alert((res as any)?.error || 'Failed to create request')
    } catch (e) {
      console.error(e); alert('Failed to create request')
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick history viewer */}
      <Card className="border-l-4 border-l-teal-500 shadow-sm">
        <CardHeader>
          <CardTitle className="text-teal-700">Previous Follow-ups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Filter by Tooth</Label>
              <Input value={historyToothFilter} onChange={(e)=>setHistoryToothFilter(e.target.value)} placeholder="e.g., 16" />
            </div>
            <div>
              <Label>Filter by Type</Label>
              <Input value={historyTypeFilter} onChange={(e)=>setHistoryTypeFilter(e.target.value)} placeholder="e.g., healing_assessment" />
            </div>
            <div className="flex items-end">
              <Badge variant="outline">{filteredHistory.length} item(s)</Badge>
            </div>
          </div>

          {/* Past Treatments Summary (compact chips) */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(toothLatest || {}).filter(([_, t]: any) => (t?.recommendedTreatment || (t?.status && t?.status !== 'healthy'))).slice(0, 20).map(([num, t]: any) => (
              <div key={num} className="flex items-center gap-2">
                <button className={`px-2 py-1 rounded text-xs border ${statusColor(t?.status)}`} onClick={()=>setSelectedTooth(num)} title={`${t?.primaryDiagnosis || t?.status || ''}${t?.recommendedTreatment ? ' → ' + t.recommendedTreatment : ''}`}>
                  # {num} {t?.primaryDiagnosis ? '• ' + t.primaryDiagnosis : ''}
                </button>
                <button className="text-[10px] px-2 py-0.5 border rounded hover:bg-gray-50" onClick={()=>requestFollowUp({ tooth: num as string, months: 3, type: 'Follow-up' })}>3m</button>
                <button className="text-[10px] px-2 py-0.5 border rounded hover:bg-gray-50" onClick={()=>requestFollowUp({ tooth: num as string, months: 6, type: 'Follow-up' })}>6m</button>
              </div>
            ))}
            {Object.keys(toothLatest || {}).length === 0 && (
              <span className="text-xs text-gray-500">No prior tooth treatments found</span>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-sm text-gray-500">No matching follow-up history.</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {filteredHistory.map(h => (
                <div key={h.id} className="p-2 border rounded text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">{h.type || 'Follow-up'} {h.tooth_specific && h.tooth_specific.length > 0 ? `• Tooth ${h.tooth_specific.join(',')}` : ''}</div>
                    <div className="text-gray-600">{new Date(h.scheduled_date).toLocaleString()} • {h.duration}m</div>
                    {h.notes && (<div className="text-gray-500">{h.notes}</div>)}
                  </div>
                  <Badge className={priorityColor(h.priority)}>{h.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tooth picker + compact map */}
      <Card className="border-l-4 border-l-teal-500 shadow-sm">
        <CardHeader>
          <CardTitle className="text-teal-700">Tooth-Specific Follow-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Compact Dental Map */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Click a tooth to select. Colors reflect current status.</div>
            <Button variant="outline" size="sm" onClick={()=>setShowFullChart(v=>!v)}>{showFullChart ? 'Hide full chart' : 'Show full chart'}</Button>
          </div>
          <div className="space-y-3">
            {/* Upper row */}
            <div className="flex flex-wrap gap-1">
              {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map(n => {
                const t = toothLatest[n.toString()]
                const cls = statusColor(t?.status)
                const isSel = selectedTooth === n.toString()
                return (
                  <button
                    key={n}
                    className={`w-8 h-8 text-xs rounded border ${cls} ${isSel ? 'ring-2 ring-purple-400' : ''}`}
                    onClick={()=>setSelectedTooth(n.toString())}
                    title={`Tooth ${n}${t?.primaryDiagnosis ? ' • ' + t.primaryDiagnosis : ''}${t?.recommendedTreatment ? ' → ' + t.recommendedTreatment : ''}`}
                  >{n}</button>
                )
              })}
            </div>
            {/* Lower row */}
            <div className="flex flex-wrap gap-1">
              {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(n => {
                const t = toothLatest[n.toString()]
                const cls = statusColor(t?.status)
                const isSel = selectedTooth === n.toString()
                return (
                  <button
                    key={n}
                    className={`w-8 h-8 text-xs rounded border ${cls} ${isSel ? 'ring-2 ring-purple-400' : ''}`}
                    onClick={()=>setSelectedTooth(n.toString())}
                    title={`Tooth ${n}${t?.primaryDiagnosis ? ' • ' + t.primaryDiagnosis : ''}${t?.recommendedTreatment ? ' → ' + t.recommendedTreatment : ''}`}
                  >{n}</button>
                )
              })}
            </div>
          </div>

          {/* Optional full chart */}
          {showFullChart && (
            <div className="border rounded p-2">
              <InteractiveDentalChart
                onToothSelect={(tooth) => setSelectedTooth(tooth)}
                toothData={{}}
                showLabels={true}
                patientId={patientId}
                subscribeRealtime={true}
              />
            </div>
          )}

          {selectedTooth ? (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="font-medium text-blue-900">Selected tooth #{selectedTooth}</div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addAppointment(true)} disabled={isReadOnly}>
                    <Plus className="w-4 h-4 mr-1"/> Add entry
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => requestFollowUp({ tooth: selectedTooth!, months: 3, type: 'Follow-up' })}>Request 3m</Button>
                  <Button size="sm" variant="outline" onClick={() => requestFollowUp({ tooth: selectedTooth!, months: 6, type: 'Follow-up' })}>Request 6m</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1"/>
              Select a tooth to create tooth-specific follow-ups.
            </div>
          )}

          {selectedTooth && (
            <div className="space-y-3">
              {getToothBucket(selectedTooth).appointments.map(appt => (
                <Card key={appt.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={priorityColor(appt.priority)}>{appt.priority}</Badge>
                      <Badge variant="outline">Tooth {selectedTooth}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeAppointment(appt.id, true)} disabled={isReadOnly}>
                      <Trash2 className="w-4 h-4"/>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label>Type</Label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {QUICK_TYPES.map(q => (
                          <button key={q.value} type="button" className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={() => {
                            updateAppointment(appt.id, 'type', q.label, true)
                            if (q.duration) updateAppointment(appt.id, 'duration', q.duration.toString(), true)
                          }}>{q.label}</button>
                        ))}
                      </div>
                      <Input value={appt.type} onChange={(e)=>updateAppointment(appt.id, 'type', e.target.value, true)} disabled={isReadOnly}/>
                    </div>
                    <div>
                      <Label>Date & time</Label>
                      <Input type="datetime-local" value={appt.scheduled_date} onChange={(e)=>updateAppointment(appt.id, 'scheduled_date', e.target.value, true)} disabled={isReadOnly}/>
                    </div>
                    <div>
                      <Label>Duration (min)</Label>
                      <Input type="number" value={appt.duration} onChange={(e)=>updateAppointment(appt.id, 'duration', e.target.value, true)} disabled={isReadOnly}/>
                    </div>
                    <div>
                      <Label>Linked diagnosis</Label>
                      <Input value={selectedTooth && toothLatest[selectedTooth]?.primaryDiagnosis ? toothLatest[selectedTooth].primaryDiagnosis : ''} placeholder="Auto from selected tooth" readOnly />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input value={appt.notes} onChange={(e)=>updateAppointment(appt.id, 'notes', e.target.value, true)} disabled={isReadOnly}/>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Follow-up (encounter) */}
      <Card className="border-l-4 border-l-teal-500 shadow-sm">
        <CardHeader>
          <CardTitle className="text-teal-700">Record Follow-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Date & time</Label>
              <Input type="datetime-local" value={new Date().toISOString().slice(0,16)} readOnly />
            </div>
            <div>
              <Label>Scope</Label>
              <div className="flex gap-2 text-sm">
                <button type="button" className={`px-2 py-1 border rounded ${!selectedTooth ? 'bg-gray-50' : ''}`} onClick={()=>setSelectedTooth(null)}>General</button>
                <button type="button" className={`px-2 py-1 border rounded ${selectedTooth ? 'bg-gray-50' : ''}`} onClick={()=>{ /* noop, keep selectedTooth */ }}>{selectedTooth ? `Tooth ${selectedTooth}` : 'Tooth...'}</button>
              </div>
            </div>
            <div>
              <Label>Linked Diagnosis</Label>
              <Input value={selectedTooth && toothLatest[selectedTooth]?.primaryDiagnosis ? toothLatest[selectedTooth].primaryDiagnosis : ''} placeholder="Auto from selected tooth" readOnly />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Symptom status</Label>
              <select className="w-full border rounded px-2 py-2 text-sm" value={evalSymptom} onChange={(e)=>setEvalSymptom(e.target.value as any)}>
                <option value="improved">improved</option>
                <option value="same">same</option>
                <option value="worsened">worsened</option>
              </select>
            </div>
            <div>
              <Label>Pain score (0-10)</Label>
              <select className="w-full border rounded px-2 py-2 text-sm" value={evalPain} onChange={(e)=>setEvalPain(parseInt(e.target.value))}>
                {Array.from({length:11},(_,i)=>i).map(i=> <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={evalTenderness} onChange={(e)=>setEvalTenderness(e.target.checked)}/> Tenderness</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={evalSwelling} onChange={(e)=>setEvalSwelling(e.target.checked)}/> Swelling</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={evalBleeding} onChange={(e)=>setEvalBleeding(e.target.checked)}/> Bleeding</label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Wound status</Label>
              <select className="w-full border rounded px-2 py-2 text-sm" value={evalWound} onChange={(e)=>setEvalWound(e.target.value as any)}>
                <option value="na">na</option>
                <option value="normal">normal</option>
                <option value="delayed">delayed</option>
                <option value="infected">infected</option>
                <option value="dry_socket">dry_socket</option>
              </select>
            </div>
            <div>
              <Label>Suture status</Label>
              <select className="w-full border rounded px-2 py-2 text-sm" value={evalSuture} onChange={(e)=>setEvalSuture(e.target.value as any)}>
                <option value="na">na</option>
                <option value="intact">intact</option>
                <option value="removed">removed</option>
                <option value="loose">loose</option>
              </select>
            </div>
            <div>
              <Label>Medication adherence</Label>
              <select className="w-full border rounded px-2 py-2 text-sm" value={evalAdherence} onChange={(e)=>setEvalAdherence(e.target.value as any)}>
                <option value="good">good</option>
                <option value="partial">partial</option>
                <option value="poor">poor</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Adverse effects</Label>
              <Textarea rows={2} placeholder="Any side effects experienced" value={evalAdverse} onChange={(e)=>setEvalAdverse(e.target.value)}/>
            </div>
            <div>
              <Label>Notes / Plan</Label>
              <Textarea rows={2} placeholder="Actions taken today, further plan" value={evalNotes} onChange={(e)=>setEvalNotes(e.target.value)}/>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => {
              const entry: FollowUpEncounter = {
                id: `eval_${Date.now()}`,
                date: new Date().toISOString(),
                scope: selectedTooth ? 'tooth' : 'general',
                toothNumber: selectedTooth || undefined,
                linkedDiagnosis: selectedTooth && toothLatest[selectedTooth]?.primaryDiagnosis ? toothLatest[selectedTooth].primaryDiagnosis : undefined,
                symptomStatus: evalSymptom,
                painScore: evalPain,
                tenderness: evalTenderness,
                swelling: evalSwelling,
                bleeding: evalBleeding,
                woundStatus: evalWound,
                sutureStatus: evalSuture,
                medicationAdherence: evalAdherence,
                adverseEffects: evalAdverse,
                notes: evalNotes,
                plan: evalPlan
              }
              update({ evaluation_entries: [...(localData.evaluation_entries || []), entry] })
              // reset some fields
              setEvalAdverse(''); setEvalNotes(''); setEvalPlan('');
            }}>Save Record</Button>
          </div>
          {(localData.evaluation_entries || []).length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-gray-500 mb-1">Recent Records</div>
              <div className="space-y-1 max-h-32 overflow-auto">
                {(localData.evaluation_entries || []).slice().reverse().map(e => (
                  <div key={e.id} className="text-xs p-2 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{new Date(e.date).toLocaleString()} {e.scope === 'tooth' ? `• Tooth ${e.toothNumber}` : '• General'}</div>
                      <div className="text-gray-600">Symptoms: {e.symptomStatus} • Pain: {e.painScore}/10 {e.linkedDiagnosis ? `• Dx: ${e.linkedDiagnosis}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* General follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-teal-500 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-teal-700">General Follow-up Appointments</CardTitle>
              <Button size="sm" onClick={() => addAppointment(false)} disabled={isReadOnly}>
                <Plus className="w-4 h-4 mr-1"/> Add appointment
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(localData.appointments || []).length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <Calendar className="w-6 h-6 mx-auto mb-2"/>No general follow-ups
              </div>
            )}
            {(localData.appointments || []).map(appt => (
              <Card key={appt.id} className="p-3">
                <div className="flex items-center justify-between">
                  <Badge className={priorityColor(appt.priority)}>{appt.priority}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => removeAppointment(appt.id)} disabled={isReadOnly}>
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label>Type</Label>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {QUICK_TYPES.map(q => (
                        <button key={q.value} type="button" className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={() => {
                          updateAppointment(appt.id, 'type', q.label)
                          if (q.duration) updateAppointment(appt.id, 'duration', q.duration.toString())
                        }}>{q.label}</button>
                      ))}
                    </div>
                    <Input value={appt.type} onChange={(e)=>updateAppointment(appt.id, 'type', e.target.value)} disabled={isReadOnly}/>
                  </div>
                  <div>
                    <Label>Date & time</Label>
                    <Input type="datetime-local" value={appt.scheduled_date} onChange={(e)=>updateAppointment(appt.id, 'scheduled_date', e.target.value)} disabled={isReadOnly}/>
                  </div>
                  <div>
                    <Label>Duration (min)</Label>
                    <Input type="number" value={appt.duration} onChange={(e)=>updateAppointment(appt.id, 'duration', e.target.value)} disabled={isReadOnly}/>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={appt.notes} onChange={(e)=>updateAppointment(appt.id, 'notes', e.target.value)} disabled={isReadOnly}/>
                  </div>
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500 shadow-sm">
          <CardHeader>
            <CardTitle className="text-teal-700">Follow-up Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>General notes</Label>
              <Textarea rows={4} value={localData.general_follow_up_notes} onChange={(e)=>update({ general_follow_up_notes: e.target.value })} disabled={isReadOnly}/>
            </div>
            <div>
              <Label>Recall period</Label>
              <Select value={localData.recall_period} onValueChange={(v)=>update({ recall_period: v })} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Select recall period"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-week">1 Week</SelectItem>
                  <SelectItem value="2-weeks">2 Weeks</SelectItem>
                  <SelectItem value="1-month">1 Month</SelectItem>
                  <SelectItem value="3-months">3 Months</SelectItem>
                  <SelectItem value="6-months">6 Months</SelectItem>
                  <SelectItem value="1-year">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isReadOnly && onSave && (
        <div className="pt-2 flex justify-end">
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => onSave(localData)}>Save Follow-up</Button>
        </div>
      )}
    </div>
  )
}
