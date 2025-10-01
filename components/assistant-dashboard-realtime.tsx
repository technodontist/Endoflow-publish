'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserCheck, CheckCircle, XCircle, Eye } from "lucide-react"
import Link from "next/link"
import { createClient } from '@/lib/supabase/client'
import { type PendingRegistration } from '@/lib/db/schema'
import { format } from 'date-fns'
import { approvePatientAction, rejectPatientAction } from '@/lib/actions/auth'

interface PendingRegistrationWithUser {
  id: string
  fullName: string
  createdAt: string
  source: 'profiles' | 'pending_registrations'
  formData?: any
  registrationId?: string
  index?: number
}

interface RealtimeAssistantDashboardProps {
  initialPendingPatients: any[]
  initialPendingRegistrations: PendingRegistration[]
}

export function RealtimeAssistantDashboard({ 
  initialPendingPatients, 
  initialPendingRegistrations 
}: RealtimeAssistantDashboardProps) {
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistrationWithUser[]>(() => {
    // Transform initial data
    const fromProfiles = initialPendingPatients
      .filter(patient => patient.id) // Filter out patients without valid IDs
      .map((patient, index) => ({
        id: patient.id,
        fullName: patient.fullName || patient.full_name || 'Unknown Patient',
        createdAt: patient.createdAt || patient.created_at || new Date().toISOString(),
        source: 'profiles' as const,
        index // Add index for unique key generation
      }))

    const fromPendingRegs = initialPendingRegistrations.map(reg => {
      let formData
      try {
        formData = reg.formData ? JSON.parse(reg.formData) : {}
      } catch (error) {
        console.error('Failed to parse form_data for registration:', reg.id, error)
        formData = {}
      }
      return {
        id: reg.userId || reg.id,  // Use userId, fallback to registration id
        fullName: `${formData.firstName || 'Unknown'} ${formData.lastName || 'User'}`,
        createdAt: reg.submittedAt ? reg.submittedAt.toISOString() : new Date().toISOString(),
        source: 'pending_registrations' as const,
        formData,
        registrationId: reg.id  // Keep registration id for reference
      }
    })

    return [...fromProfiles, ...fromPendingRegs]
  })

  const [isConnected, setIsConnected] = useState(false)
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: 'approving' | 'rejecting' | null }>({})
  const [notifications, setNotifications] = useState<{ [key: string]: { type: 'success' | 'error', message: string } }>({})

  // Handle inline approval
  const handleInlineApprove = async (patientId: string) => {
    console.log('🚀 [INLINE] handleInlineApprove called with patientId:', patientId, typeof patientId)

    if (!patientId) {
      console.error('❌ [INLINE] Patient ID is undefined or empty')
      setNotifications(prev => ({
        ...prev,
        [patientId || 'undefined']: { type: 'error', message: 'Patient ID is missing' }
      }))
      return
    }

    setLoadingStates(prev => ({ ...prev, [patientId]: 'approving' }))

    try {
      console.log('🚀 [INLINE] Starting approval for patient:', patientId)

      const result = await approvePatientAction(patientId)

      if (result.success) {
        // Remove from pending list
        setPendingRegistrations(prev => prev.filter(p => p.id !== patientId))

        // Show success notification
        setNotifications(prev => ({
          ...prev,
          [patientId]: { type: 'success', message: 'Patient approved successfully! They can now log in.' }
        }))

        console.log('✅ [INLINE] Patient approved successfully')
      } else {
        throw new Error(result.error || 'Approval failed')
      }

      // Clear notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => {
          const newNotifications = { ...prev }
          delete newNotifications[patientId]
          return newNotifications
        })
      }, 5000)

    } catch (error) {
      console.error('❌ [INLINE] Error approving patient:', error)
      setNotifications(prev => ({
        ...prev,
        [patientId]: { type: 'error', message: 'Failed to approve patient: ' + (error instanceof Error ? error.message : 'Unknown error') }
      }))

      // Clear error notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => {
          const newNotifications = { ...prev }
          delete newNotifications[patientId]
          return newNotifications
        })
      }, 5000)
    } finally {
      setLoadingStates(prev => ({ ...prev, [patientId]: null }))
    }
  }

  // Handle inline rejection
  const handleInlineReject = async (patientId: string) => {
    if (!confirm('Are you sure you want to reject this patient registration? This action cannot be undone.')) {
      return
    }

    setLoadingStates(prev => ({ ...prev, [patientId]: 'rejecting' }))

    try {
      console.log('🚀 [INLINE] Starting rejection for patient:', patientId)

      const result = await rejectPatientAction(patientId)

      if (result.success) {
        // Remove from pending list
        setPendingRegistrations(prev => prev.filter(p => p.id !== patientId))

        // Show success notification
        setNotifications(prev => ({
          ...prev,
          [patientId]: { type: 'success', message: 'Patient registration rejected successfully' }
        }))

        console.log('✅ [INLINE] Patient rejected successfully')
      } else {
        throw new Error(result.error || 'Rejection failed')
      }

      // Clear notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => {
          const newNotifications = { ...prev }
          delete newNotifications[patientId]
          return newNotifications
        })
      }, 5000)

    } catch (error) {
      console.error('❌ [INLINE] Error rejecting patient:', error)
      setNotifications(prev => ({
        ...prev,
        [patientId]: { type: 'error', message: 'Failed to reject patient: ' + (error instanceof Error ? error.message : 'Unknown error') }
      }))

      // Clear error notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => {
          const newNotifications = { ...prev }
          delete newNotifications[patientId]
          return newNotifications
        })
      }, 5000)
    } finally {
      setLoadingStates(prev => ({ ...prev, [patientId]: null }))
    }
  }

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to changes in profiles table
    const profilesSubscription = supabase
      .channel('profiles-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: 'role=eq.patient'
      }, (payload) => {
        console.log('📡 [REALTIME] Profiles change received:', payload)

        if (payload.eventType === 'INSERT' && payload.new) {
          const newProfile = payload.new as any
          if (newProfile.status === 'pending') {
            setPendingRegistrations(prev => [
              ...prev.filter(p => p.id !== newProfile.id),
              {
                id: newProfile.id,
                fullName: newProfile.full_name,
                createdAt: newProfile.created_at,
                source: 'profiles'
              }
            ])
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const updatedProfile = payload.new as any
          if (updatedProfile.status !== 'pending') {
            // Remove from pending list if status changed from pending
            setPendingRegistrations(prev => prev.filter(p => p.id !== updatedProfile.id))
          }
        } else if (payload.eventType === 'DELETE' && payload.old) {
          // Remove from pending list if deleted
          setPendingRegistrations(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe((status) => {
        console.log('📡 [REALTIME] Profiles subscription status:', status)
      })

    // Subscribe to changes in pending_registrations table
    const pendingRegsSubscription = supabase
      .channel('pending-registrations-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'pending_registrations'
      }, (payload) => {
        console.log('📡 [REALTIME] Pending registrations change received:', payload)

        if (payload.eventType === 'INSERT' && payload.new) {
          const newReg = payload.new as PendingRegistration
          if (newReg.status === 'pending') {
            let formData
            try {
              formData = newReg.formData ? JSON.parse(newReg.formData) : {}
            } catch (error) {
              console.error('Failed to parse formData:', error)
              formData = {}
            }

            setPendingRegistrations(prev => [
              ...prev.filter(p => p.id !== newReg.id),
              {
                id: newReg.id,
                fullName: `${formData.firstName || 'Unknown'} ${formData.lastName || 'User'}`,
                createdAt: newReg.submittedAt ? newReg.submittedAt.toISOString() : new Date().toISOString(),
                source: 'pending_registrations',
                formData
              }
            ])
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const updatedReg = payload.new as PendingRegistration
          if (updatedReg.status !== 'pending') {
            // Remove from pending list if status changed
            setPendingRegistrations(prev => prev.filter(p => p.id !== updatedReg.id))
          }
        } else if (payload.eventType === 'DELETE' && payload.old) {
          // Remove from pending list if deleted
          setPendingRegistrations(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe((status) => {
        console.log('📡 [REALTIME] Pending registrations subscription status:', status)
      })

    // Monitor connection status
    const connectionSubscription = supabase
      .channel('connection-status')
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
        console.log('📡 [REALTIME] Connection status:', status)
      })

    return () => {
      profilesSubscription.unsubscribe()
      pendingRegsSubscription.unsubscribe()
      connectionSubscription.unsubscribe()
    }
  }, [])

  return (
    <Card className="h-fit bg-white/80 backdrop-blur-sm border-teal-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <UserCheck className="h-5 w-5" />
            New Self-Registrations
            {isConnected && (
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" title="Live updates active" />
            )}
          </div>
          <Badge variant="secondary" className="bg-teal-700/50 text-white border-teal-400 backdrop-blur-sm">
            {pendingRegistrations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-96 overflow-y-auto">
        <div className="space-y-0">
          {pendingRegistrations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending registrations</p>
              <p className="text-sm">All patients have been verified</p>
            </div>
          ) : (
            pendingRegistrations
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 5)
              .map((patient) => {
                const initials = patient.fullName
                  .split(' ')
                  .map(name => name[0])
                  .join('')
                  .toUpperCase()

                const isLoading = loadingStates[patient.id]
                const notification = notifications[patient.id]

                return (
                  <div key={`${patient.source}-${patient.id || patient.index || Math.random()}`} className="border-b hover:bg-gray-50">
                    {/* Notification bar */}
                    {notification && (
                      <div className={`px-4 py-2 text-sm ${
                        notification.type === 'success'
                          ? 'bg-green-50 text-green-800 border-b border-green-200'
                          : 'bg-red-50 text-red-800 border-b border-red-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {notification.type === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {notification.message}
                        </div>
                      </div>
                    )}

                    {/* Main content */}
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="font-semibold text-sm text-blue-600">
                            {initials}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{patient.fullName}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            Registered {(() => {
                              if (!patient.createdAt) return 'Unknown date'
                              const date = new Date(patient.createdAt)
                              return isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy')
                            })()}
                            <Badge variant="outline" className="text-xs">
                              {patient.source === 'profiles' ? 'Profile' : 'Form'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick view button */}
                        <Button asChild size="sm" variant="outline" className="px-3">
                          <Link href={`/assistant/verify/${patient.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>

                        {/* Inline approve button */}
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log('🔍 [BUTTON] About to approve patient:', patient.id, 'Patient object:', patient)
                            handleInlineApprove(patient.id)
                          }}
                          disabled={!!isLoading}
                          className="bg-green-600 hover:bg-green-700 text-white px-3"
                        >
                          {isLoading === 'approving' ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Inline reject button */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleInlineReject(patient.id)}
                          disabled={!!isLoading}
                          className="px-3"
                        >
                          {isLoading === 'rejecting' ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </CardContent>
    </Card>
  )
}