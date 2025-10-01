"use client"

import { useState } from "react"
import {
  Stethoscope,
  AlertTriangle,
  User,
  FileText,
  Bluetooth as Tooth,
  Camera,
  FlaskConical,
  CreditCard,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Heart,
  Shield,
  Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InteractiveDentalChart } from "./interactive-dental-chart"
import { PatientFilesViewer } from "@/components/patient-files-viewer"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useEffect } from "react"
import { PatientTimeline } from "@/components/dentist/patient-timeline"

interface Patient {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  lastVisit: string
  nextAppointment?: string
  status: "active" | "inactive" | "new"
  insuranceProvider?: string
  emergencyContact: string
  medicalConditions: string[]
  allergies: string[]
  uhid: string
  address?: string
  bloodGroup?: string
  emergencyContactPhone?: string
}

interface ClinicalCockpitProps {
  selectedPatient?: Patient | null
  onNewAppointment?: () => void
  onEditPatient?: () => void
}

export function ClinicalCockpit({
  selectedPatient,
  onNewAppointment,
  onEditPatient
}: ClinicalCockpitProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [consultations, setConsultations] = useState<any[]>([])
  const [consultationFiles, setConsultationFiles] = useState<Record<string, any[]>>({})
  const [toothByConsult, setToothByConsult] = useState<Record<string, any[]>>({})
  const [treatmentsByConsult, setTreatmentsByConsult] = useState<Record<string, any[]>>({})
  const [isLoadingConsults, setIsLoadingConsults] = useState(false)
  const [dentistsList, setDentistsList] = useState<{ id: string; full_name: string }[]>([])
  const [selectedDentistForFU, setSelectedDentistForFU] = useState<string>('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const loadConsultations = async () => {
      if (!selectedPatient?.id) return
      setIsLoadingConsults(true)
      try {
        const supabase = createClient()
        const { data: cons, error } = await supabase
          .schema('api')
          .from('consultations')
          .select('*')
          .eq('patient_id', selectedPatient.id)
          .order('consultation_date', { ascending: false })

        if (error) {
          console.error('Failed to load consultations:', error)
          setConsultations([])
          return
        }

        const consList = (cons || []).map((c: any) => ({
          ...c,
          pain_assessment: safeParse(c.pain_assessment),
          medical_history: safeParse(c.medical_history),
          clinical_examination: safeParse(c.clinical_examination),
          investigations: safeParse(c.investigations),
          diagnosis: safeParse(c.diagnosis),
          treatment_plan: safeParse(c.treatment_plan),
          prescription_data: safeParse(c.prescription_data) || [],
          follow_up_data: safeParse(c.follow_up_data) || {},
          clinical_data: c.clinical_data || {},
        }))

        setConsultations(consList)

        // Fetch tooth diagnoses for all consultations in one query
        const consIds = consList.map((c:any) => c.id)
        if (consIds.length > 0) {
          const { data: teeth } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .select('consultation_id, tooth_number, status, primary_diagnosis, recommended_treatment')
            .in('consultation_id', consIds)
          const map: Record<string, any[]> = {}
          for (const t of teeth || []) {
            const k = t.consultation_id
            if (!map[k]) map[k] = []
            map[k].push(t)
          }
          setToothByConsult(map)
        }

        // Fetch treatments grouped by consultation
        const { data: trts } = await supabase
          .schema('api')
          .from('treatments')
          .select('id, consultation_id, tooth_number, status, treatment_type, total_visits, completed_visits')
          .eq('patient_id', selectedPatient.id)
        const trMap: Record<string, any[]> = {}
        for (const t of trts || []) {
          const k = t.consultation_id
          if (!k) continue
          if (!trMap[k]) trMap[k] = []
          trMap[k].push(t)
        }
        setTreatmentsByConsult(trMap)

        // Fetch files once and map by consultation date (same day)
        const { data: files } = await supabase
          .schema('api')
          .from('patient_files')
          .select('*')
          .eq('patient_id', selectedPatient.id)
          .order('created_at', { ascending: false })

        const byConsult: Record<string, any[]> = {}
        for (const c of consList) {
          const cDate = (c.consultation_date || '').slice(0, 10)
          byConsult[c.id] = (files || []).filter((f: any) => (f.created_at || '').slice(0,10) === cDate)
        }
        setConsultationFiles(byConsult)
      } finally {
        setIsLoadingConsults(false)
      }
    }

    const safeParse = (json: any) => {
      if (!json) return null
      try { return typeof json === 'string' ? JSON.parse(json) : json } catch { return null }
    }

    loadConsultations()
  }, [selectedPatient?.id, version])

  // Realtime: refresh on updates to consultations, treatments, tooth_diagnoses
  useEffect(() => {
    if (!selectedPatient?.id) return
    const client = createClient()
    const channel = client
      .channel(`cockpit-${selectedPatient.id}`)
      .on('postgres_changes', { event: '*', schema: 'api', table: 'consultations', filter: `patient_id=eq.${selectedPatient.id}` }, () => setVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'api', table: 'treatments', filter: `patient_id=eq.${selectedPatient.id}` }, () => setVersion(v => v + 1))
      .on('postgres_changes', { event: '*', schema: 'api', table: 'tooth_diagnoses', filter: `patient_id=eq.${selectedPatient.id}` }, () => setVersion(v => v + 1))
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [selectedPatient?.id])

  // Load dentists for follow-up scheduling
  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .schema('api')
          .from('dentists')
          .select('id, full_name')
        setDentistsList(data || [])
        if ((data || []).length > 0) setSelectedDentistForFU(data![0].id)
      } catch {}
    }
    run()
  }, [])

  if (!selectedPatient) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Stethoscope className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clinical Cockpit</h3>
            <p className="text-gray-600 text-sm">Select a patient from the queue to view their clinical details</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const criticalAlerts =
    selectedPatient.allergies.length > 0 ||
    selectedPatient.medicalConditions.some(
      (condition) =>
        condition.toLowerCase().includes("diabetes") ||
        condition.toLowerCase().includes("heart") ||
        condition.toLowerCase().includes("blood pressure") ||
        condition.toLowerCase().includes("hypertension")
    )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "new":
        return "bg-blue-100 text-blue-800"
      case "inactive":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Create follow-up appointments on the client (RLS allows dentist inserts)
  const scheduleFollowUpsClient = async (consultation: any, dentistId: string) => {
    try {
      const supabase = createClient()
      const followUp = consultation.follow_up_data || null
      if (!followUp) return { created: 0 }

      const candidates: { type: string; date: string; time?: string; duration?: number }[] = []
      if (Array.isArray(followUp.appointments)) {
        for (const ap of followUp.appointments) {
          const date = ap.scheduled_date || ap.date
          if (!date) continue
          candidates.push({ type: ap.type || 'follow_up', date, time: ap.time || ap.scheduled_time || '10:00', duration: parseInt(ap.duration || '30') || 30 })
        }
      }
      if (followUp.tooth_specific_follow_ups && typeof followUp.tooth_specific_follow_ups === 'object') {
        for (const tooth of Object.keys(followUp.tooth_specific_follow_ups)) {
          const entry = followUp.tooth_specific_follow_ups[tooth]
          if (entry && Array.isArray(entry.appointments)) {
            for (const ap of entry.appointments) {
              const date = ap.scheduled_date || ap.date
              if (!date) continue
              candidates.push({ type: `${ap.type || 'follow_up'} (Tooth ${tooth})`, date, time: ap.time || '10:00', duration: parseInt(ap.duration || '30') || 30 })
            }
          }
        }
      }

      let created = 0
      for (const ap of candidates) {
        const { error: insErr } = await supabase
          .schema('api')
          .from('appointments')
          .insert({
            patient_id: consultation.patient_id,
            dentist_id: dentistId,
            scheduled_date: ap.date,
            scheduled_time: ap.time || '10:00',
            duration_minutes: ap.duration || 30,
            appointment_type: ap.type,
            status: 'scheduled',
            notes: 'Created from follow_up_data'
          })
        if (!insErr) created++
      }
      return { created }
    } catch (e) {
      console.error('[FOLLOWUPS] Client scheduling error:', e)
      return { created: 0 }
    }
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Patient Header Card */}
      <Card className="border-l-4 border-l-blue-600">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </h2>
                <Badge className={getStatusColor(selectedPatient.status)}>
                  {selectedPatient.status}
                </Badge>
                {criticalAlerts && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Medical Alert
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">UHID: {selectedPatient.uhid}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Age: {new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">{selectedPatient.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Last Visit: {format(new Date(selectedPatient.lastVisit), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEditPatient}>
                Edit Patient
              </Button>
              <Button size="sm" onClick={onNewAppointment} className="bg-blue-600 hover:bg-blue-700">
                New Appointment
              </Button>
            </div>
          </div>

          {/* Critical Medical Information Alert */}
          {(selectedPatient.allergies.length > 0 || selectedPatient.medicalConditions.length > 0) && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800">Critical Medical Information</span>
              </div>
              <div className="space-y-2">
                {selectedPatient.allergies.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-red-700">Allergies: </span>
                      <span className="text-sm text-red-600">{selectedPatient.allergies.join(", ")}</span>
                    </div>
                  </div>
                )}
                {selectedPatient.medicalConditions.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Heart className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-red-700">Medical Conditions: </span>
                      <span className="text-sm text-red-600">{selectedPatient.medicalConditions.join(", ")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Clinical Tabs */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="p-0 h-full flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
<TabsList className="grid w-full grid-cols-8 rounded-none border-b bg-gray-50">
              <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-white">
                <User className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Calendar className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2 data-[state=active]:bg-white">
                <FileText className="h-4 w-4" />
                Clinical Notes
              </TabsTrigger>
              <TabsTrigger value="consultations" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Calendar className="h-4 w-4" />
                Consultations
              </TabsTrigger>
              <TabsTrigger value="chart" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Tooth className="h-4 w-4" />
                Dental Chart
              </TabsTrigger>
              <TabsTrigger value="gallery" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Camera className="h-4 w-4" />
                Image Gallery
              </TabsTrigger>
              <TabsTrigger value="lab" className="flex items-center gap-2 data-[state=active]:bg-white">
                <FlaskConical className="h-4 w-4" />
                Lab Results
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2 data-[state=active]:bg-white">
                <CreditCard className="h-4 w-4" />
                Billing
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="overview" className="p-6 m-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-600" />
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Date of Birth</label>
                          <p className="text-sm font-medium">{format(new Date(selectedPatient.dateOfBirth), 'MMMM d, yyyy')}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Blood Group</label>
                          <p className="text-sm font-medium">{selectedPatient.bloodGroup || "Not specified"}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="text-sm font-medium text-gray-600">Email</label>
                          <p className="text-sm font-medium">{selectedPatient.email}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="text-sm font-medium text-gray-600">Address</label>
                          <p className="text-sm font-medium">{selectedPatient.address || "Not provided"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Emergency Contact */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Phone className="h-5 w-5 text-blue-600" />
                        Emergency Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Contact Person</label>
                        <p className="text-sm font-medium">{selectedPatient.emergencyContact}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Phone Number</label>
                        <p className="text-sm font-medium">{selectedPatient.emergencyContactPhone || "Not provided"}</p>
                      </div>
                      {selectedPatient.insuranceProvider && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Insurance Provider</label>
                          <p className="text-sm font-medium">{selectedPatient.insuranceProvider}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Appointment History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      Recent Appointments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Routine Cleaning</p>
                          <p className="text-sm text-gray-600">{selectedPatient.lastVisit}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Completed</Badge>
                      </div>
                      {selectedPatient.nextAppointment && (
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">Follow-up Examination</p>
                            <p className="text-sm text-gray-600">{selectedPatient.nextAppointment}</p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
</TabsContent>

              <TabsContent value="timeline" className="p-6 m-0">
                {selectedPatient?.id ? (
                  <PatientTimeline patientId={selectedPatient.id} />
                ) : (
                  <div className="text-center text-gray-500 py-12">Select a patient to view timeline</div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="p-6 m-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Clinical Notes</h3>
                    <Button size="sm">Add New Note</Button>
                  </div>
                  <div className="space-y-4">
                    <Card className="border-l-4 border-l-blue-600">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium">Routine Examination</span>
                          <span className="text-xs text-gray-500">{selectedPatient.lastVisit}</span>
                        </div>
                        <p className="text-sm text-gray-700">
                          Patient presented for routine cleaning and examination. No immediate concerns noted.
                          Recommended continued regular oral hygiene and scheduled follow-up in 6 months.
                        </p>
                      </CardContent>
                    </Card>
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Additional clinical notes will appear here</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="chart" className="p-6 m-0">
                <InteractiveDentalChart 
                  patientId={selectedPatient?.id}
                  readOnly={false}
                  showLabels={true}
                />
              </TabsContent>

              <TabsContent value="consultations" className="p-6 m-0">
                {isLoadingConsults ? (
                  <div className="text-center text-gray-500 py-12">Loading consultations...</div>
                ) : consultations.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">No consultations found</div>
                ) : (
                  <div className="space-y-4">
                    {consultations.map((c) => {
                      const pickDiagText = (val: any): string => {
                        if (!val) return '—'
                        const norm = Array.isArray(val) ? val : (typeof val === 'object' ? [val] : [val])
                        const parts = norm.map((item: any) => {
                          if (typeof item === 'string') return item
                          if (typeof item === 'object' && item) {
                            return item.diagnosis_name || item.name || item.type || item.icd_code || item.description || 'Diagnosis'
                          }
                          return String(item)
                        })
                        return parts.filter(Boolean).join(', ')
                      }

                      const rawDiag = (c.diagnosis && (c.diagnosis.final || c.diagnosis.primary)) || c.clinical_data?.diagnosis?.primary
                      const diagnosis = pickDiagText(rawDiag)

                      const planVal = c.treatment_plan?.plan || c.treatment_plan?.recommended || c.clinical_data?.treatment_plan?.recommended
                      const plan = Array.isArray(planVal)
                        ? planVal.map((p: any) => (typeof p === 'string' ? p : (p?.description || p?.name || 'Treatment'))).join(', ')
                        : (typeof planVal === 'object' && planVal ? (planVal.description || planVal.name || 'Treatment') : (planVal || '—'))

                      const rxCount = Array.isArray(c.prescription_data) ? c.prescription_data.length : 0
                      const fuCount = typeof c.follow_up_data === 'object' && c.follow_up_data ? Object.keys(c.follow_up_data).length : 0
                      const files = consultationFiles[c.id] || []
                      const teeth = toothByConsult[c.id] || []
                      return (
                        <Card key={c.id}>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                              <span className="text-base">{format(new Date(c.consultation_date || c.created_at), 'MMM d, yyyy')}</span>
                              <div className="flex items-center gap-2">
                                {/* Quick follow-up scheduler */}
                                {dentistsList.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <select
                                      className="text-xs border rounded px-2 py-1"
                                      value={selectedDentistForFU}
                                      onChange={(e) => setSelectedDentistForFU(e.target.value)}
                                    >
                                      {dentistsList.map(d => (
                                        <option key={d.id} value={d.id}>{d.full_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                                      onClick={async () => {
                                        if (!selectedDentistForFU) return
                                        const res = await scheduleFollowUpsClient(c, selectedDentistForFU)
                                        console.log('Follow-ups created:', res)
                                      }}
                                    >
                                      Schedule Follow-ups
                                    </button>
                                  </div>
                                )}
                                <Badge className={c.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{c.status}</Badge>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <div className="text-gray-500">Chief Complaint</div>
                                <div className="font-medium">{c.chief_complaint || c.clinical_data?.chief_complaint || '—'}</div>
                              </div>
                              <div>
                                <div className="text-gray-500">Primary Diagnosis</div>
                                <div className="font-medium">{diagnosis}</div>
                              </div>
                              <div>
                                <div className="text-gray-500">Treatment Plan</div>
                                <div className="font-medium truncate" title={String(plan)}>{String(plan)}</div>
                              </div>
                            </div>
                            <div className="grid md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <div className="text-gray-500">Prescriptions</div>
                                <div className="font-medium">{rxCount}</div>
                              </div>
                              <div>
                                <div className="text-gray-500">Follow-ups</div>
                                <div className="font-medium">{fuCount}</div>
                              </div>
                              <div>
                                <div className="text-gray-500">Teeth Entries</div>
                                <div className="font-medium">{teeth.length}</div>
                              </div>
                            </div>

                            {/* Treatments summary synced from treatments table */}
                            {Array.isArray(treatmentsByConsult[c.id]) && treatmentsByConsult[c.id].length > 0 && (
                              <div className="grid md:grid-cols-3 gap-3 text-sm pt-2 border-t">
                                {(() => {
                                  const list = treatmentsByConsult[c.id]
                                  const pending = list.filter((t:any) => t.status === 'pending').length
                                  const prog = list.filter((t:any) => t.status === 'in_progress').length
                                  const done = list.filter((t:any) => t.status === 'completed').length
                                  return (
                                    <>
                                      <div>
                                        <div className="text-gray-500">Treatments (Pending)</div>
                                        <div className="font-medium">{pending}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">In Progress</div>
                                        <div className="font-medium">{prog}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">Completed</div>
                                        <div className="font-medium">{done}</div>
                                      </div>
                                    </>
                                  )
                                })()}
                              </div>
                            )}

                            <details className="mt-2">
                              <summary className="text-sm text-blue-700 cursor-pointer">Show details</summary>
                              <div className="mt-2 grid md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-gray-500">Symptoms</div>
                                  <div className="whitespace-pre-wrap">
                                    {c.pain_assessment ? JSON.stringify(c.pain_assessment, null, 2) : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Clinical Examination</div>
                                  <div className="whitespace-pre-wrap">
                                    {c.clinical_examination ? JSON.stringify(c.clinical_examination, null, 2) : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Investigations</div>
                                  <div className="whitespace-pre-wrap">
                                    {c.investigations ? JSON.stringify(c.investigations, null, 2) : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Follow-up</div>
                                  <div className="whitespace-pre-wrap">
                                    {c.follow_up_data ? JSON.stringify(c.follow_up_data, null, 2) : '—'}
                                  </div>
                                </div>
                              </div>
                              {teeth.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-gray-500 text-sm mb-1">Tooth Diagnoses</div>
                                  <div className="text-xs grid md:grid-cols-2 gap-2">
                                    {teeth.slice(0,8).map((t:any, idx:number) => {
                                      const list = treatmentsByConsult[c.id] || []
                                      const resolved = list.some((tr:any) => (
                                        tr.status === 'completed' && (
                                          (tr.tooth_diagnosis_id && tr.tooth_diagnosis_id === t.id) ||
                                          (!tr.tooth_diagnosis_id && tr.tooth_number && String(tr.tooth_number) === String(t.tooth_number))
                                        )
                                      ))
                                      return (
                                        <div key={idx} className="p-2 bg-gray-50 rounded border">
                                          <div className="font-medium flex items-center gap-2">
                                            <span>Tooth {t.tooth_number}</span>
                                            {resolved && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Resolved</span>
                                            )}
                                          </div>
                                          <div className="text-xs">Status: {t.status}</div>
                                          {t.primary_diagnosis && <div className="text-xs">Dx: {t.primary_diagnosis}</div>}
                                          {t.recommended_treatment && <div className="text-xs">Tx: {t.recommended_treatment}</div>}
                                        </div>
                                      )
                                    })}
                                    {teeth.length > 8 && <div className="text-gray-500">+{teeth.length - 8} more…</div>}
                                  </div>
                                </div>
                              )}
                            </details>

                            {files.length > 0 && (
                              <div className="pt-2">
                                <div className="text-sm text-gray-500 mb-1">Files from this date</div>
                                <div className="flex flex-wrap gap-2">
                                  {files.slice(0,6).map((f:any) => (
                                    <Badge key={f.id} variant="outline" className="text-xs">{f.file_type || f.mime_type}</Badge>
                                  ))}
                                  {files.length > 6 && (
                                    <span className="text-xs text-gray-500">+{files.length - 6} more</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="gallery" className="p-0 m-0">
                {selectedPatient ? (
                  <PatientFilesViewer
                    patientId={selectedPatient.id}
                    viewMode="dentist"
                    showUploader={true}
                    showPatientInfo={true}
                    maxHeight="600px"
                  />
                ) : (
                  <div className="p-6">
                    <div className="text-center py-12 text-gray-500">
                      <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Select a patient to view their medical files</p>
                      <p className="text-xs text-gray-400 mt-1">X-rays, photos, and other medical images will appear here</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lab" className="p-6 m-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Laboratory Results</h3>
                    <Button size="sm">Add Lab Order</Button>
                  </div>
                  <div className="text-center py-12 text-gray-500">
                    <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No lab results available</p>
                    <p className="text-xs text-gray-400 mt-1">Laboratory orders and results will appear here</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="billing" className="p-6 m-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Billing Information</h3>
                    <Button size="sm">Create Invoice</Button>
                  </div>
                  <div className="text-center py-12 text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No billing records found</p>
                    <p className="text-xs text-gray-400 mt-1">Patient invoices and payment history will appear here</p>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}