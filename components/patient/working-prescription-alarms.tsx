"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Trash2,
  Volume2,
  Pill,
  Zap,
  Timer,
  Play
} from "lucide-react"
import {
  getSimpleAlarmsAction,
  getTodaysSimpleAlarmsAction,
  createSimpleAlarmAction,
  updateSimpleAlarmInstanceAction,
  deleteSimpleAlarmAction
} from "@/lib/actions/simple-prescription-alarms"

interface WorkingPrescriptionAlarmsProps {
  patientId: string
}

interface SimpleAlarm {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  times_per_day: number
  start_date: string
  end_date?: string
  instructions?: string
  status: 'active' | 'completed' | 'discontinued' | 'paused'
  reminder_times: string[]
  created_at: string
}

interface TodayReminder {
  id: string
  scheduled_date: string
  scheduled_time: string
  status: 'pending' | 'taken' | 'skipped' | 'late' | 'missed'
  taken_at?: string
  skipped_at?: string
  patient_notes?: string
  prescription: {
    medication_name: string
    dosage: string
    instructions?: string
    alarm_sound?: string
  }
}

export function WorkingPrescriptionAlarms({ patientId }: WorkingPrescriptionAlarmsProps) {
  const [alarms, setAlarms] = useState<SimpleAlarm[]>([])
  const [todayReminders, setTodayReminders] = useState<TodayReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [activeAlarms, setActiveAlarms] = useState<Set<string>>(new Set())

  // Form state
  const [formData, setFormData] = useState({
    medicationName: '',
    dosage: '',
    instructions: '',
    times: ['09:00'],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    alarmSound: 'default',
    snoozeDurationMinutes: 10
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
      const [alarmsResult, remindersResult] = await Promise.all([
        getSimpleAlarmsAction(),
        getTodaysSimpleAlarmsAction()
      ])

      if (alarmsResult.success) {
        setAlarms(alarmsResult.data || [])
      } else {
        console.error('Error loading alarms:', alarmsResult.error)
      }

      if (remindersResult.success) {
        setTodayReminders(remindersResult.data || [])
      } else {
        console.error('Error loading reminders:', remindersResult.error)
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

    todayReminders.forEach(reminder => {
      if (reminder.status === 'pending' && reminder.scheduled_time === currentTime) {
        activeAlarmsSet.add(reminder.id)
        triggerAlarmNotification(reminder)
      }
    })

    setActiveAlarms(activeAlarmsSet)
  }

  const triggerAlarmNotification = (reminder: TodayReminder) => {
    // Request notification permission if not granted
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification(`💊 Time for ${reminder.prescription.medication_name}`, {
        body: `${reminder.prescription.dosage} - ${reminder.prescription.instructions || 'Take as prescribed'}`,
        icon: '/pill-icon.png',
        tag: reminder.id,
        requireInteraction: true
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }

    // Play alarm sound from stored prescription setting
    playAlarmSound(reminder.prescription.alarm_sound || 'default')
  }

  const playAlarmSound = (soundType: string) => {
    try {
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
    } catch (error) {
      console.error('Error playing alarm sound:', error)
    }
  }

  const handleCreateAlarm = async () => {
    if (!formData.medicationName || !formData.dosage) {
      alert('Please fill in medication name and dosage')
      return
    }

    try {
      const result = await createSimpleAlarmAction({
        medicationName: formData.medicationName,
        dosage: formData.dosage,
        instructions: formData.instructions,
        times: formData.times,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        alarmSound: formData.alarmSound,
        snoozeDurationMinutes: formData.snoozeDurationMinutes
      })

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

  const handleDeleteAlarm = async (alarmId: string) => {
    try {
      const result = await deleteSimpleAlarmAction(alarmId)
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

  const handleReminderAction = async (reminderId: string, status: 'taken' | 'skipped') => {
    try {
      const result = await updateSimpleAlarmInstanceAction(reminderId, status)
      if (result.success) {
        // Remove from active alarms
        setActiveAlarms(prev => {
          const newSet = new Set(prev)
          newSet.delete(reminderId)
          return newSet
        })
        loadData()
      } else {
        alert(result.error || 'Failed to update alarm status')
      }
    } catch (error) {
      console.error('Error updating reminder:', error)
      alert('Failed to update alarm status')
    }
  }

  const resetForm = () => {
    setFormData({
      medicationName: '',
      dosage: '',
      instructions: '',
      times: ['09:00'],
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      alarmSound: 'default',
      snoozeDurationMinutes: 10
    })
  }

  const updateTimeSlot = (index: number, value: string) => {
    const newTimes = [...formData.times]
    newTimes[index] = value
    setFormData({ ...formData, times: newTimes })
  }

  const addTimeSlot = () => {
    if (formData.times.length < 6) {
      setFormData({
        ...formData,
        times: [...formData.times, '09:00']
      })
    }
  }

  const removeTimeSlot = (index: number) => {
    if (formData.times.length > 1) {
      const newTimes = formData.times.filter((_, i) => i !== index)
      setFormData({ ...formData, times: newTimes })
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
      case 'late':
        return 'bg-orange-100 text-orange-800 border-orange-200'
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
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Alarm
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Prescription Alarm</DialogTitle>
                  <DialogDescription>
                    Set up a custom medication reminder with your preferred schedule.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
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
                    <Label>Reminder Times</Label>
                    <div className="space-y-2 mt-2">
                      {formData.times.map((time, index) => (
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
                            disabled={formData.times.length === 1}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {formData.times.length < 6 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addTimeSlot}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Time
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date (Optional)</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      />
                    </div>
                  </div>
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

                  {/* Alarm Sound Selection */}
                  <div>
                    <Label htmlFor="alarmSound">Alarm Sound</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Select value={formData.alarmSound} onValueChange={(value) => setFormData({ ...formData, alarmSound: value })}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="gentle">Gentle</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="chime">Chime</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" onClick={() => playAlarmSound(formData.alarmSound)}>
                        <Play className="w-3 h-3 mr-1" />
                        Test
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAlarm}
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={!formData.medicationName || !formData.dosage}
                  >
                    Create Alarm
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
            Today's Alarms ({new Date().toLocaleDateString()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todayReminders.length > 0 ? (
              todayReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`p-4 border rounded-lg ${
                    activeAlarms.has(reminder.id)
                      ? 'border-red-300 bg-red-50 animate-pulse'
                      : 'border-teal-100 bg-teal-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activeAlarms.has(reminder.id) ? 'bg-red-100' : 'bg-teal-100'
                      }`}>
                        {activeAlarms.has(reminder.id) ? (
                          <Bell className="w-5 h-5 text-red-600 animate-bounce" />
                        ) : (
                          <Pill className="w-5 h-5 text-teal-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-teal-800">
                          {reminder.prescription.medication_name}
                        </h4>
                        <p className="text-sm text-teal-600">
                          {reminder.prescription.dosage} • {formatTime(reminder.scheduled_time)}
                        </p>
                        {reminder.prescription.instructions && (
                          <p className="text-xs text-teal-500 mt-1">
                            {reminder.prescription.instructions}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(reminder.status)} text-xs`}>
                        {reminder.status.charAt(0).toUpperCase() + reminder.status.slice(1)}
                      </Badge>
                      {reminder.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReminderAction(reminder.id, 'taken')}
                            className="text-green-600 border-green-200 hover:bg-green-50 h-8 px-3"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Take
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReminderAction(reminder.id, 'skipped')}
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
            My Prescription Alarms ({alarms.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alarms.length > 0 ? (
              alarms.map((alarm) => (
                <div key={alarm.id} className="border border-teal-100 rounded-lg overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <Volume2 className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-teal-800">{alarm.medication_name}</h4>
                          <p className="text-sm text-teal-600">
                            {alarm.dosage} • {alarm.times_per_day}x daily
                          </p>
                          <p className="text-xs text-teal-500">
                            {alarm.reminder_times.map(time => formatTime(time)).join(', ')}
                          </p>
                          {alarm.instructions && (
                            <p className="text-xs text-gray-500 mt-1">{alarm.instructions}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                          Active
                        </Badge>
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
                <Timer className="w-12 h-12 mx-auto mb-4 text-teal-300" />
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