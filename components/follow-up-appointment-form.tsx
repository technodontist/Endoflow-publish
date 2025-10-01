'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Plus, X, AlertTriangle } from "lucide-react"
import { getPatientToothDiagnoses } from '@/lib/actions/tooth-diagnoses'
import { createAppointmentRequestFromConsultationAction } from '@/lib/actions/consultation'
import { toast } from 'sonner'

interface FollowUpAppointment {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  scheduled_date: string
  duration: string
  notes: string
  tooth_specific?: string[]
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  linkedTreatment?: string
  linkedDiagnosis?: string
}

interface FollowUpAppointmentFormProps {
  patientId: string
  consultationId?: string
  appointmentId?: string
  initialData?: FollowUpAppointment[]
  onSave?: (appointments: FollowUpAppointment[]) => void
  showToothSelection?: boolean
}

export function FollowUpAppointmentForm({ 
  patientId, 
  consultationId, 
  appointmentId,
  initialData = [],
  onSave,
  showToothSelection = true
}: FollowUpAppointmentFormProps) {
  const [appointments, setAppointments] = useState<FollowUpAppointment[]>(initialData)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [toothData, setToothData] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load tooth data for diagnosis/treatment context
  useEffect(() => {
    const loadToothData = async () => {
      try {
        const res = await getPatientToothDiagnoses(patientId, null, true)
        if (res?.success) {
          setToothData(res.data || {})
        }
      } catch (e) {
        console.warn('Failed to load tooth data:', e)
      }
    }
    if (patientId) {
      loadToothData()
    }
  }, [patientId])

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default: return 'bg-green-100 text-green-800 border-green-300'
    }
  }

  const statusColor = (s?: string) => {
    switch (s || 'healthy') {
      case 'caries': return 'bg-red-50 border-red-200 text-red-700'
      case 'filled': return 'bg-blue-50 border-blue-200 text-blue-700'
      case 'crown': return 'bg-amber-50 border-amber-200 text-amber-700'
      case 'root_canal': return 'bg-violet-50 border-violet-200 text-violet-700'
      case 'missing': return 'bg-gray-50 border-gray-200 text-gray-600'
      case 'attention':
      case 'extraction_needed': return 'bg-orange-50 border-orange-200 text-orange-700'
      default: return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    }
  }

  const addAppointment = () => {
    const newAppt: FollowUpAppointment = {
      id: `appt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      type: '',
      priority: 'medium',
      scheduled_date: '',
      duration: '30',
      notes: '',
      tooth_specific: selectedTooth ? [selectedTooth] : undefined,
      status: 'scheduled',
      linkedTreatment: selectedTooth && toothData[selectedTooth]?.recommendedTreatment ? toothData[selectedTooth].recommendedTreatment : undefined,
      linkedDiagnosis: selectedTooth && toothData[selectedTooth]?.primaryDiagnosis ? toothData[selectedTooth].primaryDiagnosis : undefined
    }
    setAppointments([...appointments, newAppt])
  }

  const updateAppointment = (id: string, field: keyof FollowUpAppointment, value: any) => {
    setAppointments(apps => apps.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  const removeAppointment = (id: string) => {
    setAppointments(apps => apps.filter(a => a.id !== id))
  }

  const handleSubmit = async () => {
    if (appointments.length === 0) {
      toast.error('Please add at least one follow-up appointment')
      return
    }

    // Validate appointments
    const invalidAppts = appointments.filter(a => !a.type || !a.scheduled_date)
    if (invalidAppts.length > 0) {
      toast.error('Please fill in all required fields (type and date) for all appointments')
      return
    }

    setIsSubmitting(true)
    try {
      // Create appointment requests for each follow-up
      const results = []
      for (const appt of appointments) {
        if (consultationId) {
          // Create via consultation action
          const result = await createAppointmentRequestFromConsultationAction({
            consultationId,
            patientId,
            appointmentType: appt.type,
            reasonForVisit: `Follow-up: ${appt.notes || appt.type}${appt.linkedDiagnosis ? ` | Dx: ${appt.linkedDiagnosis}` : ''}${appt.linkedTreatment ? ` | Tx: ${appt.linkedTreatment}` : ''}`,
            urgencyLevel: appt.priority === 'urgent' ? 'urgent' : appt.priority === 'high' ? 'high' : 'routine',
            delegateToAssistant: true,
            requestedDate: appt.scheduled_date.split('T')[0],
            requestedTime: appt.scheduled_date.split('T')[1] || '09:00:00',
            additionalNotes: `Auto-generated follow-up${appt.tooth_specific ? ` for tooth ${appt.tooth_specific.join(', ')}` : ''}`
          })
          results.push(result)
        }
      }

      // Check if all succeeded
      const failed = results.filter(r => !(r as any)?.success)
      if (failed.length === 0) {
        toast.success(`${appointments.length} follow-up appointment request(s) created successfully!`)
        onSave?.(appointments)
        // Clear form
        setAppointments([])
      } else {
        toast.warning(`${results.length - failed.length}/${results.length} appointment requests created`)
      }
    } catch (error) {
      console.error('Error creating follow-up appointments:', error)
      toast.error('Failed to create follow-up appointments')
    } finally {
      setIsSubmitting(false)
    }
  }

  const QUICK_TYPES = [
    { label: 'Healing Check', value: 'healing_check', duration: 15 },
    { label: 'Suture Removal', value: 'suture_removal', duration: 15 },
    { label: 'Post-extraction Review', value: 'post_extraction_review', duration: 20 },
    { label: 'Medication Review', value: 'medication_review', duration: 15 },
    { label: 'Treatment Follow-up', value: 'treatment_followup', duration: 30 },
    { label: 'Routine Check', value: 'routine_check', duration: 30 }
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            Schedule Follow-up Appointments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tooth Selection (if enabled) */}
          {showToothSelection && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">Select Tooth (Optional)</Label>
              <div className="space-y-3">
                {/* Upper row */}
                <div className="flex flex-wrap gap-1">
                  {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map(n => {
                    const t = toothData[n.toString()]
                    const cls = statusColor(t?.status)
                    const isSel = selectedTooth === n.toString()
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`w-8 h-8 text-xs rounded border ${cls} ${isSel ? 'ring-2 ring-purple-400' : ''}`}
                        onClick={() => setSelectedTooth(n.toString())}
                        title={`Tooth ${n}${t?.primaryDiagnosis ? ' • ' + t.primaryDiagnosis : ''}${t?.recommendedTreatment ? ' → ' + t.recommendedTreatment : ''}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                {/* Lower row */}
                <div className="flex flex-wrap gap-1">
                  {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(n => {
                    const t = toothData[n.toString()]
                    const cls = statusColor(t?.status)
                    const isSel = selectedTooth === n.toString()
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`w-8 h-8 text-xs rounded border ${cls} ${isSel ? 'ring-2 ring-purple-400' : ''}`}
                        onClick={() => setSelectedTooth(n.toString())}
                        title={`Tooth ${n}${t?.primaryDiagnosis ? ' • ' + t.primaryDiagnosis : ''}${t?.recommendedTreatment ? ' → ' + t.recommendedTreatment : ''}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {selectedTooth && (
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-blue-900">Selected tooth #{selectedTooth}</div>
                    <div className="text-sm text-blue-700">
                      {toothData[selectedTooth]?.primaryDiagnosis && (
                        <span>Dx: {toothData[selectedTooth].primaryDiagnosis}</span>
                      )}
                      {toothData[selectedTooth]?.recommendedTreatment && (
                        <span className="ml-2">Tx: {toothData[selectedTooth].recommendedTreatment}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Appointment Button */}
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Follow-up Appointments</h3>
            <Button onClick={addAppointment} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Appointment
            </Button>
          </div>

          {/* Appointments List */}
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No follow-up appointments scheduled</p>
              <p className="text-sm">Click "Add Appointment" to create one</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt, index) => (
                <Card key={appt.id} className="p-4 border-l-4 border-l-teal-500">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={priorityColor(appt.priority)}>{appt.priority}</Badge>
                        {appt.tooth_specific && appt.tooth_specific.length > 0 && (
                          <Badge variant="outline">Tooth {appt.tooth_specific.join(', ')}</Badge>
                        )}
                        <span className="text-sm text-gray-600">#{index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAppointment(appt.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Appointment Type *</Label>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {QUICK_TYPES.map(qt => (
                            <button
                              key={qt.value}
                              type="button"
                              className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                              onClick={() => {
                                updateAppointment(appt.id, 'type', qt.label)
                                updateAppointment(appt.id, 'duration', qt.duration.toString())
                              }}
                            >
                              {qt.label}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={appt.type}
                          onChange={(e) => updateAppointment(appt.id, 'type', e.target.value)}
                          placeholder="Enter appointment type"
                          required
                        />
                      </div>

                      <div>
                        <Label>Priority</Label>
                        <Select
                          value={appt.priority}
                          onValueChange={(value) => updateAppointment(appt.id, 'priority', value)}
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

                      <div>
                        <Label>Date & Time *</Label>
                        <Input
                          type="datetime-local"
                          value={appt.scheduled_date}
                          onChange={(e) => updateAppointment(appt.id, 'scheduled_date', e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={appt.duration}
                          onChange={(e) => updateAppointment(appt.id, 'duration', e.target.value)}
                          min="15"
                          max="180"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={appt.notes}
                          onChange={(e) => updateAppointment(appt.id, 'notes', e.target.value)}
                          placeholder="Additional notes for this follow-up"
                          rows={2}
                        />
                      </div>

                      {appt.linkedDiagnosis && (
                        <div>
                          <Label>Linked Diagnosis</Label>
                          <Input value={appt.linkedDiagnosis} readOnly className="bg-gray-50" />
                        </div>
                      )}

                      {appt.linkedTreatment && (
                        <div>
                          <Label>Linked Treatment</Label>
                          <Input value={appt.linkedTreatment} readOnly className="bg-gray-50" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Submit Button */}
          {appointments.length > 0 && (
            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isSubmitting ? (
                  <>Creating...</>
                ) : (
                  <>Create {appointments.length} Follow-up Request{appointments.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}