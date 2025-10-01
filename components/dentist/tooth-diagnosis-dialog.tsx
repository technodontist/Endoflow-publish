"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, Search, Save, Plus, Loader2 } from "lucide-react"
import { saveToothDiagnosis, type ToothDiagnosisData } from "@/lib/actions/tooth-diagnoses"

interface ToothDiagnosisDialogProps {
  isOpen: boolean
  onClose: () => void
  toothNumber: string
  patientId?: string
  consultationId?: string
  existingData?: ToothDiagnosisData
  onDataSaved?: () => void
}

export function ToothDiagnosisDialog({ 
  isOpen, 
  onClose, 
  toothNumber,
  patientId,
  consultationId,
  existingData,
  onDataSaved
}: ToothDiagnosisDialogProps) {
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([])
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([])
  const [diagnosisSearch, setDiagnosisSearch] = useState("")
  const [treatmentSearch, setTreatmentSearch] = useState("")
  const [status, setStatus] = useState<ToothDiagnosisData['status']>('healthy')
  const [treatmentPriority, setTreatmentPriority] = useState<ToothDiagnosisData['treatmentPriority']>('medium')
  const [notes, setNotes] = useState("")
  const [estimatedDuration, setEstimatedDuration] = useState<number | undefined>(undefined)
  const [estimatedCost, setEstimatedCost] = useState("")
  const [followUpRequired, setFollowUpRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing data when dialog opens
  useEffect(() => {
    if (isOpen && existingData) {
      setSelectedDiagnoses(existingData.primaryDiagnosis ? [existingData.primaryDiagnosis] : [])
      setSelectedTreatments(existingData.recommendedTreatment ? [existingData.recommendedTreatment] : [])
      setStatus(existingData.status)
      setTreatmentPriority(existingData.treatmentPriority)
      setNotes(existingData.notes || "")
      setEstimatedDuration(existingData.estimatedDuration)
      setEstimatedCost(existingData.estimatedCost || "")
      setFollowUpRequired(existingData.followUpRequired || false)
    } else if (isOpen) {
      // Reset form for new diagnosis
      setSelectedDiagnoses([])
      setSelectedTreatments([])
      setStatus('healthy')
      setTreatmentPriority('medium')
      setNotes("")
      setEstimatedDuration(undefined)
      setEstimatedCost("")
      setFollowUpRequired(false)
    }
    setError(null)
  }, [isOpen, existingData])

  const predefinedDiagnoses = {
    "Caries & Cavities": [
      "Incipient Caries",
      "Moderate Caries",
      "Deep Caries",
      "Rampant Caries",
      "Root Caries",
      "Recurrent Caries",
    ],
    "Pulpal Conditions": [
      "Reversible Pulpitis",
      "Irreversible Pulpitis",
      "Pulp Necrosis",
      "Pulp Hyperplasia",
      "Internal Resorption",
    ],
    "Periapical Conditions": [
      "Acute Apical Periodontitis",
      "Chronic Apical Periodontitis",
      "Apical Abscess",
      "Apical Granuloma",
      "Apical Cyst",
    ],
    Periodontal: [
      "Gingivitis",
      "Chronic Periodontitis",
      "Aggressive Periodontitis",
      "Gingival Recession",
      "Furcation Involvement",
    ],
    Restorative: [
      "Failed Restoration",
      "Marginal Leakage",
      "Secondary Caries",
      "Fractured Restoration",
      "Worn Restoration",
    ],
  }

  const predefinedTreatments = {
    Preventive: ["Fluoride Application", "Dental Sealants", "Oral Hygiene Instructions", "Dietary Counseling"],
    Restorative: ["Composite Filling", "Amalgam Filling", "Glass Ionomer Filling", "Inlay/Onlay", "Crown Preparation"],
    Endodontic: ["Pulp Capping", "Pulpotomy", "Root Canal Treatment", "Retreatment", "Apexification"],
    Surgical: ["Simple Extraction", "Surgical Extraction", "Apicoectomy", "Root Resection", "Hemisection"],
    Periodontal: ["Scaling & Root Planing", "Gingivectomy", "Flap Surgery", "Bone Grafting", "GTR Procedure"],
  }

  const statusOptions: { value: ToothDiagnosisData['status'], label: string }[] = [
    { value: 'healthy', label: 'Healthy' },
    { value: 'caries', label: 'Caries' },
    { value: 'filled', label: 'Filled' },
    { value: 'crown', label: 'Crown' },
    { value: 'missing', label: 'Missing' },
    { value: 'attention', label: 'Needs Attention' },
    { value: 'root_canal', label: 'Root Canal' },
    { value: 'extraction_needed', label: 'Extraction Needed' },
    { value: 'implant', label: 'Implant' }
  ]

  const priorityOptions: { value: ToothDiagnosisData['treatmentPriority'], label: string }[] = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'routine', label: 'Routine' }
  ]

  const filterItems = (items: Record<string, string[]>, searchTerm: string) => {
    if (!searchTerm) return items
    const filtered: Record<string, string[]> = {}
    Object.entries(items).forEach(([category, itemList]) => {
      const matchingItems = itemList.filter((item) => item.toLowerCase().includes(searchTerm.toLowerCase()))
      if (matchingItems.length > 0) {
        filtered[category] = matchingItems
      }
    })
    return filtered
  }

  const handleDiagnosisToggle = (diagnosis: string) => {
    setSelectedDiagnoses((prev) =>
      prev.includes(diagnosis) ? prev.filter((d) => d !== diagnosis) : [...prev, diagnosis],
    )
  }

  const handleTreatmentToggle = (treatment: string) => {
    setSelectedTreatments((prev) =>
      prev.includes(treatment) ? prev.filter((t) => t !== treatment) : [...prev, treatment],
    )
  }

  const handleSave = async () => {
    if (!patientId) {
      setError('Patient ID is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const toothDiagnosisData: ToothDiagnosisData = {
        id: existingData?.id,
        patientId,
        consultationId,
        toothNumber,
        status,
        primaryDiagnosis: selectedDiagnoses.join(', '),
        recommendedTreatment: selectedTreatments.join(', '),
        treatmentPriority,
        notes,
        estimatedDuration,
        estimatedCost,
        followUpRequired,
        examinationDate: new Date().toISOString().split('T')[0]
      }

      const result = await saveToothDiagnosis(toothDiagnosisData)
      
      if (result.success) {
        console.log('✅ Tooth diagnosis saved successfully')
        onDataSaved?.()
        onClose()
      } else {
        setError(result.error || 'Failed to save tooth diagnosis')
      }
    } catch (error) {
      console.error('Error saving tooth diagnosis:', error)
      setError('Failed to save tooth diagnosis')
    } finally {
      setLoading(false)
    }
  }

  const filteredDiagnoses = filterItems(predefinedDiagnoses, diagnosisSearch)
  const filteredTreatments = filterItems(predefinedTreatments, treatmentSearch)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Clinical Record for Tooth #{toothNumber}
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </DialogTitle>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Left Column - Diagnosis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-blue-600">🔍</span>
                Diagnosis & Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tooth Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tooth Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ToothDiagnosisData['status'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search diagnoses..."
                  value={diagnosisSearch}
                  onChange={(e) => setDiagnosisSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Selected Diagnoses */}
              {selectedDiagnoses.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Selected Diagnoses:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedDiagnoses.map((diagnosis) => (
                      <div
                        key={diagnosis}
                        className="bg-blue-100 text-blue-800 px-3 py-2 rounded text-sm flex items-center gap-2"
                      >
                        {diagnosis}
                        <button
                          onClick={() => handleDiagnosisToggle(diagnosis)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnosis Categories */}
              <div className="max-h-64 overflow-y-auto space-y-4">
                {Object.entries(filteredDiagnoses).map(([category, diagnoses]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <h4 className="font-medium text-sm text-blue-600 mb-3">{category}</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {diagnoses.map((diagnosis) => (
                        <div key={diagnosis} className="flex items-center space-x-3">
                          <Checkbox
                            id={`diag-${diagnosis}`}
                            checked={selectedDiagnoses.includes(diagnosis)}
                            onCheckedChange={() => handleDiagnosisToggle(diagnosis)}
                          />
                          <Label htmlFor={`diag-${diagnosis}`} className="text-sm cursor-pointer">
                            {diagnosis}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Treatment Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-green-600">🔧</span>
                Treatment Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Treatment Priority */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Treatment Priority</Label>
                <Select value={treatmentPriority} onValueChange={(value) => setTreatmentPriority(value as ToothDiagnosisData['treatmentPriority'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search treatments..."
                  value={treatmentSearch}
                  onChange={(e) => setTreatmentSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Selected Treatments */}
              {selectedTreatments.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Selected Treatments:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTreatments.map((treatment) => (
                      <div
                        key={treatment}
                        className="bg-green-100 text-green-800 px-3 py-2 rounded text-sm flex items-center gap-2"
                      >
                        {treatment}
                        <button
                          onClick={() => handleTreatmentToggle(treatment)}
                          className="ml-1 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Treatment Categories */}
              <div className="max-h-64 overflow-y-auto space-y-4">
                {Object.entries(filteredTreatments).map(([category, treatments]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <h4 className="font-medium text-sm text-green-600 mb-3">{category}</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {treatments.map((treatment) => (
                        <div key={treatment} className="flex items-center space-x-3">
                          <Checkbox
                            id={`treat-${treatment}`}
                            checked={selectedTreatments.includes(treatment)}
                            onCheckedChange={() => handleTreatmentToggle(treatment)}
                          />
                          <Label htmlFor={`treat-${treatment}`} className="text-sm cursor-pointer">
                            {treatment}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration" className="text-sm font-medium">
                  Estimated Duration (minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="30"
                  value={estimatedDuration !== undefined ? estimatedDuration.toString() : ''}
                  onChange={(e) => setEstimatedDuration(e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Label htmlFor="cost" className="text-sm font-medium">
                  Estimated Cost
                </Label>
                <Input
                  id="cost"
                  placeholder="$150.00"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="followUp"
                checked={followUpRequired}
                onCheckedChange={(checked) => setFollowUpRequired(!!checked)}
              />
              <Label htmlFor="followUp" className="text-sm">
                Follow-up appointment required
              </Label>
            </div>
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">
                Clinical Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Enter additional clinical notes, observations, or treatment details..."
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Clinical Record
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}