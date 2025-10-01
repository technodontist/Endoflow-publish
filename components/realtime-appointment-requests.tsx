'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, AlertTriangle, User, Phone, Mail, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface AppointmentRequest {
  id: string
  patient_id: string
  appointment_type: string
  reason_for_visit: string
  pain_level: number
  preferred_date: string
  preferred_time: string
  additional_notes?: string
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
  profiles?: {
    full_name: string
    id: string
  }
}

interface RealtimeAppointmentRequestsProps {
  initialRequests: AppointmentRequest[]
  viewType: 'patient' | 'assistant' | 'dentist'
  patientId?: string // For filtering patient's own requests
  onRequestUpdate?: (requests: AppointmentRequest[]) => void
}

export function RealtimeAppointmentRequests({
  initialRequests,
  viewType,
  patientId,
  onRequestUpdate
}: RealtimeAppointmentRequestsProps) {
  const [appointmentRequests, setAppointmentRequests] = useState<AppointmentRequest[]>(initialRequests)
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<{[key: string]: {type: 'success' | 'error', message: string}}>({})

  useEffect(() => {
    const supabase = createClient()

    console.log('📡 [REALTIME APPOINTMENTS] Setting up real-time subscription...')

    // Subscribe to appointment requests changes
    const appointmentRequestsSubscription = supabase
      .channel('appointment-requests-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'appointment_requests'
      }, (payload) => {
        console.log('📡 [REALTIME APPOINTMENTS] Appointment request change received:', payload)

        const eventType = payload.eventType
        const newData = payload.new as AppointmentRequest
        const oldData = payload.old as AppointmentRequest

        setAppointmentRequests(prev => {
          let updated = [...prev]

          switch (eventType) {
            case 'INSERT':
              // Add new appointment request (avoid duplicates)
              if (!updated.find(req => req.id === newData.id)) {
                updated.unshift(newData)
                console.log('✅ [REALTIME APPOINTMENTS] Added new appointment request:', newData.id)

                // Show notification for new requests (except for patient view of their own requests)
                if (viewType !== 'patient') {
                  setNotifications(prev => ({
                    ...prev,
                    [newData.id]: {
                      type: 'success',
                      message: `New ${newData.pain_level >= 7 ? 'urgent' : ''} appointment request received`
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
              }
              break

            case 'UPDATE':
              // Update existing appointment request
              const index = updated.findIndex(req => req.id === newData.id)
              if (index !== -1) {
                updated[index] = newData
                console.log('✅ [REALTIME APPOINTMENTS] Updated appointment request:', newData.id)

                // Show status change notification
                if (oldData.status !== newData.status) {
                  const statusMessage = newData.status === 'confirmed' ? 'Appointment confirmed!' :
                                       newData.status === 'cancelled' ? 'Appointment cancelled' :
                                       'Appointment status updated'

                  setNotifications(prev => ({
                    ...prev,
                    [newData.id]: { type: 'success', message: statusMessage }
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
              // Remove deleted appointment request
              updated = updated.filter(req => req.id !== oldData.id)
              console.log('✅ [REALTIME APPOINTMENTS] Removed appointment request:', oldData.id)
              break
          }

          // Call update callback if provided
          if (onRequestUpdate) {
            onRequestUpdate(updated)
          }

          return updated
        })
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
        console.log('📡 [REALTIME APPOINTMENTS] Subscription status:', status)
      })

    // Cleanup on unmount
    return () => {
      console.log('📡 [REALTIME APPOINTMENTS] Cleaning up subscription...')
      appointmentRequestsSubscription.unsubscribe()
    }
  }, [viewType, onRequestUpdate])

  const getPriorityColor = (painLevel: number) => {
    if (painLevel >= 7) return 'bg-red-500'
    if (painLevel >= 4) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getPriorityText = (painLevel: number) => {
    if (painLevel >= 7) return 'High'
    if (painLevel >= 4) return 'Medium'
    return 'Low'
  }

  const getPriorityTextColor = (painLevel: number) => {
    if (painLevel >= 7) return 'text-red-600'
    if (painLevel >= 4) return 'text-yellow-600'
    return 'text-green-600'
  }

  // Filter based on view type
  const filteredRequests = appointmentRequests.filter(request => {
    if (viewType === 'patient') {
      // Patient sees only their own requests
      return patientId ? request.patient_id === patientId : true
    }
    // Assistant and dentist see all pending requests
    return request.status === 'pending'
  })

  if (filteredRequests.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader className="bg-teal-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5" />
              Appointment Requests
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No appointment requests</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-fit">
      <CardHeader className="bg-teal-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Calendar className="h-5 w-5" />
            Appointment Requests
            {filteredRequests.length > 0 && (
              <Badge className="bg-red-500 text-white ml-2">{filteredRequests.length}</Badge>
            )}
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-96 overflow-y-auto">
        <div className="space-y-0">
          {filteredRequests.map((request) => (
            <div key={request.id} className="border-b hover:bg-gray-50 relative">
              {/* Notification overlay */}
              {notifications[request.id] && (
                <div className="absolute top-2 right-2 z-10">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    notifications[request.id].type === 'success'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {notifications[request.id].message}
                  </div>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {request.profiles?.full_name || 'Unknown Patient'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {request.appointment_type}
                    </div>
                    <div className="text-xs text-gray-500">
                      Preferred: {format(new Date(request.preferred_date), 'MMM d, yyyy')} at {request.preferred_time}
                    </div>
                    {request.pain_level > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className={`h-2 w-2 rounded-full ${getPriorityColor(request.pain_level)}`}></div>
                        <span className={`text-xs ${getPriorityTextColor(request.pain_level)}`}>
                          Pain Level: {request.pain_level}/10 ({getPriorityText(request.pain_level)} Priority)
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {request.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-3">
                    {viewType === 'assistant' && (
                      <Link href={`/assistant/appointments/${request.id}`}>
                        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                          Schedule
                        </Button>
                      </Link>
                    )}
                    {viewType === 'dentist' && (
                      <Button size="sm" variant="outline" className="text-xs">
                        Review
                      </Button>
                    )}
                    {viewType === 'patient' && request.status === 'pending' && (
                      <Badge variant="secondary" className="text-xs">
                        Pending Review
                      </Badge>
                    )}
                  </div>
                </div>

                {request.reason_for_visit && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    <span className="font-medium">Reason: </span>
                    {request.reason_for_visit.substring(0, 100)}
                    {request.reason_for_visit.length > 100 ? '...' : ''}
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-400">
                  Submitted: {format(new Date(request.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}