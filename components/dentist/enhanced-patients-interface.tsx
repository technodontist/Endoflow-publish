"use client"

import { useState, useEffect } from "react"
import { GripVertical, Activity, FileText, Calendar, Stethoscope, Camera, Bluetooth as Tooth, Trash2, AlertTriangle } from "lucide-react"
import { useResizable } from "@/hooks/use-resizable"
import { PatientQueueList, type QueuePatient } from "@/components/dentist/patient-queue-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { DiagnosisOverviewTab } from "@/components/consultation/tabs/DiagnosisOverviewTab"
import { FollowUpTab } from "@/components/consultation/tabs/FollowUpTab"
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

export function EnhancedPatientsInterface() {
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null)
  const [activeTab, setActiveTab] = useState("treatment-done")
  const { width, isResizing, handleMouseDown } = useResizable({ initialWidth: 360, minWidth: 280, maxWidth: 520 })

  // Data states
  const [treatments, setTreatments] = useState<Treatment[]>([])
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

    } catch (error) {
      console.error('Error loading patient data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in_progress":
        return "bg-blue-100 text-blue-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
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
      <div className="flex-1 min-w-0 pl-4">
        {!selectedPatient ? (
          <div className="h-full flex items-center justify-center">
            <Card className="w-full max-w-md mx-auto">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <Stethoscope className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Enhanced Patient Interface</h3>
                <p className="text-gray-600 text-sm">Select a patient from the queue to view their comprehensive medical records</p>
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
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h2>
                      <Badge className={getStatusColor(selectedPatient.status)}>
                        {selectedPatient.status}
                      </Badge>
                      {isLoadingData && (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-600">Syncing...</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">UHID: {selectedPatient.uhid}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          Age: {new Date().getFullYear() - new Date(selectedPatient.dateOfBirth || '1990-01-01').getFullYear()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{selectedPatient.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
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
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                  <TabsList className="grid w-full grid-cols-6 rounded-none border-b bg-gray-50">
                    <TabsTrigger value="treatment-done" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Activity className="h-4 w-4" />
                      Treatment Done
                    </TabsTrigger>
                    <TabsTrigger value="diagnosis" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <FileText className="h-4 w-4" />
                      Diagnosis
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Calendar className="h-4 w-4" />
                      Timeline
                    </TabsTrigger>
                    <TabsTrigger value="followups" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Stethoscope className="h-4 w-4" />
                      Follow-ups
                    </TabsTrigger>
                    <TabsTrigger value="xrays-photos" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Camera className="h-4 w-4" />
                      X-rays & Photos
                    </TabsTrigger>
                    <TabsTrigger value="dental-chart" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <Tooth className="h-4 w-4" />
                      Dental Chart
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-auto">
                    {/* Treatment Done Tab */}
                    <TabsContent value="treatment-done" className="p-6 m-0 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Treatment History</h3>
                        <Badge variant="outline">{treatments.length} treatments</Badge>
                      </div>
                      
                      {treatments.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No treatments found for this patient</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {treatments.map((treatment) => (
                            <Card key={treatment.id} className="border-l-4 border-l-blue-500">
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h4 className="font-medium text-gray-900">
                                        {treatment.treatment_type}
                                      </h4>
                                      <Badge className={getStatusColor(treatment.status)}>
                                        {treatment.status.charAt(0).toUpperCase() + treatment.status.slice(1)}
                                      </Badge>
                                      {treatment.tooth_number && (
                                        <Badge variant="outline">Tooth #{treatment.tooth_number}</Badge>
                                      )}
                                    </div>
                                    
                                    {treatment.primary_diagnosis && (
                                      <p className="text-sm text-gray-600 mb-2">
                                        <span className="font-medium">Diagnosis:</span> {treatment.primary_diagnosis}
                                      </p>
                                    )}
                                    
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                      <span>
                                        Progress: {treatment.completed_visits}/{treatment.total_visits} visits
                                      </span>
                                      <span>
                                        Started: {format(new Date(treatment.created_at), 'MMM d, yyyy')}
                                      </span>
                                      {treatment.completed_at && (
                                        <span>
                                          Completed: {format(new Date(treatment.completed_at), 'MMM d, yyyy')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* Diagnosis Tab */}
                    <TabsContent value="diagnosis" className="p-6 m-0">
                      <DiagnosisOverviewTab 
                        data={toothDiagnoses}
                        consultationData={{
                          clinicianName: "Current Dentist",
                          patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                          consultationDate: new Date().toISOString()
                        }}
                        isReadOnly={true}
                        showHistory={true}
                      />
                    </TabsContent>

                    {/* Timeline Tab */}
                    <TabsContent value="timeline" className="p-6 m-0">
                      <PatientTimeline patientId={selectedPatient.id} />
                    </TabsContent>

                    {/* Follow-ups Tab */}
                    <TabsContent value="followups" className="p-6 m-0">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Follow-up Appointments</h3>
                          <Badge variant="outline">{followUps.length} follow-ups</Badge>
                        </div>
                        
                        {followUps.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No follow-up appointments scheduled</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {followUps.map((followUp) => (
                              <Card key={followUp.id}>
                                <CardContent className="pt-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-medium text-gray-900">
                                          {followUp.appointment_type}
                                        </h4>
                                        <Badge className={getStatusColor(followUp.status)}>
                                          {followUp.status.charAt(0).toUpperCase() + followUp.status.slice(1)}
                                        </Badge>
                                      </div>
                                      
                                      <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span>
                                          {format(new Date(followUp.scheduled_date), 'MMM d, yyyy')} at {followUp.scheduled_time}
                                        </span>
                                        {followUp.timeline_description && (
                                          <span>{followUp.timeline_description}</span>
                                        )}
                                        {followUp.dentist_name && (
                                          <span>Dr. {followUp.dentist_name}</span>
                                        )}
                                      </div>
                                      
                                      {followUp.linked_teeth && followUp.linked_teeth.length > 0 && (
                                        <div className="mt-2">
                                          {followUp.linked_teeth.map((tooth: any) => (
                                            <Badge key={tooth.tooth_number} variant="outline" className="mr-1">
                                              Tooth #{tooth.tooth_number}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* X-rays & Photos Tab */}
                    <TabsContent value="xrays-photos" className="p-0 m-0">
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
                          <div className="text-center py-12 text-gray-500">
                            <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No patient selected</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* Dental Chart Tab */}
                    <TabsContent value="dental-chart" className="p-6 m-0">
                      <InteractiveDentalChart 
                        patientId={selectedPatient.id}
                        readOnly={true}
                        showLabels={true}
                        subscribeRealtime={true}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Patient Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-gray-900">
                Are you sure you want to delete{" "}
                <span className="font-bold">
                  {selectedPatient?.firstName} {selectedPatient?.lastName}
                </span>
                ?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-900">
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