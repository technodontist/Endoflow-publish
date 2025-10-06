"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Save, Plus } from "lucide-react"
import { EndoAICopilot } from "@/components/endo-ai-copilot"

interface FullScreenToothDiagnosisProps {
  toothNumber: string
  patientName: string
  onBack: () => void
}

export function FullScreenToothDiagnosis({ toothNumber, patientName, onBack }: FullScreenToothDiagnosisProps) {
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([])
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([])
  const [diagnosisSearch, setDiagnosisSearch] = useState("")
  const [treatmentSearch, setTreatmentSearch] = useState("")
  const [customDiagnosis, setCustomDiagnosis] = useState("")
  const [customTreatment, setCustomTreatment] = useState("")

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
    "Developmental Anomalies": [
      "Enamel Hypoplasia",
      "Dentinogenesis Imperfecta",
      "Amelogenesis Imperfecta",
      "Taurodontism",
      "Dens Invaginatus",
      "Supernumerary Tooth",
    ],
    "Traumatic Injuries": [
      "Crown Fracture (Enamel Only)",
      "Crown Fracture (Enamel-Dentin)",
      "Crown Fracture (Pulp Exposure)",
      "Root Fracture",
      "Luxation (Lateral)",
      "Intrusive Luxation",
      "Extrusive Luxation",
      "Avulsion",
    ],
    "Wear & Erosion": [
      "Attrition (Occlusal Wear)",
      "Abrasion (Cervical Wear)",
      "Erosion (Acid Wear)",
      "Abfraction",
      "Bruxism-Related Wear",
    ],
    "Tooth Resorption": [
      "External Root Resorption",
      "Internal Root Resorption",
      "Cervical Resorption",
      "Replacement Resorption",
    ],
    "Other Conditions": [
      "Hypersensitivity",
      "Tooth Discoloration",
      "Cracked Tooth Syndrome",
      "Fistula",
      "Mobility (Grade I/II/III)",
      "Impacted Tooth",
    ],
  }

  const predefinedTreatments = {
    Preventive: ["Fluoride Application", "Dental Sealants", "Oral Hygiene Instructions", "Dietary Counseling"],
    Restorative: ["Composite Filling", "Amalgam Filling", "Glass Ionomer Filling", "Inlay/Onlay", "Crown Preparation"],
    Endodontic: ["Pulp Capping", "Pulpotomy", "Root Canal Treatment", "Retreatment", "Apexification"],
    Surgical: ["Simple Extraction", "Surgical Extraction", "Apicoectomy", "Root Resection", "Hemisection"],
    Periodontal: ["Scaling & Root Planing", "Gingivectomy", "Flap Surgery", "Bone Grafting", "GTR Procedure"],
    Prosthodontic: [
      "Post & Core",
      "Full Crown (PFM)",
      "Full Crown (Zirconia)",
      "Full Crown (E-max)",
      "Veneer (Porcelain)",
      "Veneer (Composite)",
      "Inlay/Onlay (Ceramic)",
    ],
    Orthodontic: [
      "Space Maintainer",
      "Fixed Orthodontic Appliance",
      "Removable Appliance",
      "Interceptive Orthodontics",
    ],
    Pediatric: [
      "Stainless Steel Crown",
      "Strip Crown",
      "Pulpectomy (Primary Tooth)",
      "Space Regainer",
      "Fluoride Varnish",
    ],
    "Emergency/Trauma": [
      "Emergency Pain Relief",
      "Splinting",
      "Tooth Repositioning",
      "Reimplantation",
      "Temporary Restoration",
    ],
    Advanced: [
      "Bone Grafting (Socket Preservation)",
      "Sinus Lift",
      "Ridge Augmentation",
      "Implant Placement",
      "Guided Bone Regeneration",
      "Connective Tissue Graft",
    ],
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

  const handleAddCustomDiagnosis = () => {
    if (customDiagnosis.trim() && !selectedDiagnoses.includes(customDiagnosis.trim())) {
      setSelectedDiagnoses((prev) => [...prev, customDiagnosis.trim()])
      setCustomDiagnosis("")
    }
  }

  const handleAddCustomTreatment = () => {
    if (customTreatment.trim() && !selectedTreatments.includes(customTreatment.trim())) {
      setSelectedTreatments((prev) => [...prev, customTreatment.trim()])
      setCustomTreatment("")
    }
  }

  const handleSave = () => {
    console.log("[v0] Saving clinical record for tooth", toothNumber, {
      diagnoses: selectedDiagnoses,
      treatments: selectedTreatments,
    })
    onBack()
  }

  const filteredDiagnoses = filterItems(predefinedDiagnoses, diagnosisSearch)
  const filteredTreatments = filterItems(predefinedTreatments, treatmentSearch)

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack} className="flex items-center gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back to Dental Chart
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Clinical Record for Tooth #{toothNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Patient: {patientName} • Add diagnosis and treatment plan using evidence-based protocols
            </p>
          </div>
        </div>
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Clinical Record
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Diagnosis Section */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg text-primary">Diagnosis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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

                {/* Custom Diagnosis Input and Add Button */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Add Custom Diagnosis:</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom diagnosis..."
                      value={customDiagnosis}
                      onChange={(e) => setCustomDiagnosis(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddCustomDiagnosis()}
                    />
                    <Button
                      onClick={handleAddCustomDiagnosis}
                      disabled={!customDiagnosis.trim()}
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      Add Diagnosis
                    </Button>
                  </div>
                </div>

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

                {/* Diagnosis Categories */}
                <div className="max-h-[600px] overflow-y-auto space-y-4">
                  {Object.entries(filteredDiagnoses).map(([category, diagnoses]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h4 className="font-medium text-sm text-primary mb-3">{category}</h4>
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

            {/* Treatment Plan Section */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg text-teal-700">Treatment Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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

                {/* Custom Treatment Input and Add Button */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Add Custom Treatment:</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom treatment..."
                      value={customTreatment}
                      onChange={(e) => setCustomTreatment(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddCustomTreatment()}
                    />
                    <Button
                      onClick={handleAddCustomTreatment}
                      disabled={!customTreatment.trim()}
                      className="flex items-center gap-2 whitespace-nowrap bg-teal-600 hover:bg-teal-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Treatment
                    </Button>
                  </div>
                </div>

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

                {/* Treatment Categories */}
                <div className="max-h-[600px] overflow-y-auto space-y-4">
                  {Object.entries(filteredTreatments).map(([category, treatments]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h4 className="font-medium text-sm text-teal-700 mb-3">{category}</h4>
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

          {/* Endo-AI Co-Pilot */}
          {(selectedDiagnoses.length > 0 || selectedTreatments.length > 0) && (
            <div className="mt-8">
              <EndoAICopilot
                toothNumber={toothNumber}
                diagnosis={selectedDiagnoses.join(", ")}
                treatments={selectedTreatments.join(", ")}
                className="border-amber-200 bg-amber-50"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
