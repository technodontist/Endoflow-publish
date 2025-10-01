'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Calendar, Clock, User, CheckCircle, AlertCircle, Users } from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { scheduleAppointmentDirectAction } from '@/lib/actions/appointments'
import { format } from 'date-fns'

interface PendingAppointment {
  id: string
  patient_id: string
  patient_name: string
  appointment_type: string
  preferred_date: string
  preferred_time: string
  pain_level?: number
  reason_for_visit: string
  status: string
  source: 'patient_request' | 'dentist_created'
}


interface Dentist {
  id: string
  full_name: string
  specialty?: string
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string
  created_at: string
}

interface AppointmentOrganizerProps {
  currentAssistantId: string
}

export function AppointmentOrganizerNew({ currentAssistantId }: AppointmentOrganizerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingAppointments, setPendingAppointments] = useState<PendingAppointment[]>([])
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<PendingAppointment | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [appointmentType, setAppointmentType] = useState('')
  const [selectedDentist, setSelectedDentist] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [selectionMode, setSelectionMode] = useState<'pending' | 'search'>('pending')

  // Load pending appointments, patients, and dentists
  useEffect(() => {
    loadPendingAppointments()
    loadPatients()
    loadDentists()
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
      return fullName.includes(query) ||
             patient.first_name.toLowerCase().includes(query) ||
             patient.last_name.toLowerCase().includes(query) ||
             patient.id.toLowerCase().includes(query)
    })

    setFilteredPatients(filtered.slice(0, 20))
  }, [searchQuery, allPatients])

  const loadPendingAppointments = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()

      // First, get pending appointment requests
      const { data: requests, error } = await supabase
        .schema('api')
        .from('appointment_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading pending appointments:', error)
        return
      }

      // Get patient information for each request
      const formattedRequests = []
      if (requests && requests.length > 0) {
        for (const req of requests) {
          // Try to get patient info from the patients table
          const { data: patientData } = await supabase
            .schema('api')
            .from('patients')
            .select('first_name, last_name')
            .eq('id', req.patient_id)
            .single()

          const patientName = patientData
            ? `${patientData.first_name} ${patientData.last_name}`
            : `Patient ${req.patient_id.substring(0, 8)}`

          formattedRequests.push({
            id: req.id,
            patient_id: req.patient_id,
            patient_name: patientName,
            appointment_type: req.appointment_type,
            preferred_date: req.preferred_date,
            preferred_time: req.preferred_time,
            pain_level: req.pain_level,
            reason_for_visit: req.reason_for_visit,
            status: req.status,
            source: 'patient_request' as const
          })
        }
      }

      setPendingAppointments(formattedRequests)
    } catch (error) {
      console.error('Error loading pending appointments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPatients = async () => {
    try {
      const supabase = createClient()

      const { data: patientsList, error } = await supabase
        .schema('api')
        .from('patients')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading patients:', error)
        return
      }

      setAllPatients(patientsList || [])
      setFilteredPatients((patientsList || []).slice(0, 10))
    } catch (error) {
      console.error('Error loading patients:', error)
    }
  }

  const loadDentists = async () => {
    try {
      const supabase = createClient()

      const { data: dentistsList, error } = await supabase
        .schema('api')
        .from('dentists')
        .select(`
          id,
          full_name,
          specialty
        `)
        .order('full_name')

      if (error) {
        console.error('Error loading dentists:', error)
        return
      }

      setDentists(dentistsList || [])
    } catch (error) {
      console.error('Error loading dentists:', error)
    }
  }


  const filteredAppointments = pendingAppointments.filter(appointment =>
    appointment.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    appointment.appointment_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    appointment.reason_for_visit.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAppointmentSelect = (appointment: PendingAppointment) => {
    setSelectedAppointment(appointment)
    setSelectedPatient(null) // Clear patient selection when selecting appointment
    setSelectionMode('pending')
    setSelectedDate(appointment.preferred_date)
    setSelectedTime(appointment.preferred_time)
    setAppointmentType(appointment.appointment_type)
    setNotes('')
  }

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient)
    setSelectedAppointment(null) // Clear appointment selection when selecting patient
    setSelectionMode('search')
    setSelectedDate('')
    setSelectedTime('')
    setAppointmentType('')
    setNotes('')
  }

  const handleBookAppointment = async () => {
    // Validate based on selection mode
    if (selectionMode === 'pending') {
      if (!selectedAppointment || !selectedDentist || !selectedDate || !selectedTime) {
        alert('Please fill in all required fields')
        return
      }
    } else {
      if (!selectedPatient || !selectedDentist || !selectedDate || !selectedTime || !appointmentType) {
        alert('Please fill in all required fields including appointment type')
        return
      }
    }

    setIsBooking(true)
    try {
      const appointmentData = {
        patient_id: selectionMode === 'pending' ? selectedAppointment!.patient_id : selectedPatient!.id,
        dentist_id: selectedDentist,
        appointment_type: selectionMode === 'pending' ? selectedAppointment!.appointment_type : appointmentType,
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        duration_minutes: 60,
        notes: selectionMode === 'pending'
          ? (notes || selectedAppointment!.reason_for_visit)
          : notes
      }

      const result = await scheduleAppointmentDirectAction(appointmentData)

      if (result.success) {
        // If scheduling from pending request, remove it from the list
        if (selectionMode === 'pending' && selectedAppointment) {
          setPendingAppointments(prev => prev.filter(apt => apt.id !== selectedAppointment.id))
        }

        // Reset form
        setSelectedAppointment(null)
        setSelectedPatient(null)
        setSelectedDentist('')
        setSelectedDate('')
        setSelectedTime('')
        setAppointmentType('')
        setNotes('')

        alert('Appointment scheduled successfully!')
      } else {
        alert(`Error scheduling appointment: ${result.error}`)
      }
    } catch (error) {
      console.error('Error booking appointment:', error)
      alert('Failed to schedule appointment')
    } finally {
      setIsBooking(false)
    }
  }

  const getPriorityBadge = (painLevel?: number) => {
    if (!painLevel) return <Badge variant="secondary">Normal</Badge>
    if (painLevel >= 8) return <Badge variant="destructive">Urgent</Badge>
    if (painLevel >= 5) return <Badge variant="default">High</Badge>
    return <Badge variant="secondary">Normal</Badge>
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointment Organizer</h1>
          <p className="text-gray-600">Schedule pending appointments from patient requests and dentist referrals</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          {pendingAppointments.length} pending appointments
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Patient/Appointment Selection */}
        <div className="space-y-4">
          {/* Mode Selection Tabs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-3">
                <Button
                  variant={selectionMode === 'pending' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSelectionMode('pending')
                    setSearchQuery('')
                    setSelectedPatient(null)
                  }}
                  className={`flex-1 ${selectionMode === 'pending' ? 'bg-white shadow-sm' : ''}`}
                >
                  Pending Requests ({pendingAppointments.length})
                </Button>
                <Button
                  variant={selectionMode === 'search' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSelectionMode('search')
                    setSearchQuery('')
                    setSelectedAppointment(null)
                  }}
                  className={`flex-1 ${selectionMode === 'search' ? 'bg-white shadow-sm' : ''}`}
                >
                  Search Patients
                </Button>
              </div>
              <CardTitle className="text-lg">
                {selectionMode === 'pending' ? 'Pending Appointments' : 'Patient Search'}
              </CardTitle>
              <CardDescription>
                {selectionMode === 'pending'
                  ? 'Search and select appointment requests to schedule'
                  : 'Search and select any patient to schedule appointment'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={selectionMode === 'pending'
                    ? "Search by patient name, appointment type, or reason..."
                    : "Search patients by name or ID..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Content List */}
          <div className="space-y-3">
            {selectionMode === 'pending' ? (
              // Pending Appointments
              isLoading ? (
                <Card>
                  <CardContent className="p-4 text-center text-gray-500">
                    Loading pending appointments...
                  </CardContent>
                </Card>
              ) : filteredAppointments.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-center text-gray-500">
                    {searchQuery ? 'No appointments match your search' : 'No pending appointments'}
                  </CardContent>
                </Card>
              ) : (
                filteredAppointments.map((appointment) => (
                <Card
                  key={appointment.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedAppointment?.id === appointment.id ? 'ring-2 ring-teal-500 bg-teal-50' : ''
                  }`}
                  onClick={() => handleAppointmentSelect(appointment)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{appointment.patient_name}</h3>
                          {getPriorityBadge(appointment.pain_level)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(appointment.preferred_date), 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {appointment.preferred_time}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-700 mb-1">{appointment.appointment_type}</p>
                        <p className="text-sm text-gray-600 line-clamp-2">{appointment.reason_for_visit}</p>
                      </div>
                      <div className="ml-4">
                        <Badge variant="outline" className="text-xs">
                          {appointment.source === 'patient_request' ? 'Patient Request' : 'Dentist Referral'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
            ) : (
              // Patient Search
              isLoading ? (
                <Card>
                  <CardContent className="p-4 text-center text-gray-500">
                    Loading patients...
                  </CardContent>
                </Card>
              ) : filteredPatients.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-center text-gray-500">
                    {searchQuery ? 'No patients match your search' : 'No patients found'}
                  </CardContent>
                </Card>
              ) : (
                filteredPatients.map((patient) => {
                  const fullName = `${patient.first_name} ${patient.last_name}`
                  const initials = `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()
                  const isSelected = selectedPatient?.id === patient.id

                  return (
                    <Card
                      key={patient.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'ring-2 ring-teal-500 bg-teal-50' : ''
                      }`}
                      onClick={() => handlePatientSelect(patient)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <span className="text-sm font-semibold">{initials}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900">{fullName}</h3>
                            <p className="text-sm text-gray-600">
                              Patient ID: {patient.id.substring(0, 8)}...
                            </p>
                            <p className="text-sm text-gray-500">
                              Joined {format(new Date(patient.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="ml-4">
                            <Badge variant="outline" className="text-xs">
                              Patient
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )
            )}
          </div>
        </div>

        {/* Right Side: Booking Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule Appointment</CardTitle>
              <CardDescription>
                {selectedAppointment
                  ? `Scheduling for ${selectedAppointment.patient_name}`
                  : selectedPatient
                  ? `Scheduling for ${selectedPatient.first_name} ${selectedPatient.last_name}`
                  : 'Select a patient or appointment request to schedule'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(selectedAppointment || selectedPatient) ? (
                <>
                  {/* Patient Info */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-gray-600" />
                      <span className="font-medium">
                        {selectedAppointment
                          ? selectedAppointment.patient_name
                          : `${selectedPatient?.first_name} ${selectedPatient?.last_name}`
                        }
                      </span>
                    </div>
                    {selectedAppointment ? (
                      <>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>Type:</strong> {selectedAppointment.appointment_type}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Reason:</strong> {selectedAppointment.reason_for_visit}
                        </p>
                        {selectedAppointment.pain_level && (
                          <p className="text-sm text-gray-600">
                            <strong>Pain Level:</strong> {selectedAppointment.pain_level}/10
                          </p>
                        )}
                      </>
                    ) : selectedPatient && (
                      <>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>Patient ID:</strong> {selectedPatient.id.substring(0, 8)}...
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Joined:</strong> {format(new Date(selectedPatient.created_at), 'MMM d, yyyy')}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Appointment Type Selection for Direct Scheduling */}
                  {selectedPatient && (
                    <div className="space-y-2">
                      <Label htmlFor="appointmentType">Appointment Type *</Label>
                      <Select value={appointmentType} onValueChange={setAppointmentType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select appointment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Consultation">Consultation</SelectItem>
                          <SelectItem value="Cleaning">Cleaning</SelectItem>
                          <SelectItem value="Root Canal">Root Canal</SelectItem>
                          <SelectItem value="Filling">Filling</SelectItem>
                          <SelectItem value="Crown">Crown</SelectItem>
                          <SelectItem value="Extraction">Extraction</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Emergency">Emergency</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Dentist Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="dentist">Select Dentist *</Label>
                    <Select value={selectedDentist} onValueChange={setSelectedDentist}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a dentist" />
                      </SelectTrigger>
                      <SelectContent>
                        {dentists.map((dentist) => (
                          <SelectItem key={dentist.id} value={dentist.id}>
                            {dentist.full_name} {dentist.specialty && `(${dentist.specialty})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>

                  {/* Time Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="time">Time *</Label>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Input
                      placeholder="Any additional notes for this appointment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Book Button */}
                  <Button
                    onClick={handleBookAppointment}
                    disabled={Boolean(
                      isBooking ||
                      !selectedDentist ||
                      !selectedDate ||
                      !selectedTime ||
                      (selectedPatient && !appointmentType)
                    )}
                    className="w-full bg-teal-600 hover:bg-teal-700"
                  >
                    {isBooking ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Scheduling Appointment...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Book Appointment
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a pending appointment from the list to schedule it</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}