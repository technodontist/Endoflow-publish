'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Search, Users, Calendar, CheckCircle, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  getAppointmentRequestsAction,
  scheduleAppointmentDirectAction,
  getActivePatientsAction
} from "@/lib/actions/appointments"
import { format, addDays, isToday, isSameDay } from 'date-fns'

interface PendingRequest {
  id: string
  patient_id: string
  chief_complaint: string
  pain_level: number
  urgency: string
  preferred_date: string
  preferred_time: string
  additional_notes: string
  created_at: string
  patients?: {
    first_name: string
    last_name: string
  }
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
}

interface TimeSlot {
  time: string
  status: "available" | "booked" | "cancelled"
}

interface LiveAppointmentSchedulerProps {
  onClose: () => void
  dentistId: string
  onScheduleComplete?: () => void
}

export function LiveAppointmentScheduler({
  onClose,
  dentistId,
  onScheduleComplete,
}: LiveAppointmentSchedulerProps) {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ day: string; time: string } | null>(null)
  const [patientSearch, setPatientSearch] = useState("")
  const [showBookingSuccess, setShowBookingSuccess] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [scheduleMode, setScheduleMode] = useState<'requests' | 'patients'>('requests')
  const [appointmentType, setAppointmentType] = useState('')
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')

  // Generate week days starting from today
  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i)
    return {
      name: format(date, 'EEEE'),
      date: format(date, 'yyyy-MM-dd'),
      displayDate: format(date, 'MMM d'),
      isToday: isToday(date)
    }
  })

  // Time slots from 8 AM to 6 PM
  const timeSlots: TimeSlot[] = Array.from({ length: 20 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8
    const minute = i % 2 === 0 ? 0 : 30
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    return {
      time: timeStr,
      status: "available" // In real app, this would be checked against existing appointments
    }
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [requestsResult, patientsResult] = await Promise.all([
        getAppointmentRequestsAction(),
        getActivePatientsAction()
      ])

      if (requestsResult.success && requestsResult.data) {
        setPendingRequests(requestsResult.data as any)
      }

      if (patientsResult.success && patientsResult.data) {
        setAllPatients(patientsResult.data as any)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "emergency":
        return "border-l-4 border-l-red-500"
      case "urgent":
        return "border-l-4 border-l-orange-500"
      case "routine":
        return "border-l-4 border-l-green-500"
      default:
        return "border-l-4 border-l-gray-300"
    }
  }

  const getUrgencyBadgeColor = (urgency: string) => {
    switch (urgency) {
      case "emergency":
        return "bg-red-100 text-red-800 border-red-200"
      case "urgent":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "routine":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTimeSlotColor = (status: string, day: string, time: string) => {
    const isSelected = selectedTimeSlot?.day === day && selectedTimeSlot?.time === time
    const baseClass = isSelected ? "ring-2 ring-blue-500 ring-inset" : ""

    switch (status) {
      case "available":
        return `bg-teal-50 text-teal-800 hover:bg-teal-100 cursor-pointer border border-teal-200 ${baseClass}`
      case "booked":
        return `bg-gray-200 text-gray-600 cursor-not-allowed border border-gray-300 ${baseClass}`
      case "cancelled":
        return `bg-red-100 text-red-800 cursor-not-allowed border border-red-300 ${baseClass}`
      default:
        return `bg-gray-100 text-gray-800 border border-gray-300 ${baseClass}`
    }
  }

  const filteredRequests = pendingRequests.filter(
    (request) =>
      request.patients?.first_name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
      request.patients?.last_name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
      request.chief_complaint.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const filteredPatients = allPatients.filter(
    (patient) =>
      patient.first_name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
      patient.last_name?.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const handleTimeSlotClick = (day: string, time: string, status: string) => {
    if (status === "available") {
      setSelectedTimeSlot({ day, time })
    }
  }

  const handleScheduleAppointment = async () => {
    if (!selectedTimeSlot) return

    let patientId: string | null = null
    let appointmentTypeValue = appointmentType

    if (scheduleMode === 'requests' && selectedRequest) {
      const request = pendingRequests.find(r => r.id === selectedRequest)
      if (!request) return
      patientId = request.patient_id
      appointmentTypeValue = request.chief_complaint
    } else if (scheduleMode === 'patients' && selectedPatient) {
      patientId = selectedPatient
      if (!appointmentTypeValue) {
        alert('Please select an appointment type')
        return
      }
    }

    if (!patientId) return

    try {
      const scheduleData = {
        patient_id: patientId,
        dentist_id: dentistId,
        scheduled_date: selectedTimeSlot.day,
        scheduled_time: selectedTimeSlot.time + ':00',
        appointment_type: appointmentTypeValue,
        duration_minutes: duration,
        notes: notes || undefined,
        status: 'scheduled'
      }

      const result = await scheduleAppointmentDirectAction(scheduleData)

      if (result.success) {
        setShowBookingSuccess(true)
        setTimeout(() => {
          setShowBookingSuccess(false)
          onScheduleComplete?.()
          onClose()
        }, 2000)
      } else {
        alert(result.error || 'Failed to schedule appointment')
      }
    } catch (error) {
      console.error('Error scheduling appointment:', error)
      alert('Failed to schedule appointment')
    }
  }

  const getSelectedPatientName = () => {
    if (scheduleMode === 'requests' && selectedRequest) {
      const request = pendingRequests.find(r => r.id === selectedRequest)
      return request ? `${request.patients?.first_name} ${request.patients?.last_name}` : ''
    } else if (scheduleMode === 'patients' && selectedPatient) {
      const patient = allPatients.find(p => p.id === selectedPatient)
      return patient ? `${patient.first_name} ${patient.last_name}` : ''
    }
    return ''
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading appointment data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Appointments
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-blue-600">New Appointment</h1>
              <p className="text-sm text-gray-600">Schedule appointments for patients requiring booking</p>
            </div>
          </div>
        </div>
      </div>

      {showBookingSuccess && (
        <div className="container mx-auto px-6 pt-4">
          <Alert className="bg-green-50 border-green-200 animate-in slide-in-from-top-2 duration-300">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 font-medium">
              Appointment scheduled successfully! Redirecting back to appointments...
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Left Column - Patient Selection */}
          <div className="col-span-4 space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-4">
              <Button
                variant={scheduleMode === 'requests' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setScheduleMode('requests')
                  setSelectedPatient(null)
                  setSelectedRequest(null)
                }}
              >
                Pending Requests ({pendingRequests.length})
              </Button>
              <Button
                variant={scheduleMode === 'patients' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setScheduleMode('patients')
                  setSelectedPatient(null)
                  setSelectedRequest(null)
                }}
              >
                All Patients
              </Button>
            </div>

            <div className="flex items-center gap-2 text-lg font-semibold text-blue-600">
              <Users className="h-5 w-5" />
              {scheduleMode === 'requests' ? 'Appointment Requests' : 'Select Patient'}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by patient name..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Manual Appointment Details (for patients mode) */}
            {scheduleMode === 'patients' && (
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                <div>
                  <label className="text-sm font-medium">Appointment Type</label>
                  <Select value={appointmentType} onValueChange={setAppointmentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select appointment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="cleaning">Routine Cleaning</SelectItem>
                      <SelectItem value="filling">Filling</SelectItem>
                      <SelectItem value="root_canal">Root Canal</SelectItem>
                      <SelectItem value="crown">Crown</SelectItem>
                      <SelectItem value="extraction">Extraction</SelectItem>
                      <SelectItem value="checkup">Checkup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Duration (minutes)</label>
                  <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                      <SelectItem value="120">120 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-20"
                  />
                </div>
              </div>
            )}

            {/* Patient/Request List */}
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-500px)]">
              {scheduleMode === 'requests' ? (
                filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => (
                    <Card
                      key={request.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${getUrgencyColor(request.urgency)} ${
                        selectedRequest === request.id ? "ring-2 ring-blue-500 bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedRequest(request.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                              {request.patients?.first_name?.[0]}{request.patients?.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {request.patients?.first_name} {request.patients?.last_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Requested: {format(new Date(request.preferred_date), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          <Badge className={getUrgencyBadgeColor(request.urgency)} variant="outline">
                            {request.urgency}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{request.chief_complaint}</p>
                        {request.pain_level > 0 && (
                          <p className="text-xs text-red-600">Pain level: {request.pain_level}/10</p>
                        )}
                        {request.additional_notes && (
                          <p className="text-xs text-gray-500 mt-1">{request.additional_notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No pending appointment requests</p>
                  </div>
                )
              ) : (
                filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <Card
                      key={patient.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedPatient === patient.id ? "ring-2 ring-blue-500 bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedPatient(patient.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {patient.first_name} {patient.last_name}
                            </p>
                            {patient.date_of_birth && (
                              <p className="text-xs text-gray-500">
                                DOB: {format(new Date(patient.date_of_birth), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No patients found</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right Column - Weekly Schedule */}
          <div className="col-span-8 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-blue-600">
              <Calendar className="h-5 w-5" />
              Weekly Schedule
            </div>

            {/* Calendar Grid */}
            <div className="border rounded-lg overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-8 bg-gray-50">
                <div className="p-3 border-r font-medium text-sm">Time</div>
                {weekDays.map((day) => (
                  <div key={day.date} className="p-3 border-r font-medium text-sm text-center">
                    <div className={day.isToday ? 'text-blue-600 font-bold' : ''}>
                      {day.name}
                    </div>
                    <div className="text-xs text-gray-500">{day.displayDate}</div>
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                {timeSlots.map((slot) => (
                  <div key={slot.time} className="grid grid-cols-8 border-t">
                    <div className="p-3 border-r text-sm font-medium bg-gray-50">{slot.time}</div>
                    {weekDays.map((day) => (
                      <div
                        key={`${day.date}-${slot.time}`}
                        className={`p-3 border-r text-center text-sm transition-colors min-h-[50px] flex items-center justify-center ${getTimeSlotColor(
                          slot.status,
                          day.date,
                          slot.time
                        )}`}
                        onClick={() => handleTimeSlotClick(day.date, slot.time, slot.status)}
                      >
                        {slot.status === "available" ? "Available" : slot.status === "booked" ? "Booked" : "Cancelled"}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Instructions:</strong> {scheduleMode === 'requests'
                  ? 'Select a patient request from the left panel, then click on an available time slot to schedule their appointment.'
                  : 'Select a patient from the left panel, fill in the appointment details, then click on an available time slot to schedule the appointment.'
                }
              </p>
              {(selectedRequest || selectedPatient) && selectedTimeSlot && (
                <div className="mt-2 p-2 bg-white rounded border">
                  <p className="text-sm font-medium text-blue-900">
                    Ready to book: {getSelectedPatientName()} on {format(new Date(selectedTimeSlot.day), 'EEEE, MMM d')} at {selectedTimeSlot.time}
                  </p>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={handleScheduleAppointment}
                disabled={!(selectedRequest || selectedPatient) || !selectedTimeSlot || showBookingSuccess || (scheduleMode === 'patients' && !appointmentType)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-8"
              >
                {showBookingSuccess ? "Booking..." : "Schedule Appointment"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}