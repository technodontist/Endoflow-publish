'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Clock,
  Bell,
  CheckCircle,
  AlertTriangle,
  User,
  FileText,
  Plus,
  Phone,
  Mail,
  MessageSquare,
  Edit,
  Save,
  X
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { format, addDays, addWeeks, addMonths } from 'date-fns'

interface FollowUp {
  id?: string
  patientId: string
  dentistId: string
  treatmentId?: string
  toothNumber?: string
  followUpType: 'treatment_check' | 'healing_assessment' | 'next_phase' | 'medication_review' | 'general_checkup'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  scheduledDate: string
  scheduledTime: string
  duration: number
  description: string
  instructions: string
  reminderDays: number[]
  status: 'scheduled' | 'completed' | 'missed' | 'rescheduled' | 'cancelled'
  notes?: string
  createdDate: string
  completedDate?: string
}

interface FollowUpManagementProps {
  patientId?: string
  treatmentId?: string
  toothNumber?: string
  onFollowUpSave?: (followUp: FollowUp) => void
  existingFollowUps?: FollowUp[]
}

const FOLLOW_UP_TYPES = [
  {
    value: 'treatment_check',
    label: 'Treatment Follow-up',
    description: 'Check healing and treatment progress',
    defaultDuration: 30,
    icon: CheckCircle
  },
  {
    value: 'healing_assessment',
    label: 'Healing Assessment',
    description: 'Assess post-operative healing',
    defaultDuration: 20,
    icon: Calendar
  },
  {
    value: 'next_phase',
    label: 'Next Treatment Phase',
    description: 'Continue multi-phase treatment',
    defaultDuration: 60,
    icon: Clock
  },
  {
    value: 'medication_review',
    label: 'Medication Review',
    description: 'Review and adjust medications',
    defaultDuration: 15,
    icon: FileText
  },
  {
    value: 'general_checkup',
    label: 'General Checkup',
    description: 'Routine dental examination',
    defaultDuration: 45,
    icon: User
  }
]

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800 border-gray-300',
  medium: 'bg-blue-100 text-blue-800 border-blue-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  urgent: 'bg-red-100 text-red-800 border-red-300'
}

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  missed: 'bg-red-100 text-red-800',
  rescheduled: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-gray-100 text-gray-800'
}

