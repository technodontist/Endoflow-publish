"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Bell,
  Clock,
  Activity,
  CheckCircle,
  X,
  Plus,
  Edit3,
  Trash2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Calendar,
  Pill,
  Timer,
  Zap
} from "lucide-react"
import {
  getPatientPrescriptionAlarmsAction,
  getTodaysAlarmInstancesAction,
  createPrescriptionAlarmAction,
  updatePrescriptionAlarmAction,
  deletePrescriptionAlarmAction,
  updateAlarmInstanceAction
} from "@/lib/actions/prescription-alarms"
import { PrescriptionNotificationAlerts } from "./prescription-notification-alerts"

interface PrescriptionAlarmsProps {
  patientId: string
}

interface PrescriptionAlarm {
  id: string
  medication_name: string
  dosage: string
  form?: string
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom'
  frequency_per_day: number
  specific_times: string[]
  duration_type: 'days' | 'weeks' | 'months' | 'ongoing'
  duration_value?: number
  start_date: string
  end_date?: string
  alarm_enabled: boolean
  alarm_sound: string
  snooze_enabled: boolean
  snooze_duration_minutes: number
  instructions?: string
  additional_notes?: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  created_at: string
}

interface AlarmInstance {
  id: string
  scheduled_date: string
  scheduled_time: string
  status: 'pending' | 'taken' | 'skipped' | 'missed' | 'snoozed'
  taken_at?: string
  skipped_at?: string
  snooze_count: number
  snooze_until?: string
  patient_notes?: string
  prescription_alarm: {
    medication_name: string
    dosage: string
    instructions?: string
    alarm_sound: string
    snooze_enabled: boolean
    snooze_duration_minutes: number
  }
}

