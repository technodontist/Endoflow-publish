'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  CheckCircle,
  Play,
  XCircle,
  AlertTriangle,
  Bell,
  Activity,
  Stethoscope
} from "lucide-react"
import { format } from 'date-fns'

interface Appointment {
  id: string
  patient_id: string
  dentist_id: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  appointment_type: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
  patients?: {
    first_name: string
    last_name: string
  }
  dentists?: {
    full_name: string
  }
}

interface RealtimeAppointmentsProps {
  dentistId: string
  initialAppointments: Appointment[]
  onAppointmentUpdate?: (appointments: Appointment[]) => void
}

export function RealtimeAppointments({
  dentistId,
  initialAppointments,
  onAppointmentUpdate
}: RealtimeAppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<{[key: string]: {type: 'success' | 'info' | 'warning', message: string}}>({})

  useEffect(() => {
    const supabase = createClient()

    console.log('📡 [REALTIME DENTIST] Setting up appointments subscription for dentist:', dentistId)

    // Subscribe to appointments changes
    const appointmentsSubscription = supabase
      .channel('dentist-appointments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'appointments',
        filter: `dentist_id=eq.${dentistId}`
      }, (payload) => {
        console.log('📡 [REALTIME DENTIST] Appointment change received:', payload)

        const eventType = payload.eventType
        const newData = payload.new as Appointment
        const oldData = payload.old as Appointment

        setAppointments(prev => {
          let updated = [...prev]

          switch (eventType) {
            case 'INSERT':
              // Add new appointment (avoid duplicates)
              if (!updated.find(apt => apt.id === newData.id)) {
                updated.push(newData)
                console.log('✅ [REALTIME DENTIST] Added new appointment:', newData.id)

                // Show notification for new appointments
                setNotifications(prev => ({
                  ...prev,
                  [newData.id]: {
                    type: 'success',
                    message: `New appointment scheduled: ${newData.appointment_type}`
                  }
                }))

                // Auto-clear notification after 5 seconds
                setTimeout(() => {
                  setNotifications(prev => {
                    const newNotifications = { ...prev }
                    delete newNotifications[newData.id]
                    return newNotifications
                  })
                }, 5000)
              }
              break

            case 'UPDATE':
              // Update existing appointment
              const index = updated.findIndex(apt => apt.id === newData.id)
              if (index !== -1) {
                const oldAppointment = updated[index]
                updated[index] = newData
                console.log('✅ [REALTIME DENTIST] Updated appointment:', newData.id)

                // Show status change notification
                if (oldAppointment.status !== newData.status) {
                  const statusMessage = newData.status === 'confirmed' ? 'Appointment confirmed by assistant' :
                                       newData.status === 'in_progress' ? 'Treatment started' :
                                       newData.status === 'completed' ? 'Treatment completed' :
                                       newData.status === 'cancelled' ? 'Appointment cancelled' :
                                       'Appointment status updated'

                  setNotifications(prev => ({
                    ...prev,
                    [newData.id]: { type: 'info', message: statusMessage }
                  }))

                  setTimeout(() => {
                    setNotifications(prev => {
                      const newNotifications = { ...prev }
                      delete newNotifications[newData.id]
                      return newNotifications
                    })
                  }, 5000)
                }

                // Show patient arrival notification if relevant
                if (newData.status === 'scheduled' && !oldAppointment.status) {
                  setNotifications(prev => ({
                    ...prev,
                    [newData.id]: {
                      type: 'info',
                      message: `Patient ${newData.patients?.first_name || 'Unknown'} appointment confirmed`
                    }
                  }))

                  setTimeout(() => {
                    setNotifications(prev => {
                      const newNotifications = { ...prev }
                      delete newNotifications[newData.id]
                      return newNotifications
                    })
                  }, 5000)
                }
              }
              break

            case 'DELETE':
              // Remove deleted appointment
              updated = updated.filter(apt => apt.id !== oldData.id)
              console.log('✅ [REALTIME DENTIST] Removed appointment:', oldData.id)

              setNotifications(prev => ({
                ...prev,
                ['deleted-' + oldData.id]: {
                  type: 'warning',
                  message: 'Appointment was cancelled'
                }
              }))

              setTimeout(() => {
                setNotifications(prev => {
                  const newNotifications = { ...prev }
                  delete newNotifications['deleted-' + oldData.id]
                  return newNotifications
                })
              }, 5000)
              break
          }

          // Sort by date and time
          updated.sort((a, b) => {
            const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date)
            if (dateCompare !== 0) return dateCompare
            return a.scheduled_time.localeCompare(b.scheduled_time)
          })

          // Call update callback if provided
          if (onAppointmentUpdate) {
            onAppointmentUpdate(updated)
          }

          return updated
        })
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
        console.log('📡 [REALTIME DENTIST] Subscription status:', status)
      })

    // Cleanup on unmount
    return () => {
      console.log('📡 [REALTIME DENTIST] Cleaning up subscription...')
      appointmentsSubscription.unsubscribe()
    }
  }, [dentistId, onAppointmentUpdate])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-teal-100 text-teal-800 border-teal-200'
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      case 'no_show': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />
      case 'confirmed': return <CheckCircle className="w-4 h-4" />
      case 'in_progress': return <Play className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      case 'no_show': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  // Filter today's appointments
  const today = format(new Date(), 'yyyy-MM-dd')
  const todaysAppointments = appointments.filter(apt => apt.scheduled_date === today)
  const upcomingAppointments = appointments.filter(apt => apt.scheduled_date > today).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Connection Status & Notifications */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-teal-600" />
          <h3 className="text-lg font-semibold">Your Appointments</h3>
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
        </div>
        <Badge variant="outline" className="text-xs">
          {appointments.length} total appointments
        </Badge>
      </div>

      {/* Live Notifications */}
      {Object.entries(notifications).map(([key, notification]) => (
        <div
          key={key}
          className={`p-3 rounded-lg border-l-4 ${
            notification.type === 'success' ? 'bg-green-50 border-green-400 text-green-800' :
            notification.type === 'info' ? 'bg-teal-50 border-teal-400 text-teal-800' :
            'bg-orange-50 border-orange-400 text-orange-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      ))}

      {/* Today's Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Today's Appointments ({todaysAppointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaysAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm">No appointments for today</p>
              <p className="text-xs text-gray-400">Enjoy your free day!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-teal-100 text-teal-600">
                          {appointment.patients?.first_name?.[0]}{appointment.patients?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {appointment.patients?.first_name} {appointment.patients?.last_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {appointment.appointment_type}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {appointment.scheduled_time.slice(0, 5)} • {appointment.duration_minutes} min
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(appointment.status)}>
                        {getStatusIcon(appointment.status)}
                        <span className="ml-1 capitalize">{appointment.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>
                  </div>
                  {appointment.notes && (
                    <div className="mt-2 text-xs text-gray-600 p-2 bg-gray-50 rounded">
                      <strong>Notes:</strong> {appointment.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-purple-100 text-purple-600 text-xs">
                          {appointment.patients?.first_name?.[0]}{appointment.patients?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">
                          {appointment.patients?.first_name} {appointment.patients?.last_name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {format(new Date(appointment.scheduled_date), 'MMM d')} at {appointment.scheduled_time.slice(0, 5)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {appointment.appointment_type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}