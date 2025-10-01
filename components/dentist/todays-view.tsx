'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  CheckCircle,
  Play,
  Square,
  XCircle,
  MessageCircle,
  FileText,
  Activity
} from "lucide-react"
import {
  getDentistAppointmentsAction,
  updateDentistAppointmentStatus,
  markPatientNoShow
} from "@/lib/actions/dentist"
import { format, parseISO } from 'date-fns'

interface Appointment {
  id: string
  patientId?: string
  patient_id?: string
  scheduledDate?: string
  scheduledTime?: string
  scheduled_date?: string
  scheduled_time?: string
  durationMinutes?: number
  duration_minutes?: number
  appointmentType?: string
  appointment_type?: string
  status: string
  notes?: string
  patients?: {
    firstName?: string
    lastName?: string
  }
}

interface TodaysViewProps {
  dentistId: string
  onRefreshStats: () => void
}

export function DentistTodaysView({ dentistId, onRefreshStats }: TodaysViewProps) {
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    loadTodaysAppointments()

    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  const loadTodaysAppointments = async () => {
    setIsLoading(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const result = await getDentistAppointmentsAction(today, today)

      if (result.success && result.data) {
        // Sort by time (null-safe; supports both camelCase and snake_case)
        const sorted = result.data.sort((a: any, b: any) => {
          const at = (a.scheduled_time || a.scheduledTime || '') as string
          const bt = (b.scheduled_time || b.scheduledTime || '') as string
          return at.localeCompare(bt)
        }) as Appointment[]
        setTodaysAppointments(sorted)
      }
    } catch (error) {
      console.error('Error loading today\'s appointments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusUpdate = async (appointmentId: string, newStatus: string, notes?: string) => {
    try {
      const result = await updateDentistAppointmentStatus(appointmentId, newStatus, notes)
      if (result.success) {
        await loadTodaysAppointments()
        onRefreshStats()
      }
    } catch (error) {
      console.error('Error updating appointment status:', error)
    }
  }

  const handleNoShow = async (appointmentId: string) => {
    try {
      const result = await markPatientNoShow(appointmentId)
      if (result.success) {
        await loadTodaysAppointments()
        onRefreshStats()
      }
    } catch (error) {
      console.error('Error marking no-show:', error)
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
      case 'in_progress': return <Play className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      case 'no_show': return <AlertCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Scheduled'
      case 'in_progress': return 'In Progress'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      case 'no_show': return 'No Show'
      default: return status
    }
  }

  const isCurrentAppointment = (appointment: Appointment) => {
    const now = currentTime
    const st = (appointment.scheduled_time || appointment.scheduledTime || '00:00') as string
    const [hours, minutes] = st.split(':').map(Number)
    const appointmentTime = new Date()
    appointmentTime.setHours(hours || 0, minutes || 0, 0, 0)

    const dur = (appointment.duration_minutes ?? appointment.durationMinutes ?? 60) as number
    const endTime = new Date(appointmentTime.getTime() + dur * 60000)

    return now >= appointmentTime && now <= endTime && appointment.status === 'in_progress'
  }

  const isUpcoming = (appointment: Appointment) => {
    const now = currentTime
    const st = (appointment.scheduled_time || appointment.scheduledTime || '00:00') as string
    const [hours, minutes] = st.split(':').map(Number)
    const appointmentTime = new Date()
    appointmentTime.setHours(hours || 0, minutes || 0, 0, 0)

    const timeDiff = appointmentTime.getTime() - now.getTime()
    return timeDiff > 0 && timeDiff <= 30 * 60 * 1000 // Within 30 minutes
  }

  const completedCount = todaysAppointments.filter(apt => apt.status === 'completed').length
  const scheduledCount = todaysAppointments.filter(apt => apt.status === 'scheduled').length
  const inProgressCount = todaysAppointments.filter(apt => apt.status === 'in_progress').length
  const currentAppointment = todaysAppointments.find(isCurrentAppointment)


  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-teal-900">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-teal-600">
                {format(currentTime, 'h:mm a')} • {todaysAppointments.length} appointments today
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-900">{completedCount}</div>
                <div className="text-sm text-teal-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{inProgressCount}</div>
                <div className="text-sm text-green-600">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-700">{scheduledCount}</div>
                <div className="text-sm text-gray-600">Scheduled</div>
              </div>
            </div>
          </div>

          {currentAppointment && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-teal-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <div className="font-medium">
                    Current Patient: {currentAppointment.patients?.first_name} {currentAppointment.patients?.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {currentAppointment.appointment_type} • Started {currentAppointment.scheduled_time.slice(0, 5)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointments List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduled Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaysAppointments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No appointments scheduled for today</p>
                <p className="text-sm">Enjoy your free day!</p>
              </div>
            ) : (
              todaysAppointments.map((appointment) => {
                const isCurrent = isCurrentAppointment(appointment)
                const isNext = isUpcoming(appointment)

                return (
                  <div
                    key={appointment.id}
                    className={`p-4 border rounded-lg transition-all ${
                      isCurrent ? 'border-green-300 bg-green-50 shadow-md' :
                      isNext ? 'border-teal-300 bg-teal-50' :
                      'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-teal-100 text-teal-600">
                            {appointment.patients?.first_name?.[0]}{appointment.patients?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">
                              {appointment.patients?.first_name} {appointment.patients?.last_name}
                            </h4>
                            {isCurrent && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                Current
                              </Badge>
                            )}
                            {isNext && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                Next
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
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

                          {appointment.notes && (
                            <div className="mt-2 text-xs text-gray-600 p-2 bg-gray-50 rounded">
                              {appointment.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(appointment.status)}>
                          {getStatusIcon(appointment.status)}
                          <span className="ml-1">{getStatusLabel(appointment.status)}</span>
                        </Badge>

                        <div className="flex gap-1">
                          {appointment.status === 'scheduled' && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() => handleStatusUpdate(appointment.id, 'in_progress')}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Start
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleNoShow(appointment.id)}
                              >
                                No Show
                              </Button>
                            </>
                          )}

                          {appointment.status === 'in_progress' && (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                              onClick={() => handleStatusUpdate(appointment.id, 'completed')}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Insights */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <User className="w-4 h-4 mr-2" />
                View Patient Queue
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule New Appointment
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Access Patient Records
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Message to Staff
              </Button>
            </CardContent>
          </Card>

          {/* Daily Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Daily Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Appointments</span>
                  <span className="font-medium">{todaysAppointments.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="font-medium text-green-600">{completedCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="font-medium text-blue-600">{inProgressCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Remaining</span>
                  <span className="font-medium text-gray-600">{scheduledCount}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Completion Rate</span>
                    <span className="font-bold text-blue-600">
                      {todaysAppointments.length > 0
                        ? Math.round((completedCount / todaysAppointments.length) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}