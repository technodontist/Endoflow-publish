'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Calendar,
  Clock,
  User,
  Search,
  Plus,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Stethoscope,
  CalendarDays,
  UserPlus
} from "lucide-react"
import {
  dentistBookAppointment,
  getPatientsForBooking,
  getDentistAvailableSlots
} from "@/lib/actions/dentist"
import { AppointmentAvailability, TimeSlot } from "@/lib/services/appointments"

interface Patient {
  id: string
  first_name: string
  last_name: string
  created_at: string
}

interface BookingInterfaceProps {
  dentistId: string
  onRefreshStats: () => void
}

interface BookingForm {
  patientId: string
  appointmentType: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes: number
  notes: string
  urgency: 'routine' | 'urgent' | 'emergency'
}

export function DentistBookingInterface({ dentistId, onRefreshStats }: BookingInterfaceProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [availableSlots, setAvailableSlots] = useState<AppointmentAvailability[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoadingPatients, setIsLoadingPatients] = useState(true)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [bookingForm, setBookingForm] = useState<BookingForm>({
    patientId: '',
    appointmentType: '',
    scheduledDate: '',
    scheduledTime: '',
    durationMinutes: 60,
    notes: '',
    urgency: 'routine'
  })

  const [submitResult, setSubmitResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  useEffect(() => {
    loadPatients()
  }, [])

  useEffect(() => {
    if (bookingForm.scheduledDate) {
      loadAvailableSlots()
    }
  }, [bookingForm.scheduledDate, bookingForm.durationMinutes])

  const loadPatients = async () => {
    setIsLoadingPatients(true)
    try {
      const result = await getPatientsForBooking()
      if (result.success && result.data) {
        setPatients(result.data as any)
      }
    } catch (error) {
      console.error('Error loading patients:', error)
    } finally {
      setIsLoadingPatients(false)
    }
  }

  const loadAvailableSlots = async () => {
    setIsLoadingSlots(true)
    try {
      const endDate = new Date(bookingForm.scheduledDate)
      endDate.setDate(endDate.getDate() + 7) // Load next 7 days

      const result = await getDentistAvailableSlots(
        bookingForm.scheduledDate,
        endDate.toISOString().split('T')[0],
        bookingForm.durationMinutes
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      // Validate form
      if (!bookingForm.patientId || !bookingForm.appointmentType ||
          !bookingForm.scheduledDate || !bookingForm.scheduledTime) {
        setSubmitResult({
          success: false,
          error: 'Please fill in all required fields'
        })
        return
      }

      const formData = new FormData()
      formData.append('patientId', bookingForm.patientId)
      formData.append('appointmentType', bookingForm.appointmentType)
      formData.append('scheduledDate', bookingForm.scheduledDate)
      formData.append('scheduledTime', bookingForm.scheduledTime)
      formData.append('durationMinutes', bookingForm.durationMinutes.toString())
      formData.append('notes', bookingForm.notes)
      formData.append('urgency', bookingForm.urgency)

      const result = await dentistBookAppointment(formData)

      if (result.success) {
        setSubmitResult({
          success: true,
          message: 'Appointment booked successfully!'
        })

        // Reset form
        setBookingForm({
          patientId: '',
          appointmentType: '',
          scheduledDate: '',
          scheduledTime: '',
          durationMinutes: 60,
          notes: '',
          urgency: 'routine'
        })

        onRefreshStats()

        // Clear success message after delay
        setTimeout(() => {
          setSubmitResult(null)
        }, 3000)
      } else {
        setSubmitResult({
          success: false,
          error: result.error || 'Failed to book appointment'
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

  const updateFormData = (field: keyof BookingForm, value: string | number) => {
    setBookingForm(prev => ({ ...prev, [field]: value }))
  }

  const filteredPatients = patients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedPatient = patients.find(p => p.id === bookingForm.patientId)

  const getAvailableTimesForDate = (date: string): TimeSlot[] => {
    const daySlots = availableSlots.find(slot => slot.date === date)
    return daySlots?.timeSlots.filter(slot => slot.available) || []
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'destructive'
      case 'urgent': return 'secondary'
      default: return 'outline'
    }
  }

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            New Consultation Booking
          </CardTitle>
          <p className="text-sm text-gray-600">
            Schedule a new appointment directly for any patient
          </p>
        </CardHeader>
        <CardContent>
          {submitResult && (
            <Alert className={`mb-6 ${submitResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Patient *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search patients by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg">
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
                        bookingForm.patientId === patient.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => updateFormData('patientId', patient.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          bookingForm.patientId === patient.id ? 'bg-blue-600' : 'bg-gray-300'
                        }`} />
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                            {patient.first_name[0]}{patient.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {patient.first_name} {patient.last_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            Patient since {new Date(patient.created_at).toLocaleDateString()}
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
                  value={bookingForm.appointmentType}
                  onValueChange={(value) => updateFormData('appointmentType', value)}
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
                  value={bookingForm.urgency}
                  onValueChange={(value) => updateFormData('urgency', value)}
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

            {/* Date and Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledDate" className="text-sm font-medium">
                  Date *
                </Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  value={bookingForm.scheduledDate}
                  onChange={(e) => updateFormData('scheduledDate', e.target.value)}
                  min={minDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledTime" className="text-sm font-medium">
                  Time *
                </Label>
                <Select
                  value={bookingForm.scheduledTime}
                  onValueChange={(value) => updateFormData('scheduledTime', value)}
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
                    ) : bookingForm.scheduledDate ? (
                      getAvailableTimesForDate(bookingForm.scheduledDate).length > 0 ? (
                        getAvailableTimesForDate(bookingForm.scheduledDate).map((slot) => (
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
                        Select date first
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
                  value={bookingForm.durationMinutes.toString()}
                  onValueChange={(value) => updateFormData('durationMinutes', parseInt(value))}
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
                placeholder="Add any special notes or pre-appointment instructions..."
                value={bookingForm.notes}
                onChange={(e) => updateFormData('notes', e.target.value)}
                rows={3}
              />
            </div>

            {/* Booking Summary */}
            {selectedPatient && bookingForm.appointmentType && bookingForm.scheduledDate && bookingForm.scheduledTime && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    Booking Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Patient:</span> {selectedPatient.first_name} {selectedPatient.last_name}</div>
                    <div><span className="font-medium">Type:</span> {bookingForm.appointmentType}</div>
                    <div className="flex items-center gap-4">
                      <span><span className="font-medium">Date:</span> {new Date(bookingForm.scheduledDate).toLocaleDateString()}</span>
                      <span><span className="font-medium">Time:</span> {bookingForm.scheduledTime}</span>
                      <span><span className="font-medium">Duration:</span> {bookingForm.durationMinutes} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Priority:</span>
                      <Badge variant={getUrgencyColor(bookingForm.urgency)} className="text-xs">
                        {bookingForm.urgency}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !bookingForm.patientId || !bookingForm.appointmentType || !bookingForm.scheduledDate || !bookingForm.scheduledTime}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}