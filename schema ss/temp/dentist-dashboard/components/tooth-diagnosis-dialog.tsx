"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search } from "lucide-react"
import { EndoAICopilot } from "./endo-ai-copilot"

interface ToothDiagnosisDialogProps {
  isOpen: boolean
  onClose: () => void
  toothNumber: string
}

export function ToothDiagnosisDialog({ isOpen, onClose, toothNumber }: ToothDiagnosisDialogProps) {
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([])
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([])
  const [diagnosisSearch, setDiagnosisSearch] = useState("")
  const [treatmentSearch, setTreatmentSearch] = useState("")
  const [showDiagnosisList, setShowDiagnosisList] = useState(false)
  const [showTreatmentList, setShowTreatmentList] = useState(false)

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

  const handleSave = () => {
    console.log("[v0] Saving clinical record for tooth", toothNumber, {
      diagnoses: selectedDiagnoses,
      treatments: selectedTreatments,
    })
    onClose()
  }

  const filteredDiagnoses = filterItems(predefinedDiagnoses, diagnosisSearch)
  const filteredTreatments = filterItems(predefinedTreatments, treatmentSearch)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[80vw] h-[80vh] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clinical Record for Tooth #{toothNumber}</DialogTitle>
          <DialogDescription>
            Add diagnosis and treatment plan for the selected tooth using evidence-based protocols.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Diagnosis
                <Button
                  size="sm"
                  onClick={() => setShowDiagnosisList(!showDiagnosisList)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Diagnosis
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Diagnoses */}
              {selectedDiagnoses.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Selected Diagnoses:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedDiagnoses.map((diagnosis) => (
                      <div
                        key={diagnosis}
                        className="bg-primary/10 text-primary px-3 py-2 rounded text-sm flex items-center gap-2"
                      >
                        {diagnosis}
                        <button
                          onClick={() => handleDiagnosisToggle(diagnosis)}
                          className="ml-1 text-primary hover:text-primary/70"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnosis Selection */}
              {showDiagnosisList && (
                <div className="space-y-4 border rounded-lg p-6 bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search diagnoses..."
                      value={diagnosisSearch}
                      onChange={(e) => setDiagnosisSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-4">
                    {Object.entries(filteredDiagnoses).map(([category, diagnoses]) => (
                      <div key={category}>
                        <h4 className="font-medium text-sm text-primary mb-3">{category}</h4>
                        <div className="grid grid-cols-1 gap-3 ml-2">
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
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Treatment Plan
                <Button
                  size="sm"
                  onClick={() => setShowTreatmentList(!showTreatmentList)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Treatment
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Treatments */}
              {selectedTreatments.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Selected Treatments:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTreatments.map((treatment) => (
                      <div
                        key={treatment}
                        className="bg-teal-100 text-teal-700 px-3 py-2 rounded text-sm flex items-center gap-2"
                      >
                        {treatment}
                        <button
                          onClick={() => handleTreatmentToggle(treatment)}
                          className="ml-1 text-teal-700 hover:text-teal-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Treatment Selection */}
              {showTreatmentList && (
                <div className="space-y-4 border rounded-lg p-6 bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search treatments..."
                      value={treatmentSearch}
                      onChange={(e) => setTreatmentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-4">
                    {Object.entries(filteredTreatments).map(([category, treatments]) => (
                      <div key={category}>
                        <h4 className="font-medium text-sm text-teal-700 mb-3">{category}</h4>
                        <div className="grid grid-cols-1 gap-3 ml-2">
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {(selectedDiagnoses.length > 0 || selectedTreatments.length > 0) && (
          <div className="mt-8">
            <EndoAICopilot
              toothNumber={toothNumber}
              diagnosis={selectedDiagnoses.join(", ")}
              treatments={selectedTreatments.join(", ")}
            />
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-primary">
            Save Clinical Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