export function EnhancedPrescriptionAlarms({ patientId }: PrescriptionAlarmsProps) {
  const [alarms, setAlarms] = useState<PrescriptionAlarm[]>([])
  const [todayInstances, setTodayInstances] = useState<AlarmInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingAlarm, setEditingAlarm] = useState<PrescriptionAlarm | null>(null)
  const [activeAlarms, setActiveAlarms] = useState<Set<string>>(new Set())

  // Form state
  const [formData, setFormData] = useState({
    medicationName: '',
    dosage: '',
    form: '',
    scheduleType: 'daily' as const,
    frequencyPerDay: 1,
    specificTimes: ['09:00'],
    durationType: 'days' as const,
    durationValue: 7,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    alarmEnabled: true,
    alarmSound: 'default',
    snoozeEnabled: true,
    snoozeDurationMinutes: 10,
    instructions: '',
    additionalNotes: ''
  })

  useEffect(() => {
    loadData()
    // Check for active alarms every minute
    const interval = setInterval(checkActiveAlarms, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [alarmsResult, instancesResult] = await Promise.all([
        getPatientPrescriptionAlarmsAction(),
        getTodaysAlarmInstancesAction()
      ])

      if (alarmsResult.success) {
        setAlarms(alarmsResult.data || [])
      }

      if (instancesResult.success) {
        setTodayInstances(instancesResult.data || [])
      }
    } catch (error) {
      console.error('Error loading alarm data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkActiveAlarms = () => {
    const now = new Date()
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')

    const activeAlarmsSet = new Set<string>()

    todayInstances.forEach(instance => {
      if (instance.status === 'pending' && instance.scheduled_time === currentTime) {
        activeAlarmsSet.add(instance.id)
        triggerAlarmNotification(instance)
      }
    })

    setActiveAlarms(activeAlarmsSet)
  }

  const triggerAlarmNotification = (instance: AlarmInstance) => {
    // Request notification permission if not granted
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification(`💊 Time for ${instance.prescription_alarm.medication_name}`, {
        body: `${instance.prescription_alarm.dosage} - ${instance.prescription_alarm.instructions || 'Take as prescribed'}`,
        icon: '/pill-icon.png',
        badge: '/endoflow-badge.png',
        tag: instance.id,
        requireInteraction: true
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }

    // Play alarm sound
    if (instance.prescription_alarm.alarm_sound !== 'silent') {
      playAlarmSound(instance.prescription_alarm.alarm_sound)
    }
  }

  const playAlarmSound = (soundType: string) => {
    // Create audio context for alarm sounds
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    const sounds = {
      default: { frequency: 800, duration: 1000 },
      gentle: { frequency: 440, duration: 800 },
      urgent: { frequency: 1000, duration: 1500 },
      chime: { frequency: 523, duration: 600 }
    }

    const sound = sounds[soundType as keyof typeof sounds] || sounds.default

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime)
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration / 1000)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + sound.duration / 1000)
  }

  const handleCreateAlarm = async () => {
    try {
      const result = await createPrescriptionAlarmAction(formData)
      if (result.success) {
        setShowAddDialog(false)
        resetForm()
        loadData()
      } else {
        alert(result.error || 'Failed to create alarm')
      }
    } catch (error) {
      console.error('Error creating alarm:', error)
      alert('Failed to create alarm')
    }
  }

  const handleUpdateAlarm = async () => {
    if (!editingAlarm) return

    try {
      const result = await updatePrescriptionAlarmAction(editingAlarm.id, formData)
      if (result.success) {
        setEditingAlarm(null)
        resetForm()
        loadData()
      } else {
        alert(result.error || 'Failed to update alarm')
      }
    } catch (error) {
      console.error('Error updating alarm:', error)
      alert('Failed to update alarm')
    }
  }

  const handleDeleteAlarm = async (alarmId: string) => {
    try {
      const result = await deletePrescriptionAlarmAction(alarmId)
      if (result.success) {
        loadData()
      } else {
        alert(result.error || 'Failed to delete alarm')
      }
    } catch (error) {
      console.error('Error deleting alarm:', error)
      alert('Failed to delete alarm')
    }
  }

  const handleInstanceAction = async (instanceId: string, status: 'taken' | 'skipped' | 'snoozed', snoozeMinutes?: number) => {
    try {
      const result = await updateAlarmInstanceAction({
        instanceId,
        status,
        snoozeMinutes
      })
      if (result.success) {
        // Remove from active alarms if taken or skipped
        if (status !== 'snoozed') {
          setActiveAlarms(prev => {
            const newSet = new Set(prev)
            newSet.delete(instanceId)
            return newSet
          })
        }
        loadData()
      } else {
        alert(result.error || 'Failed to update alarm status')
      }
    } catch (error) {
      console.error('Error updating alarm instance:', error)
      alert('Failed to update alarm status')
    }
  }

  const resetForm = () => {
    setFormData({
      medicationName: '',
      dosage: '',
      form: '',
      scheduleType: 'daily',
      frequencyPerDay: 1,
      specificTimes: ['09:00'],
      durationType: 'days',
      durationValue: 7,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      alarmEnabled: true,
      alarmSound: 'default',
      snoozeEnabled: true,
      snoozeDurationMinutes: 10,
      instructions: '',
      additionalNotes: ''
    })
  }

  const startEdit = (alarm: PrescriptionAlarm) => {
    setEditingAlarm(alarm)
    setFormData({
      medicationName: alarm.medication_name,
      dosage: alarm.dosage,
      form: alarm.form || '',
      scheduleType: alarm.schedule_type,
      frequencyPerDay: alarm.frequency_per_day,
      specificTimes: alarm.specific_times,
      durationType: alarm.duration_type,
      durationValue: alarm.duration_value || 7,
      startDate: alarm.start_date,
      endDate: alarm.end_date || '',
      alarmEnabled: alarm.alarm_enabled,
      alarmSound: alarm.alarm_sound,
      snoozeEnabled: alarm.snooze_enabled,
      snoozeDurationMinutes: alarm.snooze_duration_minutes,
      instructions: alarm.instructions || '',
      additionalNotes: alarm.additional_notes || ''
    })
  }

  const updateTimeSlot = (index: number, value: string) => {
    const newTimes = [...formData.specificTimes]
    newTimes[index] = value
    setFormData({ ...formData, specificTimes: newTimes })
  }

  const addTimeSlot = () => {
    if (formData.specificTimes.length < 6) {
      setFormData({
        ...formData,
        specificTimes: [...formData.specificTimes, '09:00']
      })
    }
  }

  const removeTimeSlot = (index: number) => {
    if (formData.specificTimes.length > 1) {
      const newTimes = formData.specificTimes.filter((_, i) => i !== index)
      setFormData({ ...formData, specificTimes: newTimes })
    }
  }

  const formatTime = (timeString: string) => {
    try {
      const time = new Date(`2000-01-01T${timeString}`)
      return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return timeString
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'snoozed':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'missed':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 pb-20">
        {[1, 2, 3].map(i => (
          <Card key={i} className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-teal-200 rounded w-1/3"></div>
                <div className="h-6 bg-teal-200 rounded w-2/3"></div>
                <div className="h-3 bg-teal-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Prescription Notifications from Dentist */}
      <PrescriptionNotificationAlerts patientId={patientId} />

      {/* Header with Add Alarm Button */}
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-teal-800 flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-600" />
                Prescription Alarms
              </CardTitle>
              <p className="text-sm text-teal-600">Manage your medication reminders and schedules</p>
            </div>
            <Dialog open={showAddDialog || !!editingAlarm} onOpenChange={(open) => {
              if (!open) {
                setShowAddDialog(false)
                setEditingAlarm(null)
                resetForm()
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Alarm
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingAlarm ? 'Edit Prescription Alarm' : 'Add New Prescription Alarm'}
                  </DialogTitle>
                  <DialogDescription>
                    Set up a custom medication reminder with your preferred schedule and settings.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Medication Details */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Medication Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="medicationName">Medication Name *</Label>
                        <Input
                          id="medicationName"
                          value={formData.medicationName}
                          onChange={(e) => setFormData({ ...formData, medicationName: e.target.value })}
                          placeholder="e.g., Amoxicillin"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dosage">Dosage *</Label>
                        <Input
                          id="dosage"
                          value={formData.dosage}
                          onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                          placeholder="e.g., 500mg, 1 tablet"
                        />
                      </div>
                      <div>
                        <Label htmlFor="form">Form</Label>
                        <Select value={formData.form} onValueChange={(value) => setFormData({ ...formData, form: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select form" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tablet">Tablet</SelectItem>
                            <SelectItem value="capsule">Capsule</SelectItem>
                            <SelectItem value="liquid">Liquid</SelectItem>
                            <SelectItem value="injection">Injection</SelectItem>
                            <SelectItem value="cream">Cream</SelectItem>
                            <SelectItem value="drops">Drops</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Configuration */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Schedule Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="scheduleType">Schedule Type</Label>
                        <Select value={formData.scheduleType} onValueChange={(value: any) => setFormData({ ...formData, scheduleType: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="frequencyPerDay">Times per Day</Label>
                        <Select value={formData.frequencyPerDay.toString()} onValueChange={(value) => {
                          const num = parseInt(value)
                          const currentTimes = formData.specificTimes
                          let newTimes = [...currentTimes]

                          if (num > currentTimes.length) {
                            // Add more time slots
                            while (newTimes.length < num) {
                              newTimes.push('09:00')
                            }
                          } else if (num < currentTimes.length) {
                            // Remove excess time slots
                            newTimes = newTimes.slice(0, num)
                          }

                          setFormData({ ...formData, frequencyPerDay: num, specificTimes: newTimes })
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Time Slots */}
                    <div>
                      <Label>Specific Times</Label>
                      <div className="space-y-2 mt-2">
                        {formData.specificTimes.map((time, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={time}
                              onChange={(e) => updateTimeSlot(index, e.target.value)}
                              className="w-32"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeTimeSlot(index)}
                              disabled={formData.specificTimes.length === 1}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Duration Settings */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Duration Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="durationType">Duration Type</Label>
                        <Select value={formData.durationType} onValueChange={(value: any) => setFormData({ ...formData, durationType: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="weeks">Weeks</SelectItem>
                            <SelectItem value="months">Months</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.durationType !== 'ongoing' && (
                        <div>
                          <Label htmlFor="durationValue">Duration Value</Label>
                          <Input
                            id="durationValue"
                            type="number"
                            min="1"
                            value={formData.durationValue}
                            onChange={(e) => setFormData({ ...formData, durationValue: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      )}
                      <div>
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Alarm Settings */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Alarm Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="alarmEnabled">Enable Alarm</Label>
                        <Switch
                          id="alarmEnabled"
                          checked={formData.alarmEnabled}
                          onCheckedChange={(checked) => setFormData({ ...formData, alarmEnabled: checked })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="alarmSound">Alarm Sound</Label>
                        <Select value={formData.alarmSound} onValueChange={(value) => setFormData({ ...formData, alarmSound: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="gentle">Gentle</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="chime">Chime</SelectItem>
                            <SelectItem value="silent">Silent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="snoozeEnabled">Enable Snooze</Label>
                        <Switch
                          id="snoozeEnabled"
                          checked={formData.snoozeEnabled}
                          onCheckedChange={(checked) => setFormData({ ...formData, snoozeEnabled: checked })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="snoozeDuration">Snooze Duration (minutes)</Label>
                        <Select value={formData.snoozeDurationMinutes.toString()} onValueChange={(value) => setFormData({ ...formData, snoozeDurationMinutes: parseInt(value) })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 minutes</SelectItem>
                            <SelectItem value="10">10 minutes</SelectItem>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Instructions and Notes */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Instructions & Notes</h3>
                    <div>
                      <Label htmlFor="instructions">Instructions</Label>
                      <Textarea
                        id="instructions"
                        value={formData.instructions}
                        onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                        placeholder="e.g., Take with food, Before meals"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="additionalNotes">Additional Notes</Label>
                      <Textarea
                        id="additionalNotes"
                        value={formData.additionalNotes}
                        onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                        placeholder="Any additional notes or reminders"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowAddDialog(false)
                    setEditingAlarm(null)
                    resetForm()
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={editingAlarm ? handleUpdateAlarm : handleCreateAlarm}
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={!formData.medicationName || !formData.dosage}
                  >
                    {editingAlarm ? 'Update Alarm' : 'Create Alarm'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Active Alarms Today */}
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-teal-700 flex items-center gap-2">
            <Zap className="w-4 h-4 text-teal-600" />
            Active Alarms Today ({new Date().toLocaleDateString()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todayInstances.length > 0 ? (
              todayInstances.map((instance) => (
                <div
                  key={instance.id}
                  className={`p-4 border rounded-lg ${
                    activeAlarms.has(instance.id)
                      ? 'border-red-300 bg-red-50 animate-pulse'
                      : 'border-teal-100 bg-teal-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activeAlarms.has(instance.id) ? 'bg-red-100' : 'bg-teal-100'
                      }`}>
                        {activeAlarms.has(instance.id) ? (
                          <Bell className="w-5 h-5 text-red-600 animate-bounce" />
                        ) : (
                          <Pill className="w-5 h-5 text-teal-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-teal-800">
                          {instance.prescription_alarm.medication_name}
                        </h4>
                        <p className="text-sm text-teal-600">
                          {instance.prescription_alarm.dosage} • {formatTime(instance.scheduled_time)}
                        </p>
                        {instance.prescription_alarm.instructions && (
                          <p className="text-xs text-teal-500 mt-1">
                            {instance.prescription_alarm.instructions}
                          </p>
                        )}
                        {instance.snooze_count > 0 && (
                          <p className="text-xs text-purple-500 mt-1">
                            Snoozed {instance.snooze_count} times
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(instance.status)} text-xs`}>
                        {instance.status.charAt(0).toUpperCase() + instance.status.slice(1)}
                      </Badge>
                      {(instance.status === 'pending' || instance.status === 'snoozed') && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInstanceAction(instance.id, 'taken')}
                            className="text-green-600 border-green-200 hover:bg-green-50 h-8 px-3"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Take
                          </Button>
                          {instance.prescription_alarm.snooze_enabled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInstanceAction(instance.id, 'snoozed', instance.prescription_alarm.snooze_duration_minutes)}
                              className="text-purple-600 border-purple-200 hover:bg-purple-50 h-8 px-3"
                            >
                              <Timer className="w-3 h-3 mr-1" />
                              Snooze
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInstanceAction(instance.id, 'skipped')}
                            className="text-yellow-600 border-yellow-200 hover:bg-yellow-50 h-8 px-3"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Skip
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto mb-4 text-teal-300" />
                <p className="text-sm text-teal-500">No alarms scheduled for today</p>
                <p className="text-xs text-teal-400 mt-1">Your medication reminders will appear here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* All Prescription Alarms */}
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-teal-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            My Prescription Alarms ({alarms.filter(a => a.status === 'active').length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alarms.filter(a => a.status === 'active').length > 0 ? (
              alarms.filter(a => a.status === 'active').map((alarm) => (
                <div key={alarm.id} className="border border-teal-100 rounded-lg overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          {alarm.alarm_enabled ? (
                            <Volume2 className="w-5 h-5 text-teal-600" />
                          ) : (
                            <VolumeX className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-teal-800">{alarm.medication_name}</h4>
                          <p className="text-sm text-teal-600">
                            {alarm.dosage} • {alarm.frequency_per_day}x daily
                          </p>
                          <p className="text-xs text-teal-500">
                            {alarm.specific_times.map(time => formatTime(time)).join(', ')}
                          </p>
                          {alarm.instructions && (
                            <p className="text-xs text-gray-500 mt-1">{alarm.instructions}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${
                          alarm.alarm_enabled
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {alarm.alarm_enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(alarm)}
                          className="h-8 px-2"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Prescription Alarm</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the alarm for {alarm.medication_name}?
                                This will remove all future reminders for this medication.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteAlarm(alarm.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Settings className="w-12 h-12 mx-auto mb-4 text-teal-300" />
                <p className="text-sm text-teal-500">No prescription alarms set up</p>
                <p className="text-xs text-teal-400 mt-1">Click "Add Alarm" to create your first medication reminder</p>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Alarm
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}