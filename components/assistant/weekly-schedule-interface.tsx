'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  Clock,
  User,
  Search,
  CheckCircle,
  AlertTriangle,
  Loader2,
  UserPlus,
  CalendarDays,
  Settings
} from "lucide-react"
import {
  confirmAppointmentRequestAction,
  createAppointmentRequestAction,
  getAvailableDentistsAction,
  getActivePatientsAction
} from "@/lib/actions/appointments"
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'

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
  priority?: 'high' | 'medium' | 'low'
  uhid?: string
  treatment_type?: string
  requested_date?: string
}

interface Dentist {
  id: string
  fullName: string
  specialty: string | null
  createdAt: Date
}

interface TimeSlot {
  time: string
  status: 'available' | 'booked'
  patient?: Patient
  appointmentId?: string
}

interface WeeklyScheduleInterfaceProps {
  initialPatientRequests?: Patient[]
  currentAssistantId: string
}

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM"
]

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
]

export function WeeklyScheduleInterface({
  initialPatientRequests = [],
  currentAssistantId
}: WeeklyScheduleInterfaceProps) {
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [selectedDentist, setSelectedDentist] = useState<string>('dr-nisarg')
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [patientRequests, setPatientRequests] = useState<Patient[]>(initialPatientRequests)
  const [schedule, setSchedule] = useState<{[key: string]: {[key: string]: TimeSlot}}>({})
  const [draggedPatient, setDraggedPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  // Load initial data
  useEffect(() => {
    loadDentists()
    loadPatientRequests()
    initializeSchedule()
  }, [])

  useEffect(() => {
    initializeSchedule()
  }, [selectedWeek, selectedDentist])

  const loadDentists = async () => {
    try {
      const result = await getAvailableDentistsAction()
      if (result.success && result.data) {
        setDentists(result.data)
        // Auto-select Dr. Nisarg if available
        const drNisarg = result.data.find(d =>
          d.fullName.toLowerCase().includes('nisarg') ||
          d.id === 'dr-nisarg'
        )
        if (drNisarg) {
          setSelectedDentist(drNisarg.id)
        }
      }
    } catch (error) {
      console.error('Error loading dentists:', error)
    }
  }

  const loadPatientRequests = async () => {
    try {
      const result = await getActivePatientsAction()
      if (result.success && result.data) {
        // Transform patients to include mock priority data
        const transformedPatients = result.data.map(patient => ({
          ...patient,
          priority: (Math.random() > 0.6 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
          treatment_type: ['Root Canal Follow-up', 'Crown Preparation', 'Routine Cleaning', 'Dental Examination'][Math.floor(Math.random() * 4)],
          requested_date: format(addDays(new Date(), Math.floor(Math.random() * 7)), 'yyyy-MM-dd')
        }))
        setPatientRequests(transformedPatients)
      }
    } catch (error) {
      console.error('Error loading patient requests:', error)
    }
  }

  const initializeSchedule = () => {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }) // Monday start
    const newSchedule: {[key: string]: {[key: string]: TimeSlot}} = {}

    DAYS_OF_WEEK.forEach((day, dayIndex) => {
      const currentDate = addDays(weekStart, dayIndex)
      const dateKey = format(currentDate, 'yyyy-MM-dd')
      newSchedule[dateKey] = {}

      TIME_SLOTS.forEach(time => {
        // Mock some booked slots for demonstration
        const isBooked = Math.random() > 0.8
        newSchedule[dateKey][time] = {
          time,
          status: isBooked ? 'booked' : 'available',
          ...(isBooked && {
            patient: {
              id: 'mock-' + Math.random(),
              firstName: ['John', 'Jane', 'Bob', 'Alice'][Math.floor(Math.random() * 4)],
              lastName: ['Smith', 'Doe', 'Johnson', 'Wilson'][Math.floor(Math.random() * 4)],
              createdAt: new Date(),
              phone: null,
              email: null,
              dateOfBirth: null,
              medicalHistorySummary: null,
              emergencyContactName: null,
              emergencyContactPhone: null
            } as Patient,
            appointmentId: 'apt-' + Math.random()
          })
        }
      })
    })

    setSchedule(newSchedule)
  }

  const handleDragStart = (patient: Patient) => {
    setDraggedPatient(patient)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, dateKey: string, timeSlot: string) => {
    e.preventDefault()

    if (!draggedPatient || !selectedDentist) return

    setIsLoading(true)
    setSubmitResult(null)

    try {
      // Create appointment request
      const formData = new FormData()
      formData.append('chiefComplaint', draggedPatient.treatment_type || 'Scheduled Appointment')
      formData.append('painLevel', '0')
      formData.append('urgency', draggedPatient.priority || 'routine')
      formData.append('preferredDate', dateKey)
      formData.append('preferredTime', timeSlot)
      formData.append('additionalNotes', `Scheduled by assistant via weekly calendar`)

      const requestResult = await createAppointmentRequestAction(draggedPatient.id, formData)

      if (!requestResult.success || !requestResult.data) {
        throw new Error(requestResult.error || 'Failed to create appointment request')
      }

      // Immediately confirm the appointment
      const confirmResult = await confirmAppointmentRequestAction(
        requestResult.data.id,
        {
          dentistId: selectedDentist,
          assistantId: currentAssistantId,
          scheduledDate: dateKey,
          scheduledTime: timeSlot,
          durationMinutes: 60,
          notes: `Scheduled appointment via weekly calendar`
        },
        currentAssistantId
      )

      if (confirmResult.success) {
        // Update the schedule
        setSchedule(prev => ({
          ...prev,
          [dateKey]: {
            ...prev[dateKey],
            [timeSlot]: {
              time: timeSlot,
              status: 'booked',
              patient: draggedPatient,
              appointmentId: requestResult.data?.id || 'unknown'
            }
          }
        }))

        // Remove patient from requests
        setPatientRequests(prev => prev.filter(p => p.id !== draggedPatient.id))

        setSubmitResult({
          success: true,
          message: `Appointment scheduled for ${draggedPatient.firstName} ${draggedPatient.lastName}`
        })

        setTimeout(() => setSubmitResult(null), 3000)
      } else {
        throw new Error(confirmResult.error || 'Failed to confirm appointment')
      }
    } catch (error) {
      console.error('Error scheduling appointment:', error)
      setSubmitResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule appointment'
      })
      setTimeout(() => setSubmitResult(null), 5000)
    } finally {
      setIsLoading(false)
      setDraggedPatient(null)
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      default: return 'bg-green-500'
    }
  }

  const getPriorityTextColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 border-red-200'
      case 'medium': return 'text-yellow-600 border-yellow-200'
      default: return 'text-green-600 border-green-200'
    }
  }

  const getWeekDates = () => {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })
    return DAYS_OF_WEEK.map((day, index) => {
      const date = addDays(weekStart, index)
      return {
        day,
        date,
        dateKey: format(date, 'yyyy-MM-dd'),
        isToday: isSameDay(date, new Date())
      }
    })
  }

  const selectedDentistInfo = dentists.find(d => d.id === selectedDentist)

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Weekly Schedule</h2>
          <p className="text-gray-600">
            Scheduling for: {selectedDentistInfo?.fullName || 'Select Dentist'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedDentist} onValueChange={setSelectedDentist}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Dentist" />
            </SelectTrigger>
            <SelectContent>
              {dentists.map((dentist) => (
                <SelectItem key={dentist.id} value={dentist.id}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <div>
                      <div className="font-medium">{dentist.fullName}</div>
                      {dentist.specialty && (
                        <div className="text-xs text-gray-500">{dentist.specialty}</div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => setSelectedWeek(prev => addDays(prev, -7))}
          >
            Previous Week
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedWeek(new Date())}
          >
            This Week
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedWeek(prev => addDays(prev, 7))}
          >
            Next Week
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
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

      <div className="flex gap-6">
        {/* Left Sidebar: Patients Requiring Scheduling */}
        <Card className="w-80 h-fit">
          <CardHeader className="bg-teal-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patients Requiring Scheduling
              {patientRequests.length > 0 && (
                <Badge className="bg-red-500 text-white ml-2">
                  {patientRequests.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            {patientRequests.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No patients requiring scheduling</p>
              </div>
            ) : (
              <div className="space-y-0">
                {patientRequests.map((patient) => (
                  <div
                    key={patient.id}
                    draggable
                    onDragStart={() => handleDragStart(patient)}
                    className="p-4 border-b hover:bg-gray-50 cursor-move transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {patient.uhid || `UH${patient.id.slice(-6)}`}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {patient.treatment_type}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              Requested: {patient.requested_date ? format(new Date(patient.requested_date), 'MMM d') : 'ASAP'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={`text-xs ${getPriorityTextColor(patient.priority)}`}>
                          {patient.priority}
                        </Badge>
                        <div className={`h-2 w-2 rounded-full ${getPriorityColor(patient.priority)}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Weekly Calendar Grid */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-teal-600" />
                Week of {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[1200px]">
                  {/* Header Row */}
                  <div className="grid grid-cols-8 border-b bg-gray-50">
                    <div className="p-3 text-sm font-medium text-gray-700 border-r">Time</div>
                    {getWeekDates().map(({ day, date, isToday }) => (
                      <div key={day} className={`p-3 text-center border-r last:border-r-0 ${isToday ? 'bg-teal-50' : ''}`}>
                        <div className={`text-sm font-medium ${isToday ? 'text-teal-600' : 'text-gray-700'}`}>
                          {day}
                        </div>
                        <div className={`text-xs ${isToday ? 'text-teal-500' : 'text-gray-500'}`}>
                          {format(date, 'MMM d')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Time Slots */}
                  {TIME_SLOTS.map((timeSlot) => (
                    <div key={timeSlot} className="grid grid-cols-8 border-b hover:bg-gray-50/50">
                      <div className="p-3 text-sm font-medium text-gray-600 border-r bg-gray-50/50">
                        {timeSlot}
                      </div>
                      {getWeekDates().map(({ dateKey, isToday }) => (
                        <div
                          key={`${dateKey}-${timeSlot}`}
                          className={`relative border-r last:border-r-0 min-h-[60px] ${isToday ? 'bg-teal-50/30' : ''}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, dateKey, timeSlot)}
                        >
                          {schedule[dateKey]?.[timeSlot]?.status === 'available' ? (
                            <div className="h-full flex items-center justify-center">
                              <div className="w-full h-full border-2 border-dashed border-gray-200 rounded m-1 flex items-center justify-center text-xs text-gray-400 hover:border-teal-300 hover:bg-teal-50 transition-colors">
                                Available
                              </div>
                            </div>
                          ) : schedule[dateKey]?.[timeSlot]?.status === 'booked' ? (
                            <div className="h-full p-1">
                              <div className="w-full h-full bg-teal-100 border border-teal-200 rounded p-2 text-xs">
                                <div className="font-medium text-teal-800">
                                  {schedule[dateKey][timeSlot].patient?.firstName}{' '}
                                  {schedule[dateKey][timeSlot].patient?.lastName}
                                </div>
                                <div className="text-teal-600 mt-1">
                                  <CheckCircle className="w-3 h-3 inline mr-1" />
                                  Booked
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Book Appointment Button */}
          <div className="mt-6 text-center">
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 text-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Booking Appointment...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5 mr-2" />
                  Book Appointment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}