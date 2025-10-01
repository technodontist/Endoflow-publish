'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar,
  Clock,
  User,
  Search,
  Plus,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Phone,
  Mail,
  CalendarDays,
  Stethoscope,
  X,
  UserPlus
} from "lucide-react"
import {
  getAvailabilityAction,
  confirmAppointmentRequestAction,
  createAppointmentRequestAction,
  getAvailableDentistsAction,
  getActivePatientsAction
} from "@/lib/actions/appointments"
import { AppointmentAvailability, TimeSlot } from "@/lib/services/appointments"
import ContextualAppointmentForm from "@/components/appointments/ContextualAppointmentForm"
import PatientSearch from "@/components/shared/PatientSearch"

interface Patient {
  id: string
  firstName: string
  lastName: string
  createdAt: Date
  phone: string | null
  email: string | null
  dateOfBirth: string | null
  medicalHistorySummary: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}

interface Dentist {
  id: string
  fullName: string
  specialty: string | null
  createdAt: Date
}

interface AppointmentBookingInterfaceProps {
  currentAssistantId: string
}

interface DirectBookingForm {
  patientId: string
  dentistId: string
  appointmentType: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes: number
  notes: string
  urgency: 'routine' | 'urgent' | 'emergency'
}

export function AppointmentBookingInterface({ currentAssistantId }: AppointmentBookingInterfaceProps) {
  const [activeTab, setActiveTab] = useState("pending")
  const [patients, setPatients] = useState<Patient[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [availableSlots, setAvailableSlots] = useState<AppointmentAvailability[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoadingPatients, setIsLoadingPatients] = useState(true)
  const [isLoadingDentists, setIsLoadingDentists] = useState(true)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [showDirectBooking, setShowDirectBooking] = useState(false)
  const [showContextualBooking, setShowContextualBooking] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')

  const [directBookingForm, setDirectBookingForm] = useState<DirectBookingForm>({
    patientId: '',
    dentistId: '',
    appointmentType: '',
    scheduledDate: '',
    scheduledTime: '',
    durationMinutes: 60,
    notes: '',
    urgency: 'routine'
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  // Load initial data
  useEffect(() => {
    loadPatients()
    loadDentists()
  }, [])

  // Load available slots when date or dentist changes
  useEffect(() => {
    if (directBookingForm.scheduledDate && directBookingForm.dentistId) {
      loadAvailableSlots()
    }
  }, [directBookingForm.scheduledDate, directBookingForm.dentistId])

  const loadPatients = async () => {
    setIsLoadingPatients(true)
    try {
      const result = await getActivePatientsAction()
      if (result.success && result.data) {
        setPatients(result.data)
      } else {
        setPatients([])
      }
    } catch (error) {
      console.error('Error loading patients:', error)
      setPatients([])
    } finally {
      setIsLoadingPatients(false)
    }
  }

  const loadDentists = async () => {
    setIsLoadingDentists(true)
    try {
      const result = await getAvailableDentistsAction()
      if (result.success && result.data) {
        setDentists(result.data)
      }
    } catch (error) {
      console.error('Error loading dentists:', error)
    } finally {
      setIsLoadingDentists(false)
    }
  }

  const loadAvailableSlots = async () => {
    setIsLoadingSlots(true)
    try {
      const endDate = new Date(directBookingForm.scheduledDate)
      endDate.setDate(endDate.getDate() + 7) // Load next 7 days

      const result = await getAvailabilityAction(
        directBookingForm.scheduledDate,
        endDate.toISOString().split('T')[0],
        directBookingForm.durationMinutes,
        directBookingForm.dentistId
      )

      if (result.success && result.data) {
        setAvailableSlots(result.data)
      }
    } catch (error) {
      console.error('Error loading available slots:', error)
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const handleDirectBooking = async () => {
    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      // Validate form
      if (!directBookingForm.patientId || !directBookingForm.dentistId ||
          !directBookingForm.appointmentType || !directBookingForm.scheduledDate ||
          !directBookingForm.scheduledTime) {
        setSubmitResult({
          success: false,
          error: 'Please fill in all required fields'
        })
        return
      }

      // Create appointment request first (for consistency with workflow)
      const formData = new FormData()
      formData.append('chiefComplaint', directBookingForm.appointmentType)
      formData.append('painLevel', '0')
      formData.append('urgency', directBookingForm.urgency)
      formData.append('preferredDate', directBookingForm.scheduledDate)
      formData.append('preferredTime', directBookingForm.scheduledTime)
      formData.append('additionalNotes', `Direct booking by assistant. ${directBookingForm.notes}`)

      const requestResult = await createAppointmentRequestAction(directBookingForm.patientId, formData)

      if (!requestResult.success || !requestResult.data) {
        setSubmitResult({
          success: false,
          error: requestResult.error || 'Failed to create appointment request'
        })
        return
      }

      // Immediately confirm the appointment
      const confirmResult = await confirmAppointmentRequestAction(
        requestResult.data.id,
        {
          dentistId: directBookingForm.dentistId,
          assistantId: currentAssistantId,
          scheduledDate: directBookingForm.scheduledDate,
          scheduledTime: directBookingForm.scheduledTime,
          durationMinutes: directBookingForm.durationMinutes,
          notes: directBookingForm.notes
        },
        currentAssistantId
      )

      if (confirmResult.success) {
        setSubmitResult({
          success: true,
          message: 'Appointment booked successfully!'
        })

        // Reset form
        setDirectBookingForm({
          patientId: '',
          dentistId: '',
          appointmentType: '',
          scheduledDate: '',
          scheduledTime: '',
          durationMinutes: 60,
          notes: '',
          urgency: 'routine'
        })

        // Close dialog after delay
        setTimeout(() => {
          setShowDirectBooking(false)
          setSubmitResult(null)
        }, 2000)
      } else {
        setSubmitResult({
          success: false,
          error: confirmResult.error || 'Failed to confirm appointment'
        })
      }
    } catch (error) {
      console.error('Error booking appointment:', error)
      setSubmitResult({
        success: false,
        error: 'An unexpected error occurred'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredPatients = patients.filter(patient =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getAvailableTimesForDate = (date: string): TimeSlot[] => {
    const daySlots = availableSlots.find(slot => slot.date === date)
    return daySlots?.timeSlots.filter(slot => slot.available) || []
  }

  const selectedPatient = patients.find(p => p.id === directBookingForm.patientId)
  const selectedDentist = dentists.find(d => d.id === directBookingForm.dentistId)

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Appointment Management</h2>
          <p className="text-gray-600 text-sm">Manage patient appointments and scheduling</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showContextualBooking} onOpenChange={setShowContextualBooking}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Contextual Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                  Create Contextual Appointment
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {!selectedPatientId ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Search for Patient</h4>
                    <PatientSearch onPatientSelect={(patientId) => setSelectedPatientId(patientId)} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Create Contextual Appointment</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedPatientId('')}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Change Patient
                      </Button>
                    </div>
                    <ContextualAppointmentForm 
                      patientId={selectedPatientId}
                      onSuccess={() => {
                        setSelectedPatientId('')
                        setShowContextualBooking(false)
                      }}
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showDirectBooking} onOpenChange={setShowDirectBooking}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Legacy Booking
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-teal-600" />
                Book New Appointment
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {submitResult && (
                <Alert className={submitResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <div className="flex items-center gap-2">
                    {submitResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                    <AlertDescription className={submitResult.success ? 'text-green-800' : 'text-red-800'}>
                      {submitResult.success ? submitResult.message : submitResult.error}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Patient Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Patient *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search patients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {isLoadingPatients ? (
                    <div className="p-4 text-center">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading patients...</p>
                    </div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <User className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No patients found</p>
                    </div>
                  ) : (
                    filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          directBookingForm.patientId === patient.id ? 'bg-teal-50 border-teal-200' : ''
                        }`}
                        onClick={() => setDirectBookingForm(prev => ({ ...prev, patientId: patient.id }))}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            directBookingForm.patientId === patient.id ? 'bg-teal-600' : 'bg-gray-300'
                          }`} />
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {patient.firstName} {patient.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              Patient since {new Date(patient.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Appointment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentType" className="text-sm font-medium">
                    Appointment Type *
                  </Label>
                  <Select
                    value={directBookingForm.appointmentType}
                    onValueChange={(value) => setDirectBookingForm(prev => ({ ...prev, appointmentType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select appointment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Routine Cleaning">Routine Cleaning</SelectItem>
                      <SelectItem value="Dental Examination">Dental Examination</SelectItem>
                      <SelectItem value="Cavity Filling">Cavity Filling</SelectItem>
                      <SelectItem value="Root Canal">Root Canal</SelectItem>
                      <SelectItem value="Crown Placement">Crown Placement</SelectItem>
                      <SelectItem value="Tooth Extraction">Tooth Extraction</SelectItem>
                      <SelectItem value="Orthodontic Consultation">Orthodontic Consultation</SelectItem>
                      <SelectItem value="Emergency Treatment">Emergency Treatment</SelectItem>
                      <SelectItem value="Follow-up Visit">Follow-up Visit</SelectItem>
                      <SelectItem value="Consultation">Consultation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency" className="text-sm font-medium">
                    Priority Level
                  </Label>
                  <Select
                    value={directBookingForm.urgency}
                    onValueChange={(value) => setDirectBookingForm(prev => ({ ...prev, urgency: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Routine</Badge>
                          <span>Regular appointment</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">Urgent</Badge>
                          <span>Within 24 hours</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="emergency">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">Emergency</Badge>
                          <span>ASAP</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dentist Selection */}
              <div className="space-y-2">
                <Label htmlFor="dentist" className="text-sm font-medium">
                  Assign Dentist *
                </Label>
                <Select
                  value={directBookingForm.dentistId}
                  onValueChange={(value) => setDirectBookingForm(prev => ({ ...prev, dentistId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dentist" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingDentists ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading dentists...
                        </div>
                      </SelectItem>
                    ) : (
                      dentists.map((dentist) => (
                        <SelectItem key={dentist.id} value={dentist.id}>
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4" />
                            <div>
                              <div className="font-medium">{dentist.fullName}</div>
                              {dentist.specialty && (
                                <div className="text-xs text-gray-500">{dentist.specialty}</div>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Time Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate" className="text-sm font-medium">
                    Date *
                  </Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={directBookingForm.scheduledDate}
                    onChange={(e) => setDirectBookingForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    min={minDate}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledTime" className="text-sm font-medium">
                    Time *
                  </Label>
                  <Select
                    value={directBookingForm.scheduledTime}
                    onValueChange={(value) => setDirectBookingForm(prev => ({ ...prev, scheduledTime: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingSlots ? "Loading..." : "Select time"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingSlots ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading times...
                          </div>
                        </SelectItem>
                      ) : directBookingForm.scheduledDate && directBookingForm.dentistId ? (
                        getAvailableTimesForDate(directBookingForm.scheduledDate).length > 0 ? (
                          getAvailableTimesForDate(directBookingForm.scheduledDate).map((slot) => (
                            <SelectItem key={slot.time} value={slot.time}>
                              {slot.time}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-slots" disabled>
                            No available slots
                          </SelectItem>
                        )
                      ) : (
                        <SelectItem value="select-date" disabled>
                          Select date and dentist first
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-sm font-medium">
                    Duration
                  </Label>
                  <Select
                    value={directBookingForm.durationMinutes.toString()}
                    onValueChange={(value) => setDirectBookingForm(prev => ({ ...prev, durationMinutes: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Appointment Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Add any special notes or instructions for this appointment..."
                  value={directBookingForm.notes}
                  onChange={(e) => setDirectBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Booking Summary */}
              {selectedPatient && selectedDentist && directBookingForm.scheduledDate && directBookingForm.scheduledTime && (
                <Card className="bg-teal-50 border-teal-200">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-teal-600" />
                      Booking Summary
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Patient:</span> {selectedPatient.firstName} {selectedPatient.lastName}</div>
                      <div><span className="font-medium">Dentist:</span> {selectedDentist.fullName}</div>
                      <div><span className="font-medium">Type:</span> {directBookingForm.appointmentType}</div>
                      <div className="flex items-center gap-4">
                        <span><span className="font-medium">Date:</span> {new Date(directBookingForm.scheduledDate).toLocaleDateString()}</span>
                        <span><span className="font-medium">Time:</span> {directBookingForm.scheduledTime}</span>
                        <span><span className="font-medium">Duration:</span> {directBookingForm.durationMinutes} min</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleDirectBooking}
                  disabled={isSubmitting || !directBookingForm.patientId || !directBookingForm.dentistId || !directBookingForm.appointmentType || !directBookingForm.scheduledDate || !directBookingForm.scheduledTime}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Booking Appointment...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Appointment
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDirectBooking(false)}
                  disabled={isSubmitting}
                  className="px-6"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  )
}