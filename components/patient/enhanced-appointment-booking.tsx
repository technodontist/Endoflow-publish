'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Info,
  Bell,
  ThermometerSun
} from "lucide-react"
import { bookAppointment, getAvailableSlots } from "@/lib/actions/patient"
import { AppointmentAvailability, TimeSlot } from "@/lib/services/appointments"

interface EnhancedAppointmentBookingProps {
  onClose: () => void
  onSuccess?: () => void
}

interface FormData {
  chiefComplaint: string
  painLevel: number
  urgency: 'routine' | 'urgent' | 'emergency'
  preferredDate: string
  preferredTime: string
  additionalNotes: string
}

interface FormErrors {
  chiefComplaint?: string
  painLevel?: string
  preferredDate?: string
  preferredTime?: string
}

export function EnhancedAppointmentBooking({ onClose, onSuccess }: EnhancedAppointmentBookingProps) {
  const [formData, setFormData] = useState<FormData>({
    chiefComplaint: '',
    painLevel: 0,
    urgency: 'routine',
    preferredDate: '',
    preferredTime: '',
    additionalNotes: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<AppointmentAvailability[]>([])
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  // Load available slots when date changes
  useEffect(() => {
    if (formData.preferredDate) {
      loadAvailableSlots()
    }
  }, [formData.preferredDate])

  const loadAvailableSlots = async () => {
    setIsLoadingSlots(true)
    try {
      const endDate = new Date(formData.preferredDate)
      endDate.setDate(endDate.getDate() + 7) // Load next 7 days from selected date

      const result = await getAvailableSlots(
        formData.preferredDate,
        endDate.toISOString().split('T')[0],
        60 // Default 60 minute appointments
      )

      if (result && result.success && result.data) {
        setAvailableSlots(result.data)
      } else {
        console.error('Failed to load available slots:', result?.error || 'Unknown error')
        setAvailableSlots([])
      }
    } catch (error) {
      console.error('Error loading available slots:', error)
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {}

    if (!formData.chiefComplaint.trim()) {
      newErrors.chiefComplaint = 'Please describe your main concern'
    } else if (formData.chiefComplaint.trim().length < 10) {
      newErrors.chiefComplaint = 'Please provide more detail about your concern'
    }

    if (formData.painLevel < 0 || formData.painLevel > 10) {
      newErrors.painLevel = 'Pain level must be between 0 and 10'
    }

    if (!formData.preferredDate) {
      newErrors.preferredDate = 'Please select a preferred date'
    } else {
      const selectedDate = new Date(formData.preferredDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (selectedDate < today) {
        newErrors.preferredDate = 'Date cannot be in the past'
      }

      // Check if it's a weekend
      if (selectedDate.getDay() === 0 || selectedDate.getDay() === 6) {
        newErrors.preferredDate = 'Please select a weekday (Monday-Friday)'
      }
    }

    if (!formData.preferredTime) {
      newErrors.preferredTime = 'Please select a preferred time'
    }

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors = validateForm()
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      // Parse the selected time slot to extract time and dentist ID
      const [selectedTime, dentistId] = formData.preferredTime.includes('-')
        ? formData.preferredTime.split('-')
        : [formData.preferredTime, '']

      const formDataObj = new FormData()
      formDataObj.append('chiefComplaint', formData.chiefComplaint)
      formDataObj.append('painLevel', formData.painLevel.toString())
      formDataObj.append('urgency', formData.urgency)
      formDataObj.append('preferredDate', formData.preferredDate)
      formDataObj.append('preferredTime', selectedTime)
      formDataObj.append('dentistId', dentistId)
      formDataObj.append('additionalNotes', formData.additionalNotes)

      const result = await bookAppointment(formDataObj)

      setSubmitResult(result)

      if (result && result.success) {
        // Reset form
        setFormData({
          chiefComplaint: '',
          painLevel: 0,
          urgency: 'routine',
          preferredDate: '',
          preferredTime: '',
          additionalNotes: ''
        })

        // Call success callback after a delay to show success message
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 2000)
      }
    } catch (error) {
      console.error('Error submitting appointment request:', error)
      setSubmitResult({
        success: false,
        error: 'An unexpected error occurred. Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'destructive'
      case 'urgent': return 'secondary'
      default: return 'outline'
    }
  }

  const getPainLevelColor = (level: number) => {
    if (level >= 8) return 'text-red-600'
    if (level >= 5) return 'text-orange-500'
    if (level >= 3) return 'text-yellow-500'
    return 'text-green-600'
  }

  const getAvailableTimesForDate = (date: string): TimeSlot[] => {
    const daySlots = availableSlots.find(slot => slot.date === date)
    return daySlots?.timeSlots.filter(slot => slot.available) || []
  }

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0]

  // Get maximum date (6 months from now)
  const maxDate = new Date()
  maxDate.setMonth(maxDate.getMonth() + 6)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  return (
    <Card className="w-full max-w-2xl mx-auto bg-white border border-gray-200 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-600" />
            Book New Appointment
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {submitResult && (
          <Alert className={submitResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <div className="flex items-center gap-2">
              {submitResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              <AlertDescription className={submitResult.success ? 'text-green-800' : 'text-red-800'}>
                {submitResult.success ? 'Appointment request submitted successfully!' : submitResult.error}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chief Complaint */}
          <div className="space-y-2">
            <Label htmlFor="chiefComplaint" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              Chief Complaint *
              <Info className="w-4 h-4 text-gray-500" />
            </Label>
            <Textarea
              id="chiefComplaint"
              placeholder="Please describe your main concern or reason for visit in detail..."
              value={formData.chiefComplaint}
              onChange={(e) => updateFormData('chiefComplaint', e.target.value)}
              className={`resize-none bg-white text-gray-900 placeholder:text-gray-500 ${errors.chiefComplaint ? 'border-red-500' : 'border-gray-300'}`}
              rows={4}
            />
            {errors.chiefComplaint && (
              <p className="text-sm text-red-600">{errors.chiefComplaint}</p>
            )}
            <p className="text-xs text-gray-500">
              Be as specific as possible to help us prepare for your visit
            </p>
          </div>

          {/* Pain Level and Urgency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="painLevel" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <ThermometerSun className="w-4 h-4 text-gray-600" />
                Pain Level (0-10)
              </Label>
              <Select
                value={formData.painLevel.toString()}
                onValueChange={(value) => updateFormData('painLevel', parseInt(value))}
              >
                <SelectTrigger className={`bg-white text-gray-900 ${errors.painLevel ? 'border-red-500' : 'border-gray-300'}`}>
                  <SelectValue placeholder="Select pain level" />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <SelectItem key={level} value={level.toString()}>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${getPainLevelColor(level)}`}>{level}</span>
                        <span className="text-sm text-muted-foreground">
                          {level === 0 ? 'No pain' :
                           level <= 3 ? 'Mild' :
                           level <= 6 ? 'Moderate' :
                           level <= 8 ? 'Severe' : 'Extreme'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.painLevel && (
                <p className="text-sm text-red-600">{errors.painLevel}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
                Urgency Level
              </Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => updateFormData('urgency', value)}
              >
                <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Routine</Badge>
                      <span>Regular appointment</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Urgent</Badge>
                      <span>Within 24 hours</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="emergency">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">Emergency</Badge>
                      <span>ASAP</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Date and Time Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              Scheduling Preferences
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferredDate" className="text-sm font-medium text-gray-700">
                  Preferred Date *
                </Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => updateFormData('preferredDate', e.target.value)}
                  min={minDate}
                  max={maxDateStr}
                  className={`bg-white text-gray-900 ${errors.preferredDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.preferredDate && (
                  <p className="text-sm text-red-600">{errors.preferredDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredTime" className="text-sm font-medium text-gray-700">
                  Preferred Time *
                </Label>
                <Select
                  value={formData.preferredTime}
                  onValueChange={(value) => updateFormData('preferredTime', value)}
                >
                  <SelectTrigger className={`bg-white text-gray-900 ${errors.preferredTime ? 'border-red-500' : 'border-gray-300'}`}>
                    <SelectValue placeholder={isLoadingSlots ? "Loading..." : "Select time"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingSlots ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading available times...
                        </div>
                      </SelectItem>
                    ) : formData.preferredDate ? (
                      getAvailableTimesForDate(formData.preferredDate).length > 0 ? (
                        getAvailableTimesForDate(formData.preferredDate).map((slot) => (
                          <SelectItem key={`${slot.time}-${slot.dentistId}`} value={`${slot.time}-${slot.dentistId}`}>
                            <div className="flex items-center gap-2">
                              <span>{slot.time}</span>
                              <span className="text-xs text-muted-foreground">
                                with {slot.dentistName}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-slots" disabled>
                          No available slots for this date
                        </SelectItem>
                      )
                    ) : (
                      <SelectItem value="select-date" disabled>
                        Please select a date first
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.preferredTime && (
                  <p className="text-sm text-red-600">{errors.preferredTime}</p>
                )}
              </div>
            </div>

            {formData.urgency !== 'routine' && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {formData.urgency === 'emergency'
                    ? 'Emergency requests will be prioritized and you will be contacted within 1 hour.'
                    : 'Urgent requests will be scheduled within 24 hours when possible.'
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="additionalNotes" className="text-sm font-medium text-gray-700">
              Additional Notes
            </Label>
            <Textarea
              id="additionalNotes"
              placeholder="Any additional information, medical concerns, or special requests..."
              value={formData.additionalNotes}
              onChange={(e) => updateFormData('additionalNotes', e.target.value)}
              className="resize-none bg-white text-gray-900 placeholder:text-gray-500 border-gray-300"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              Include any medications, allergies, or specific requests
            </p>
          </div>

          {/* Current Selection Summary */}
          {formData.chiefComplaint && formData.preferredDate && formData.preferredTime && (
            <Card className="bg-teal-50 border-teal-200">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-sm mb-3 text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-600" />
                  Appointment Summary
                </h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div><span className="font-medium">Concern:</span> {formData.chiefComplaint.slice(0, 60)}{formData.chiefComplaint.length > 60 ? '...' : ''}</div>
                  <div className="flex items-center gap-4">
                    <span><span className="font-medium">Date:</span> {new Date(formData.preferredDate).toLocaleDateString()}</span>
                    <span><span className="font-medium">Time:</span> {formData.preferredTime.includes('-') ? formData.preferredTime.split('-')[0] : formData.preferredTime}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span><span className="font-medium">Pain Level:</span> {formData.painLevel}/10</span>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Priority:</span>
                      <Badge variant={getUrgencyColor(formData.urgency)} className="text-xs">
                        {formData.urgency}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || isLoadingSlots}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Submit Appointment Request
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}