export function FollowUpManagement({
  patientId,
  treatmentId,
  toothNumber,
  onFollowUpSave,
  existingFollowUps = []
}: FollowUpManagementProps) {
  const [followUps, setFollowUps] = useState<FollowUp[]>(existingFollowUps)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [newFollowUp, setNewFollowUp] = useState<Partial<FollowUp>>({
    patientId: patientId || '',
    dentistId: 'current-dentist-id',
    treatmentId,
    toothNumber,
    followUpType: 'treatment_check',
    priority: 'medium',
    scheduledDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    scheduledTime: '10:00',
    duration: 30,
    description: '',
    instructions: '',
    reminderDays: [1, 3],
    status: 'scheduled',
    createdDate: new Date().toISOString()
  })

  const getQuickScheduleOptions = () => [
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'In 3 days', date: addDays(new Date(), 3) },
    { label: 'Next week', date: addWeeks(new Date(), 1) },
    { label: 'In 2 weeks', date: addWeeks(new Date(), 2) },
    { label: 'Next month', date: addMonths(new Date(), 1) }
  ]

  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(time)
      }
    }
    return slots
  }

  const handleTypeChange = (type: string) => {
    const typeConfig = FOLLOW_UP_TYPES.find(t => t.value === type)
    setNewFollowUp(prev => ({
      ...prev,
      followUpType: type as FollowUp['followUpType'],
      duration: typeConfig?.defaultDuration || 30,
      description: typeConfig?.description || ''
    }))
  }

  const handleQuickSchedule = (date: Date) => {
    setNewFollowUp(prev => ({
      ...prev,
      scheduledDate: format(date, 'yyyy-MM-dd')
    }))
  }

  const saveFollowUp = () => {
    const followUp: FollowUp = {
      ...newFollowUp as FollowUp,
      id: editingFollowUp?.id || Date.now().toString()
    }

    if (editingFollowUp) {
      setFollowUps(prev => prev.map(f => f.id === editingFollowUp.id ? followUp : f))
    } else {
      setFollowUps(prev => [...prev, followUp])
    }

    onFollowUpSave?.(followUp)
    resetForm()
  }

  const resetForm = () => {
    setNewFollowUp({
      patientId: patientId || '',
      dentistId: 'current-dentist-id',
      treatmentId,
      toothNumber,
      followUpType: 'treatment_check',
      priority: 'medium',
      scheduledDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      scheduledTime: '10:00',
      duration: 30,
      description: '',
      instructions: '',
      reminderDays: [1, 3],
      status: 'scheduled',
      createdDate: new Date().toISOString()
    })
    setEditingFollowUp(null)
    setIsCreateOpen(false)
  }

  const markAsCompleted = (followUpId: string, notes?: string) => {
    setFollowUps(prev => prev.map(f =>
      f.id === followUpId
        ? { ...f, status: 'completed', completedDate: new Date().toISOString(), notes }
        : f
    ))
  }

  const updateStatus = (followUpId: string, status: FollowUp['status']) => {
    setFollowUps(prev => prev.map(f =>
      f.id === followUpId ? { ...f, status } : f
    ))
  }

  const groupedFollowUps = {
    upcoming: followUps.filter(f => f.status === 'scheduled' && new Date(f.scheduledDate) >= new Date()),
    overdue: followUps.filter(f => f.status === 'scheduled' && new Date(f.scheduledDate) < new Date()),
    completed: followUps.filter(f => f.status === 'completed'),
    other: followUps.filter(f => !['scheduled', 'completed'].includes(f.status))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Follow-up Management</h2>
          <p className="text-gray-600">Schedule and track patient follow-up appointments</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Schedule Follow-up
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {getQuickScheduleOptions().map((option) => (
          <Card
            key={option.label}
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => {
              handleQuickSchedule(option.date)
              setIsCreateOpen(true)
            }}
          >
            <CardContent className="p-4 text-center">
              <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-gray-500">{format(option.date, 'MMM d')}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Follow-up Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Upcoming Follow-ups ({groupedFollowUps.upcoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedFollowUps.upcoming.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming follow-ups scheduled</p>
              </div>
            ) : (
              groupedFollowUps.upcoming.map((followUp) => (
                <div key={followUp.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={PRIORITY_COLORS[followUp.priority]}>
                          {followUp.priority}
                        </Badge>
                        {followUp.toothNumber && (
                          <Badge variant="outline">Tooth {followUp.toothNumber}</Badge>
                        )}
                      </div>

                      <h4 className="font-medium">
                        {FOLLOW_UP_TYPES.find(t => t.value === followUp.followUpType)?.label}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">{followUp.description}</p>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(followUp.scheduledDate), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {followUp.scheduledTime} ({followUp.duration}min)
                        </span>
                      </div>

                      {followUp.instructions && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                          <strong>Instructions:</strong> {followUp.instructions}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingFollowUp(followUp)
                          setNewFollowUp(followUp)
                          setIsCreateOpen(true)
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => markAsCompleted(followUp.id!)}
                      >
                        <CheckCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Overdue & Other Follow-ups */}
        <div className="space-y-6">
          {/* Overdue */}
          {groupedFollowUps.overdue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Overdue Follow-ups ({groupedFollowUps.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedFollowUps.overdue.map((followUp) => (
                  <div key={followUp.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-red-900">
                          {FOLLOW_UP_TYPES.find(t => t.value === followUp.followUpType)?.label}
                        </h4>
                        <p className="text-sm text-red-700">{followUp.description}</p>
                        <div className="text-sm text-red-600 mt-1">
                          Due: {format(new Date(followUp.scheduledDate), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(followUp.id!, 'rescheduled')}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => markAsCompleted(followUp.id!)}
                        >
                          Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Completed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Recent Completed ({groupedFollowUps.completed.slice(0, 5).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedFollowUps.completed.slice(0, 5).map((followUp) => (
                <div key={followUp.id} className="p-3 border rounded-lg bg-green-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-green-900">
                        {FOLLOW_UP_TYPES.find(t => t.value === followUp.followUpType)?.label}
                      </h4>
                      <div className="text-sm text-green-700">
                        Completed: {followUp.completedDate && format(new Date(followUp.completedDate), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      Completed
                    </Badge>
                  </div>
                  {followUp.notes && (
                    <div className="mt-2 text-sm text-green-700">
                      <strong>Notes:</strong> {followUp.notes}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Follow-up Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        if (!open) resetForm()
        setIsCreateOpen(open)
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFollowUp ? 'Edit Follow-up' : 'Schedule New Follow-up'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Follow-up Type</Label>
                <Select
                  value={newFollowUp.followUpType}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={newFollowUp.priority}
                  onValueChange={(value: any) => setNewFollowUp(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newFollowUp.description}
                onChange={(e) => setNewFollowUp(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the purpose of this follow-up..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newFollowUp.scheduledDate}
                  onChange={(e) => setNewFollowUp(prev => ({ ...prev, scheduledDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Time</Label>
                <Select
                  value={newFollowUp.scheduledTime}
                  onValueChange={(value) => setNewFollowUp(prev => ({ ...prev, scheduledTime: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeSlots().map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={newFollowUp.duration}
                  onChange={(e) => setNewFollowUp(prev => ({ ...prev, duration: Number(e.target.value) }))}
                  min="15"
                  max="120"
                />
              </div>
            </div>

            <div>
              <Label>Special Instructions</Label>
              <Textarea
                value={newFollowUp.instructions}
                onChange={(e) => setNewFollowUp(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Any special instructions for the patient..."
                rows={2}
              />
            </div>

            <div>
              <Label>Reminder Days (before appointment)</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 7].map((day) => (
                  <label key={day} className="flex items-center gap-2">
                    <Checkbox
                      checked={newFollowUp.reminderDays?.includes(day)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewFollowUp(prev => ({
                            ...prev,
                            reminderDays: [...(prev.reminderDays || []), day]
                          }))
                        } else {
                          setNewFollowUp(prev => ({
                            ...prev,
                            reminderDays: (prev.reminderDays || []).filter(d => d !== day)
                          }))
                        }
                      }}
                    />
                    <span className="text-sm">{day} day{day > 1 ? 's' : ''}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={saveFollowUp} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {editingFollowUp ? 'Update Follow-up' : 'Schedule Follow-up'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}