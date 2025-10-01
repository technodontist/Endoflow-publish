'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Calendar, CheckCircle, Clock, FileText, Stethoscope, User, Activity, Camera, Pill } from "lucide-react"
import { loadFollowUpAppointmentData, saveFollowUpAssessment } from '@/lib/actions/follow-up-appointment'
import { Slider } from "@/components/ui/slider"

interface FollowUpFormData {
  // Clinical Assessment
  symptomStatus: 'resolved' | 'improved' | 'same' | 'worsened'
  painLevel: number // 0-10
  swelling: 'none' | 'mild' | 'moderate' | 'severe'
  healing: 'excellent' | 'normal' | 'delayed' | 'concerning'
  
  // Post-Treatment Findings
  woundStatus: 'healed' | 'healing_well' | 'delayed_healing' | 'infected' | 'dry_socket' | 'na'
  sutureStatus: 'intact' | 'removed' | 'dissolved' | 'loose' | 'na'
  
  // Clinical Examination
  tenderness: boolean
  bleeding: boolean
  mobility: boolean
  percussion: 'negative' | 'mild' | 'moderate' | 'severe'
  
  // Treatment-Specific
  restorationStatus: 'intact' | 'chipped' | 'fractured' | 'lost' | 'na'
  occlusionCheck: 'normal' | 'high' | 'interference' | 'na'
  
  // X-ray/Imaging
  xrayRequired: boolean
  xrayFindings: string
  
  // Medication & Compliance
  medicationAdherence: 'excellent' | 'good' | 'partial' | 'poor'
  adverseEffects: string
  
  // Clinical Notes
  clinicalFindings: string
  treatmentProvided: string
  
  // Next Steps
  healingProgress: 'complete' | 'on_track' | 'needs_monitoring' | 'intervention_required'
  nextFollowUp: 'none' | '1_week' | '2_weeks' | '1_month' | '3_months' | '6_months' | 'as_needed'
  additionalTreatmentNeeded: boolean
  referralRequired: boolean
  
  // Instructions
  patientInstructions: string
  prescriptionUpdate: string
}

interface FollowUpAppointmentFormProps {
  appointmentId: string
  patientId: string
  treatmentId?: string
  consultationId?: string
  onComplete?: () => void
  onCancel?: () => void
}

