'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Calendar,
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Users,
  CalendarDays,
  Timer,
  Bell
} from "lucide-react"
import { createAppointmentRequestFromConsultationAction } from '@/lib/actions/consultation'

interface AppointmentRequestDialogProps {
  consultationId: string
  patientId: string
  patientName: string
  trigger: React.ReactNode
  onSuccess?: () => void
}

interface FormData {
  appointmentType: string
  reasonForVisit: string
  urgencyLevel: 'routine' | 'urgent' | 'emergency'
  delegateToAssistant: boolean
  requestedDate: string
  requestedTime: string
  additionalNotes: string
}

export function AppointmentRequestDialog({
  consultationId,
  patientId,
  patientName,
  trigger,
  onSuccess
}: AppointmentRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  const [formData, setFormData] = useState<FormData>({
    appointmentType: '',
    reasonForVisit: '',
    urgencyLevel: 'routine',
    delegateToAssistant: false,
    requestedDate: '',
    requestedTime: '09:00',
    additionalNotes: ''
  })

  const appointmentTypes = [
    'Follow-up Consultation',
    'Root Canal Treatment',
    'Dental Cleaning',
    'Tooth Extraction',
    'Dental Crown',
    'Dental Filling',
    'Dental Implant',
    'Orthodontic Treatment',
    'Periodontal Treatment',
    'Emergency Treatment',
    'Other'
  ]

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
  ]

  const updateFormData = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setResult(null) // Clear any previous results
  }

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'emergency': return 'destructive'
      case 'urgent': return 'secondary'
      default: return 'outline'
    }
  }

  const getUrgencyDescription = (level: string) => {
    switch (level) {
      case 'emergency': return 'Same day appointment required'
      case 'urgent': return 'Within 24-48 hours'
      default: return 'Within 1-2 weeks'
    }
  }

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0]

  // Get maximum date (3 months from now)
  const maxDate = new Date()
  maxDate.setMonth(maxDate.getMonth() + 3)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      const result = await createAppointmentRequestFromConsultationAction({
        consultationId,
        patientId,
        appointmentType: formData.appointmentType,
        reasonForVisit: formData.reasonForVisit,
        urgencyLevel: formData.urgencyLevel,
        delegateToAssistant: formData.delegateToAssistant,
        requestedDate: formData.requestedDate,
        requestedTime: formData.requestedTime + ':00',
        additionalNotes: formData.additionalNotes
      })

      setResult(result)

      if (result.success) {
        // Reset form on success
        setFormData({
          appointmentType: '',
          reasonForVisit: '',
          urgencyLevel: 'routine',
          delegateToAssistant: false,
          requestedDate: '',
          requestedTime: '09:00',
          additionalNotes: ''
        })

        // Close dialog after showing success message
        setTimeout(() => {
          setOpen(false)
          onSuccess?.()
        }, 2000)
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'An unexpected error occurred. Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            Create Appointment Request
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Schedule a follow-up appointment for {patientName} based on this consultation
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {result && (
            <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
                <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
                  {result.success ? result.message : result.error}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Appointment Type */}
          <div className="space-y-2">
            <Label htmlFor="appointmentType" className="text-sm font-medium">
              Appointment Type *
            </Label>
            <Select value={formData.appointmentType} onValueChange={(value) => updateFormData('appointmentType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select appointment type" />
              </SelectTrigger>
              <SelectContent>
                {appointmentTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason for Visit */}
          <div className="space-y-2">
            <Label htmlFor="reasonForVisit" className="text-sm font-medium">
              Reason for Visit *
            </Label>
            <Textarea
              id="reasonForVisit"
              placeholder="Describe the reason for the follow-up appointment..."
              value={formData.reasonForVisit}
              onChange={(e) => updateFormData('reasonForVisit', e.target.value)}
              rows={3}
              required
            />
          </div>

          {/* Urgency Level */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Urgency Level
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {(['routine', 'urgent', 'emergency'] as const).map((level) => (
                <div
                  key={level}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.urgencyLevel === level
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => updateFormData('urgencyLevel', level)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={getUrgencyColor(level)} className="text-xs">
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Badge>
                    {formData.urgencyLevel === level && (
                      <CheckCircle className="w-4 h-4 text-teal-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{getUrgencyDescription(level)}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Delegation Option */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Delegate to Assistant
                </Label>
                <p className="text-xs text-gray-600">
                  Let your assistant handle the appointment scheduling
                </p>
              </div>
              <Switch
                checked={formData.delegateToAssistant}
                onCheckedChange={(checked) => updateFormData('delegateToAssistant', checked)}
              />
            </div>

            {formData.delegateToAssistant && (
              <Alert className="border-blue-200 bg-blue-50">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  This request will be added to the assistant's task list for scheduling
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Scheduling Preferences (only if not delegating) */}
          {!formData.delegateToAssistant && (
            <div className="space-y-4">
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-teal-600" />
                  Scheduling Preferences
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="requestedDate" className="text-sm font-medium">
                      Preferred Date
                    </Label>
                    <Input
                      id="requestedDate"
                      type="date"
                      value={formData.requestedDate}
                      onChange={(e) => updateFormData('requestedDate', e.target.value)}
                      min={minDate}
                      max={maxDateStr}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requestedTime" className="text-sm font-medium">
                      Preferred Time
                    </Label>
                    <Select value={formData.requestedTime} onValueChange={(value) => updateFormData('requestedTime', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map(time => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="additionalNotes" className="text-sm font-medium">
              Additional Notes
            </Label>
            <Textarea
              id="additionalNotes"
              placeholder="Any special instructions or additional information..."
              value={formData.additionalNotes}
              onChange={(e) => updateFormData('additionalNotes', e.target.value)}
              rows={2}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || !formData.appointmentType || !formData.reasonForVisit}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating Request...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  {formData.delegateToAssistant ? 'Assign to Assistant' : 'Create Appointment Request'}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>

          {/* Request Summary */}
          {formData.appointmentType && formData.reasonForVisit && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
                Request Summary
              </h5>
              <div className="space-y-2 text-sm text-gray-700">
                <div><span className="font-medium">Type:</span> {formData.appointmentType}</div>
                <div><span className="font-medium">Patient:</span> {patientName}</div>
                <div><span className="font-medium">Urgency:</span>
                  <Badge variant={getUrgencyColor(formData.urgencyLevel)} className="ml-2 text-xs">
                    {formData.urgencyLevel}
                  </Badge>
                </div>
                <div><span className="font-medium">Handling:</span> {formData.delegateToAssistant ? 'Assistant will schedule' : 'Direct scheduling'}</div>
                {!formData.delegateToAssistant && formData.requestedDate && (
                  <div><span className="font-medium">Preferred:</span> {formData.requestedDate} at {formData.requestedTime}</div>
                )}
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}