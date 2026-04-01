"use client"

import { useState, useEffect } from "react"
import { GripVertical, Calendar, Camera, Bluetooth as Tooth, Trash2, AlertTriangle, ArrowLeft, LayoutDashboard, Layers, Stethoscope } from "lucide-react"
import { useResizable } from "@/hooks/use-resizable"
import { PatientQueueList, type QueuePatient } from "@/components/dentist/patient-queue-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { InteractiveDentalChart } from "./interactive-dental-chart"
import { PatientFilesViewer } from "@/components/patient-files-viewer"
import { PatientTimeline } from "@/components/dentist/patient-timeline"
import { PatientOverviewTab } from "@/components/dentist/patient-overview-tab"
import { PatientJourneyTab } from "@/components/dentist/patient-journey-tab"
import { PatientRxAppointmentsTab } from "@/components/dentist/patient-rx-appointments-tab"
import { EnhancedDentalChartTab } from "@/components/dentist/enhanced-dental-chart-tab"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { getPatientToothDiagnoses } from "@/lib/actions/tooth-diagnoses"
import { getPatientFollowUpOverviewAction } from "@/lib/actions/followup-overview"
import { deletePatientAction } from "@/lib/actions/dentist"
import { toast } from "sonner"

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
  uhid: string
  address?: string
  bloodGroup?: string
  emergencyContact: string
  emergencyContactPhone?: string
  medicalConditions: string[]
  allergies: string[]
}

interface Treatment {
  id: string
  treatment_type: string
  tooth_number?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  total_visits: number
  completed_visits: number
  consultation_id: string
  appointment_id?: string
  created_at: string
  completed_at?: string
  primary_diagnosis?: string
}

interface EnhancedPatientsInterfaceProps {
  isMobileView?: boolean
}

