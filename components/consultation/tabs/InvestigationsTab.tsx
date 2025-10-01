'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

interface InvestigationsTabProps {
  data?: any
  onChange?: (data: any) => void
  isReadOnly?: boolean
  onSave?: (data: any) => void
}

export function InvestigationsTab({ data, onChange, isReadOnly = false, onSave }: InvestigationsTabProps) {
  // Simple state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  const [radiographicFindings, setRadiographicFindings] = useState('')
  const [radiographicTypes, setRadiographicTypes] = useState<string[]>([])
  const [vitalityTests, setVitalityTests] = useState<string[]>([])
  const [percussionTests, setPercussionTests] = useState<string[]>([])
  const [palpationFindings, setPalpationFindings] = useState<string[]>([])
  const [laboratoryTests, setLaboratoryTests] = useState('')
  const [recommendations, setRecommendations] = useState('')

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    // Normalize incoming values for checkboxes
    const normToArray = (v: any): string[] => {
      if (!v) return []
      if (Array.isArray(v)) return v
      if (typeof v === 'string') return v.split(/;|,|\n/).map(s => s.trim()).filter(Boolean)
      return []
    }
    
    setRadiographicFindings(data?.radiographic_findings || '')
    setRadiographicTypes(data?.radiographic_types || [])
    setVitalityTests(normToArray(data?.vitality_tests))
    setPercussionTests(normToArray(data?.percussion_tests))
    setPalpationFindings(normToArray(data?.palpation_findings))
    setLaboratoryTests(data?.laboratory_tests || '')
    setRecommendations(data?.recommendations || '')
  }, [data])

  // Event handlers
  const handleRadiographicFindingsChange = (value: string) => {
    setRadiographicFindings(value)
    if (onChange) {
      onChange({
        radiographic_findings: value,
        radiographic_types: radiographicTypes,
        vitality_tests: vitalityTests,
        percussion_tests: percussionTests,
        palpation_findings: palpationFindings,
        laboratory_tests: laboratoryTests,
        recommendations: recommendations
      })
    }
  }

  const handleRadiographicTypeToggle = (type: string) => {
    const newTypes = radiographicTypes.includes(type)
      ? radiographicTypes.filter(t => t !== type)
      : [...radiographicTypes, type]
    setRadiographicTypes(newTypes)
    if (onChange) {
      onChange({
        radiographic_findings: radiographicFindings,
        radiographic_types: newTypes,
        vitality_tests: vitalityTests,
        percussion_tests: percussionTests,
        palpation_findings: palpationFindings,
        laboratory_tests: laboratoryTests,
        recommendations: recommendations
      })
    }
  }

  const toggleVitalityTest = (test: string) => {
    const next = vitalityTests.includes(test)
      ? vitalityTests.filter(t => t !== test)
      : [...vitalityTests, test]
    setVitalityTests(next)
    if (onChange) {
      onChange({
        radiographic_findings: radiographicFindings,
        radiographic_types: radiographicTypes,
        vitality_tests: next,
        percussion_tests: percussionTests,
        palpation_findings: palpationFindings,
        laboratory_tests: laboratoryTests,
        recommendations: recommendations
      })
    }
  }

  const togglePercussionTest = (test: string) => {
    const next = percussionTests.includes(test)
      ? percussionTests.filter(t => t !== test)
      : [...percussionTests, test]
    setPercussionTests(next)
    if (onChange) {
      onChange({
        radiographic_findings: radiographicFindings,
        radiographic_types: radiographicTypes,
        vitality_tests: vitalityTests,
        percussion_tests: next,
        palpation_findings: palpationFindings,
        laboratory_tests: laboratoryTests,
        recommendations: recommendations
      })
    }
  }

  const togglePalpationFinding = (finding: string) => {
    const next = palpationFindings.includes(finding)
      ? palpationFindings.filter(f => f !== finding)
      : [...palpationFindings, finding]
    setPalpationFindings(next)
    if (onChange) {
      onChange({
        radiographic_findings: radiographicFindings,
        radiographic_types: radiographicTypes,
        vitality_tests: vitalityTests,
        percussion_tests: percussionTests,
        palpation_findings: next,
        laboratory_tests: laboratoryTests,
        recommendations: recommendations
      })
    }
  }

  const handleLaboratoryTestsChange = (value: string) => {
    setLaboratoryTests(value)
    if (onChange) {
      onChange({
        radiographic_findings: radiographicFindings,
        radiographic_types: radiographicTypes,
        vitality_tests: vitalityTests,
        percussion_tests: percussionTests,
        palpation_findings: palpationFindings,
        laboratory_tests: value,
        recommendations: recommendations
      })
    }
  }

  const handleRecommendationsChange = (value: string) => {
    setRecommendations(value)
    if (onChange) {
      onChange({
        radiographic_findings: radiographicFindings,
        radiographic_types: radiographicTypes,
        vitality_tests: vitalityTests,
        percussion_tests: percussionTests,
        palpation_findings: palpationFindings,
        laboratory_tests: laboratoryTests,
        recommendations: value
      })
    }
  }

  // Simple options arrays
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const radiographicTypeOptions = [
    "IOPA (Intraoral Periapical)", "Bitewing", "Panoramic (OPG)", "CBCT", "CT Scan", "Occlusal"
  ]

  const vitalityTestOptions = [
    'Cold test positive', 'Cold test negative', 'Heat test positive', 'Heat test negative',
    'Electric pulp test positive', 'Electric pulp test negative', 'No response to EPT',
    'Delayed response', 'Hyperresponsive', 'Hyporesponsive'
  ]

  const percussionTestOptions = [
    'Vertical percussion positive', 'Vertical percussion negative',
    'Horizontal percussion positive', 'Horizontal percussion negative',
    'Tender to percussion', 'No tenderness'
  ]

  const palpationFindingOptions = [
    'Tender to palpation', 'No tenderness', 'Swelling present', 'No swelling',
    'Fluctuant swelling', 'Firm swelling', 'Lymph node enlargement', 'Normal palpation'
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">Investigations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Radiographic Investigations */}
          <div>
            <Label>Radiographic Investigations Taken</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {radiographicTypeOptions.map(type => {
                const id = `radio-${slug(type)}`
                return (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={radiographicTypes.includes(type)}
                      onCheckedChange={() => handleRadiographicTypeToggle(type)}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={id} className="text-sm cursor-pointer">
                      {type}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Radiographic Findings */}
          <div>
            <Label htmlFor="radiographic-findings">Radiographic Findings</Label>
            <Textarea
              id="radiographic-findings"
              value={radiographicFindings}
              onChange={(e) => handleRadiographicFindingsChange(e.target.value)}
              placeholder="Describe findings from X-rays, OPG, CBCT or other imaging (pathology, bone levels, root condition, etc.)"
              rows={4}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Vitality Tests - now checkboxes */}
          <div>
            <Label>Vitality Tests (Pulp Testing)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {vitalityTestOptions.map(test => {
                const id = `vitality-${slug(test)}`
                return (
                  <div key={test} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={vitalityTests.includes(test)}
                      onCheckedChange={() => toggleVitalityTest(test)}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={id} className="text-sm cursor-pointer">
                      {test}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Percussion Tests - now checkboxes */}
          <div>
            <Label>Percussion Tests</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {percussionTestOptions.map(test => {
                const id = `percussion-${slug(test)}`
                return (
                  <div key={test} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={percussionTests.includes(test)}
                      onCheckedChange={() => togglePercussionTest(test)}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={id} className="text-sm cursor-pointer">
                      {test}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Palpation Findings - now checkboxes */}
          <div>
            <Label>Palpation Findings</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {palpationFindingOptions.map(finding => {
                const id = `palpation-${slug(finding)}`
                return (
                  <div key={finding} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={palpationFindings.includes(finding)}
                      onCheckedChange={() => togglePalpationFinding(finding)}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={id} className="text-sm cursor-pointer">
                      {finding}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Laboratory Tests */}
          <div>
            <Label htmlFor="laboratory-tests">Laboratory Tests & Results</Label>
            <Textarea
              id="laboratory-tests"
              value={laboratoryTests}
              onChange={(e) => handleLaboratoryTestsChange(e.target.value)}
              placeholder="List any blood tests, cultures, biopsies ordered or completed with results"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Investigation Recommendations */}
          <div>
            <Label htmlFor="recommendations">Additional Investigations Recommended</Label>
            <Textarea
              id="recommendations"
              value={recommendations}
              onChange={(e) => handleRecommendationsChange(e.target.value)}
              placeholder="Recommend any follow-up imaging, tests, or specialist referrals needed"
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
                      radiographic_findings: radiographicFindings,
                      radiographic_types: radiographicTypes,
                      vitality_tests: vitalityTests,
                      percussion_tests: percussionTests,
                      palpation_findings: palpationFindings,
                      laboratory_tests: laboratoryTests,
                      recommendations: recommendations
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