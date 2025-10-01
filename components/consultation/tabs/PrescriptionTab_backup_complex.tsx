'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Pill, AlertTriangle, Clock } from "lucide-react"
import { InteractiveDentalChart } from "@/components/dentist/interactive-dental-chart"

interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
  tooth_specific?: string[]
}

interface PrescriptionData {
  medications: Medication[]
  general_instructions: string
  tooth_specific_prescriptions: {
    [toothNumber: string]: {
      medications: Medication[]
      instructions: string
    }
  }
  allergies_checked: boolean
  drug_interactions_checked: boolean
  follow_up_required: boolean
  pharmacist_notes: string
}

interface PrescriptionTabProps {
  data: PrescriptionData
  onChange: (data: PrescriptionData) => void
  isReadOnly?: boolean
}

export function PrescriptionTab({ data, onChange, isReadOnly = false }: PrescriptionTabProps) {
  const [localData, setLocalData] = useState<PrescriptionData>(data)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)

  useEffect(() => {
    setLocalData(data)
  }, [data])

  const handleUpdate = (field: keyof PrescriptionData, value: any) => {
    const updatedData = { ...localData, [field]: value }
    setLocalData(updatedData)
    onChange(updatedData)
  }

  const addMedication = (isToothSpecific = false) => {
    const newMedication: Medication = {
      id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: '',
      tooth_specific: isToothSpecific && selectedTooth ? [selectedTooth] : undefined
    }

    if (isToothSpecific && selectedTooth) {
      const updatedToothPrescriptions = {
        ...localData.tooth_specific_prescriptions,
        [selectedTooth]: {
          ...localData.tooth_specific_prescriptions[selectedTooth],
          medications: [
            ...(localData.tooth_specific_prescriptions[selectedTooth]?.medications || []),
            newMedication
          ]
        }
      }
      handleUpdate('tooth_specific_prescriptions', updatedToothPrescriptions)
    } else {
      handleUpdate('medications', [...localData.medications, newMedication])
    }
  }

  const updateMedication = (medicationId: string, field: keyof Medication, value: string, isToothSpecific = false) => {
    if (isToothSpecific && selectedTooth) {
      const updatedToothPrescriptions = {
        ...localData.tooth_specific_prescriptions,
        [selectedTooth]: {
          ...localData.tooth_specific_prescriptions[selectedTooth],
          medications: (localData.tooth_specific_prescriptions[selectedTooth]?.medications || []).map(med =>
            med.id === medicationId ? { ...med, [field]: value } : med
          )
        }
      }
      handleUpdate('tooth_specific_prescriptions', updatedToothPrescriptions)
    } else {
      const updatedMedications = localData.medications.map(med =>
        med.id === medicationId ? { ...med, [field]: value } : med
      )
      handleUpdate('medications', updatedMedications)
    }
  }

  const removeMedication = (medicationId: string, isToothSpecific = false) => {
    if (isToothSpecific && selectedTooth) {
      const updatedToothPrescriptions = {
        ...localData.tooth_specific_prescriptions,
        [selectedTooth]: {
          ...localData.tooth_specific_prescriptions[selectedTooth],
          medications: (localData.tooth_specific_prescriptions[selectedTooth]?.medications || []).filter(med => med.id !== medicationId)
        }
      }
      handleUpdate('tooth_specific_prescriptions', updatedToothPrescriptions)
    } else {
      handleUpdate('medications', localData.medications.filter(med => med.id !== medicationId))
    }
  }

  const getToothData = (toothNumber: string) => {
    return localData.tooth_specific_prescriptions[toothNumber] || {
      medications: [],
      instructions: ''
    }
  }

  const getOralCavityStatus = () => {
    const toothNumbers = Array.from({ length: 32 }, (_, i) => (i + 1).toString())
    const prescribedTeeth = Object.keys(localData.tooth_specific_prescriptions).filter(tooth =>
      localData.tooth_specific_prescriptions[tooth].medications.length > 0
    )

    return {
      total: 32,
      healthy: toothNumbers.length - prescribedTeeth.length,
      prescribed: prescribedTeeth.length,
      medicated: prescribedTeeth.length
    }
  }

  const oralStatus = getOralCavityStatus()

  return (
    <div className="space-y-6">
      {/* Interactive Dental Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5" />
            Tooth-Specific Prescription Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <InteractiveDentalChart
              onToothSelect={(toothNumber) => {
                setSelectedTooth(toothNumber)
                console.log(`Selected tooth ${toothNumber} for prescription`)
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
                <div className="text-sm text-gray-600">No Medications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{oralStatus.prescribed}</div>
                <div className="text-sm text-gray-600">Prescribed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{oralStatus.medicated}</div>
                <div className="text-sm text-gray-600">Under Treatment</div>
              </div>
            </div>

            {selectedTooth && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">
                  Selected: Tooth #{selectedTooth}
                </h4>
                <Badge variant="outline" className="text-blue-700">
                  {getToothData(selectedTooth).medications.length} medication(s) prescribed
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Medications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5" />
                General Medications
              </CardTitle>
              <Button
                onClick={() => addMedication(false)}
                size="sm"
                disabled={isReadOnly}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Medication
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {localData.medications.map((medication) => (
              <Card key={medication.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Medication Details</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMedication(medication.id, false)}
                      disabled={isReadOnly}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`med-name-${medication.id}`}>Medicine Name</Label>
                      <Input
                        id={`med-name-${medication.id}`}
                        value={medication.name}
                        onChange={(e) => updateMedication(medication.id, 'name', e.target.value, false)}
                        placeholder="e.g., Amoxicillin"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`med-dosage-${medication.id}`}>Dosage</Label>
                      <Input
                        id={`med-dosage-${medication.id}`}
                        value={medication.dosage}
                        onChange={(e) => updateMedication(medication.id, 'dosage', e.target.value, false)}
                        placeholder="e.g., 500mg"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`med-frequency-${medication.id}`}>Frequency</Label>
                      <Select
                        value={medication.frequency}
                        onValueChange={(value) => updateMedication(medication.id, 'frequency', value, false)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once-daily">Once Daily</SelectItem>
                          <SelectItem value="twice-daily">Twice Daily</SelectItem>
                          <SelectItem value="thrice-daily">Thrice Daily</SelectItem>
                          <SelectItem value="four-times-daily">Four Times Daily</SelectItem>
                          <SelectItem value="as-needed">As Needed</SelectItem>
                          <SelectItem value="before-meals">Before Meals</SelectItem>
                          <SelectItem value="after-meals">After Meals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`med-duration-${medication.id}`}>Duration</Label>
                      <Input
                        id={`med-duration-${medication.id}`}
                        value={medication.duration}
                        onChange={(e) => updateMedication(medication.id, 'duration', e.target.value, false)}
                        placeholder="e.g., 7 days"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`med-instructions-${medication.id}`}>Instructions</Label>
                    <Textarea
                      id={`med-instructions-${medication.id}`}
                      value={medication.instructions}
                      onChange={(e) => updateMedication(medication.id, 'instructions', e.target.value, false)}
                      placeholder="Special instructions for the patient..."
                      rows={2}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </Card>
            ))}

            {localData.medications.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No general medications prescribed</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tooth-Specific Medications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Tooth-Specific Medications
              </CardTitle>
              <Button
                onClick={() => addMedication(true)}
                size="sm"
                disabled={isReadOnly || !selectedTooth}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add for Tooth #{selectedTooth}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTooth ? (
              <>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800">Tooth #{selectedTooth} Medications</h4>
                </div>

                {getToothData(selectedTooth).medications.map((medication) => (
                  <Card key={medication.id} className="p-4 border-blue-200">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-blue-700">
                          Tooth #{selectedTooth}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMedication(medication.id, true)}
                          disabled={isReadOnly}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`tooth-med-name-${medication.id}`}>Medicine Name</Label>
                          <Input
                            id={`tooth-med-name-${medication.id}`}
                            value={medication.name}
                            onChange={(e) => updateMedication(medication.id, 'name', e.target.value, true)}
                            placeholder="e.g., Ibuprofen"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`tooth-med-dosage-${medication.id}`}>Dosage</Label>
                          <Input
                            id={`tooth-med-dosage-${medication.id}`}
                            value={medication.dosage}
                            onChange={(e) => updateMedication(medication.id, 'dosage', e.target.value, true)}
                            placeholder="e.g., 400mg"
                            disabled={isReadOnly}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`tooth-med-instructions-${medication.id}`}>Tooth-Specific Instructions</Label>
                        <Textarea
                          id={`tooth-med-instructions-${medication.id}`}
                          value={medication.instructions}
                          onChange={(e) => updateMedication(medication.id, 'instructions', e.target.value, true)}
                          placeholder="Instructions specific to this tooth..."
                          rows={2}
                          disabled={isReadOnly}
                        />
                      </div>
                    </div>
                  </Card>
                ))}

                {getToothData(selectedTooth).medications.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Pill className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No medications for tooth #{selectedTooth}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor={`tooth-instructions-${selectedTooth}`}>Additional Instructions for Tooth #{selectedTooth}</Label>
                  <Textarea
                    id={`tooth-instructions-${selectedTooth}`}
                    value={getToothData(selectedTooth).instructions}
                    onChange={(e) => {
                      const updatedToothPrescriptions = {
                        ...localData.tooth_specific_prescriptions,
                        [selectedTooth]: {
                          ...getToothData(selectedTooth),
                          instructions: e.target.value
                        }
                      }
                      handleUpdate('tooth_specific_prescriptions', updatedToothPrescriptions)
                    }}
                    placeholder="Special care instructions for this tooth..."
                    rows={3}
                    disabled={isReadOnly}
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a tooth from the dental chart above</p>
                <p className="text-sm">to add tooth-specific medications</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* General Instructions and Safety Checks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="general-instructions">General Prescription Instructions</Label>
              <Textarea
                id="general-instructions"
                value={localData.general_instructions}
                onChange={(e) => handleUpdate('general_instructions', e.target.value)}
                placeholder="General instructions for the patient..."
                rows={4}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <Label htmlFor="pharmacist-notes">Notes for Pharmacist</Label>
              <Textarea
                id="pharmacist-notes"
                value={localData.pharmacist_notes}
                onChange={(e) => handleUpdate('pharmacist_notes', e.target.value)}
                placeholder="Special notes or instructions for the pharmacist..."
                rows={3}
                disabled={isReadOnly}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Safety Checks & Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allergies-checked"
                  checked={localData.allergies_checked}
                  onChange={(e) => handleUpdate('allergies_checked', e.target.checked)}
                  disabled={isReadOnly}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="allergies-checked" className="text-sm">
                  Patient allergies verified
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="interactions-checked"
                  checked={localData.drug_interactions_checked}
                  onChange={(e) => handleUpdate('drug_interactions_checked', e.target.checked)}
                  disabled={isReadOnly}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="interactions-checked" className="text-sm">
                  Drug interactions checked
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="follow-up-required"
                  checked={localData.follow_up_required}
                  onChange={(e) => handleUpdate('follow_up_required', e.target.checked)}
                  disabled={isReadOnly}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="follow-up-required" className="text-sm">
                  Follow-up appointment required
                </Label>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-800 mb-2">Safety Reminders</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Verify patient allergies before prescribing</li>
                <li>• Check for drug interactions</li>
                <li>• Provide clear dosage instructions</li>
                <li>• Schedule follow-up if needed</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}