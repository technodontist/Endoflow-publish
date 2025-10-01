'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

interface TreatmentPlanTabProps {
  data?: any
  onChange?: (data: any) => void
  isReadOnly?: boolean
  onSave?: (data: any) => void
}

export function TreatmentPlanTab({ data, onChange, isReadOnly = false, onSave }: TreatmentPlanTabProps) {
  // Simple state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  const [treatmentGoals, setTreatmentGoals] = useState('')
  const [plannedProcedures, setPlannedProcedures] = useState<string[]>([])
  const [treatmentSequence, setTreatmentSequence] = useState('')
  const [estimatedDuration, setEstimatedDuration] = useState('')
  const [treatmentOptions, setTreatmentOptions] = useState('')
  const [riskConsiderations, setRiskConsiderations] = useState('')
  const [followUpPlan, setFollowUpPlan] = useState('')
  const [prognosis, setPrognosis] = useState('')

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    setTreatmentGoals(data?.treatment_goals || '')
    setPlannedProcedures(data?.planned_procedures || [])
    setTreatmentSequence(data?.treatment_sequence || '')
    setEstimatedDuration(data?.estimated_duration || '')
    setTreatmentOptions(data?.treatment_options || '')
    setRiskConsiderations(data?.risk_considerations || '')
    setFollowUpPlan(data?.follow_up_plan || '')
    setPrognosis(data?.prognosis || '')
  }, [data])

  // Event handlers that update all fields in onChange callback
  const updateAllFields = (updatedFields: any) => {
    if (onChange) {
      onChange({
        treatment_goals: treatmentGoals,
        planned_procedures: plannedProcedures,
        treatment_sequence: treatmentSequence,
        estimated_duration: estimatedDuration,
        treatment_options: treatmentOptions,
        risk_considerations: riskConsiderations,
        follow_up_plan: followUpPlan,
        prognosis: prognosis,
        ...updatedFields
      })
    }
  }

  const handleTreatmentGoalsChange = (value: string) => {
    setTreatmentGoals(value)
    updateAllFields({ treatment_goals: value })
  }

  const handleProcedureToggle = (procedure: string) => {
    const newProcedures = plannedProcedures.includes(procedure)
      ? plannedProcedures.filter(p => p !== procedure)
      : [...plannedProcedures, procedure]
    setPlannedProcedures(newProcedures)
    updateAllFields({ planned_procedures: newProcedures })
  }

  const handleTreatmentSequenceChange = (value: string) => {
    setTreatmentSequence(value)
    updateAllFields({ treatment_sequence: value })
  }

  const handleEstimatedDurationChange = (value: string) => {
    setEstimatedDuration(value)
    updateAllFields({ estimated_duration: value })
  }

  const handleTreatmentOptionsChange = (value: string) => {
    setTreatmentOptions(value)
    updateAllFields({ treatment_options: value })
  }

  const handleRiskConsiderationsChange = (value: string) => {
    setRiskConsiderations(value)
    updateAllFields({ risk_considerations: value })
  }

  const handleFollowUpPlanChange = (value: string) => {
    setFollowUpPlan(value)
    updateAllFields({ follow_up_plan: value })
  }

  const handlePrognosisChange = (value: string) => {
    setPrognosis(value)
    updateAllFields({ prognosis: value })
  }

  // Simple options arrays
  const commonProcedures = [
    "Routine cleaning", "Dental filling", "Crown placement", "Root canal therapy",
    "Tooth extraction", "Periodontal treatment", "Orthodontic treatment", "Dental implant"
  ]

  const prognosisOptions = ["Excellent", "Good", "Fair", "Guarded", "Poor"]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Treatment Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Treatment Goals */}
          <div>
            <Label htmlFor="treatment-goals">Treatment Goals & Objectives</Label>
            <Textarea
              id="treatment-goals"
              value={treatmentGoals}
              onChange={(e) => handleTreatmentGoalsChange(e.target.value)}
              placeholder="Outline the primary treatment goals and expected outcomes"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Planned Procedures */}
          <div>
            <Label>Planned Procedures</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {commonProcedures.map(procedure => (
                <div key={procedure} className="flex items-center space-x-2">
                  <Checkbox
                    id={`procedure-${procedure}`}
                    checked={plannedProcedures.includes(procedure)}
                    onCheckedChange={() => handleProcedureToggle(procedure)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`procedure-${procedure}`} className="text-sm cursor-pointer">
                    {procedure}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Treatment Sequence */}
          <div>
            <Label htmlFor="treatment-sequence">Treatment Sequence & Phasing</Label>
            <Textarea
              id="treatment-sequence"
              value={treatmentSequence}
              onChange={(e) => handleTreatmentSequenceChange(e.target.value)}
              placeholder="Describe the order and phases of treatment (what comes first, second, etc.)"
              rows={4}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Estimated Duration */}
          <div>
            <Label htmlFor="estimated-duration">Estimated Treatment Duration</Label>
            <Select
              value={estimatedDuration}
              onValueChange={handleEstimatedDurationChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select estimated duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                <SelectItem value="1-2 months">1-2 months</SelectItem>
                <SelectItem value="3-6 months">3-6 months</SelectItem>
                <SelectItem value="6-12 months">6-12 months</SelectItem>
                <SelectItem value="1-2 years">1-2 years</SelectItem>
                <SelectItem value="2+ years">2+ years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Treatment Options */}
          <div>
            <Label htmlFor="treatment-options">Alternative Treatment Options</Label>
            <Textarea
              id="treatment-options"
              value={treatmentOptions}
              onChange={(e) => handleTreatmentOptionsChange(e.target.value)}
              placeholder="Describe alternative treatment approaches and their pros/cons"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Risk Considerations */}
          <div>
            <Label htmlFor="risk-considerations">Risk Considerations & Contraindications</Label>
            <Textarea
              id="risk-considerations"
              value={riskConsiderations}
              onChange={(e) => handleRiskConsiderationsChange(e.target.value)}
              placeholder="List any risks, complications, or contraindications for proposed treatment"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Follow-up Plan */}
          <div>
            <Label htmlFor="follow-up-plan">Follow-up & Maintenance Plan</Label>
            <Textarea
              id="follow-up-plan"
              value={followUpPlan}
              onChange={(e) => handleFollowUpPlanChange(e.target.value)}
              placeholder="Outline follow-up appointments, maintenance requirements, and monitoring plan"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Overall Prognosis */}
          <div>
            <Label htmlFor="prognosis">Overall Treatment Prognosis</Label>
            <Select
              value={prognosis}
              onValueChange={handlePrognosisChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select overall prognosis" />
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
                      treatment_goals: treatmentGoals,
                      planned_procedures: plannedProcedures,
                      treatment_sequence: treatmentSequence,
                      estimated_duration: estimatedDuration,
                      treatment_options: treatmentOptions,
                      risk_considerations: riskConsiderations,
                      follow_up_plan: followUpPlan,
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