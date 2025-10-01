'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, User, AlertTriangle } from "lucide-react"
import { format } from 'date-fns'
import { createAppointmentRequest } from '@/lib/actions/appointments'

interface AppointmentRequestModalProps {
  isOpen: boolean
  onClose: () => void
  consultationId?: string
  patientId: string
  patientName: string
  suggestedTreatments?: string[]
  urgencyLevel?: 'routine' | 'urgent' | 'emergency'
}

export function AppointmentRequestModal({
  isOpen,
  onClose,
  consultationId,
  patientId,
  patientName,
  suggestedTreatments = [],
  urgencyLevel = 'routine'
}: AppointmentRequestModalProps) {
  const [formData, setFormData] = useState({
    appointmentType: '',
    preferredDate: '',
    preferredTime: '',
    reasonForVisit: '',
    urgency: urgencyLevel,
    additionalNotes: '',
    estimatedDuration: '60'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const appointmentData = {
        patientId,
        appointmentType: formData.appointmentType,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        reasonForVisit: formData.reasonForVisit,
        additionalNotes: `${formData.additionalNotes}${consultationId ? `\n\nGenerated from consultation: ${consultationId}` : ''}\n\nEstimated Duration: ${formData.estimatedDuration} minutes\nUrgency: ${formData.urgency}`,
        painLevel: getUrgencyPainLevel(formData.urgency)
      }

      const result = await createAppointmentRequest(appointmentData)

      if (result.success) {
        alert('Appointment request submitted successfully!')
        onClose()
        // Reset form
        setFormData({
          appointmentType: '',
          preferredDate: '',
          preferredTime: '',
          reasonForVisit: '',
          urgency: 'routine',
          additionalNotes: '',
          estimatedDuration: '60'
        })
      } else {
        alert(`Failed to submit appointment request: ${result.error}`)
      }
    } catch (error) {
      console.error('Error submitting appointment request:', error)
      alert('Failed to submit appointment request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getUrgencyPainLevel = (urgency: string): number => {
    switch (urgency) {
      case 'emergency': return 9
      case 'urgent': return 6
      case 'routine': return 2
      default: return 2
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'text-red-600 bg-red-50 border-red-200'
      case 'urgent': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'routine': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const appointmentTypes = [
    'Consultation',
    'Routine Cleaning',
    'Filling',
    'Root Canal Therapy',
    'Crown Placement',
    'Extraction',
    'Periodontal Treatment',
    'Orthodontic Consultation',
    'Implant Consultation',
    'Emergency Visit',
    'Follow-up',
    'Other'
  ]

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00'
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule Appointment Request
          </DialogTitle>
          <div className="text-sm text-gray-600">
            Creating appointment request for: <span className="font-medium">{patientName}</span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
          {/* Urgency Level */}
          <div className={`p-3 rounded-lg border-2 ${getUrgencyColor(formData.urgency)}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Urgency Level: {formData.urgency.charAt(0).toUpperCase() + formData.urgency.slice(1)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['routine', 'urgent', 'emergency'].map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, urgency: level as any }))}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    formData.urgency === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Appointment Type */}
          <div>
            <Label htmlFor="appointmentType">Appointment Type *</Label>
            <Select
              value={formData.appointmentType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, appointmentType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select appointment type..." />
              </SelectTrigger>
              <SelectContent>
                {appointmentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Suggested Treatments */}
          {suggestedTreatments.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Suggested Treatments from Consultation:</h4>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                {suggestedTreatments.map((treatment, index) => (
                  <li key={index}>{treatment}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preferredDate">Preferred Date *</Label>
              <Input
                id="preferredDate"
                type="date"
                value={formData.preferredDate}
                onChange={(e) => setFormData(prev => ({ ...prev, preferredDate: e.target.value }))}
                min={format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>
            <div>
              <Label htmlFor="preferredTime">Preferred Time *</Label>
              <Select
                value={formData.preferredTime}
                onValueChange={(value) => setFormData(prev => ({ ...prev, preferredTime: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time..." />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estimated Duration */}
          <div>
            <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
            <Select
              value={formData.estimatedDuration}
              onValueChange={(value) => setFormData(prev => ({ ...prev, estimatedDuration: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="180">3 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason for Visit */}
          <div>
            <Label htmlFor="reasonForVisit">Reason for Visit *</Label>
            <Textarea
              id="reasonForVisit"
              value={formData.reasonForVisit}
              onChange={(e) => setFormData(prev => ({ ...prev, reasonForVisit: e.target.value }))}
              placeholder="Describe the purpose of this appointment..."
              rows={3}
              required
            />
          </div>

          {/* Additional Notes */}
          <div>
            <Label htmlFor="additionalNotes">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              value={formData.additionalNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
              placeholder="Any special requirements or additional information..."
              rows={3}
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.appointmentType || !formData.preferredDate || !formData.preferredTime || !formData.reasonForVisit}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </div>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}