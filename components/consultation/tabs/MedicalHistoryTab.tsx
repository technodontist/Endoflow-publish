'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

interface MedicalHistoryTabProps {
  data?: any
  onChange?: (data: any) => void
  isReadOnly?: boolean
  onSave?: (data: any) => void
}

export function MedicalHistoryTab({ data, onChange, isReadOnly = false, onSave }: MedicalHistoryTabProps) {
  // Simple state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  const [medicalConditions, setMedicalConditions] = useState<string[]>([])
  const [currentMedications, setCurrentMedications] = useState('')
  const [allergies, setAllergies] = useState<string[]>([])
  const [previousDentalTreatments, setPreviousDentalTreatments] = useState<string[]>([])
  const [familyMedicalHistory, setFamilyMedicalHistory] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    setMedicalConditions(data?.medical_conditions || [])
    setCurrentMedications(data?.current_medications || '')
    setAllergies(data?.allergies || [])
    setPreviousDentalTreatments(data?.previous_dental_treatments || [])
    setFamilyMedicalHistory(data?.family_medical_history || '')
    setAdditionalNotes(data?.additional_notes || '')
  }, [data])

  // Event handlers
  const handleMedicalConditionToggle = (condition: string) => {
    const newConditions = medicalConditions.includes(condition)
      ? medicalConditions.filter(c => c !== condition)
      : [...medicalConditions, condition]
    setMedicalConditions(newConditions)
    if (onChange) {
      onChange({
        medical_conditions: newConditions,
        current_medications: currentMedications,
        allergies: allergies,
        previous_dental_treatments: previousDentalTreatments,
        family_medical_history: familyMedicalHistory,
        additional_notes: additionalNotes
      })
    }
  }

  const handleMedicationsChange = (value: string) => {
    setCurrentMedications(value)
    if (onChange) {
      onChange({
        medical_conditions: medicalConditions,
        current_medications: value,
        allergies: allergies,
        previous_dental_treatments: previousDentalTreatments,
        family_medical_history: familyMedicalHistory,
        additional_notes: additionalNotes
      })
    }
  }

  const handleAllergyToggle = (allergy: string) => {
    const newAllergies = allergies.includes(allergy)
      ? allergies.filter(a => a !== allergy)
      : [...allergies, allergy]
    setAllergies(newAllergies)
    if (onChange) {
      onChange({
        medical_conditions: medicalConditions,
        current_medications: currentMedications,
        allergies: newAllergies,
        previous_dental_treatments: previousDentalTreatments,
        family_medical_history: familyMedicalHistory,
        additional_notes: additionalNotes
      })
    }
  }

  const handleDentalTreatmentToggle = (treatment: string) => {
    const newTreatments = previousDentalTreatments.includes(treatment)
      ? previousDentalTreatments.filter(t => t !== treatment)
      : [...previousDentalTreatments, treatment]
    setPreviousDentalTreatments(newTreatments)
    if (onChange) {
      onChange({
        medical_conditions: medicalConditions,
        current_medications: currentMedications,
        allergies: allergies,
        previous_dental_treatments: newTreatments,
        family_medical_history: familyMedicalHistory,
        additional_notes: additionalNotes
      })
    }
  }

  const handleFamilyHistoryChange = (value: string) => {
    setFamilyMedicalHistory(value)
    if (onChange) {
      onChange({
        medical_conditions: medicalConditions,
        current_medications: currentMedications,
        allergies: allergies,
        previous_dental_treatments: previousDentalTreatments,
        family_medical_history: value,
        additional_notes: additionalNotes
      })
    }
  }

  const handleAdditionalNotesChange = (value: string) => {
    setAdditionalNotes(value)
    if (onChange) {
      onChange({
        medical_conditions: medicalConditions,
        current_medications: currentMedications,
        allergies: allergies,
        previous_dental_treatments: previousDentalTreatments,
        family_medical_history: familyMedicalHistory,
        additional_notes: value
      })
    }
  }

  // Simple options arrays
  const medicalConditionOptions = [
    "Diabetes", "Hypertension", "Heart Disease", "Asthma", "Thyroid Disorders",
    "Kidney Disease", "Arthritis", "Cancer", "Depression", "Anxiety"
  ]

  const allergyOptions = [
    "Penicillin", "Aspirin", "Ibuprofen", "Latex", "Shellfish",
    "Peanuts", "Eggs", "Milk", "Soy", "Local Anesthetics"
  ]

  const dentalTreatmentOptions = [
    "Fillings", "Root canal", "Crown placement", "Tooth extraction",
    "Dental cleaning", "Braces", "Dentures", "Gum treatment"
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Medical History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Medical Conditions */}
          <div>
            <Label>Medical Conditions</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {medicalConditionOptions.map(condition => (
                <div key={condition} className="flex items-center space-x-2">
                  <Checkbox
                    id={`condition-${condition}`}
                    checked={medicalConditions.includes(condition)}
                    onCheckedChange={() => handleMedicalConditionToggle(condition)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`condition-${condition}`} className="text-sm cursor-pointer">
                    {condition}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Current Medications */}
          <div>
            <Label htmlFor="medications">Current Medications</Label>
            <Textarea
              id="medications"
              value={currentMedications}
              onChange={(e) => handleMedicationsChange(e.target.value)}
              placeholder="List current medications, dosages, and frequency (e.g., Lisinopril 10mg daily, Metformin 500mg twice daily)"
              rows={4}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Allergies */}
          <div>
            <Label>Known Allergies</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {allergyOptions.map(allergy => (
                <div key={allergy} className="flex items-center space-x-2">
                  <Checkbox
                    id={`allergy-${allergy}`}
                    checked={allergies.includes(allergy)}
                    onCheckedChange={() => handleAllergyToggle(allergy)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`allergy-${allergy}`} className="text-sm cursor-pointer">
                    {allergy}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Previous Dental Treatments */}
          <div>
            <Label>Previous Dental Treatments</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {dentalTreatmentOptions.map(treatment => (
                <div key={treatment} className="flex items-center space-x-2">
                  <Checkbox
                    id={`treatment-${treatment}`}
                    checked={previousDentalTreatments.includes(treatment)}
                    onCheckedChange={() => handleDentalTreatmentToggle(treatment)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`treatment-${treatment}`} className="text-sm cursor-pointer">
                    {treatment}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Family Medical History */}
          <div>
            <Label htmlFor="family-history">Family Medical History</Label>
            <Textarea
              id="family-history"
              value={familyMedicalHistory}
              onChange={(e) => handleFamilyHistoryChange(e.target.value)}
              placeholder="Describe any relevant family medical history (parents, siblings, grandparents)"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <Label htmlFor="additional-notes">Additional Medical Notes</Label>
            <Textarea
              id="additional-notes"
              value={additionalNotes}
              onChange={(e) => handleAdditionalNotesChange(e.target.value)}
              placeholder="Any other medical information, hospitalizations, surgeries, or concerns"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Save Button */}
          {!isReadOnly && onSave && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => {
                  if (onSave) {
                    onSave({
                      medical_conditions: medicalConditions,
                      current_medications: currentMedications,
                      allergies: allergies,
                      previous_dental_treatments: previousDentalTreatments,
                      family_medical_history: familyMedicalHistory,
                      additional_notes: additionalNotes
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