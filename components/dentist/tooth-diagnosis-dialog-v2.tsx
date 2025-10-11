"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, Search, Save, Plus, Loader2, X, Sparkles, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { saveToothDiagnosis, type ToothDiagnosisData } from "@/lib/actions/tooth-diagnoses"
import EndoAICopilotLive from "./endo-ai-copilot-live"
import DiagnosisAICopilot from "./diagnosis-ai-copilot"

interface ToothDiagnosisDialogProps {
  isOpen: boolean
  onClose: () => void
  toothNumber: string
  patientId?: string
  consultationId?: string
  existingData?: ToothDiagnosisData
  onDataSaved?: () => void
}

export function ToothDiagnosisDialogV2({
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
  const [manualSymptoms, setManualSymptoms] = useState<string[]>([])

  // Helper function to normalize and match diagnosis names
  const normalizeDiagnosisName = (diagnosis: string): string | null => {
    const normalized = diagnosis.toLowerCase().trim()
    
    // Mapping of common variations to predefined diagnoses
    const diagnosisMap: { [key: string]: string } = {
      'deep dental caries': 'Deep Caries',
      'deep caries': 'Deep Caries',
      'dental caries': 'Moderate Caries',
      'moderate dental caries': 'Moderate Caries',
      'incipient dental caries': 'Incipient Caries',
      'rampant dental caries': 'Rampant Caries',
      'root dental caries': 'Root Caries',
      'recurrent dental caries': 'Recurrent Caries',
      'periapical abscess': 'Apical Abscess',
      'tooth fracture': 'Crown Fracture (Enamel-Dentin)',
      'pulpal involvement': 'Irreversible Pulpitis',
      'non-restorable tooth': 'Root Fracture',
      'previously restored tooth': 'Failed Restoration',
      'crowned tooth': 'Crown',
      'missing tooth': 'Missing',
      'symptomatic tooth': 'Hypersensitivity'
    }
    
    // Try exact match first
    if (diagnosisMap[normalized]) {
      return diagnosisMap[normalized]
    }
    
    // Try partial matches
    for (const [key, value] of Object.entries(diagnosisMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value
      }
    }
    
    // If no match found, return original (capitalized)
    return diagnosis.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  // Load existing data when dialog opens
  useEffect(() => {
    if (isOpen && existingData) {
      console.log('🦷 [DIALOG] Loading existing data for tooth:', existingData)

      // Check if this is voice-extracted data (has isVoiceExtracted flag but no ID)
      const isVoiceExtracted = !!(existingData as any).isVoiceExtracted && !existingData.id

      // Load data if it's either:
      // 1. Saved in database (has ID), OR
      // 2. Voice-extracted (has isVoiceExtracted flag)
      if (existingData.id || isVoiceExtracted) {
        // Handle both formats: primaryDiagnosis (string) or selectedDiagnoses (array)
        const rawDiagnoses = existingData.primaryDiagnosis
                         ? existingData.primaryDiagnosis.split(', ').filter(Boolean)
                         : (existingData as any).selectedDiagnoses || []
        const rawTreatments = existingData.recommendedTreatment
                          ? existingData.recommendedTreatment.split(', ').filter(Boolean)
                          : (existingData as any).selectedTreatments || []

        // Normalize diagnosis names to match predefined options
        const diagnoses = rawDiagnoses.map((d: string) => normalizeDiagnosisName(d)).filter(Boolean) as string[]
        console.log('🔄 [DIALOG] Normalized diagnoses from', rawDiagnoses, 'to', diagnoses)

        if (isVoiceExtracted) {
          console.log('🎤 [VOICE-EXTRACTED] Auto-populating diagnosis checkboxes from voice recognition!')
          console.log('🎤 [VOICE-EXTRACTED] Voice extracted at:', (existingData as any).voiceExtractedAt)
        }

        setSelectedDiagnoses(diagnoses)
        setSelectedTreatments(rawTreatments)
        setStatus(existingData.status || 'healthy')
        setTreatmentPriority(existingData.treatmentPriority || 'medium')
        setNotes(existingData.notes || "")
        setEstimatedDuration(existingData.estimatedDuration)
        setEstimatedCost(existingData.estimatedCost || "")
        setFollowUpRequired(existingData.followUpRequired || false)

        if (isVoiceExtracted) {
          console.log('✅ [VOICE-EXTRACTED] Pre-selected voice diagnoses:', diagnoses, 'treatments:', rawTreatments)
        } else {
          console.log('✅ [DIALOG] Loaded saved diagnoses:', diagnoses, 'treatments:', rawTreatments)
        }
      } else {
        // This is unsaved draft data without voice extraction - reset the form
        console.log('⚠️ [DIALOG] No saved data or voice extraction, resetting form')
        setSelectedDiagnoses([])
        setSelectedTreatments([])
        setStatus('healthy')
        setTreatmentPriority('medium')
        setNotes("")
        setEstimatedDuration(undefined)
        setEstimatedCost("")
        setFollowUpRequired(false)
      }
    } else if (isOpen) {
      // Reset form for new diagnosis
      console.log('🆕 [DIALOG] New diagnosis - resetting form')
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
  }, [isOpen, existingData, toothNumber])

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
    const newDiagnoses = selectedDiagnoses.includes(diagnosis)
      ? selectedDiagnoses.filter((d) => d !== diagnosis)
      : [...selectedDiagnoses, diagnosis]
    
    setSelectedDiagnoses(newDiagnoses)
    
    // Auto-update status based on diagnosis if currently healthy
    if (newDiagnoses.length > 0 && status === 'healthy') {
      const diagnosisText = newDiagnoses.join(', ')
      const autoStatus = getStatusFromDiagnosis(diagnosisText)
      setStatus(autoStatus)
    } else if (newDiagnoses.length === 0) {
      setStatus('healthy')
    }
  }

  const handleTreatmentToggle = (treatment: string) => {
    setSelectedTreatments((prev) =>
      prev.includes(treatment) ? prev.filter((t) => t !== treatment) : [...prev, treatment],
    )
  }

  const handleAcceptAISuggestion = (treatment: string) => {
    // Add AI-suggested treatment to selected treatments if not already present
    if (!selectedTreatments.includes(treatment)) {
      setSelectedTreatments([...selectedTreatments, treatment])
    }
  }

  // Helper function to map diagnosis to status
  const getStatusFromDiagnosis = (diagnosis: string): ToothDiagnosisData['status'] => {
    const diagnosisLower = diagnosis.toLowerCase()
    
    if (diagnosisLower.includes('caries') || diagnosisLower.includes('cavity') || diagnosisLower.includes('decay')) {
      return 'caries'
    }
    if (diagnosisLower.includes('filled') || diagnosisLower.includes('filling') || diagnosisLower.includes('restoration')) {
      return 'filled'
    }
    if (diagnosisLower.includes('crown')) {
      return 'crown'
    }
    if (diagnosisLower.includes('missing') || diagnosisLower.includes('extracted') || diagnosisLower.includes('absent')) {
      return 'missing'
    }
    if (diagnosisLower.includes('root canal') || diagnosisLower.includes('rct') || diagnosisLower.includes('endodontic')) {
      return 'root_canal'
    }
    if (diagnosisLower.includes('implant')) {
      return 'implant'
    }
    if (diagnosisLower.includes('extraction needed') || diagnosisLower.includes('hopeless')) {
      return 'extraction_needed'
    }
    if (diagnosisLower.includes('attention') || diagnosisLower.includes('watch') || diagnosisLower.includes('monitor')) {
      return 'attention'
    }
    
    // Default to healthy only if no issues found
    return 'healthy'
  }

  const handleSave = async () => {
    if (!patientId) {
      setError('Patient ID is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Auto-determine status based on diagnosis if not manually set or set to healthy
      const diagnosisText = selectedDiagnoses.join(', ')
      const autoStatus = diagnosisText ? getStatusFromDiagnosis(diagnosisText) : status
      const finalStatus = (status === 'healthy' && diagnosisText) ? autoStatus : status

      // Get proper color code for the status
      const getColorForStatus = (status: string): string => {
        const colors: Record<string, string> = {
          'healthy': '#22c55e',
          'caries': '#ef4444',
          'filled': '#3b82f6',
          'crown': '#a855f7',
          'missing': '#6b7280',
          'root_canal': '#f97316',
          'bridge': '#8b5cf6',
          'implant': '#06b6d4',
          'extraction_needed': '#dc2626',
          'attention': '#eab308'
        }
        return colors[status] || '#22c55e'
      }

      const toothDiagnosisData: ToothDiagnosisData = {
        id: existingData?.id,
        patientId,
        consultationId,
        toothNumber,
        status: finalStatus,
        primaryDiagnosis: diagnosisText,
        recommendedTreatment: selectedTreatments.join(', '),
        treatmentPriority,
        notes,
        estimatedDuration,
        estimatedCost,
        followUpRequired,
        examinationDate: new Date().toISOString().split('T')[0],
        colorCode: getColorForStatus(finalStatus)  // ADD THIS!
      }
      
      console.log('🔨 [DIALOG] Saving tooth diagnosis for tooth #' + toothNumber)
      console.log('  📊 Status determined: "' + finalStatus + '" (was: "' + status + '")')
      console.log('  🦷 Diagnosis: "' + diagnosisText + '"')
      console.log('  💉 Treatment: "' + selectedTreatments.join(', ') + '"')
      console.log('🔨 [DIALOG] Full data being saved:', toothDiagnosisData)

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
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DialogPrimitive.Content
          data-radix-dialog-content
          className={cn(
            "tooth-diagnosis-wide-dialog",
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-[95vw] max-w-[95vw] h-[95vh]",
            "overflow-hidden flex flex-col p-0",
            "border bg-background shadow-lg sm:rounded-lg"
          )}>
        <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-gradient-to-r from-blue-50 to-teal-50 border-b">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            Clinical Record for Tooth #{toothNumber}
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add diagnosis and treatment plan using evidence-based protocols with AI assistance
          </p>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-3 gap-6 py-4">
          {/* Left Column - Diagnosis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                Diagnosis & Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Voice-Extracted Data Indicator */}
              {existingData && (existingData as any).isVoiceExtracted && !existingData.id && (
                <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-2 border-teal-300 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-semibold text-teal-700">
                      🎤 Auto-populated from Voice Recognition
                    </span>
                  </div>
                  <p className="text-xs text-teal-600 mt-1">
                    Diagnosis extracted from your voice recording. Review and modify as needed.
                  </p>
                </div>
              )}

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

              {/* Quick Symptom Entry - Triggers AI Copilot */}
              {(!selectedDiagnoses || selectedDiagnoses.length === 0) && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Quick Symptom Entry
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {['Sharp pain', 'Dull ache', 'Cold sensitivity', 'Heat sensitivity', 
                      'Swelling', 'Pain when chewing', 'Spontaneous pain', 'Lingering pain'].map(symptom => (
                      <Button
                        key={symptom}
                        variant={manualSymptoms.includes(symptom) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (manualSymptoms.includes(symptom)) {
                            setManualSymptoms(prev => prev.filter(s => s !== symptom))
                          } else {
                            setManualSymptoms(prev => [...prev, symptom])
                          }
                        }}
                        className="text-xs h-7"
                      >
                        {symptom}
                      </Button>
                    ))}
                  </div>
                  {(manualSymptoms.length > 0 || (existingData?.symptoms && existingData.symptoms.length > 0)) && (
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI will suggest diagnosis based on symptoms
                    </p>
                  )}
                </div>
              )}

              {/* AI Diagnosis Suggestions - Show when no diagnoses selected and symptoms exist */}
              {(!selectedDiagnoses || selectedDiagnoses.length === 0) && (
                (existingData?.symptoms && existingData.symptoms.length > 0) ||
                (existingData?.painCharacteristics) ||
                (existingData?.clinicalFindings) ||
                (manualSymptoms.length > 0)
              ) && (
                <div className="my-4">
                  <DiagnosisAICopilot
                    symptoms={[
                      ...(existingData?.symptoms || []),
                      ...manualSymptoms
                    ]}
                    painCharacteristics={existingData?.painCharacteristics}
                    clinicalFindings={existingData?.clinicalFindings}
                    toothNumber={toothNumber}
                    patientContext={{
                      age: 35
                    }}
                    onAcceptSuggestion={(diagnosis) => {
                      // Find and tick the matching diagnosis checkbox
                      const normalizedDiagnosis = normalizeDiagnosisName(diagnosis)
                      if (normalizedDiagnosis && !selectedDiagnoses.includes(normalizedDiagnosis)) {
                        handleDiagnosisToggle(normalizedDiagnosis)
                      }
                    }}
                  />
                </div>
              )}

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

          {/* Middle Column - AI Co-Pilot */}
          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-teal-600" />
                Endo AI Co-pilot
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDiagnoses.length > 0 ? (
                <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-2 border-teal-300 rounded-xl shadow-lg p-1">
                  <div className="bg-white/80 backdrop-blur rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-teal-500 rounded-full">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-teal-700">AI Treatment Suggestions</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-teal-100 text-teal-600 px-2 py-1 rounded-full font-semibold">POWERED BY GEMINI</span>
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">Diagnosis: {selectedDiagnoses[0]}</span>
                        </div>
                      </div>
                    </div>
                    <EndoAICopilotLive
                      diagnosis={selectedDiagnoses[0]}
                      toothNumber={toothNumber}
                      onAcceptSuggestion={handleAcceptAISuggestion}
                      patientContext={{
                        age: 35
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <div>
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Select a diagnosis</p>
                    <p className="text-sm text-gray-500 mt-1">AI suggestions will appear here</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column - Treatment Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-600" />
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

          {/* Additional Information - Full Width Row */}
          <Card className="lg:col-span-3">
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
        </div>
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t bg-white">
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
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
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  )
}