export function EnhancedPatientsInterface({ isMobileView = false }: EnhancedPatientsInterfaceProps) {
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const { width, isResizing, handleMouseDown } = useResizable({ initialWidth: 360, minWidth: 280, maxWidth: 520 })

  // Data states
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [toothDiagnoses, setToothDiagnoses] = useState<any>({})
  const [followUps, setFollowUps] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [version, setVersion] = useState(0)

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load patient data when selected patient changes
  useEffect(() => {
    if (selectedPatient?.id) {
      loadPatientData()
    }
  }, [selectedPatient?.id, version])

  // Real-time subscriptions for data updates
  useEffect(() => {
    if (!selectedPatient?.id) return
    
    const client = createClient()
    const channel = client
      .channel(`enhanced-patients-${selectedPatient.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'api', 
        table: 'consultations', 
        filter: `patient_id=eq.${selectedPatient.id}` 
      }, () => {
        console.log("🔄 Real-time: Consultations updated")
        setVersion(v => v + 1)
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'api', 
        table: 'treatments', 
        filter: `patient_id=eq.${selectedPatient.id}` 
      }, () => {
        console.log("🔄 Real-time: Treatments updated")
        setVersion(v => v + 1)
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'api', 
        table: 'tooth_diagnoses', 
        filter: `patient_id=eq.${selectedPatient.id}` 
      }, () => {
        console.log("🔄 Real-time: Tooth diagnoses updated")
        setVersion(v => v + 1)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'appointments',
        filter: `patient_id=eq.${selectedPatient.id}`
      }, () => {
        console.log("🔄 Real-time: Appointments updated")
        setVersion(v => v + 1)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'treatment_episodes',
        filter: `patient_id=eq.${selectedPatient.id}`
      }, () => {
        console.log("🔄 Real-time: Treatment episodes updated")
        setVersion(v => v + 1)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'tooth_timeline',
        filter: `patient_id=eq.${selectedPatient.id}`
      }, () => {
        console.log("🔄 Real-time: Tooth timeline updated")
        setVersion(v => v + 1)
      })
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [selectedPatient?.id])

  const loadPatientData = async () => {
    if (!selectedPatient?.id) return
    
    setIsLoadingData(true)
    try {
      const supabase = createClient()

      // Load treatments
      const { data: treatmentData } = await supabase
        .schema('api')
        .from('treatments')
        .select(`
          id,
          treatment_type,
          tooth_number,
          status,
          total_visits,
          completed_visits,
          consultation_id,
          appointment_id,
          created_at,
          completed_at,
          tooth_diagnoses!tooth_diagnosis_id (
            primary_diagnosis
          )
        `)
        .eq('patient_id', selectedPatient.id)
        .order('created_at', { ascending: false })

      setTreatments((treatmentData || []).map(t => ({
        ...t,
        primary_diagnosis: t.tooth_diagnoses?.primary_diagnosis
      })))

      // Load consultations
      const { data: consultationData } = await supabase
        .schema('api')
        .from('consultations')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('consultation_date', { ascending: false })

      setConsultations(consultationData || [])

      // Load tooth diagnoses for diagnosis overview
      console.log('🔍 Loading tooth diagnoses for patient:', selectedPatient.id)
      const toothResult = await getPatientToothDiagnoses(selectedPatient.id, null, true)
      console.log('🔍 Tooth diagnoses result:', toothResult)
      if (toothResult?.success && toothResult.data) {
        console.log('🔍 Raw tooth diagnoses data:', toothResult.data)
        
        // Transform the data to match DiagnosisOverviewTab expected format
        const transformedData: any = {}
        Object.entries(toothResult.data).forEach(([toothNumber, toothData]: [string, any]) => {
          transformedData[toothNumber] = {
            selectedDiagnoses: toothData.primaryDiagnosis ? [toothData.primaryDiagnosis] : [],
            diagnosisDetails: toothData.diagnosisDetails || '',
            examinationDate: toothData.examinationDate || new Date().toISOString().split('T')[0],
            symptoms: toothData.symptoms || [],
            diagnosticNotes: toothData.notes || '',
            priority: toothData.treatmentPriority || 'medium',
            currentStatus: toothData.status || 'healthy',
            selectedTreatments: toothData.recommendedTreatment ? [toothData.recommendedTreatment] : []
          }
        })
        
        console.log('🔍 Transformed tooth diagnoses data:', transformedData)
        setToothDiagnoses(transformedData)
      } else {
        console.log('❌ Failed to load tooth diagnoses:', toothResult?.error)
        setToothDiagnoses({})
      }

      // Load follow-ups
      const followUpResult = await getPatientFollowUpOverviewAction(selectedPatient.id)
      if (followUpResult?.success) {
        setFollowUps(followUpResult.data || [])
      }

      // Load appointments for Rx & Appointments tab
      const { data: appointmentData } = await supabase
        .schema('api')
        .from('appointments')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('scheduled_date', { ascending: false })
      setAppointments(appointmentData || [])

      // Load prescriptions for Rx & Appointments tab
      const { data: prescriptionData } = await supabase
        .schema('api')
        .from('patient_prescriptions')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('created_at', { ascending: false })
      setPrescriptions(prescriptionData || [])

    } catch (error) {
      console.error('Error loading patient data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/15 text-green-400"
      case "in_progress":
        return "bg-blue-500/100/15 text-blue-400"
      case "pending":
        return "bg-yellow-500/15 text-yellow-400"
      case "cancelled":
        return "bg-red-500/100/15 text-red-400"
      default:
        return "bg-muted text-foreground"
    }
  }

  const handleDeletePatient = async () => {
    if (!selectedPatient?.id) return

    setIsDeleting(true)
    try {
      const result = await deletePatientAction(selectedPatient.id)

      if (result.success) {
        toast.success("Patient Deleted", {
          description: `${selectedPatient.firstName} ${selectedPatient.lastName} and all related records have been permanently deleted.`,
        })
        setSelectedPatient(null)
        setShowDeleteDialog(false)
      } else {
        toast.error("Delete Failed", {
          description: result.error || "Failed to delete patient",
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred while deleting the patient",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const patientForComponents: Patient | null = selectedPatient ? {
    id: selectedPatient.id,
    firstName: selectedPatient.firstName,
    lastName: selectedPatient.lastName,
    email: selectedPatient.email || "",
    phone: selectedPatient.phone || "",
    dateOfBirth: selectedPatient.dateOfBirth || "1990-01-01",
    lastVisit: selectedPatient.lastVisit || new Date().toISOString(),
    nextAppointment: selectedPatient.nextAppointment,
    status: selectedPatient.status,
    emergencyContact: "Not provided",
    medicalConditions: [],
    allergies: [],
    uhid: selectedPatient.uhid,
    address: undefined,
    bloodGroup: undefined,
    emergencyContactPhone: undefined,
  } : null

  // Detail panel content — reused in both desktop (inline) and mobile (Sheet)
  const detailPanelContent = (
    <div className={isMobileView ? "h-full overflow-y-auto" : "flex-1 min-w-0 pl-4"}>
        {!selectedPatient ? (
          <div className="h-full flex items-center justify-center">
            <Card className="w-full max-w-md mx-auto">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <Stethoscope className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Enhanced Patient Interface</h3>
                <p className="text-muted-foreground text-sm">Select a patient from the queue to view their comprehensive medical records</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full flex flex-col space-y-4">
            {/* Patient Header */}
            <Card className="border-l-4 border-l-blue-600">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-foreground">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h2>
                      <Badge className={getStatusColor(selectedPatient.status)}>
                        {selectedPatient.status}
                      </Badge>
                      {isLoadingData && (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-400">Syncing...</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">UHID: {selectedPatient.uhid}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          Age: {new Date().getFullYear() - new Date(selectedPatient.dateOfBirth || '1990-01-01').getFullYear()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{selectedPatient.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          Last Visit: {selectedPatient.lastVisit ? format(new Date(selectedPatient.lastVisit), 'MMM d, yyyy') : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Edit Patient
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      New Appointment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 hover:text-red-700 hover:bg-red-500/100/10"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Patient
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Enhanced Tabs */}
            <Card className="flex-1 flex flex-col">
              <CardContent className="p-0 h-full flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <TabsList className="flex w-full rounded-none border-b bg-muted overflow-x-auto">
                    <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <LayoutDashboard className="h-4 w-4" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="dental-chart" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <Tooth className="h-4 w-4" />
                      Dental Chart
                    </TabsTrigger>
                    <TabsTrigger value="journey" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <Layers className="h-4 w-4" />
                      Journey
                    </TabsTrigger>
                    <TabsTrigger value="files" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <Camera className="h-4 w-4" />
                      Files
                    </TabsTrigger>
                    <TabsTrigger value="rx-appointments" className="flex items-center gap-2 data-[state=active]:bg-card">
                      <Calendar className="h-4 w-4" />
                      Rx & Appt
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-auto">
                    {/* Overview Tab */}
                    <TabsContent value="overview" className="p-6 m-0">
                      {selectedPatient && (
                        <PatientOverviewTab
                          patientId={selectedPatient.id}
                          treatments={treatments}
                          consultations={consultations}
                          followUps={followUps}
                        />
                      )}
                    </TabsContent>

                    {/* Dental Chart Tab (Visual entry point — click tooth for history) */}
                    <TabsContent value="dental-chart" className="p-6 m-0">
                      {selectedPatient && (
                        <EnhancedDentalChartTab patientId={selectedPatient.id} />
                      )}
                    </TabsContent>

                    {/* Journey Tab (Unified longitudinal view — replaces Episodes + Timeline + Treatments + Diagnosis + Follow-ups) */}
                    <TabsContent value="journey" className="p-6 m-0">
                      {selectedPatient && (
                        <PatientJourneyTab patientId={selectedPatient.id} />
                      )}
                    </TabsContent>

                    {/* Files Tab (X-rays, Photos, Documents) */}
                    <TabsContent value="files" className="p-0 m-0">
                      {patientForComponents ? (
                        <PatientFilesViewer
                          patientId={patientForComponents.id}
                          viewMode="dentist"
                          showUploader={true}
                          showPatientInfo={true}
                          maxHeight="600px"
                        />
                      ) : (
                        <div className="p-6">
                          <div className="text-center py-12 text-muted-foreground">
                            <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No patient selected</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* Rx & Appointments Tab */}
                    <TabsContent value="rx-appointments" className="p-6 m-0">
                      {selectedPatient && (
                        <PatientRxAppointmentsTab
                          appointments={appointments}
                          prescriptions={prescriptions}
                          followUps={followUps}
                        />
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  )

  // --- MOBILE LAYOUT ---
  if (isMobileView) {
    return (
      <div className="min-h-[400px]">
        {/* Full-width Patient Queue */}
        <PatientQueueList
          selectedPatientId={selectedPatient?.id}
          onPatientSelect={(p) => setSelectedPatient(p)}
        />

        {/* Patient Detail Sheet (slides up from bottom) */}
        <Sheet open={!!selectedPatient} onOpenChange={(open) => { if (!open) setSelectedPatient(null) }}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 overflow-hidden">
            <SheetHeader className="px-4 pt-4 pb-2 border-b sticky top-0 bg-card z-10">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedPatient(null)} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle className="text-left">
                  {selectedPatient?.firstName} {selectedPatient?.lastName}
                </SheetTitle>
              </div>
            </SheetHeader>
            <div className="overflow-y-auto h-full pb-8 px-1">
              {detailPanelContent}
            </div>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete Patient Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-foreground">
                Are you sure you want to delete{" "}
                <span className="font-bold">
                  {selectedPatient?.firstName} {selectedPatient?.lastName}
                </span>
                ?
              </p>
              <div className="bg-red-500/10 border border-red-300 rounded-md p-3 text-sm text-red-400">
                <p className="font-semibold mb-2">⚠️ This action cannot be undone!</p>
                <p className="text-xs">The following data will be permanently deleted:</p>
                <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                  <li>All consultations and medical records</li>
                  <li>All treatments and tooth diagnoses</li>
                  <li>All appointments (past and future)</li>
                  <li>All uploaded medical files and images</li>
                  <li>All messages and notifications</li>
                  <li>Patient profile and account</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePatient}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    )
  }

  // --- DESKTOP LAYOUT ---
  return (
    <div className="flex min-h-[600px] relative">
      {/* Left: Patient Queue */}
      <div style={{ width: `${width}px` }} className="flex-shrink-0">
        <PatientQueueList
          selectedPatientId={selectedPatient?.id}
          onPatientSelect={(p) => setSelectedPatient(p)}
        />
      </div>

      {/* Divider */}
      <div
        className={`w-1 bg-border hover:bg-primary/20 cursor-col-resize flex items-center justify-center group relative ${
          isResizing ? "bg-primary/30" : ""
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`absolute inset-y-0 w-3 flex items-center justify-center ${isResizing ? "w-6" : ""}`}>
          <GripVertical className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ${
            isResizing ? "text-primary" : ""
          }`} />
        </div>
      </div>

      {/* Right: Enhanced Patient Interface */}
      {detailPanelContent}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete Patient Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-foreground">
                Are you sure you want to delete{" "}
                <span className="font-bold">
                  {selectedPatient?.firstName} {selectedPatient?.lastName}
                </span>
                ?
              </p>
              <div className="bg-red-500/10 border border-red-300 rounded-md p-3 text-sm text-red-400">
                <p className="font-semibold mb-2">⚠️ This action cannot be undone!</p>
                <p className="text-xs">The following data will be permanently deleted:</p>
                <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                  <li>All consultations and medical records</li>
                  <li>All treatments and tooth diagnoses</li>
                  <li>All appointments (past and future)</li>
                  <li>All uploaded medical files and images</li>
                  <li>All messages and notifications</li>
                  <li>Patient profile and account</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePatient}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}