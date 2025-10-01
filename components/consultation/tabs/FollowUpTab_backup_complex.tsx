'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Plus, Trash2, AlertTriangle, CheckCircle, Phone, Mail } from "lucide-react"
import { InteractiveDentalChart } from "@/components/dentist/interactive-dental-chart"

interface FollowUpAppointment {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  scheduled_date: string
  duration: string
  notes: string
  tooth_specific?: string[]
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
}

interface PostCareInstruction {
  id: string
  title: string
  description: string
  duration: string
  tooth_specific?: string[]
  importance: 'low' | 'medium' | 'high'
}

interface FollowUpData {
  appointments: FollowUpAppointment[]
  post_care_instructions: PostCareInstruction[]
  tooth_specific_follow_ups: {
    [toothNumber: string]: {
      appointments: FollowUpAppointment[]
      instructions: PostCareInstruction[]
      monitoring_notes: string
      healing_progress: string
    }
  }
  general_follow_up_notes: string
  next_visit_required: boolean
  emergency_contact_provided: boolean
  patient_education_completed: boolean
  recall_period: string
}

interface FollowUpTabProps {
  data: FollowUpData
  onChange: (data: FollowUpData) => void
  isReadOnly?: boolean
}

export function FollowUpTab({ data, onChange, isReadOnly = false }: FollowUpTabProps) {
  const [localData, setLocalData] = useState<FollowUpData>(data)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)

  useEffect(() => {
    setLocalData(data)
  }, [data])

  const handleUpdate = (field: keyof FollowUpData, value: any) => {
    const updatedData = { ...localData, [field]: value }
    setLocalData(updatedData)
    onChange(updatedData)
  }

  const addAppointment = (isToothSpecific = false) => {
    const newAppointment: FollowUpAppointment = {
      id: `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: '',
      priority: 'medium',
      scheduled_date: '',
      duration: '30',
      notes: '',
      tooth_specific: isToothSpecific && selectedTooth ? [selectedTooth] : undefined,
      status: 'scheduled'
    }

    if (isToothSpecific && selectedTooth) {
      const updatedToothFollowUps = {
        ...localData.tooth_specific_follow_ups,
        [selectedTooth]: {
          ...localData.tooth_specific_follow_ups[selectedTooth],
          appointments: [
            ...(localData.tooth_specific_follow_ups[selectedTooth]?.appointments || []),
            newAppointment
          ]
        }
      }
      handleUpdate('tooth_specific_follow_ups', updatedToothFollowUps)
    } else {
      handleUpdate('appointments', [...localData.appointments, newAppointment])
    }
  }

  const addInstruction = (isToothSpecific = false) => {
    const newInstruction: PostCareInstruction = {
      id: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      description: '',
      duration: '',
      tooth_specific: isToothSpecific && selectedTooth ? [selectedTooth] : undefined,
      importance: 'medium'
    }

    if (isToothSpecific && selectedTooth) {
      const updatedToothFollowUps = {
        ...localData.tooth_specific_follow_ups,
        [selectedTooth]: {
          ...localData.tooth_specific_follow_ups[selectedTooth],
          instructions: [
            ...(localData.tooth_specific_follow_ups[selectedTooth]?.instructions || []),
            newInstruction
          ]
        }
      }
      handleUpdate('tooth_specific_follow_ups', updatedToothFollowUps)
    } else {
      handleUpdate('post_care_instructions', [...localData.post_care_instructions, newInstruction])
    }
  }

  const updateAppointment = (appointmentId: string, field: keyof FollowUpAppointment, value: any, isToothSpecific = false) => {
    if (isToothSpecific && selectedTooth) {
      const updatedToothFollowUps = {
        ...localData.tooth_specific_follow_ups,
        [selectedTooth]: {
          ...localData.tooth_specific_follow_ups[selectedTooth],
          appointments: (localData.tooth_specific_follow_ups[selectedTooth]?.appointments || []).map(appt =>
            appt.id === appointmentId ? { ...appt, [field]: value } : appt
          )
        }
      }
      handleUpdate('tooth_specific_follow_ups', updatedToothFollowUps)
    } else {
      const updatedAppointments = localData.appointments.map(appt =>
        appt.id === appointmentId ? { ...appt, [field]: value } : appt
      )
      handleUpdate('appointments', updatedAppointments)
    }
  }

  const removeAppointment = (appointmentId: string, isToothSpecific = false) => {
    if (isToothSpecific && selectedTooth) {
      const updatedToothFollowUps = {
        ...localData.tooth_specific_follow_ups,
        [selectedTooth]: {
          ...localData.tooth_specific_follow_ups[selectedTooth],
          appointments: (localData.tooth_specific_follow_ups[selectedTooth]?.appointments || []).filter(appt => appt.id !== appointmentId)
        }
      }
      handleUpdate('tooth_specific_follow_ups', updatedToothFollowUps)
    } else {
      handleUpdate('appointments', localData.appointments.filter(appt => appt.id !== appointmentId))
    }
  }

  const getToothData = (toothNumber: string) => {
    return localData.tooth_specific_follow_ups[toothNumber] || {
      appointments: [],
      instructions: [],
      monitoring_notes: '',
      healing_progress: ''
    }
  }

  const getOralCavityStatus = () => {
    const toothNumbers = Array.from({ length: 32 }, (_, i) => (i + 1).toString())
    const followUpTeeth = Object.keys(localData.tooth_specific_follow_ups).filter(tooth =>
      localData.tooth_specific_follow_ups[tooth].appointments.length > 0 ||
      localData.tooth_specific_follow_ups[tooth].instructions.length > 0
    )

    return {
      total: 32,
      healthy: toothNumbers.length - followUpTeeth.length,
      monitoring: followUpTeeth.length,
      scheduled: followUpTeeth.filter(tooth =>
        localData.tooth_specific_follow_ups[tooth].appointments.some(appt => appt.status === 'scheduled')
      ).length
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-green-100 text-green-800 border-green-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const oralStatus = getOralCavityStatus()

  return (
    <div className="space-y-6">
      {/* Interactive Dental Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Tooth-Specific Follow-up Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <InteractiveDentalChart
              onToothSelect={(toothNumber) => {
                setSelectedTooth(toothNumber)
                console.log(`Selected tooth ${toothNumber} for follow-up`)
              }}
              toothData={{}}
              showLabels={true}
            />

            {/* Oral Cavity Status */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{oralStatus.total}</div>
                <div className="text-sm text-gray-600">Total Teeth</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{oralStatus.healthy}</div>
                <div className="text-sm text-gray-600">No Follow-up</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{oralStatus.monitoring}</div>
                <div className="text-sm text-gray-600">Monitoring</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{oralStatus.scheduled}</div>
                <div className="text-sm text-gray-600">Scheduled</div>
              </div>
            </div>

            {selectedTooth && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">
                  Selected: Tooth #{selectedTooth}
                </h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-blue-700">
                    {getToothData(selectedTooth).appointments.length} appointment(s)
                  </Badge>
                  <Badge variant="outline" className="text-blue-700">
                    {getToothData(selectedTooth).instructions.length} instruction(s)
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Follow-up Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                General Follow-up Appointments
              </CardTitle>
              <Button
                onClick={() => addAppointment(false)}
                size="sm"
                disabled={isReadOnly}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Appointment
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {localData.appointments.map((appointment) => (
              <Card key={appointment.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={getPriorityColor(appointment.priority)}>
                      {appointment.priority.toUpperCase()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAppointment(appointment.id, false)}
                      disabled={isReadOnly}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`appt-type-${appointment.id}`}>Appointment Type</Label>
                      <Select
                        value={appointment.type}
                        onValueChange={(value) => updateAppointment(appointment.id, 'type', value, false)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="routine-checkup">Routine Checkup</SelectItem>
                          <SelectItem value="post-operative">Post-operative</SelectItem>
                          <SelectItem value="healing-assessment">Healing Assessment</SelectItem>
                          <SelectItem value="suture-removal">Suture Removal</SelectItem>
                          <SelectItem value="pain-management">Pain Management</SelectItem>
                          <SelectItem value="complication-check">Complication Check</SelectItem>
                          <SelectItem value="progress-evaluation">Progress Evaluation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`appt-priority-${appointment.id}`}>Priority</Label>
                      <Select
                        value={appointment.priority}
                        onValueChange={(value) => updateAppointment(appointment.id, 'priority', value as any, false)}
                        disabled={isReadOnly}
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
                      <Label htmlFor={`appt-date-${appointment.id}`}>Scheduled Date</Label>
                      <Input
                        id={`appt-date-${appointment.id}`}
                        type="datetime-local"
                        value={appointment.scheduled_date}
                        onChange={(e) => updateAppointment(appointment.id, 'scheduled_date', e.target.value, false)}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`appt-duration-${appointment.id}`}>Duration (minutes)</Label>
                      <Input
                        id={`appt-duration-${appointment.id}`}
                        type="number"
                        value={appointment.duration}
                        onChange={(e) => updateAppointment(appointment.id, 'duration', e.target.value, false)}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`appt-notes-${appointment.id}`}>Appointment Notes</Label>
                    <Textarea
                      id={`appt-notes-${appointment.id}`}
                      value={appointment.notes}
                      onChange={(e) => updateAppointment(appointment.id, 'notes', e.target.value, false)}
                      placeholder="Notes for this appointment..."
                      rows={2}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </Card>
            ))}

            {localData.appointments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No general follow-up appointments scheduled</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tooth-Specific Follow-ups */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Tooth-Specific Follow-up
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => addAppointment(true)}
                  size="sm"
                  disabled={isReadOnly || !selectedTooth}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Appointment
                </Button>
                <Button
                  onClick={() => addInstruction(true)}
                  size="sm"
                  variant="outline"
                  disabled={isReadOnly || !selectedTooth}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Instruction
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTooth ? (
              <>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800">Tooth #{selectedTooth} Follow-up Plan</h4>
                </div>

                {/* Tooth-specific appointments */}
                {getToothData(selectedTooth).appointments.map((appointment) => (
                  <Card key={appointment.id} className="p-4 border-blue-200">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-blue-700">
                            Tooth #{selectedTooth}
                          </Badge>
                          <Badge className={getPriorityColor(appointment.priority)}>
                            {appointment.priority}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAppointment(appointment.id, true)}
                          disabled={isReadOnly}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Type</Label>
                          <Select
                            value={appointment.type}
                            onValueChange={(value) => updateAppointment(appointment.id, 'type', value, true)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="post-extraction">Post-extraction Check</SelectItem>
                              <SelectItem value="endodontic-follow-up">Endodontic Follow-up</SelectItem>
                              <SelectItem value="crown-fitting">Crown Fitting</SelectItem>
                              <SelectItem value="healing-check">Healing Check</SelectItem>
                              <SelectItem value="pain-assessment">Pain Assessment</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Date & Time</Label>
                          <Input
                            type="datetime-local"
                            value={appointment.scheduled_date}
                            onChange={(e) => updateAppointment(appointment.id, 'scheduled_date', e.target.value, true)}
                            disabled={isReadOnly}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Monitoring notes */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`monitoring-${selectedTooth}`}>Monitoring Notes</Label>
                    <Textarea
                      id={`monitoring-${selectedTooth}`}
                      value={getToothData(selectedTooth).monitoring_notes}
                      onChange={(e) => {
                        const updatedToothFollowUps = {
                          ...localData.tooth_specific_follow_ups,
                          [selectedTooth]: {
                            ...getToothData(selectedTooth),
                            monitoring_notes: e.target.value
                          }
                        }
                        handleUpdate('tooth_specific_follow_ups', updatedToothFollowUps)
                      }}
                      placeholder="What to monitor for this tooth..."
                      rows={3}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`healing-${selectedTooth}`}>Healing Progress</Label>
                    <Textarea
                      id={`healing-${selectedTooth}`}
                      value={getToothData(selectedTooth).healing_progress}
                      onChange={(e) => {
                        const updatedToothFollowUps = {
                          ...localData.tooth_specific_follow_ups,
                          [selectedTooth]: {
                            ...getToothData(selectedTooth),
                            healing_progress: e.target.value
                          }
                        }
                        handleUpdate('tooth_specific_follow_ups', updatedToothFollowUps)
                      }}
                      placeholder="Track healing progress..."
                      rows={3}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {getToothData(selectedTooth).appointments.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No follow-up appointments for tooth #{selectedTooth}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a tooth from the dental chart above</p>
                <p className="text-sm">to manage tooth-specific follow-ups</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Post-care Instructions and Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Post-care Instructions
              </CardTitle>
              <Button
                onClick={() => addInstruction(false)}
                size="sm"
                disabled={isReadOnly}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Instruction
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {localData.post_care_instructions.map((instruction) => (
              <Card key={instruction.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={getPriorityColor(instruction.importance)}>
                      {instruction.importance.toUpperCase()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleUpdate('post_care_instructions',
                          localData.post_care_instructions.filter(inst => inst.id !== instruction.id)
                        )
                      }}
                      disabled={isReadOnly}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div>
                    <Label>Instruction Title</Label>
                    <Input
                      value={instruction.title}
                      onChange={(e) => {
                        const updated = localData.post_care_instructions.map(inst =>
                          inst.id === instruction.id ? { ...inst, title: e.target.value } : inst
                        )
                        handleUpdate('post_care_instructions', updated)
                      }}
                      placeholder="e.g., Ice pack application"
                      disabled={isReadOnly}
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={instruction.description}
                      onChange={(e) => {
                        const updated = localData.post_care_instructions.map(inst =>
                          inst.id === instruction.id ? { ...inst, description: e.target.value } : inst
                        )
                        handleUpdate('post_care_instructions', updated)
                      }}
                      placeholder="Detailed instructions..."
                      rows={3}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </Card>
            ))}

            {localData.post_care_instructions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No post-care instructions added</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Follow-up Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="general-notes">General Follow-up Notes</Label>
              <Textarea
                id="general-notes"
                value={localData.general_follow_up_notes}
                onChange={(e) => handleUpdate('general_follow_up_notes', e.target.value)}
                placeholder="General notes for follow-up care..."
                rows={4}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <Label htmlFor="recall-period">Recall Period</Label>
              <Select
                value={localData.recall_period}
                onValueChange={(value) => handleUpdate('recall_period', value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recall period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-week">1 Week</SelectItem>
                  <SelectItem value="2-weeks">2 Weeks</SelectItem>
                  <SelectItem value="1-month">1 Month</SelectItem>
                  <SelectItem value="3-months">3 Months</SelectItem>
                  <SelectItem value="6-months">6 Months</SelectItem>
                  <SelectItem value="1-year">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="next-visit-required"
                  checked={localData.next_visit_required}
                  onChange={(e) => handleUpdate('next_visit_required', e.target.checked)}
                  disabled={isReadOnly}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="next-visit-required" className="text-sm">
                  Next visit required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="emergency-contact"
                  checked={localData.emergency_contact_provided}
                  onChange={(e) => handleUpdate('emergency_contact_provided', e.target.checked)}
                  disabled={isReadOnly}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="emergency-contact" className="text-sm">
                  Emergency contact information provided
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="patient-education"
                  checked={localData.patient_education_completed}
                  onChange={(e) => handleUpdate('patient_education_completed', e.target.checked)}
                  disabled={isReadOnly}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="patient-education" className="text-sm">
                  Patient education completed
                </Label>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Emergency Contact
              </h4>
              <p className="text-sm text-blue-700 mb-2">
                Provide patients with emergency contact information
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-blue-700">
                  <Phone className="w-3 h-3 mr-1" />
                  Emergency: +1 (555) 123-4567
                </Badge>
                <Badge variant="outline" className="text-blue-700">
                  <Mail className="w-3 h-3 mr-1" />
                  urgent@clinic.com
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}