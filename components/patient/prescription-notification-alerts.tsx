"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Bell,
  CheckCircle,
  Pill,
  Calendar,
  User,
  Info,
  X,
  Eye,
  EyeOff,
  Clock,
  Capsule,
  AlarmClock,
  Loader2
} from "lucide-react"
import {
  getPrescriptionNotificationsAction,
  getPrescriptionDetailsAction
} from "@/lib/actions/prescription-notifications"
import { markNotificationReadAction } from "@/lib/actions/notifications"
import { createPrescriptionAlarmAction } from "@/lib/actions/prescription-alarms"
import { createClient } from "@/lib/supabase/client"

interface PrescriptionNotification {
  id: string
  type: string
  title: string
  message: string
  related_id: string | null
  read: boolean
  created_at: string
}

interface PrescriptionDetail {
  id: string
  medication_name: string
  brand_name?: string
  dosage: string
  strength?: string
  form?: string
  frequency: string
  times_per_day: number
  duration_days?: number
  instructions?: string
  total_quantity?: string
  refills_remaining: number
  status: string
  start_date: string
  created_at: string
}

interface PrescriptionNotificationAlertsProps {
  patientId: string
}

export function PrescriptionNotificationAlerts({ patientId }: PrescriptionNotificationAlertsProps) {
  const [notifications, setNotifications] = useState<PrescriptionNotification[]>([])
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<PrescriptionDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<PrescriptionNotification | null>(null)
  const [creatingAlarm, setCreatingAlarm] = useState<string | null>(null) // Track which prescription is creating alarm

  useEffect(() => {
    loadNotifications()
  }, [patientId])

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const result = await getPrescriptionNotificationsAction(patientId)

      if (result.success && result.data) {
        setNotifications(result.data)
      }
    } catch (error) {
      console.error('Error loading prescription notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPrescriptionDetails = async (consultationId: string) => {
    try {
      const result = await getPrescriptionDetailsAction(consultationId)

      if (result.success && result.data) {
        setSelectedPrescriptions(result.data)
        return result.data
      }
      return []
    } catch (error) {
      console.error('Error loading prescription details:', error)
      return []
    }
  }

  const handleViewDetails = async (notification: PrescriptionNotification) => {
    setSelectedNotification(notification)

    if (notification.related_id) {
      const prescriptions = await loadPrescriptionDetails(notification.related_id)
      setSelectedPrescriptions(prescriptions)
    }

    setShowDetailDialog(true)

    // Mark notification as read
    if (!notification.read) {
      try {
        const result = await markNotificationReadAction(notification.id)
        if (result.success) {
          // Update local state
          setNotifications(prev =>
            prev.map(n =>
              n.id === notification.id ? { ...n, read: true } : n
            )
          )
        }
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }
  }

  const createAlarmFromPrescription = async (prescription: PrescriptionDetail) => {
    try {
      setCreatingAlarm(prescription.id)

      // Generate default times based on frequency
      const defaultTimes = generateDefaultTimes(prescription.times_per_day)

      // Update the prescription record to include alarm information
      const supabase = createClient()

      const { error: updateError } = await supabase
        .schema('api')
        .from('patient_prescriptions')
        .update({
          reminder_times: JSON.stringify(defaultTimes),
          alarm_sound: 'default',
          notes: `${prescription.notes || ''}\n\n🔔 Alarm created: ${defaultTimes.join(', ')}`.trim()
        })
        .eq('id', prescription.id)

      if (updateError) {
        console.error('Error updating prescription with alarm info:', updateError)
        alert(`❌ Failed to create alarm: ${updateError.message}`)
        return
      }

      // Show success message with details
      const timesList = defaultTimes.join(', ')
      alert(`✅ Medication alarm created successfully!\n\n💊 Medication: ${prescription.medication_name}\n⏰ Times: ${timesList}\n📅 Duration: ${prescription.duration_days ? `${prescription.duration_days} days` : 'Ongoing'}\n\n✨ Your alarm has been saved and will appear in the prescription alarms section below.`)

      // Close the detail dialog
      setShowDetailDialog(false)

    } catch (error) {
      console.error('Error creating alarm from prescription:', error)
      alert('❌ Failed to create alarm. Please try again.')
    } finally {
      setCreatingAlarm(null)
    }
  }

  const generateDefaultTimes = (timesPerDay: number): string[] => {
    // Generate default times based on frequency
    switch (timesPerDay) {
      case 1:
        return ['09:00'] // Once daily - morning
      case 2:
        return ['09:00', '21:00'] // Twice daily - morning and evening
      case 3:
        return ['09:00', '13:00', '21:00'] // Three times daily - morning, afternoon, evening
      case 4:
        return ['08:00', '12:00', '17:00', '22:00'] // Four times daily - every 6 hours
      case 5:
        return ['08:00', '11:00', '14:00', '17:00', '20:00'] // Five times daily
      case 6:
        return ['08:00', '10:00', '12:00', '15:00', '18:00', '21:00'] // Six times daily
      default:
        return ['09:00'] // Default fallback
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const getFormIcon = (form?: string) => {
    switch (form?.toLowerCase()) {
      case 'tablet':
      case 'capsule':
        return <Capsule className="w-4 h-4" />
      case 'liquid':
      case 'syrup':
        return <Pill className="w-4 h-4" />
      default:
        return <Pill className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-teal-700 flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-600 animate-pulse" />
            Loading Prescription Notifications...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="animate-pulse">
                <div className="p-4 border border-teal-100 rounded-lg">
                  <div className="space-y-2">
                    <div className="h-4 bg-teal-200 rounded w-3/4"></div>
                    <div className="h-3 bg-teal-200 rounded w-1/2"></div>
                    <div className="h-3 bg-teal-200 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const unreadNotifications = notifications.filter(n => !n.read)
  const hasUnreadNotifications = unreadNotifications.length > 0

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-teal-700 flex items-center gap-2">
              <Bell className={`w-4 h-4 ${hasUnreadNotifications ? 'text-orange-600 animate-bounce' : 'text-teal-600'}`} />
              Prescription Notifications
              {hasUnreadNotifications && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                  {unreadNotifications.length} new
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg transition-all ${
                    !notification.read
                      ? 'border-orange-200 bg-orange-50/30 shadow-sm'
                      : 'border-teal-100 bg-teal-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        !notification.read ? 'bg-orange-100' : 'bg-teal-100'
                      }`}>
                        <Pill className={`w-5 h-5 ${
                          !notification.read ? 'text-orange-600' : 'text-teal-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium text-sm ${
                            !notification.read ? 'text-orange-800' : 'text-teal-800'
                          }`}>
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          )}
                        </div>
                        <p className={`text-xs leading-relaxed ${
                          !notification.read ? 'text-orange-700' : 'text-teal-600'
                        }`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {formatDateTime(notification.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(notification)}
                        className={`h-8 px-3 text-xs ${
                          !notification.read
                            ? 'border-orange-200 text-orange-700 hover:bg-orange-50'
                            : 'border-teal-200 text-teal-700 hover:bg-teal-50'
                        }`}
                      >
                        <Info className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto mb-4 text-teal-300" />
                <p className="text-sm text-teal-500">No prescription notifications yet</p>
                <p className="text-xs text-teal-400 mt-1">
                  You'll receive notifications here when your dentist prescribes medications
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prescription Details Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-600" />
              Prescription Details
            </DialogTitle>
            <DialogDescription>
              {selectedNotification?.title} - {selectedNotification ? formatDateTime(selectedNotification.created_at) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-6">
              {/* Notification Message */}
              <div className="p-4 bg-teal-50 rounded-lg border border-teal-100">
                <p className="text-sm text-teal-800">
                  {selectedNotification.message}
                </p>
              </div>

              {/* Prescription Details */}
              {selectedPrescriptions.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Capsule className="w-4 h-4 text-teal-600" />
                    Prescribed Medications ({selectedPrescriptions.length})
                  </h3>

                  <div className="space-y-4">
                    {selectedPrescriptions.map((prescription, index) => (
                      <div key={prescription.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getFormIcon(prescription.form)}
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {prescription.medication_name}
                                {prescription.brand_name && (
                                  <span className="text-sm text-gray-500 ml-2">
                                    ({prescription.brand_name})
                                  </span>
                                )}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {prescription.dosage}
                                {prescription.strength && ` • ${prescription.strength}`}
                                {prescription.form && ` • ${prescription.form}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                              {prescription.status}
                            </Badge>
                            <Button
                              size="sm"
                              onClick={() => createAlarmFromPrescription(prescription)}
                              disabled={creatingAlarm === prescription.id}
                              className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3 text-xs"
                            >
                              {creatingAlarm === prescription.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <AlarmClock className="w-3 h-3 mr-1" />
                                  Make Alarm
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Frequency:</span>
                            <p className="text-gray-600">
                              {prescription.frequency} ({prescription.times_per_day}x daily)
                            </p>
                            <p className="text-xs text-teal-600 mt-1">
                              Suggested times: {generateDefaultTimes(prescription.times_per_day).join(', ')}
                            </p>
                          </div>

                          {prescription.duration_days && (
                            <div>
                              <span className="font-medium text-gray-700">Duration:</span>
                              <p className="text-gray-600">
                                {prescription.duration_days} days
                              </p>
                            </div>
                          )}

                          {prescription.total_quantity && (
                            <div>
                              <span className="font-medium text-gray-700">Quantity:</span>
                              <p className="text-gray-600">{prescription.total_quantity}</p>
                            </div>
                          )}

                          <div>
                            <span className="font-medium text-gray-700">Refills:</span>
                            <p className="text-gray-600">{prescription.refills_remaining} remaining</p>
                          </div>
                        </div>

                        {prescription.instructions && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <span className="font-medium text-gray-700">Instructions:</span>
                            <p className="text-gray-600 text-sm mt-1">
                              {prescription.instructions}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          Prescribed: {formatDateTime(prescription.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm text-gray-500">No detailed prescription information available</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setShowDetailDialog(false)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}