export function FollowUpAppointmentForm({
  appointmentId,
  patientId,
  treatmentId,
  consultationId,
  onComplete,
  onCancel
}: FollowUpAppointmentFormProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [appointment, setAppointment] = useState<any>(null)
  const [treatment, setTreatment] = useState<any>(null)
  const [linkedTeeth, setLinkedTeeth] = useState<any[]>([])
  
  const [formData, setFormData] = useState<FollowUpFormData>({
    symptomStatus: 'improved',
    painLevel: 0,
    swelling: 'none',
    healing: 'normal',
    woundStatus: 'na',
    sutureStatus: 'na',
    tenderness: false,
    bleeding: false,
    mobility: false,
    percussion: 'negative',
    restorationStatus: 'na',
    occlusionCheck: 'na',
    xrayRequired: false,
    xrayFindings: '',
    medicationAdherence: 'good',
    adverseEffects: '',
    clinicalFindings: '',
    treatmentProvided: '',
    healingProgress: 'on_track',
    nextFollowUp: 'none',
    additionalTreatmentNeeded: false,
    referralRequired: false,
    patientInstructions: '',
    prescriptionUpdate: ''
  })

  useEffect(() => {
    loadAppointmentData()
  }, [appointmentId])

  const loadAppointmentData = async () => {
    if (!appointmentId) {
      console.error('No appointment ID provided')
      setLoading(false)
      return
    }

    try {
      console.log('Loading appointment data for ID:', appointmentId)

      // Use server action to load data with proper permissions
      const result = await loadFollowUpAppointmentData(appointmentId)

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load appointment data')
      }

      const appointmentData = result.data
      console.log('Loaded appointment data:', appointmentData)

      // Set the appointment data
      setAppointment(appointmentData)

      // Set treatment data if available
      if (appointmentData.treatment) {
        setTreatment(appointmentData.treatment)
      }

      // Set linked teeth data if available
      if (appointmentData.linkedTeeth) {
        setLinkedTeeth(appointmentData.linkedTeeth)
      }

    } catch (error: any) {
      console.error('Error in loadAppointmentData:', error)
      const errorMessage = error.message || 'Unknown error'
      console.log(`Failed to load appointment data: ${errorMessage}`)

      // Set a minimal appointment object to allow form to render
      setAppointment({
        id: appointmentId,
        patient_id: patientId,
        appointment_type: 'follow_up',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '00:00:00',
        status: 'in_progress',
        patients: {
          id: patientId,
          first_name: 'Patient',
          last_name: 'Loading...'
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateNextFollowUpDate = (interval: string): string => {
    const daysMap = {
      '1_week': 7,
      '2_weeks': 14,
      '1_month': 30,
      '3_months': 90,
      '6_months': 180
    }
    
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + (daysMap[interval as keyof typeof daysMap] || 30))
    return nextDate.toISOString().split('T')[0]
  }

  const handleSave = async () => {
    if (!appointment) {
      console.log('Appointment data not loaded. Please try again.')
      return
    }

    setSaving(true)

    try {
      // Use server action to save assessment with proper permissions
      const result = await saveFollowUpAssessment(
        appointmentId,
        patientId,
        {
          ...formData,
          linkedTeeth: linkedTeeth.map(t => t.tooth_number)
        },
        treatmentId,
        consultationId
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to save assessment')
      }

      console.log('Follow-up assessment saved successfully')

      // Success - trigger callback
      onComplete?.()

    } catch (error: any) {
      console.error('Error saving follow-up:', error)
      const errorMessage = error.message || 'Failed to save follow-up assessment'
      console.log(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  const patientName = appointment?.patients ? 
    `${appointment.patients.first_name} ${appointment.patients.last_name}` : 
    'Patient'

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-l-4 border-l-teal-600">
        <CardHeader>
          <CardTitle className="text-teal-700 flex items-center gap-2">
            <Stethoscope className="w-5 h-5" />
            Follow-up Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Patient:</span>
              <div className="font-medium">{patientName}</div>
            </div>
            {treatment && (
              <>
                <div>
                  <span className="text-gray-600">Treatment:</span>
                  <div className="font-medium">{treatment.treatment_type}</div>
                </div>
                {treatment.tooth_diagnoses && (
                  <div>
                    <span className="text-gray-600">Tooth:</span>
                    <div className="font-medium">#{treatment.tooth_diagnoses.tooth_number}</div>
                  </div>
                )}
              </>
            )}
            <div>
              <span className="text-gray-600">Follow-up Date:</span>
              <div className="font-medium">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Clinical Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Symptom Status</Label>
              <Select 
                value={formData.symptomStatus} 
                onValueChange={(value: any) => setFormData({...formData, symptomStatus: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Completely Resolved</SelectItem>
                  <SelectItem value="improved">Improved</SelectItem>
                  <SelectItem value="same">Same</SelectItem>
                  <SelectItem value="worsened">Worsened</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Pain Level (0-10)</Label>
              <div className="flex items-center gap-3">
                <Slider 
                  value={[formData.painLevel]} 
                  onValueChange={([value]) => setFormData({...formData, painLevel: value})}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <Badge variant={formData.painLevel > 5 ? "destructive" : formData.painLevel > 2 ? "secondary" : "default"}>
                  {formData.painLevel}
                </Badge>
              </div>
            </div>

            <div>
              <Label>Swelling</Label>
              <Select 
                value={formData.swelling} 
                onValueChange={(value: any) => setFormData({...formData, swelling: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center gap-2">
              <Checkbox 
                checked={formData.tenderness}
                onCheckedChange={(checked) => setFormData({...formData, tenderness: !!checked})}
              />
              <span className="text-sm">Tenderness</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox 
                checked={formData.bleeding}
                onCheckedChange={(checked) => setFormData({...formData, bleeding: !!checked})}
              />
              <span className="text-sm">Bleeding</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox 
                checked={formData.mobility}
                onCheckedChange={(checked) => setFormData({...formData, mobility: !!checked})}
              />
              <span className="text-sm">Mobility</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox 
                checked={formData.xrayRequired}
                onCheckedChange={(checked) => setFormData({...formData, xrayRequired: !!checked})}
              />
              <span className="text-sm">X-ray Required</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Treatment-Specific Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Treatment-Specific Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Healing Progress</Label>
              <Select 
                value={formData.healing} 
                onValueChange={(value: any) => setFormData({...formData, healing: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="concerning">Concerning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Wound Status</Label>
              <Select 
                value={formData.woundStatus} 
                onValueChange={(value: any) => setFormData({...formData, woundStatus: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="na">N/A</SelectItem>
                  <SelectItem value="healed">Completely Healed</SelectItem>
                  <SelectItem value="healing_well">Healing Well</SelectItem>
                  <SelectItem value="delayed_healing">Delayed Healing</SelectItem>
                  <SelectItem value="infected">Signs of Infection</SelectItem>
                  <SelectItem value="dry_socket">Dry Socket</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Suture Status</Label>
              <Select 
                value={formData.sutureStatus} 
                onValueChange={(value: any) => setFormData({...formData, sutureStatus: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="na">N/A</SelectItem>
                  <SelectItem value="intact">Intact</SelectItem>
                  <SelectItem value="removed">Removed Today</SelectItem>
                  <SelectItem value="dissolved">Dissolved</SelectItem>
                  <SelectItem value="loose">Loose</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Findings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Clinical Findings & Treatment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Clinical Findings</Label>
            <Textarea
              value={formData.clinicalFindings}
              onChange={(e) => setFormData({...formData, clinicalFindings: e.target.value})}
              placeholder="Describe clinical examination findings..."
              rows={3}
            />
          </div>

          {formData.xrayRequired && (
            <div>
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                X-ray Findings
              </Label>
              <Textarea
                value={formData.xrayFindings}
                onChange={(e) => setFormData({...formData, xrayFindings: e.target.value})}
                placeholder="Describe radiographic findings..."
                rows={2}
              />
            </div>
          )}

          <div>
            <Label>Treatment Provided Today</Label>
            <Textarea
              value={formData.treatmentProvided}
              onChange={(e) => setFormData({...formData, treatmentProvided: e.target.value})}
              placeholder="Describe any treatment or procedures performed..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Next Steps & Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Overall Healing Progress</Label>
              <Select 
                value={formData.healingProgress} 
                onValueChange={(value: any) => setFormData({...formData, healingProgress: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete - No Further Follow-up</SelectItem>
                  <SelectItem value="on_track">On Track - Continue Monitoring</SelectItem>
                  <SelectItem value="needs_monitoring">Needs Close Monitoring</SelectItem>
                  <SelectItem value="intervention_required">Intervention Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Next Follow-up</Label>
              <Select 
                value={formData.nextFollowUp} 
                onValueChange={(value: any) => setFormData({...formData, nextFollowUp: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None Required</SelectItem>
                  <SelectItem value="1_week">1 Week</SelectItem>
                  <SelectItem value="2_weeks">2 Weeks</SelectItem>
                  <SelectItem value="1_month">1 Month</SelectItem>
                  <SelectItem value="3_months">3 Months</SelectItem>
                  <SelectItem value="6_months">6 Months</SelectItem>
                  <SelectItem value="as_needed">As Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Patient Instructions</Label>
            <Textarea
              value={formData.patientInstructions}
              onChange={(e) => setFormData({...formData, patientInstructions: e.target.value})}
              placeholder="Post-care instructions for the patient..."
              rows={3}
            />
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Prescription Update
            </Label>
            <Textarea
              value={formData.prescriptionUpdate}
              onChange={(e) => setFormData({...formData, prescriptionUpdate: e.target.value})}
              placeholder="Any changes to medications..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button 
          className="bg-teal-600 hover:bg-teal-700"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>Saving...</>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Follow-up
            </>
          )}
        </Button>
      </div>
    </div>
  )
}