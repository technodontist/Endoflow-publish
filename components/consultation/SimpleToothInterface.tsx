'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { X, Search, Plus, ChevronDown, ChevronRight } from "lucide-react"

interface SimpleToothInterfaceProps {
  toothNumber: string
  onClose: () => void
  onSave: (data: any) => void
  existingData?: Partial<ToothData>
}

interface ToothData {
  currentStatus: string
  selectedDiagnoses: string[]
  diagnosisDetails: string
  examinationDate: string
  symptoms: string[]
  diagnosticNotes: string
  selectedTreatments: string[]
  priority: string
  treatmentDetails: string
  duration: string
  estimatedCost: string
  scheduledDate: string
  treatmentNotes: string
  followUpRequired: boolean
}

export function SimpleToothInterface({ toothNumber, onClose, onSave, existingData }: SimpleToothInterfaceProps) {
  // Check if we're dealing with multiple teeth
  const isMultiSelect = toothNumber.includes(',')
  const toothNumbers = isMultiSelect ? toothNumber.split(',') : [toothNumber]
  const [customDiagnosis, setCustomDiagnosis] = useState('')
  const [customTreatment, setCustomTreatment] = useState('')
  const [diagnosisSearch, setDiagnosisSearch] = useState('')
  const [treatmentSearch, setTreatmentSearch] = useState('')
  const [expandedDiagnosisCategories, setExpandedDiagnosisCategories] = useState<Record<string, boolean>>({})
  const [expandedTreatmentCategories, setExpandedTreatmentCategories] = useState<Record<string, boolean>>({})

  // Multi-select individual treatment mode
  const [treatmentMode, setTreatmentMode] = useState<'unified' | 'individual'>('unified')
  const [individualToothTreatments, setIndividualToothTreatments] = useState<{[toothNumber: string]: Partial<ToothData>}>({})
  const [toothData, setToothData] = useState<ToothData>({
    currentStatus: existingData?.currentStatus || 'healthy',
    selectedDiagnoses: existingData?.selectedDiagnoses || [],
    diagnosisDetails: existingData?.diagnosisDetails || '',
    examinationDate: existingData?.examinationDate || new Date().toISOString().split('T')[0],
    symptoms: existingData?.symptoms || [],
    diagnosticNotes: existingData?.diagnosticNotes || '',
    selectedTreatments: existingData?.selectedTreatments || [],
    priority: (existingData?.priority as any) || 'medium',
    treatmentDetails: existingData?.treatmentDetails || '',
    duration: (existingData?.duration as any) || '60',
    estimatedCost: (existingData?.estimatedCost as any) || '',
    scheduledDate: (existingData?.scheduledDate as any) || '',
    treatmentNotes: existingData?.treatmentNotes || '',
    followUpRequired: !!existingData?.followUpRequired
  })
  const originalStatusRef = useRef<string>(toothData.currentStatus)

  // Derive status heuristics from diagnosis/treatment
  const deriveStatus = (payload: { diagnoses?: string[]; treatments?: string[]; fallback?: string }) => {
    const diag = (payload.diagnoses || []).join(' ').toLowerCase()
    const trt = (payload.treatments || []).join(' ').toLowerCase()
    if (diag.includes('caries') || trt.includes('filling')) return 'caries'
    if (trt.includes('filling') || diag.includes('filled')) return 'filled'
    if (trt.includes('crown') || diag.includes('crown')) return 'crown'
    if (diag.includes('pulp') || trt.includes('root canal')) return 'root_canal'
    if (diag.includes('extract') || trt.includes('extraction')) return 'extraction_needed'
    if (trt.includes('implant') || diag.includes('implant')) return 'implant'
    if (diag.includes('periodontal')) return 'attention'
    return payload.fallback || 'healthy'
  }

  const categorizedDiagnoses = {
    'Caries & Cavities': [
      'Incipient Caries',
      'Moderate Caries',
      'Deep Caries',
      'Rampant Caries',
      'Root Caries',
      'Recurrent Caries',
    ],
    'Pulpal Conditions': [
      'Reversible Pulpitis',
      'Irreversible Pulpitis',
      'Pulp Necrosis',
      'Pulp Hyperplasia',
      'Internal Resorption',
    ],
    'Periapical Conditions': [
      'Acute Apical Periodontitis',
      'Chronic Apical Periodontitis',
      'Apical Abscess',
      'Apical Granuloma',
      'Apical Cyst',
    ],
    'Periodontal': [
      'Gingivitis',
      'Chronic Periodontitis',
      'Aggressive Periodontitis',
      'Gingival Recession',
      'Furcation Involvement',
    ],
    'Restorative': [
      'Failed Restoration',
      'Marginal Leakage',
      'Secondary Caries',
      'Fractured Restoration',
      'Worn Restoration',
    ],
    'Developmental Anomalies': [
      'Enamel Hypoplasia',
      'Dentinogenesis Imperfecta',
      'Amelogenesis Imperfecta',
      'Taurodontism',
      'Dens Invaginatus',
      'Supernumerary Tooth',
    ],
    'Traumatic Injuries': [
      'Crown Fracture (Enamel Only)',
      'Crown Fracture (Enamel-Dentin)',
      'Crown Fracture (Pulp Exposure)',
      'Root Fracture',
      'Vertical Root Fracture',
      'Luxation (Lateral)',
      'Intrusive Luxation',
      'Extrusive Luxation',
      'Avulsion',
    ],
    'Wear & Erosion': [
      'Attrition (Occlusal Wear)',
      'Abrasion (Cervical Wear)',
      'Erosion (Acid Wear)',
      'Abfraction',
      'Bruxism-Related Wear',
    ],
    'Tooth Resorption': [
      'External Root Resorption',
      'Internal Root Resorption',
      'Cervical Resorption',
      'Replacement Resorption',
    ],
    'Other Conditions': [
      'Hypersensitivity',
      'Tooth Discoloration',
      'Cracked Tooth Syndrome',
      'Fistula',
      'Mobility (Grade I/II/III)',
      'Impacted Tooth',
    ],
  }

  const categorizedTreatments = {
    'Preventive': [
      'Fluoride Application',
      'Dental Sealants',
      'Oral Hygiene Instructions',
      'Dietary Counseling',
    ],
    'Restorative': [
      'Composite Filling',
      'Amalgam Filling',
      'Glass Ionomer Filling',
      'Inlay/Onlay',
      'Crown Preparation',
    ],
    'Endodontic': [
      'Pulp Capping',
      'Pulpotomy',
      'Root Canal Treatment',
      'Retreatment',
      'Apexification',
    ],
    'Surgical': [
      'Simple Extraction',
      'Surgical Extraction',
      'Apicoectomy',
      'Root Resection',
      'Hemisection',
    ],
    'Periodontal': [
      'Scaling & Root Planing',
      'Gingivectomy',
      'Flap Surgery',
      'Bone Grafting',
      'GTR Procedure',
    ],
    'Prosthodontic': [
      'Post & Core',
      'Full Crown (PFM)',
      'Full Crown (Zirconia)',
      'Full Crown (E-max)',
      'Veneer (Porcelain)',
      'Veneer (Composite)',
      'Inlay/Onlay (Ceramic)',
    ],
    'Orthodontic': [
      'Space Maintainer',
      'Fixed Orthodontic Appliance',
      'Removable Appliance',
      'Interceptive Orthodontics',
    ],
    'Pediatric': [
      'Stainless Steel Crown',
      'Strip Crown',
      'Pulpectomy (Primary Tooth)',
      'Space Regainer',
      'Fluoride Varnish',
    ],
    'Emergency/Trauma': [
      'Emergency Pain Relief',
      'Splinting',
      'Tooth Repositioning',
      'Reimplantation',
      'Temporary Restoration',
    ],
    'Advanced': [
      'Bone Grafting (Socket Preservation)',
      'Sinus Lift',
      'Ridge Augmentation',
      'Implant Placement',
      'Guided Bone Regeneration',
      'Connective Tissue Graft',
    ],
  }

  const availableSymptoms = ['Pain', 'Sensitivity', 'Swelling', 'Bleeding', 'Mobility', 'Fracture']

  // Filter diagnoses by category based on search term
  const filteredDiagnosesByCategory = Object.entries(categorizedDiagnoses).reduce((acc, [category, diagnoses]) => {
    const filtered = diagnoses.filter(diagnosis =>
      diagnosis.toLowerCase().includes(diagnosisSearch.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[category] = filtered
    }
    return acc
  }, {} as Record<string, string[]>)

  // Filter treatments by category based on search term
  const filteredTreatmentsByCategory = Object.entries(categorizedTreatments).reduce((acc, [category, treatments]) => {
    const filtered = treatments.filter(treatment =>
      treatment.toLowerCase().includes(treatmentSearch.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[category] = filtered
    }
    return acc
  }, {} as Record<string, string[]>)

  // Get all treatments as flat array for individual mode
  const allTreatments = Object.values(categorizedTreatments).flat()

  const handleUpdate = (field: keyof ToothData, value: any) => {
    setToothData(prev => ({ ...prev, [field]: value }))
  }

  const toggleSymptom = (symptom: string) => {
    setToothData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }))
  }

  const addDiagnosis = (diagnosis: string) => {
    setToothData(prev => {
      const selected = prev.selectedDiagnoses.includes(diagnosis)
        ? prev.selectedDiagnoses
        : [...prev.selectedDiagnoses, diagnosis]
      const nextStatus = deriveStatus({ diagnoses: selected, treatments: prev.selectedTreatments, fallback: prev.currentStatus })
      return { ...prev, selectedDiagnoses: selected, currentStatus: nextStatus }
    })
  }

  const removeDiagnosis = (diagnosis: string) => {
    setToothData(prev => ({
      ...prev,
      selectedDiagnoses: prev.selectedDiagnoses.filter(d => d !== diagnosis)
    }))
  }

  const addTreatment = (treatment: string) => {
    setToothData(prev => {
      const selected = prev.selectedTreatments.includes(treatment)
        ? prev.selectedTreatments
        : [...prev.selectedTreatments, treatment]
      const nextStatus = deriveStatus({ diagnoses: prev.selectedDiagnoses, treatments: selected, fallback: prev.currentStatus })
      return { ...prev, selectedTreatments: selected, currentStatus: nextStatus }
    })
  }

  const removeTreatment = (treatment: string) => {
    setToothData(prev => ({
      ...prev,
      selectedTreatments: prev.selectedTreatments.filter(t => t !== treatment)
    }))
  }

  const handleAddCustomDiagnosis = () => {
    if (customDiagnosis.trim()) {
      addDiagnosis(customDiagnosis.trim())
      setCustomDiagnosis('')
    }
  }

  const handleAddCustomTreatment = () => {
    if (customTreatment.trim()) {
      addTreatment(customTreatment.trim())
      setCustomTreatment('')
    }
  }

  const handleSave = () => {
    if (isMultiSelect) {
      // For multi-select, we might have individual treatments per tooth
      const multiTeethData = {}
      if (individualToothTreatments && Object.keys(individualToothTreatments).length > 0) {
        // Individual treatments mode
        toothNumbers.forEach(tooth => {
          multiTeethData[tooth] = {
            ...toothData,
            selectedTreatments: individualToothTreatments[tooth]?.selectedTreatments || toothData.selectedTreatments,
            treatmentDetails: individualToothTreatments[tooth]?.treatmentDetails || toothData.treatmentDetails,
            estimatedCost: individualToothTreatments[tooth]?.estimatedCost || toothData.estimatedCost,
            duration: individualToothTreatments[tooth]?.duration || toothData.duration,
            priority: individualToothTreatments[tooth]?.priority || toothData.priority
          }
        })
      } else {
        // Unified treatments mode (original behavior)
        toothNumbers.forEach(tooth => {
          multiTeethData[tooth] = { ...toothData }
        })
      }
      onSave(multiTeethData)
      console.log(`🦷 Multi-select save: Applied diagnosis and treatment to teeth ${toothNumbers.join(', ')}`)
    } else {
      const payload = { ...toothData }
      // If status wasn’t changed in the dialog, omit it so we don’t override the previous status
      if (originalStatusRef.current === toothData.currentStatus) {
        delete (payload as any).currentStatus
      }
      onSave(payload)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to Dental Chart
            </Button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isMultiSelect
                  ? `Clinical Record for Teeth #${toothNumbers.join(', #')}`
                  : `Clinical Record for Tooth #${toothNumber}`
                }
              </h2>
              <p className="text-sm text-gray-600">
                Patient: Alok Abhinav • {isMultiSelect
                  ? `Creating unified diagnosis and treatment plan for ${toothNumbers.length} teeth`
                  : 'Add diagnosis and treatment plan using evidence-based protocols'
                }
              </p>
            </div>
          </div>

          {/* Compact Status Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600">Status</Label>
            <Select
              value={toothData.currentStatus}
              onValueChange={(val) => setToothData(prev => ({ ...prev, currentStatus: val }))}
            >
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="caries">Caries</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="crown">Crown</SelectItem>
                <SelectItem value="root_canal">Root Canal</SelectItem>
                <SelectItem value="extraction_needed">Extraction Needed</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="attention">Needs Attention</SelectItem>
                <SelectItem value="implant">Implant</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isMultiSelect ? `Save Records for ${toothNumbers.length} Teeth` : 'Save Clinical Record'}
            </Button>
          </div>
        </div>

        {/* Multi-select indicator */}
        {isMultiSelect && (
          <div className="px-6 py-3 bg-purple-50 border-b border-purple-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-purple-100 text-purple-800">
                  Multi-Select Mode
                </Badge>
                <span className="text-sm text-gray-700">
                  Treating teeth:
                  <span className="font-medium ml-1">
                    {toothNumbers.map(tooth => `#${tooth}`).join(', ')}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Treatment Mode:</span>
                <div className="flex bg-white rounded-lg border border-purple-200">
                  <Button
                    size="sm"
                    variant={treatmentMode === 'unified' ? 'default' : 'ghost'}
                    onClick={() => setTreatmentMode('unified')}
                    className="text-xs px-3 py-1"
                  >
                    Unified
                  </Button>
                  <Button
                    size="sm"
                    variant={treatmentMode === 'individual' ? 'default' : 'ghost'}
                    onClick={() => setTreatmentMode('individual')}
                    className="text-xs px-3 py-1"
                  >
                    Individual
                  </Button>
                </div>
              </div>
            </div>
            {treatmentMode === 'individual' && (
              <div className="mt-2 text-xs text-purple-700">
                💡 Individual mode: Shared diagnosis, but each tooth can have different treatments
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex h-full overflow-hidden">
          {/* Left Side - Diagnosis */}
          <div className="w-1/2 p-6 border-r">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-blue-600 mb-4">Diagnosis</h3>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search diagnoses..."
                    value={diagnosisSearch}
                    onChange={(e) => setDiagnosisSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Custom Diagnosis Input */}
                <div className="mb-4">
                  <Label className="text-sm font-medium mb-2 block">Add Custom Diagnosis:</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom diagnosis..."
                      value={customDiagnosis}
                      onChange={(e) => setCustomDiagnosis(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCustomDiagnosis()}
                    />
                    <Button
                      variant="outline"
                      onClick={handleAddCustomDiagnosis}
                      disabled={!customDiagnosis.trim()}
                    >
                      + Add Diagnosis
                    </Button>
                  </div>
                </div>

                {/* Selected Diagnoses */}
                {toothData.selectedDiagnoses.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-sm font-medium mb-2 block">Selected Diagnoses:</Label>
                    <div className="flex flex-wrap gap-2">
                      {toothData.selectedDiagnoses.map((diagnosis, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-blue-100 text-blue-800 flex items-center gap-1"
                        >
                          {diagnosis}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-red-600"
                            onClick={() => removeDiagnosis(diagnosis)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Diagnoses by Category - Single Scrollable Container */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {Object.entries(filteredDiagnosesByCategory).map(([category, diagnoses], categoryIndex) => (
                      <div key={category} className="border-b last:border-b-0">
                        {/* Category Header - Collapsible */}
                        <div
                          className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between sticky top-0 z-10"
                          onClick={() => {
                            setExpandedDiagnosisCategories(prev => ({
                              ...prev,
                              [category]: !prev[category]
                            }))
                          }}
                        >
                          <Label className="text-sm font-medium text-gray-700 cursor-pointer">{category}</Label>
                          {expandedDiagnosisCategories[category] ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        
                        {/* Category Items */}
                        {expandedDiagnosisCategories[category] && (
                          <div>
                            {diagnoses.map((diagnosis) => (
                              <div
                                key={diagnosis}
                                className={`p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-all duration-200 ${
                                  toothData.selectedDiagnoses.includes(diagnosis)
                                    ? 'bg-blue-100 border-l-4 border-blue-500'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  addDiagnosis(diagnosis)
                                }}
                              >
                                <div className="text-sm font-medium">{diagnosis}</div>
                                {toothData.selectedDiagnoses.includes(diagnosis) && (
                                  <div className="text-xs text-blue-600 mt-1">✓ Added</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Treatment Plan */}
          <div className="w-1/2 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-teal-600 mb-4">Treatment Plan</h3>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search treatments..."
                    value={treatmentSearch}
                    onChange={(e) => setTreatmentSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Custom Treatment Input */}
                <div className="mb-4">
                  <Label className="text-sm font-medium mb-2 block">Add Custom Treatment:</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom treatment..."
                      value={customTreatment}
                      onChange={(e) => setCustomTreatment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTreatment()}
                    />
                    <Button
                      variant="outline"
                      className="text-teal-600 border-teal-300"
                      onClick={handleAddCustomTreatment}
                      disabled={!customTreatment.trim()}
                    >
                      + Add Treatment
                    </Button>
                  </div>
                </div>

                {/* Selected Treatments */}
                {toothData.selectedTreatments.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-sm font-medium mb-2 block">Selected Treatments:</Label>
                    <div className="flex flex-wrap gap-2">
                      {toothData.selectedTreatments.map((treatment, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-teal-100 text-teal-800 flex items-center gap-1"
                        >
                          {treatment}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-red-600"
                            onClick={() => removeTreatment(treatment)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Treatments by Category - Single Scrollable Container */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {Object.entries(filteredTreatmentsByCategory).map(([category, treatments], categoryIndex) => (
                      <div key={category} className="border-b last:border-b-0">
                        {/* Category Header - Collapsible */}
                        <div
                          className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between sticky top-0 z-10"
                          onClick={() => {
                            setExpandedTreatmentCategories(prev => ({
                              ...prev,
                              [category]: !prev[category]
                            }))
                          }}
                        >
                          <Label className="text-sm font-medium text-gray-700 cursor-pointer">{category}</Label>
                          {expandedTreatmentCategories[category] ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        
                        {/* Category Items */}
                        {expandedTreatmentCategories[category] && (
                          <div>
                            {treatments.map((treatment) => (
                              <div
                                key={treatment}
                                className={`p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 flex items-center justify-between transition-all duration-200 ${
                                  toothData.selectedTreatments.includes(treatment)
                                    ? 'bg-teal-100 border-l-4 border-teal-500'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  addTreatment(treatment)
                                }}
                              >
                                <div className="text-sm font-medium">{treatment}</div>
                                <input
                                  type="checkbox"
                                  checked={toothData.selectedTreatments.includes(treatment)}
                                  readOnly
                                  className="text-teal-600"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Individual Treatment Mode - Per Tooth Assignment */}
                {isMultiSelect && treatmentMode === 'individual' && (
                  <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <Label className="text-sm font-medium mb-3 block text-purple-800">
                      Individual Treatment per Tooth
                    </Label>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {toothNumbers.map(tooth => (
                        <div key={tooth} className="bg-white p-3 rounded border border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm text-gray-700">Tooth #{tooth}</span>
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              Shared Diagnosis Applied
                            </Badge>
                          </div>

                          {/* Individual Treatment Selection */}
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-600">Select Treatments:</Label>
                            <div className="flex flex-wrap gap-1">
                              {allTreatments.slice(0, 4).map(treatment => {
                                const isSelected = individualToothTreatments[tooth]?.selectedTreatments?.includes(treatment) ||
                                                 (!individualToothTreatments[tooth] && toothData.selectedTreatments.includes(treatment))
                                return (
                                  <button
                                    key={treatment}
                                    type="button"
                                    onClick={() => {
                                      const currentTreatments = individualToothTreatments[tooth]?.selectedTreatments || toothData.selectedTreatments
                                      const newTreatments = isSelected
                                        ? currentTreatments.filter(t => t !== treatment)
                                        : [...currentTreatments, treatment]

                                      setIndividualToothTreatments(prev => ({
                                        ...prev,
                                        [tooth]: {
                                          ...prev[tooth],
                                          selectedTreatments: newTreatments
                                        }
                                      }))
                                    }}
                                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                                      isSelected
                                        ? 'bg-teal-100 text-teal-800 border-teal-300'
                                        : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                                    }`}
                                  >
                                    {treatment}
                                  </button>
                                )
                              })}
                            </div>

                            {/* Priority for this tooth */}
                            <div className="flex items-center gap-2 mt-2">
                              <Label className="text-xs text-gray-600">Priority:</Label>
                              <Select
                                value={individualToothTreatments[tooth]?.priority || toothData.priority || 'medium'}
                                onValueChange={(value) => {
                                  setIndividualToothTreatments(prev => ({
                                    ...prev,
                                    [tooth]: {
                                      ...prev[tooth],
                                      priority: value
                                    }
                                  }))
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t p-4 bg-gray-50 flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline">Add to Prescription</Button>
            <Button variant="outline">Schedule Follow-up</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {isMultiSelect ? `Save for ${toothNumbers.length} Teeth` : 'Save Diagnosis & Treatment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}