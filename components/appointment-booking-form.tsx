'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Clock, User } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { confirmAppointmentAction } from "@/lib/actions/appointments"
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AppointmentVoiceRecorder } from '@/components/appointment/AppointmentVoiceRecorder'
import type { AppointmentExtraction } from '@/lib/services/appointment-conversation-parser'

interface AppointmentBookingFormProps {
  requestId: string
  availableDentists: any[]
  preferredDate: string
  preferredTime: string
  appointmentType: string
  isUrgent?: boolean
}

export function AppointmentBookingForm({
  requestId,
  availableDentists,
  preferredDate,
  preferredTime,
  appointmentType,
  isUrgent = false
}: AppointmentBookingFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Safely parse the preferred date with fallback
  const parsePreferredDate = (dateStr: string) => {
    try {
      const parsed = new Date(dateStr)
      if (isNaN(parsed.getTime())) {
        console.warn('Invalid date string:', dateStr)
        return new Date() // fallback to today
      }
      return parsed
    } catch (error) {
      console.warn('Error parsing date:', error)
      return new Date() // fallback to today
    }
  }
  
  const [selectedDate, setSelectedDate] = useState<Date>(parsePreferredDate(preferredDate))
  const [formData, setFormData] = useState({
    dentistId: '',
    scheduledTime: preferredTime,
    durationMinutes: 60,
    notes: ''
  })

  // Handle voice-extracted appointment data
  const handleVoiceDataExtracted = (data: AppointmentExtraction) => {
    console.log('📋 [VOICE AUTO-FILL] Extracted appointment data:', data)
    
    // Auto-fill date
    if (data.preferredDate) {
      try {
        const voiceDate = new Date(data.preferredDate)
        if (!isNaN(voiceDate.getTime())) {
          setSelectedDate(voiceDate)
          console.log('✅ [VOICE AUTO-FILL] Date set to:', data.preferredDate)
        }
      } catch (error) {
        console.error('Error parsing voice date:', error)
      }
    }

    // Auto-fill time
    if (data.preferredTime) {
      setFormData(prev => ({ ...prev, scheduledTime: data.preferredTime }))
      console.log('✅ [VOICE AUTO-FILL] Time set to:', data.preferredTime)
    }

    // Auto-fill duration
    if (data.durationMinutes) {
      setFormData(prev => ({ ...prev, durationMinutes: data.durationMinutes }))
      console.log('✅ [VOICE AUTO-FILL] Duration set to:', data.durationMinutes)
    }

    // Auto-fill notes
    if (data.reasonForVisit || data.additionalNotes) {
      const notes = [data.reasonForVisit, data.additionalNotes].filter(Boolean).join('. ')
      setFormData(prev => ({ ...prev, notes }))
      console.log('✅ [VOICE AUTO-FILL] Notes set')
    }

    // Show success toast
    toast.success(`AI extracted appointment details with ${data.confidence}% confidence!`, {
      description: `${data.appointmentType} on ${format(new Date(data.preferredDate), 'PPP')} at ${data.preferredTime}`
    })
  }

  // Generate time slots (9 AM to 5 PM, 30-minute intervals)
  const timeSlots = []
  for (let hour = 9; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      timeSlots.push(time)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.dentistId || !selectedDate) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await confirmAppointmentAction(requestId, {
        dentistId: formData.dentistId,
        scheduledDate: format(selectedDate, 'yyyy-MM-dd'),
        scheduledTime: formData.scheduledTime,
        durationMinutes: formData.durationMinutes,
        notes: formData.notes
      })

      if (result && result.success) {
        toast.success('Appointment confirmed successfully!')
        router.push('/assistant?confirmed=success')
      } else {
        toast.error((result && result.error) || 'Failed to confirm appointment')
      }
    } catch (error) {
      console.error('Error confirming appointment:', error)
      toast.error('Failed to confirm appointment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Voice Recorder for AI Scheduling */}
      <AppointmentVoiceRecorder
        onAppointmentDataExtracted={handleVoiceDataExtracted}
        isEnabled={true}
      />

      {isUrgent && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800 text-sm font-medium">
            <Clock className="h-4 w-4" />
            High Priority - Consider urgent scheduling
          </div>
        </div>
      )}

      {/* Dentist Selection */}
      <div className="space-y-2">
        <Label htmlFor="dentist" className="text-sm font-medium">
          Assign Dentist *
        </Label>
        <Select
          value={formData.dentistId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, dentistId: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a dentist" />
          </SelectTrigger>
          <SelectContent>
            {availableDentists.map((dentist) => (
              <SelectItem key={dentist.id} value={dentist.id}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{dentist.full_name}</div>
                    {dentist.specialty && (
                      <div className="text-xs text-gray-500">{dentist.specialty}</div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Appointment Date *
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate && !isNaN(selectedDate.getTime()) ? format(selectedDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <div className="text-xs text-gray-500">
          Original request: {(() => {
            try {
              const date = new Date(preferredDate)
              return isNaN(date.getTime()) ? 'Invalid date' : format(date, "PPP")
            } catch (error) {
              return 'Invalid date'
            }
          })()}
        </div>
      </div>

      {/* Time Selection */}
      <div className="space-y-2">
        <Label htmlFor="time" className="text-sm font-medium">
          Appointment Time *
        </Label>
        <Select
          value={formData.scheduledTime}
          onValueChange={(value) => setFormData(prev => ({ ...prev, scheduledTime: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {timeSlots.map((time) => (
              <SelectItem key={time} value={time}>
                {format(new Date(`2000-01-01T${time}`), 'h:mm a')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-gray-500">
          Preferred time: {preferredTime}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label htmlFor="duration" className="text-sm font-medium">
          Duration (minutes)
        </Label>
        <Select
          value={formData.durationMinutes.toString()}
          onValueChange={(value) => setFormData(prev => ({ ...prev, durationMinutes: parseInt(value) }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="90">1.5 hours</SelectItem>
            <SelectItem value="120">2 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          Appointment Notes
        </Label>
        <Textarea
          id="notes"
          placeholder="Add any special notes for this appointment..."
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
        />
      </div>

      {/* Appointment Type Display */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-700">Appointment Type</div>
        <div className="text-sm text-gray-600">{appointmentType}</div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-teal-600 hover:bg-teal-700"
        >
          {isSubmitting ? 'Confirming...' : 'Confirm Appointment'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="px-6"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}