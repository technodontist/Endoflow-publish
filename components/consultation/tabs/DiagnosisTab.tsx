'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface DiagnosisTabProps {
  data?: any
  onChange?: (data: any) => void
  isReadOnly?: boolean
  onSave?: (data: any) => void
}

export function DiagnosisTab({ data, onChange, isReadOnly = false, onSave }: DiagnosisTabProps) {
  // Simple state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('')
  const [differentialDiagnoses, setDifferentialDiagnoses] = useState('')
  const [finalDiagnosis, setFinalDiagnosis] = useState('')
  const [clinicalImpression, setClinicalImpression] = useState('')
  const [diagnosticReasoning, setDiagnosticReasoning] = useState('')
  const [prognosis, setPrognosis] = useState('')

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    setProvisionalDiagnosis(data?.provisional_diagnosis || '')
    setDifferentialDiagnoses(data?.differential_diagnoses || '')
    setFinalDiagnosis(data?.final_diagnosis || '')
    setClinicalImpression(data?.clinical_impression || '')
    setDiagnosticReasoning(data?.diagnostic_reasoning || '')
    setPrognosis(data?.prognosis || '')
  }, [data])

  // Event handlers
  const handleProvisionalDiagnosisChange = (value: string) => {
    setProvisionalDiagnosis(value)
    if (onChange) {
      onChange({
        provisional_diagnosis: value,
        differential_diagnoses: differentialDiagnoses,
        final_diagnosis: finalDiagnosis,
        clinical_impression: clinicalImpression,
        diagnostic_reasoning: diagnosticReasoning,
        prognosis: prognosis
      })
    }
  }

  const handleDifferentialDiagnosesChange = (value: string) => {
    setDifferentialDiagnoses(value)
    if (onChange) {
      onChange({
        provisional_diagnosis: provisionalDiagnosis,
        differential_diagnoses: value,
        final_diagnosis: finalDiagnosis,
        clinical_impression: clinicalImpression,
        diagnostic_reasoning: diagnosticReasoning,
        prognosis: prognosis
      })
    }
  }

  const handleFinalDiagnosisChange = (value: string) => {
    setFinalDiagnosis(value)
    if (onChange) {
      onChange({
        provisional_diagnosis: provisionalDiagnosis,
        differential_diagnoses: differentialDiagnoses,
        final_diagnosis: value,
        clinical_impression: clinicalImpression,
        diagnostic_reasoning: diagnosticReasoning,
        prognosis: prognosis
      })
    }
  }

  const handleClinicalImpressionChange = (value: string) => {
    setClinicalImpression(value)
    if (onChange) {
      onChange({
        provisional_diagnosis: provisionalDiagnosis,
        differential_diagnoses: differentialDiagnoses,
        final_diagnosis: finalDiagnosis,
        clinical_impression: value,
        diagnostic_reasoning: diagnosticReasoning,
        prognosis: prognosis
      })
    }
  }

  const handleDiagnosticReasoningChange = (value: string) => {
    setDiagnosticReasoning(value)
    if (onChange) {
      onChange({
        provisional_diagnosis: provisionalDiagnosis,
        differential_diagnoses: differentialDiagnoses,
        final_diagnosis: finalDiagnosis,
        clinical_impression: clinicalImpression,
        diagnostic_reasoning: value,
        prognosis: prognosis
      })
    }
  }

  const handlePrognosisChange = (value: string) => {
    setPrognosis(value)
    if (onChange) {
      onChange({
        provisional_diagnosis: provisionalDiagnosis,
        differential_diagnoses: differentialDiagnoses,
        final_diagnosis: finalDiagnosis,
        clinical_impression: clinicalImpression,
        diagnostic_reasoning: diagnosticReasoning,
        prognosis: value
      })
    }
  }

  // Simple prognosis options
  const prognosisOptions = ["Excellent", "Good", "Fair", "Guarded", "Poor"]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Clinical Diagnosis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Provisional Diagnosis */}
          <div>
            <Label htmlFor="provisional-diagnosis">Provisional Diagnosis</Label>
            <Textarea
              id="provisional-diagnosis"
              value={provisionalDiagnosis}
              onChange={(e) => handleProvisionalDiagnosisChange(e.target.value)}
              placeholder="Initial clinical impression based on history and examination"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Differential Diagnoses */}
          <div>
            <Label htmlFor="differential-diagnoses">Differential Diagnoses</Label>
            <Textarea
              id="differential-diagnoses"
              value={differentialDiagnoses}
              onChange={(e) => handleDifferentialDiagnosesChange(e.target.value)}
              placeholder="List other possible diagnoses to consider and rule out"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Final Diagnosis */}
          <div>
            <Label htmlFor="final-diagnosis">Final/Confirmed Diagnosis</Label>
            <Textarea
              id="final-diagnosis"
              value={finalDiagnosis}
              onChange={(e) => handleFinalDiagnosisChange(e.target.value)}
              placeholder="Confirmed diagnosis after completing investigations"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Clinical Impression */}
          <div>
            <Label htmlFor="clinical-impression">Clinical Impression</Label>
            <Textarea
              id="clinical-impression"
              value={clinicalImpression}
              onChange={(e) => handleClinicalImpressionChange(e.target.value)}
              placeholder="Overall clinical assessment and impression"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Diagnostic Reasoning */}
          <div>
            <Label htmlFor="diagnostic-reasoning">Diagnostic Reasoning</Label>
            <Textarea
              id="diagnostic-reasoning"
              value={diagnosticReasoning}
              onChange={(e) => handleDiagnosticReasoningChange(e.target.value)}
              placeholder="Explain the clinical reasoning that led to the diagnosis"
              rows={4}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Prognosis */}
          <div>
            <Label htmlFor="prognosis">Prognosis</Label>
            <Select
              value={prognosis}
              onValueChange={handlePrognosisChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select prognosis" />
              </SelectTrigger>
              <SelectContent>
                {prognosisOptions.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save Button */}
          {!isReadOnly && onSave && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => {
                  if (onSave) {
                    onSave({
                      provisional_diagnosis: provisionalDiagnosis,
                      differential_diagnoses: differentialDiagnoses,
                      final_diagnosis: finalDiagnosis,
                      clinical_impression: clinicalImpression,
                      diagnostic_reasoning: diagnosticReasoning,
                      prognosis: prognosis
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