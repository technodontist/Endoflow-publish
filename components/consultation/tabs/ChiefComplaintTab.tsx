'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

export function ChiefComplaintTab({ data, onChange, isReadOnly = false, onSave }: any) {
  // Local state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  const [complaint, setComplaint] = useState('')
  const [description, setDescription] = useState('')
  const [painScale, setPainScale] = useState(0)
  const [symptoms, setSymptoms] = useState<string[]>([])

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    setComplaint(data?.primary_complaint || '')
    setDescription(data?.patient_description || '')
    setPainScale(data?.pain_scale || 0)
    setSymptoms(data?.associated_symptoms || [])
  }, [data])

  // Event handlers
  const handleComplaintChange = (value: string) => {
    setComplaint(value)
    if (onChange) {
      onChange({
        primary_complaint: value,
        patient_description: description,
        pain_scale: painScale,
        associated_symptoms: symptoms,
        onset_duration: '',
        severity_scale: painScale,
        location_detail: '',
        onset_type: '',
        frequency: '',
        triggers: []
      })
    }
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    if (onChange) {
      onChange({
        primary_complaint: complaint,
        patient_description: value,
        pain_scale: painScale,
        associated_symptoms: symptoms,
        onset_duration: '',
        severity_scale: painScale,
        location_detail: '',
        onset_type: '',
        frequency: '',
        triggers: []
      })
    }
  }

  const handlePainScaleChange = (value: number) => {
    setPainScale(value)
    if (onChange) {
      onChange({
        primary_complaint: complaint,
        patient_description: description,
        pain_scale: value,
        associated_symptoms: symptoms,
        onset_duration: '',
        severity_scale: value,
        location_detail: '',
        onset_type: '',
        frequency: '',
        triggers: []
      })
    }
  }

  const handleSymptomToggle = (symptom: string) => {
    const newSymptoms = symptoms.includes(symptom)
      ? symptoms.filter(s => s !== symptom)
      : [...symptoms, symptom]
    setSymptoms(newSymptoms)
    if (onChange) {
      onChange({
        primary_complaint: complaint,
        patient_description: description,
        pain_scale: painScale,
        associated_symptoms: newSymptoms,
        onset_duration: '',
        severity_scale: painScale,
        location_detail: '',
        onset_type: '',
        frequency: '',
        triggers: []
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Chief Complaint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Primary Complaint */}
          <div>
            <Label htmlFor="primary-complaint">Primary Complaint</Label>
            <Input
              id="primary-complaint"
              value={complaint}
              onChange={(e) => handleComplaintChange(e.target.value)}
              placeholder="What is the patient's main concern?"
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Detailed Description */}
          <div>
            <Label htmlFor="description">Detailed Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Describe the problem in detail, including onset, duration, and patient's own words..."
              rows={4}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Pain Scale */}
          <div>
            <Label htmlFor="pain-scale">Pain Level: {painScale}/10</Label>
            <input
              id="pain-scale"
              type="range"
              min="0"
              max="10"
              value={painScale}
              onChange={(e) => handlePainScaleChange(parseInt(e.target.value))}
              disabled={isReadOnly}
              className="w-full mt-2 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>No pain</span>
              <span>Extreme pain</span>
            </div>
          </div>

          {/* Associated Symptoms */}
          <div>
            <Label>Associated Symptoms</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {['Sharp pain', 'Dull ache', 'Throbbing', 'Swelling', 'Sensitivity to hot', 'Sensitivity to cold'].map(symptom => (
                <div key={symptom} className="flex items-center space-x-2">
                  <Checkbox
                    id={`symptom-${symptom}`}
                    checked={symptoms.includes(symptom)}
                    onCheckedChange={() => handleSymptomToggle(symptom)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`symptom-${symptom}`} className="text-sm cursor-pointer">
                    {symptom}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          {!isReadOnly && onSave && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => {
                  if (onSave) {
                    onSave({
                      primary_complaint: complaint,
                      patient_description: description,
                      pain_scale: painScale,
                      associated_symptoms: symptoms,
                      onset_duration: '',
                      severity_scale: painScale,
                      location_detail: '',
                      onset_type: '',
                      frequency: '',
                      triggers: []
                    })
                  }
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Save
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
