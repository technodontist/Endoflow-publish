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

  // Get next appointment
  const nextAppointment = todaysAppointments.find(
    apt => apt.status === 'scheduled' && !isUpcoming(apt)
  ) || todaysAppointments.find(apt => isUpcoming(apt))

  // Calculate total duration
  const totalMinutes = todaysAppointments.reduce((sum, apt) => 
    sum + (apt.duration_minutes ?? apt.durationMinutes ?? 60), 0
  )

  return (
    <div className="space-y-6">
      {/* Enhanced Current Status Card */}
      <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-teal-900">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-teal-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {format(currentTime, 'h:mm a')} • {todaysAppointments.length} appointments • {totalMinutes} min total
              </p>
            </div>

            <div className="text-right">
              <div className="text-sm text-teal-600 mb-1">Progress</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-teal-900">
                  {completedCount}/{todaysAppointments.length}
                </div>
                <div className="text-sm text-teal-700">
                  ({todaysAppointments.length > 0 ? Math.round((completedCount / todaysAppointments.length) * 100) : 0}%)
                </div>
              </div>
            </div>
          </div>

          {currentAppointment && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-teal-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    🔴 Current Patient: {currentAppointment.patients?.first_name} {currentAppointment.patients?.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {currentAppointment.appointment_type} • Started {currentAppointment.scheduled_time?.slice(0, 5)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!currentAppointment && nextAppointment && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    ⏰ Next: {nextAppointment.patients?.first_name} {nextAppointment.patients?.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {nextAppointment.appointment_type} • {nextAppointment.scheduled_time?.slice(0, 5)}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleStatusUpdate(nextAppointment.id, 'in_progress')}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Start Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Layout: Schedule + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule - Expanded */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  Today's Schedule
                </div>
                <Badge variant="outline" className="text-xs">
                  {scheduledCount} remaining
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaysAppointments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No appointments scheduled for today</p>
                  <p className="text-sm mt-1">Enjoy your free day! 🌟</p>
                </div>
              ) : (
                todaysAppointments.map((appointment) => {
                  const isCurrent = isCurrentAppointment(appointment)
                  const isNext = isUpcoming(appointment)

                  return (
                    <div
                      key={appointment.id}
                      className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                        isCurrent ? 'border-green-400 bg-green-50 shadow-md ring-2 ring-green-200' :
                        isNext ? 'border-blue-300 bg-blue-50' :
                        appointment.status === 'completed' ? 'border-gray-300 bg-gray-50 opacity-75' :
                        'border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar className="w-11 h-11 border-2 border-white shadow-sm">
                            <AvatarFallback className={`text-white font-semibold ${
                              isCurrent ? 'bg-green-500' :
                              isNext ? 'bg-blue-500' :
                              'bg-teal-500'
                            }`}>
                              {appointment.patients?.first_name?.[0]}{appointment.patients?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900">
                                {appointment.patients?.first_name} {appointment.patients?.last_name}
                              </h4>
                              {isCurrent && (
                                <Badge className="text-xs bg-green-500 text-white border-0">
                                  🔴 In Session
                                </Badge>
                              )}
                              {isNext && (
                                <Badge className="text-xs bg-blue-500 text-white border-0">
                                  ⏰ Up Next
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-600">
                              <span className="flex items-center gap-1 font-medium">
                                <Clock className="w-3.5 h-3.5 text-teal-600" />
                                {appointment.scheduled_time?.slice(0, 5)}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span>{appointment.duration_minutes ?? appointment.durationMinutes ?? 60} min</span>
                            </div>

                            <div className="mt-1.5">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                {appointment.appointment_type ?? appointment.appointmentType}
                              </span>
                            </div>

                            {appointment.notes && (
                              <div className="mt-2 text-xs text-gray-700 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
                                <span className="font-medium">📝 Note: </span>{appointment.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 ml-3">
                          <Badge className={`${getStatusColor(appointment.status)} border`}>
                            {getStatusIcon(appointment.status)}
                            <span className="ml-1 text-xs font-medium">{getStatusLabel(appointment.status)}</span>
                          </Badge>

                          <div className="flex gap-1.5">
                            {appointment.status === 'scheduled' && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 shadow-sm"
                                  onClick={() => handleStatusUpdate(appointment.id, 'in_progress')}
                                >
                                  <Play className="w-3.5 h-3.5 mr-1" />
                                  Start
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                  onClick={() => handleNoShow(appointment.id)}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  No Show
                                </Button>
                              </>
                            )}

                            {appointment.status === 'in_progress' && (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 shadow-sm"
                                onClick={() => handleStatusUpdate(appointment.id, 'completed')}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
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
        </div>

        {/* Smart Sidebar */}
        <div className="space-y-6">
          {/* Contextual Quick Actions */}
          <Card className="border-teal-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-5 h-5 text-teal-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextAppointment && (
                <Button 
                  className="w-full justify-start bg-green-600 hover:bg-green-700 text-white shadow-sm"
                  onClick={() => handleStatusUpdate(nextAppointment.id, 'in_progress')}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Next Appointment
                </Button>
              )}
              <Button className="w-full justify-start" variant="outline" onClick={() => window.location.href = '/dentist?tab=patients'}>
                <User className="w-4 h-4 mr-2" />
                Patient Records
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => window.location.href = '/dentist?tab=organizer'}>
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Appointment
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <AlertCircle className="w-4 h-4 mr-2" />
                Emergency Walk-in
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => window.location.href = '/dentist?tab=messages'}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Reminders
              </Button>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-5 h-5 text-blue-600" />
                Today's Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Progress Ring */}
                <div className="flex items-center justify-center py-4">
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-gray-200"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * (1 - (todaysAppointments.length > 0 ? completedCount / todaysAppointments.length : 0))}`}
                        className="text-teal-600 transition-all duration-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">
                          {todaysAppointments.length > 0 ? Math.round((completedCount / todaysAppointments.length) * 100) : 0}%
                        </div>
                        <div className="text-xs text-gray-500">Complete</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Completed
                    </span>
                    <span className="font-semibold text-green-600">{completedCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5">
                      <Play className="w-4 h-4 text-blue-600" />
                      In Progress
                    </span>
                    <span className="font-semibold text-blue-600">{inProgressCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-600" />
                      Remaining
                    </span>
                    <span className="font-semibold text-gray-700">{scheduledCount}</span>
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
