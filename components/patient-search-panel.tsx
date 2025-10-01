'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, User, Calendar, Clock, FileText, Phone, Mail, Plus, Image, Download } from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { PatientBillingForm } from './patient-billing-form'
import { getPatientFilesAction, getFileUrlAction } from '@/lib/actions/patient-files'

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string
  medical_history_summary?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  created_at: string
}

interface Appointment {
  id: string
  scheduled_date: string
  scheduled_time: string
  appointment_type: string
  status: string
  notes?: string
  dentists?: {
    full_name: string
    specialty: string
  }
}

interface Treatment {
  id: string
  treatment_type: string
  description?: string
  status: string
  created_at: string
  dentists?: {
    full_name: string
    specialty: string
  }
  appointments?: {
    scheduled_date: string
    appointment_type: string
  }
}

interface PatientFile {
  id: string
  patient_id: string
  uploaded_by: string
  file_name: string
  original_file_name: string
  file_path: string
  file_size: number
  mime_type: string
  file_type: string
  description: string
  created_at: string
  uploader?: {
    full_name: string
  }
}

export function PatientSearchPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [showBillingForm, setShowBillingForm] = useState(false)

  // Load all patients on component mount
  useEffect(() => {
    async function loadPatients() {
      try {
        const supabase = createClient()
        const { data: patients, error } = await supabase
          .schema('api')
          .from('patients')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading patients:', error)
          return
        }

        setAllPatients(patients || [])
        setFilteredPatients((patients || []).slice(0, 10)) // Show first 10 by default
      } catch (error) {
        console.error('Error loading patients:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPatients()
  }, [])

  // Filter patients based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(allPatients.slice(0, 10))
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allPatients.filter(patient => {
      const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
      const firstName = patient.first_name.toLowerCase()
      const lastName = patient.last_name.toLowerCase()

      return fullName.includes(query) ||
             firstName.includes(query) ||
             lastName.includes(query) ||
             patient.id.toLowerCase().includes(query)
    })

    setFilteredPatients(filtered.slice(0, 20)) // Limit to 20 results
  }, [searchQuery, allPatients])

  // Load patient history when a patient is selected
  const handlePatientSelect = async (patient: Patient) => {
    setSelectedPatient(patient)
    setIsLoadingHistory(true)

    try {
      const supabase = createClient()

      // Load appointments
      const { data: patientAppointments, error: appointmentsError } = await supabase
        .schema('api')
        .from('appointments')
        .select(`
          *,
          dentists:dentist_id (
            full_name,
            specialty
          )
        `)
        .eq('patient_id', patient.id)
        .order('scheduled_date', { ascending: true })

      if (appointmentsError) {
        console.error('Error loading appointments:', appointmentsError)
      }

      // Load treatments with simplified query to avoid join errors
      const { data: patientTreatments, error: treatmentsError } = await supabase
        .schema('api')
        .from('treatments')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })

      if (treatmentsError) {
        console.error('Error loading treatments:', treatmentsError)
        // Set empty array to prevent undefined errors
        setTreatments([])
      } else {
        setTreatments(patientTreatments || [])
      }

      setAppointments(patientAppointments || [])

      // Load patient files
      const filesResult = await getPatientFilesAction(patient.id)
      if (filesResult.success) {
        setPatientFiles(filesResult.data || [])
      } else {
        console.error('Error loading patient files:', filesResult.error)
        setPatientFiles([])
      }

    } catch (error) {
      console.error('Error loading patient history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return 'Invalid date'
    }
  }

  const formatDateTime = (dateString: string, timeString?: string) => {
    try {
      const date = new Date(dateString)
      if (timeString) {
        return `${format(date, 'MMM d, yyyy')} at ${timeString}`
      }
      return format(date, 'MMM d, yyyy')
    } catch {
      return 'Invalid date'
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-500" />
          Patient Search & History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={(e) => e.preventDefault()}>
        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                // Stop any global hotkeys or accidental submit/redirects
                if (e.key === 'Enter') e.preventDefault();
                e.stopPropagation();
              }}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex gap-4 h-[500px]">
          {/* Patient List */}
          <div className="w-1/2 border-r pr-4">
            <h3 className="font-semibold mb-3 text-sm">Patients ({filteredPatients.length})</h3>
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading patients...</p>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No patients found' : 'No patients available'}
                  </p>
                </div>
              ) : (
                filteredPatients.map((patient) => {
                  const fullName = `${patient.first_name} ${patient.last_name}`
                  const initials = `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()
                  const isSelected = selectedPatient?.id === patient.id

                  return (
                    <div
                      key={patient.id}
                      onClick={() => handlePatientSelect(patient)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                        isSelected ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <span className={`text-xs font-semibold ${
                            isSelected ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {initials}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm truncate">{fullName}</h4>
                          <p className="text-xs text-muted-foreground">
                            Joined {formatDate(patient.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Patient History */}
          <div className="flex-1 pl-4">
            {selectedPatient ? (
              <div className="space-y-4">
                {/* Patient Info */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold mb-2">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {selectedPatient.date_of_birth && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>DOB: {formatDate(selectedPatient.date_of_birth)}</span>
                      </div>
                    )}
                    {selectedPatient.emergency_contact_name && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>Emergency: {selectedPatient.emergency_contact_name}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <Button
                      onClick={() => setShowBillingForm(!showBillingForm)}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {showBillingForm ? 'Hide Billing' : 'Make Billing'}
                    </Button>
                  </div>
                </div>

                {showBillingForm ? (
                  <PatientBillingForm
                    selectedPatient={selectedPatient}
                    onBillingCreated={() => {
                      setShowBillingForm(false)
                      // Refresh patient history if needed
                      handlePatientSelect(selectedPatient)
                    }}
                  />
                ) : isLoadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading history...</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[350px] overflow-y-auto">
                    {/* Appointments */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Appointments ({appointments.length})
                      </h4>
                      {appointments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No appointments found</p>
                      ) : (
                        <div className="space-y-2">
                          {appointments.slice(0, 5).map((appointment) => (
                            <div key={appointment.id} className="p-2 bg-gray-50 rounded text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{appointment.appointment_type}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateTime(appointment.scheduled_date, appointment.scheduled_time)}
                                  </p>
                                  {appointment.dentists && (
                                    <p className="text-xs text-muted-foreground">
                                      Dr. {appointment.dentists.full_name}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {appointment.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Treatment History */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Treatment History ({treatments.length})
                      </h4>
                      {treatments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No treatments found</p>
                      ) : (
                        <div className="space-y-2">
                          {treatments.slice(0, 5).map((treatment) => (
                            <div key={treatment.id} className="p-2 bg-gray-50 rounded text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{treatment.treatment_type}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(treatment.created_at)}
                                  </p>
                                  {treatment.dentists && (
                                    <p className="text-xs text-muted-foreground">
                                      Dr. {treatment.dentists.full_name}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {treatment.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Medical History */}
                    {selectedPatient.medical_history_summary && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Medical History
                        </h4>
                        <div className="p-2 bg-gray-50 rounded text-sm">
                          <p>{selectedPatient.medical_history_summary}</p>
                        </div>
                      </div>
                    )}

                    {/* Patient Files */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Patient Files ({patientFiles.length})
                      </h4>
                      {patientFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No files uploaded yet</p>
                      ) : (
                        <div className="space-y-2">
                          {patientFiles.slice(0, 5).map((file) => (
                            <div key={file.id} className="p-2 bg-gray-50 rounded text-sm">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Image className="h-3 w-3 text-gray-400" />
                                    <span className="font-medium">{file.file_type}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {(file.file_size / 1024 / 1024).toFixed(1)} MB
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {file.description}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Uploaded {formatDate(file.created_at)}
                                    {file.uploader && ` by ${file.uploader.full_name}`}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    const result = await getFileUrlAction(file.file_path)
                                    if (result.success && result.url) {
                                      window.open(result.url, '_blank')
                                    } else {
                                      alert('Failed to open file')
                                    }
                                  }}
                                  className="text-xs"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {patientFiles.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{patientFiles.length - 5} more files
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">Select a Patient</h3>
                <p className="text-muted-foreground">
                  Choose a patient from the list to view their appointment history and records
                </p>
              </div>
            )}
          </div>
        </div>
        </form>
      </CardContent>
    </Card>
  )
}