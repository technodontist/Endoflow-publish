'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Users,
  Search,
  Clock,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Activity,
  MoreVertical,
  Eye,
  MessageSquare
} from "lucide-react"
import {
  getDentistAppointmentsAction,
  updateDentistAppointmentStatus
} from "@/lib/actions/dentist"
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns'

interface Appointment {
  id: string
  patientId: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes: number
  appointmentType: string
  status: string
  notes?: string | null
  patients?: {
    firstName: string
    lastName: string
  }
}

interface PatientQueueProps {
  dentistId: string
  onRefreshStats: () => void
  onSelectPatient?: (patient: any) => void
}

export function DentistPatientQueue({ dentistId, onRefreshStats, onSelectPatient }: PatientQueueProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Appointment | null>(null)
  const [queueView, setQueueView] = useState<'today' | 'week' | 'all'>('today')

  useEffect(() => {
    loadAppointments()
  }, [queueView])

  useEffect(() => {
    filterAppointments()
  }, [appointments, searchTerm])

  const loadAppointments = async () => {
    setIsLoading(true)
    try {
      let startDate: string
      let endDate: string

      const today = new Date()

      if (queueView === 'today') {
        startDate = format(today, 'yyyy-MM-dd')
        endDate = startDate
      } else if (queueView === 'week') {
        startDate = format(today, 'yyyy-MM-dd')
        const weekEnd = new Date(today)
        weekEnd.setDate(weekEnd.getDate() + 7)
        endDate = format(weekEnd, 'yyyy-MM-dd')
      } else {
        // All future appointments
        startDate = format(today, 'yyyy-MM-dd')
        const future = new Date(today)
        future.setMonth(future.getMonth() + 3)
        endDate = format(future, 'yyyy-MM-dd')
      }

      const result = await getDentistAppointmentsAction(startDate, endDate)
      if (result.success && result.data) {
        // Sort by date and time
        const sorted = result.data.sort((a, b) => {
          const dateCompare = a.scheduledDate.localeCompare(b.scheduledDate)
          if (dateCompare === 0) {
            return a.scheduledTime.localeCompare(b.scheduledTime)
          }
          return dateCompare
        })
        setAppointments(sorted)
      }
    } catch (error) {
      console.error('Error loading appointments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterAppointments = () => {
    let filtered = appointments

    if (searchTerm) {
      filtered = filtered.filter(apt =>
        apt.patients?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.patients?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.appointmentType.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredAppointments(filtered)
  }

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      const result = await updateDentistAppointmentStatus(appointmentId, newStatus)
      if (result.success) {
        await loadAppointments()
        onRefreshStats()
      }
    } catch (error) {
      console.error('Error updating appointment status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-teal-100 text-teal-800 border-teal-200'
      case 'in_progress': return 'bg-green-100 text-green-800 border-green-200'
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      case 'no_show': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />
      case 'in_progress': return <Activity className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <AlertCircle className="w-4 h-4" />
      case 'no_show': return <AlertCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getDateStatus = (date: string) => {
    const appointmentDate = parseISO(date)
    if (isToday(appointmentDate)) return 'Today'
    if (isPast(appointmentDate)) return 'Past'
    if (isFuture(appointmentDate)) return 'Upcoming'
    return ''
  }

  const getDateColor = (date: string) => {
    const appointmentDate = parseISO(date)
    if (isToday(appointmentDate)) return 'text-teal-600 font-medium'
    if (isPast(appointmentDate)) return 'text-gray-500'
    return 'text-gray-700'
  }

  const todayCount = appointments.filter(apt => isToday(parseISO(apt.scheduled_date))).length
  const upcomingCount = appointments.filter(apt =>
    isFuture(parseISO(apt.scheduled_date)) && !isToday(parseISO(apt.scheduled_date))
  ).length
  const inProgressCount = appointments.filter(apt => apt.status === 'in_progress').length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Queue Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Patient Queue Management
          </CardTitle>
          <p className="text-sm text-gray-600">
            Real-time patient queue with status tracking
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-teal-700">Today's Patients</p>
                  <p className="text-xl font-bold text-teal-900">{todayCount}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-700">In Progress</p>
                  <p className="text-xl font-bold text-green-900">{inProgressCount}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-700">Upcoming</p>
                  <p className="text-xl font-bold text-gray-900">{upcomingCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={queueView === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQueueView('today')}
              >
                Today
              </Button>
              <Button
                variant={queueView === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQueueView('week')}
              >
                This Week
              </Button>
              <Button
                variant={queueView === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQueueView('all')}
              >
                All
              </Button>
            </div>
          </div>

          {/* Patient Queue List */}
          <div className="space-y-4">
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No patients in queue</p>
                <p className="text-sm">All appointments are up to date</p>
              </div>
            ) : (
              filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer hover:border-blue-300"
                  onClick={() => {
                    if (onSelectPatient && appointment.patients) {
                      // Transform appointment data to patient format expected by ClinicalCockpit
                      const patientData = {
                        id: appointment.patient_id,
                        firstName: appointment.patients.first_name,
                        lastName: appointment.patients.last_name,
                        uhid: appointment.patient_id.slice(-8).toUpperCase(),
                        email: `${appointment.patients.first_name?.toLowerCase()}.${appointment.patients.last_name?.toLowerCase()}@example.com`,
                        phone: '+1-555-0123',
                        dateOfBirth: '1985-06-15',
                        lastVisit: appointment.scheduled_date,
                        status: 'active' as const,
                        emergencyContact: 'Emergency Contact',
                        medicalConditions: ['Hypertension'],
                        allergies: ['Penicillin'],
                        address: '123 Main St, City, State 12345',
                        bloodGroup: 'O+',
                        emergencyContactPhone: '+1-555-0456'
                      }
                      onSelectPatient(patientData)
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {appointment.patients?.first_name?.[0]}
                          {appointment.patients?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <h4 className="font-medium text-lg">
                          {appointment.patients?.first_name} {appointment.patients?.last_name}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className={getDateColor(appointment.scheduled_date)}>
                              {format(parseISO(appointment.scheduled_date), 'MMM d, yyyy')}
                              {isToday(parseISO(appointment.scheduled_date)) && (
                                <span className="ml-1 text-blue-600 font-medium">(Today)</span>
                              )}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {appointment.scheduled_time.slice(0, 5)}
                          </span>
                          <span>
                            {appointment.duration_minutes} min
                          </span>
                        </div>
                        <div className="mt-1">
                          <span className="text-sm font-medium text-gray-700">
                            {appointment.appointment_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(appointment.status)}>
                        {getStatusIcon(appointment.status)}
                        <span className="ml-1">{appointment.status.replace('_', ' ')}</span>
                      </Badge>

                      <div className="flex gap-1">
                        {appointment.status === 'scheduled' && isToday(parseISO(appointment.scheduled_date)) && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleStatusUpdate(appointment.id, 'in_progress')}
                          >
                            Start
                          </Button>
                        )}

                        {appointment.status === 'in_progress' && (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleStatusUpdate(appointment.id, 'completed')}
                          >
                            Complete
                          </Button>
                        )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPatient(appointment)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-600" />
                                Patient Details
                              </DialogTitle>
                            </DialogHeader>

                            {selectedPatient && (
                              <div className="space-y-4">
                                <div className="text-center">
                                  <Avatar className="w-16 h-16 mx-auto mb-2">
                                    <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                                      {selectedPatient.patients?.first_name?.[0]}
                                      {selectedPatient.patients?.last_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <h3 className="text-lg font-semibold">
                                    {selectedPatient.patients?.first_name} {selectedPatient.patients?.last_name}
                                  </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-500">Date</p>
                                    <p className="font-medium">
                                      {format(parseISO(selectedPatient.scheduled_date), 'MMM d, yyyy')}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Time</p>
                                    <p className="font-medium">{selectedPatient.scheduled_time.slice(0, 5)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Duration</p>
                                    <p className="font-medium">{selectedPatient.duration_minutes} min</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Status</p>
                                    <Badge className={getStatusColor(selectedPatient.status)}>
                                      {selectedPatient.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-gray-500 text-sm">Appointment Type</p>
                                  <p className="font-medium">{selectedPatient.appointment_type}</p>
                                </div>

                                {selectedPatient.notes && (
                                  <div>
                                    <p className="text-gray-500 text-sm">Notes</p>
                                    <p className="text-sm">{selectedPatient.notes}</p>
                                  </div>
                                )}

                                <div className="flex gap-2 pt-4">
                                  <Button size="sm" variant="outline" className="flex-1">
                                    <FileText className="w-4 h-4 mr-2" />
                                    View Records
                                  </Button>
                                  <Button size="sm" variant="outline" className="flex-1">
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Send Message
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>

                  {appointment.notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <span className="font-medium">Notes: </span>
                      {appointment.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}