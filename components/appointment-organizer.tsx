'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, Plus, User, CheckCircle, X, AlertCircle } from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { scheduleAppointmentDirectAction, getAppointmentsForWeekAction, type DirectScheduleAppointmentData } from '@/lib/actions/appointments'
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
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

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string
  medical_history_summary?: string
  created_at: string
}

interface Dentist {
  id: string
  full_name: string
  specialty?: string
}

interface Appointment {
  id: string
  patient_id: string
  dentist_id: string
  scheduled_date: string
  scheduled_time: string
  appointment_type: string
  status: string
  notes?: string
  duration_minutes: number
}

interface AppointmentOrganizerProps {
  selectedPatient: Patient | null
  onAppointmentScheduled?: () => void
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
]

const APPOINTMENT_TYPES = [
  'Consultation',
  'Routine Cleaning',
  'Root Canal',
  'Crown Preparation',
  'Filling',
  'Extraction',
  'Emergency',
  'Follow-up',
  'Preventive Care'
]

export function AppointmentOrganizer({ selectedPatient, onAppointmentScheduled }: AppointmentOrganizerProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [weekDays, setWeekDays] = useState<Date[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([])
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  const [selectedDentist, setSelectedDentist] = useState<string>('')
  const [appointmentType, setAppointmentType] = useState<string>('')
  const [duration, setDuration] = useState<number>(60)
  const [notes, setNotes] = useState<string>('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)

  // Calculate week days
  useEffect(() => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 }) // Monday start
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    setWeekDays(days)
  }, [currentWeek])

  // Load dentists
  useEffect(() => {
    async function loadDentists() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .schema('api')
          .from('dentists')
          .select('*')
          .order('full_name')

        if (error) {
          console.error('Error loading dentists:', error)
          return
        }

        setDentists(data || [])
      } catch (error) {
        console.error('Error loading dentists:', error)
      }
    }

    loadDentists()
  }, [])

  // Load existing appointments for the current week
  useEffect(() => {
    async function loadAppointments() {
      if (weekDays.length === 0) return

      try {
        setIsLoading(true)
        const startDate = format(weekDays[0], 'yyyy-MM-dd')
        const endDate = format(weekDays[6], 'yyyy-MM-dd')

        const result = await getAppointmentsForWeekAction(startDate, endDate)

        if (result.success) {
          setExistingAppointments(result.data)
        } else {
          console.error('Error loading appointments:', result.error)
        }
      } catch (error) {
        console.error('Error loading appointments:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAppointments()
  }, [weekDays])

  const isSlotBooked = (date: string, time: string, dentistId?: string) => {
    return existingAppointments.some(apt =>
      apt.scheduled_date === date &&
      apt.scheduled_time === time.substring(0, 5) && // Convert HH:MM format
      (!dentistId || apt.dentist_id === dentistId)
    )
  }

  const isSlotSelected = (date: string, time: string) => {
    return selectedSlot?.date === date && selectedSlot?.time === time
  }

  const handleSlotClick = (date: string, time: string) => {
    if (!selectedDentist) {
      alert('Please select a dentist first')
      return
    }

    if (isSlotBooked(date, time, selectedDentist)) {
      return // Can't select booked slots
    }

    setSelectedSlot({ date, time })
  }

  const handleScheduleAppointment = () => {
    if (!selectedPatient || !selectedSlot || !selectedDentist || !appointmentType) {
      alert('Please fill in all required fields')
      return
    }
    setShowConfirmDialog(true)
  }

  const handleConfirmSchedule = async () => {
    if (!selectedPatient || !selectedSlot || !selectedDentist || !appointmentType) return

    try {
      setIsScheduling(true)

      const appointmentData: DirectScheduleAppointmentData = {
        patient_id: selectedPatient.id,
        dentist_id: selectedDentist,
        scheduled_date: selectedSlot.date,
        scheduled_time: selectedSlot.time,
        appointment_type: appointmentType,
        duration_minutes: duration,
        status: 'scheduled',
        notes: notes || undefined
      }

      const result = await scheduleAppointmentDirectAction(appointmentData)

      if (!result.success) {
        alert(result.error || 'Failed to schedule appointment. Please try again.')
        return
      }

      // Refresh appointments
      const startDate = format(weekDays[0], 'yyyy-MM-dd')
      const endDate = format(weekDays[6], 'yyyy-MM-dd')
      const refreshResult = await getAppointmentsForWeekAction(startDate, endDate)

      if (refreshResult.success) {
        setExistingAppointments(refreshResult.data)
      }

      // Reset form
      setSelectedSlot(null)
      setSelectedDentist('')
      setAppointmentType('')
      setDuration(60)
      setNotes('')
      setShowConfirmDialog(false)

      // Notify parent component
      onAppointmentScheduled?.()

      alert('Appointment scheduled successfully!')
    } catch (error) {
      console.error('Error scheduling appointment:', error)
      alert('Failed to schedule appointment. Please try again.')
    } finally {
      setIsScheduling(false)
    }
  }

  const getSlotStatus = (date: string, time: string) => {
    if (!selectedDentist) return 'disabled'
    if (isSlotBooked(date, time, selectedDentist)) return 'booked'
    if (isSlotSelected(date, time)) return 'selected'
    return 'available'
  }

  const getSlotClassName = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-50 hover:bg-green-100 text-green-800 border-green-200 cursor-pointer'
      case 'selected':
        return 'bg-teal-500 text-white border-teal-500 cursor-pointer'
      case 'booked':
        return 'bg-red-50 text-red-800 border-red-200 cursor-not-allowed'
      case 'disabled':
        return 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
      default:
        return 'bg-gray-50 text-gray-400 border-gray-200'
    }
  }

  if (!selectedPatient) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Patient Selected</p>
            <p className="text-sm">Select a patient from the search panel to schedule an appointment</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Appointment
          </CardTitle>
          <CardDescription>
            Scheduling for: <span className="font-medium text-teal-600">
              {selectedPatient.first_name} {selectedPatient.last_name}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Appointment Details Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dentist">Dentist *</Label>
              <Select value={selectedDentist} onValueChange={setSelectedDentist}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dentist" />
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

            <div className="space-y-2">
              <Label htmlFor="type">Appointment Type *</Label>
              <Select value={appointmentType} onValueChange={setAppointmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                min="15"
                max="180"
                step="15"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional appointment notes..."
                className="resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              size="sm"
            >
              Previous Week
            </Button>
            <h3 className="font-medium">
              {format(weekDays[0] || new Date(), 'MMM d')} - {format(weekDays[6] || new Date(), 'MMM d, yyyy')}
            </h3>
            <Button
              variant="outline"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              size="sm"
            >
              Next Week
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="border rounded-lg overflow-auto">
            <div className="grid grid-cols-8 min-w-[800px]">
              {/* Header */}
              <div className="p-3 border-b font-medium">Time</div>
              {weekDays.map((day) => (
                <div key={day.toString()} className="p-3 border-b border-l font-medium text-center">
                  <div>{format(day, 'EEE')}</div>
                  <div className="text-sm text-muted-foreground">{format(day, 'MMM d')}</div>
                </div>
              ))}

              {/* Time Slots */}
              {TIME_SLOTS.map((time) => (
                <div key={time} className="contents">
                  <div className="p-3 border-b border-r text-sm font-medium bg-muted/50">
                    {time}
                  </div>
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const status = getSlotStatus(dateStr, time)

                    return (
                      <div
                        key={`${dateStr}-${time}`}
                        className={`p-2 h-12 border-b border-l transition-all ${getSlotClassName(status)}`}
                        onClick={() => status === 'available' && handleSlotClick(dateStr, time)}
                      >
                        <div className="text-xs text-center">
                          {status === 'available' && <span>Available</span>}
                          {status === 'selected' && <CheckCircle className="h-4 w-4 mx-auto" />}
                          {status === 'booked' && <X className="h-4 w-4 mx-auto" />}
                          {status === 'disabled' && <span>-</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Selected Slot Info */}
          {selectedSlot && (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex items-center gap-2 text-teal-800">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">
                  Selected: {format(new Date(selectedSlot.date), 'EEEE, MMMM d, yyyy')} at {selectedSlot.time}
                </span>
              </div>
            </div>
          )}

          {/* Schedule Button */}
          <Button
            onClick={handleScheduleAppointment}
            disabled={!selectedSlot || !selectedDentist || !appointmentType || isLoading}
            className="w-full bg-teal-600 hover:bg-teal-700"
            size="lg"
          >
            {!selectedDentist ? 'Select Dentist First' :
             !appointmentType ? 'Select Appointment Type' :
             !selectedSlot ? 'Select Time Slot' :
             'Schedule Appointment'}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Appointment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Please confirm the appointment details:</p>
                <div className="bg-muted p-3 rounded text-sm space-y-1">
                  <div><strong>Patient:</strong> {selectedPatient.first_name} {selectedPatient.last_name}</div>
                  <div><strong>Dentist:</strong> {dentists.find(d => d.id === selectedDentist)?.full_name}</div>
                  <div><strong>Date:</strong> {selectedSlot && format(new Date(selectedSlot.date), 'EEEE, MMMM d, yyyy')}</div>
                  <div><strong>Time:</strong> {selectedSlot?.time}</div>
                  <div><strong>Type:</strong> {appointmentType}</div>
                  <div><strong>Duration:</strong> {duration} minutes</div>
                  {notes && <div><strong>Notes:</strong> {notes}</div>}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isScheduling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSchedule}
              disabled={isScheduling}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isScheduling ? 'Scheduling...' : 'Confirm Appointment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}