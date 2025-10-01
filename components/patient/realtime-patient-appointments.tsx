'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  Bell,
  Activity,
  CalendarDays
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
  dentist_name?: string
  dentists?: {
    full_name: string
  }
}

interface RealtimePatientAppointmentsProps {
  patientId: string
  initialAppointments: Appointment[]
  onAppointmentUpdate?: (appointments: Appointment[]) => void
}

export function RealtimePatientAppointments({
  patientId,
  initialAppointments,
  onAppointmentUpdate
}: RealtimePatientAppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<{[key: string]: {type: 'success' | 'info' | 'warning', message: string}}>({})

  useEffect(() => {
    const supabase = createClient()

    console.log('📡 [REALTIME PATIENT] Setting up appointments subscription for patient:', patientId)

    // Subscribe to appointments changes for this patient
    const appointmentsSubscription = supabase
      .channel('patient-appointments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'appointments',
        filter: `patient_id=eq.${patientId}`
      }, (payload) => {
        console.log('📡 [REALTIME PATIENT] Appointment change received:', payload)

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
                console.log('✅ [REALTIME PATIENT] Added new appointment:', newData.id)

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
                console.log('✅ [REALTIME PATIENT] Updated appointment:', newData.id)

                // Show status change notification
                if (oldAppointment.status !== newData.status) {
                  const statusMessage = newData.status === 'confirmed' ? '🎉 Your appointment has been confirmed!' :
                                       newData.status === 'in_progress' ? '🩺 Your treatment has started' :
                                       newData.status === 'completed' ? '✅ Your treatment is complete' :
                                       newData.status === 'cancelled' ? '❌ Your appointment was cancelled' :
                                       'Your appointment status was updated'

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
                  }, 7000) // Show status updates longer
                }

                // Show appointment confirmation notification
                if (newData.status === 'confirmed' && oldAppointment.status !== 'confirmed') {
                  setNotifications(prev => ({
                    ...prev,
                    [newData.id + '-confirmed']: {
                      type: 'success',
                      message: `Appointment confirmed for ${format(new Date(newData.scheduled_date), 'MMM d')} at ${newData.scheduled_time}`
                    }
                  }))

                  setTimeout(() => {
                    setNotifications(prev => {
                      const newNotifications = { ...prev }
                      delete newNotifications[newData.id + '-confirmed']
                      return newNotifications
                    })
                  }, 8000)
                }
              }
              break

            case 'DELETE':
              // Remove deleted appointment
              updated = updated.filter(apt => apt.id !== oldData.id)
              console.log('✅ [REALTIME PATIENT] Removed appointment:', oldData.id)

              setNotifications(prev => ({
                ...prev,
                ['deleted-' + oldData.id]: {
                  type: 'warning',
                  message: 'Your appointment was cancelled'
                }
              }))

              setTimeout(() => {
                setNotifications(prev => {
                  const newNotifications = { ...prev }
                  delete newNotifications['deleted-' + oldData.id]
                  return newNotifications
                })
              }, 6000)
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
        console.log('📡 [REALTIME PATIENT] Subscription status:', status)
      })

    // Cleanup on unmount
    return () => {
      console.log('📡 [REALTIME PATIENT] Cleaning up subscription...')
      appointmentsSubscription.unsubscribe()
    }
  }, [patientId, onAppointmentUpdate])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
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
      case 'scheduled': return <Clock className="w-3 h-3" />
      case 'confirmed': return <CheckCircle className="w-3 h-3" />
      case 'in_progress': return <Activity className="w-3 h-3" />
      case 'completed': return <CheckCircle className="w-3 h-3" />
      case 'cancelled': return <AlertTriangle className="w-3 h-3" />
      case 'no_show': return <AlertTriangle className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }

  // Filter upcoming and past appointments
  const today = format(new Date(), 'yyyy-MM-dd')
  const upcomingAppointments = appointments.filter(apt => apt.scheduled_date >= today)
  const pastAppointments = appointments.filter(apt => apt.scheduled_date < today)

  return (
    <div className="space-y-4">
      {/* Live Notifications */}
      {Object.entries(notifications).map(([key, notification]) => (
        <div
          key={key}
          className={`p-3 rounded-lg border-l-4 ${
            notification.type === 'success' ? 'bg-green-50 border-green-400 text-green-800' :
            notification.type === 'info' ? 'bg-blue-50 border-blue-400 text-blue-800' :
            'bg-orange-50 border-orange-400 text-orange-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      ))}

      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-medium text-gray-700">Your Appointments</span>
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Live updates active' : 'Disconnected'} />
        </div>
      </div>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
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
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{appointment.appointment_type}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {format(new Date(appointment.scheduled_date), 'MMM d, yyyy')} at {appointment.scheduled_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        <span>Dr. {appointment.dentists?.full_name || appointment.dentist_name || 'TBD'}</span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(appointment.status)}>
                      {getStatusIcon(appointment.status)}
                      <span className="ml-1 capitalize">{appointment.status.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                  {appointment.notes && (
                    <div className="mt-2 text-xs text-gray-600 p-2 bg-gray-50 rounded">
                      <strong>Notes:</strong> {appointment.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Appointments (limited) */}
      {pastAppointments.length > 0 && (
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              Recent Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pastAppointments.slice(0, 3).map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{appointment.appointment_type}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {format(new Date(appointment.scheduled_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        <span>Dr. {appointment.dentists?.full_name || appointment.dentist_name || 'Unknown'}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {appointment.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No appointments message */}
      {appointments.length === 0 && (
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm">No appointments yet</p>
              <p className="text-xs text-gray-400">Book your first appointment to get started!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}