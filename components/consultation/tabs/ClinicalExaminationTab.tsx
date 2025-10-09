'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Sparkles, Clock, Activity } from "lucide-react"

interface ClinicalExaminationTabProps {
  data?: any
  onChange?: (data: any) => void
  isReadOnly?: boolean
  onSave?: (data: any) => void
}

export function ClinicalExaminationTab({ data, onChange, isReadOnly = false, onSave }: ClinicalExaminationTabProps) {
  // Simple state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  // Replace free-text areas with checkbox selections

  // Safe id helper so labels work reliably
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  
  const [extraoralSelections, setExtraoralSelections] = useState<string[]>([])
  const [intraoralSelections, setIntraoralSelections] = useState<string[]>([])
  const [occlusionSelections, setOcclusionSelections] = useState<string[]>([])

  const [oralHygiene, setOralHygiene] = useState('')
  const [gingivalCondition, setGingivalCondition] = useState('')
  const [periodontalStatus, setPeriodontalStatus] = useState('')

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    // Normalize incoming values into string arrays
    const normToArray = (v: any): string[] => {
      if (!v) return []
      if (Array.isArray(v)) return v
      if (typeof v === 'string') return v.split(/;|,|\n/).map(s => s.trim()).filter(Boolean)
      if (typeof v === 'object') return Object.values(v).map((x: any) => String(x)).filter(Boolean)
      return []
    }

    setExtraoralSelections(normToArray(data?.extraoral_findings))
    setIntraoralSelections(normToArray(data?.intraoral_findings))
    setOralHygiene(data?.oral_hygiene || '')
    setGingivalCondition(data?.gingival_condition || '')
    setPeriodontalStatus(data?.periodontal_status || '')
    setOcclusionSelections(normToArray(data?.occlusion_notes))
  }, [data])

  // Event handlers
  const toggleExtraoral = (item: string) => {
    const next = extraoralSelections.includes(item)
      ? extraoralSelections.filter(x => x !== item)
      : [...extraoralSelections, item]
    setExtraoralSelections(next)
    if (onChange) {
      onChange({
        extraoral_findings: next,
        intraoral_findings: intraoralSelections,
        oral_hygiene: oralHygiene,
        gingival_condition: gingivalCondition,
        periodontal_status: periodontalStatus,
        occlusion_notes: occlusionSelections
      })
    }
  }

  const toggleIntraoral = (item: string) => {
    const next = intraoralSelections.includes(item)
      ? intraoralSelections.filter(x => x !== item)
      : [...intraoralSelections, item]
    setIntraoralSelections(next)
    if (onChange) {
      onChange({
        extraoral_findings: extraoralSelections,
        intraoral_findings: next,
        oral_hygiene: oralHygiene,
        gingival_condition: gingivalCondition,
        periodontal_status: periodontalStatus,
        occlusion_notes: occlusionSelections
      })
    }
  }

  const handleOralHygieneChange = (value: string) => {
    setOralHygiene(value)
    if (onChange) {
      onChange({
        extraoral_findings: extraoralSelections,
        intraoral_findings: intraoralSelections,
        oral_hygiene: value,
        gingival_condition: gingivalCondition,
        periodontal_status: periodontalStatus,
        occlusion_notes: occlusionSelections
      })
    }
  }

  const handleGingivalChange = (value: string) => {
    setGingivalCondition(value)
    if (onChange) {
      onChange({
        extraoral_findings: extraoralSelections,
        intraoral_findings: intraoralSelections,
        oral_hygiene: oralHygiene,
        gingival_condition: value,
        periodontal_status: periodontalStatus,
        occlusion_notes: occlusionSelections
      })
    }
  }

  const handlePeriodontalChange = (value: string) => {
    setPeriodontalStatus(value)
    if (onChange) {
      onChange({
        extraoral_findings: extraoralSelections,
        intraoral_findings: intraoralSelections,
        oral_hygiene: oralHygiene,
        gingival_condition: gingivalCondition,
        periodontal_status: value,
        occlusion_notes: occlusionSelections
      })
    }
  }

  const toggleOcclusion = (item: string) => {
    const next = occlusionSelections.includes(item)
      ? occlusionSelections.filter(x => x !== item)
      : [...occlusionSelections, item]
    setOcclusionSelections(next)
    if (onChange) {
      onChange({
        extraoral_findings: extraoralSelections,
        intraoral_findings: intraoralSelections,
        oral_hygiene: oralHygiene,
        gingival_condition: gingivalCondition,
        periodontal_status: periodontalStatus,
        occlusion_notes: next
      })
    }
  }

  // Simple option arrays
  const oralHygieneOptions = ["Excellent", "Good", "Fair", "Poor"]
  const gingivalConditionOptions = ["Healthy", "Mild gingivitis", "Moderate gingivitis", "Severe gingivitis"]
  const periodontalStatusOptions = ["Healthy", "Mild periodontitis", "Moderate periodontitis", "Severe periodontitis"]

  // Checkbox option sets
  const extraoralOptions = [
    'Facial asymmetry', 'TMJ tenderness', 'Lymphadenopathy', 'Swelling', 'Trismus', 'Skin lesions'
  ]
  const intraoralOptions = [
    'Caries present', 'Existing restorations', 'Gingival inflammation', 'Plaque / calculus', 'Ulcer / lesion', 'Tongue coating', 'Halitosis', 'Tooth mobility', 'Mucosal lesion', 'Fistula', 'Bleeding on probing'
  ]
  const occlusionOptions = [
    'Class I', 'Class II', 'Class III', 'Crossbite', 'Open bite', 'Deep bite', 'Midline shift', 'Bruxism facets', 'Anterior guidance issue'
  ]

  return (
    <div className="space-y-6">
      {/* AI Auto-Fill Indicator */}
      {(data as any)?.auto_extracted && (
        <Alert className="bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 border-2 border-purple-200 shadow-sm">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-purple-600 animate-pulse mt-0.5" />
            <div className="flex-1">
              <AlertTitle className="text-purple-900 font-semibold flex items-center gap-2">
                🤖 AI-Extracted Clinical Examination
                <Badge variant="outline" className="bg-white text-purple-700 border-purple-300">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Confidence: {(data as any).confidence || 85}%
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-purple-700 text-sm mt-1">
                Clinical examination findings extracted from voice recording using Gemini AI.
                Please verify accuracy before saving.
              </AlertDescription>
              {(data as any).extraction_timestamp && (
                <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Extracted: {new Date((data as any).extraction_timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Clinical Examination</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Extraoral Findings - now checkboxes */}
          <div>
            <Label>Extraoral Examination Findings</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {extraoralOptions.map(item => {
                const id = `extraoral-${slug(item)}`
                return (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={extraoralSelections.includes(item)}
                      onCheckedChange={() => toggleExtraoral(item)}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={id} className="text-sm cursor-pointer">{item}</Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Intraoral Findings - now checkboxes */}
          <div>
            <Label>Intraoral Examination Findings</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {intraoralOptions.map(item => {
                const id = `intraoral-${slug(item)}`
                return (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={intraoralSelections.includes(item)}
                      onCheckedChange={() => toggleIntraoral(item)}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={id} className="text-sm cursor-pointer">{item}</Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Oral Hygiene Assessment */}
          <div>
            <Label htmlFor="oral-hygiene">Oral Hygiene Status</Label>
            <Select
              value={oralHygiene}
              onValueChange={handleOralHygieneChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select oral hygiene status" />
              </SelectTrigger>
              <SelectContent>
                {oralHygieneOptions.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gingival Condition */}
          <div>
            <Label htmlFor="gingival-condition">Gingival Condition</Label>
            <Select
              value={gingivalCondition}
              onValueChange={handleGingivalChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select gingival condition" />
              </SelectTrigger>
              <SelectContent>
                {gingivalConditionOptions.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Periodontal Status */}
          <div>
            <Label htmlFor="periodontal-status">Periodontal Status</Label>
            <Select
              value={periodontalStatus}
              onValueChange={handlePeriodontalChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select periodontal status" />
              </SelectTrigger>
              <SelectContent>
                {periodontalStatusOptions.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Occlusion & Bite Assessment - now checkboxes */}
          <div>
            <Label>Occlusion & Bite Assessment</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {occlusionOptions.map(item => {
                const id = `occlusion-${slug(item)}`
                return (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={occlusionSelections.includes(item)}
                      onCheckedChange={() => toggleOcclusion(item)}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={id} className="text-sm cursor-pointer">{item}</Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Save Button */}
          {!isReadOnly && onSave && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => {
                  if (onSave) {
                    onSave({
                      extraoral_findings: extraoralSelections,
                      intraoral_findings: intraoralSelections,
                      oral_hygiene: oralHygiene,
                      gingival_condition: gingivalCondition,
                      periodontal_status: periodontalStatus,
                      occlusion_notes: occlusionSelections
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