'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Clock, CheckCircle2 } from "lucide-react"

// Helper function to map AI pain quality keywords to checkbox-compatible symptom names
function mapPainQualityToSymptoms(painQuality: string, painCharacteristics: any, associatedSymptoms: string[]): string[] {
  const symptoms: string[] = []
  const qualityLower = (painQuality || '').toLowerCase()
  const charQuality = (painCharacteristics?.quality || '').toLowerCase()
  const combinedQuality = `${qualityLower} ${charQuality}`.toLowerCase()

  // Map AI keywords to exact checkbox labels
  if (combinedQuality.includes('sharp') || combinedQuality.includes('stabbing') || combinedQuality.includes('shooting')) {
    symptoms.push('Sharp pain')
  }
  if (combinedQuality.includes('dull') || combinedQuality.includes('aching') || combinedQuality.includes('ache')) {
    symptoms.push('Dull ache')
  }
  if (combinedQuality.includes('throb') || combinedQuality.includes('pulsating')) {
    symptoms.push('Throbbing')
  }

  // Check associated symptoms for additional conditions
  const symptomsLower = associatedSymptoms.map(s => s.toLowerCase()).join(' ')
  if (combinedQuality.includes('swell') || symptomsLower.includes('swell')) {
    symptoms.push('Swelling')
  }
  if (combinedQuality.includes('hot') || symptomsLower.includes('hot') || symptomsLower.includes('heat')) {
    symptoms.push('Sensitivity to hot')
  }
  if (combinedQuality.includes('cold') || symptomsLower.includes('cold') || symptomsLower.includes('ice')) {
    symptoms.push('Sensitivity to cold')
  }

  return symptoms
}

export function ChiefComplaintTab({ data, onChange, isReadOnly = false, onSave }: any) {
  // Local state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  const [complaint, setComplaint] = useState('')
  const [description, setDescription] = useState('')
  const [painScale, setPainScale] = useState(0)
  const [symptoms, setSymptoms] = useState<string[]>([])

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    console.log('🔍 [CHIEF COMPLAINT TAB] useEffect triggered with FULL data object:', data)
    console.log('🔍 [CHIEF COMPLAINT TAB] Specific fields:', {
      primary_complaint: data?.primary_complaint,
      pain_scale: data?.pain_scale,
      pain_quality: data?.pain_quality,
      pain_characteristics: data?.pain_characteristics,
      associated_symptoms: data?.associated_symptoms,
      auto_extracted: data?.auto_extracted
    })

    setComplaint(data?.primary_complaint || '')
    setDescription(data?.patient_description || '')
    setPainScale(data?.pain_scale || 0)

    // Map AI-extracted pain quality to symptoms checkboxes
    const extractedSymptoms = mapPainQualityToSymptoms(
      data?.pain_quality || '',
      data?.pain_characteristics,
      data?.associated_symptoms || []
    )

    console.log('🎯 [CHIEF COMPLAINT TAB] Mapped symptoms:', {
      input_pain_quality: data?.pain_quality,
      input_pain_characteristics: data?.pain_characteristics,
      input_associated_symptoms: data?.associated_symptoms,
      extracted_symptoms: extractedSymptoms
    })

    const finalSymptoms = extractedSymptoms.length > 0 ? extractedSymptoms : (data?.associated_symptoms || [])
    console.log('✅ [CHIEF COMPLAINT TAB] Setting symptoms to:', finalSymptoms)
    setSymptoms(finalSymptoms)
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
      {/* AI Auto-Fill Indicator */}
      {data?.auto_extracted && (
        <div className="p-4 bg-gradient-to-r from-blue-50 via-teal-50 to-blue-50 rounded-lg border-2 border-blue-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Sparkles className="h-5 w-5 text-teal-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-gradient-to-r from-blue-600 to-teal-600 text-white border-0">
                    🤖 AI Auto-Filled from Voice Recording
                  </Badge>
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Confidence: {data.confidence || 85}%
                  </Badge>
                </div>
                <p className="text-sm text-gray-700 mt-1">
                  Chief complaint extracted using Gemini AI. Review and edit as needed.
                </p>
                {data.extraction_timestamp && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Extracted: {new Date(data.extraction_timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Chief Complaint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="primary-complaint">Primary Complaint *</Label>
              {data?.auto_extracted && complaint && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  AI Filled
                </Badge>
              )}
            </div>
            <Textarea
              id="primary-complaint"
              placeholder="What is the patient's main concern?"
              value={complaint}
              onChange={(e) => handleComplaintChange(e.target.value)}
              disabled={isReadOnly}
              className={`min-h-[80px] ${
                data?.auto_extracted && complaint 
                  ? 'border-green-300 bg-green-50 focus:border-green-400 focus:ring-green-400' 
                  : ''
              }`}
            />
          </div>

          {/* Detailed Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="description">Detailed Description</Label>
              {data?.auto_extracted && description && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  AI Filled
                </Badge>
              )}
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Describe the problem in detail, including onset, duration, and patient's own words..."
              rows={4}
              disabled={isReadOnly}
              className={`mt-2 ${
                data?.auto_extracted && description 
                  ? 'border-green-300 bg-green-50 focus:border-green-400 focus:ring-green-400' 
                  : ''
              }`}
            />
          </div>

          {/* Pain Scale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="pain-scale">Pain Level: {painScale}/10</Label>
              {data?.auto_extracted && painScale > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  AI Filled
                </Badge>
              )}
            </div>
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
