/**
 * STANDALONE CHIEF COMPLAINT FORM TEST
 * 
 * This is a simplified version of the Chief Complaint form
 * to test if the issue is with the form itself or the integration.
 * 
 * To use this:
 * 1. Replace the contents of ChiefComplaintTab.tsx with this temporarily
 * 2. Test if this version works
 * 3. If it works, we know the issue is in the original component
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle } from "lucide-react"

interface ChiefComplaintData {
  primary_complaint: string
  onset_duration: string
  associated_symptoms: string[]
  severity_scale: number
  location_detail: string
  patient_description: string
  onset_type: string
  pain_scale: number
  frequency: string
  triggers: string[]
}

interface ChiefComplaintTabProps {
  data: ChiefComplaintData
  onChange: (data: ChiefComplaintData) => void
  isReadOnly?: boolean
  onSave?: (data: ChiefComplaintData) => Promise<void>
}

export function ChiefComplaintTab({ data, onChange, isReadOnly = false, onSave }: ChiefComplaintTabProps) {
  // Initialize with simple defaults
  const [testData, setTestData] = useState({
    primary_complaint: '',
    patient_description: '',
    location_detail: '',
    pain_scale: 0,
    symptoms: [] as string[]
  })

  console.log('🧪 STANDALONE CHIEF COMPLAINT TEST RENDERED')
  console.log('🧪 Props received:', { data, isReadOnly })
  console.log('🧪 Current test data:', testData)

  const handleInputChange = (field: string, value: any) => {
    console.log(`🧪 Input change: ${field} = ${value}`)
    setTestData(prev => ({ ...prev, [field]: value }))
    
    // Also call the parent onChange if provided
    if (onChange) {
      const updatedData = { ...data, [field]: value }
      console.log('🧪 Calling parent onChange with:', updatedData)
      onChange(updatedData)
    }
  }

  const handleSymptomToggle = (symptom: string) => {
    console.log(`🧪 Toggling symptom: ${symptom}`)
    const currentSymptoms = testData.symptoms || []
    const updatedSymptoms = currentSymptoms.includes(symptom)
      ? currentSymptoms.filter(s => s !== symptom)
      : [...currentSymptoms, symptom]
    
    setTestData(prev => ({ ...prev, symptoms: updatedSymptoms }))
    console.log('🧪 Updated symptoms:', updatedSymptoms)
  }

  const testSymptoms = ['Sharp pain', 'Throbbing pain', 'Sensitivity to cold', 'Swelling']

  return (
    <div className="space-y-6">
      {/* Test Header */}
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-yellow-900">🧪 STANDALONE TEST VERSION</h3>
        </div>
        <p className="text-sm text-yellow-700">This is a test version to check if form inputs work</p>
        <p className="text-xs text-yellow-600 mt-1">
          isReadOnly: {isReadOnly ? 'TRUE (should disable inputs)' : 'FALSE (inputs should work)'}
        </p>
      </div>

      {/* Simple Form Test */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Input Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-input">Test Text Input</Label>
            <Input
              id="test-input"
              value={testData.location_detail}
              onChange={(e) => handleInputChange('location_detail', e.target.value)}
              placeholder="Type here to test..."
              disabled={isReadOnly}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current value: "{testData.location_detail}"
            </p>
          </div>

          <div>
            <Label htmlFor="test-textarea">Test Textarea</Label>
            <Textarea
              id="test-textarea"
              value={testData.patient_description}
              onChange={(e) => handleInputChange('patient_description', e.target.value)}
              placeholder="Type a longer description here..."
              disabled={isReadOnly}
              rows={3}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current value: "{testData.patient_description}"
            </p>
          </div>

          <div>
            <Label htmlFor="test-range">Test Pain Scale (0-10)</Label>
            <input
              id="test-range"
              type="range"
              min="0"
              max="10"
              value={testData.pain_scale}
              onChange={(e) => handleInputChange('pain_scale', parseInt(e.target.value))}
              disabled={isReadOnly}
              className="w-full mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current value: {testData.pain_scale}/10
            </p>
          </div>

          <div>
            <Label>Test Checkboxes</Label>
            <div className="space-y-2 mt-2">
              {testSymptoms.map(symptom => (
                <div key={symptom} className="flex items-center space-x-2">
                  <Checkbox
                    id={`test-${symptom}`}
                    checked={testData.symptoms.includes(symptom)}
                    onCheckedChange={() => handleSymptomToggle(symptom)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`test-${symptom}`} className="text-sm">
                    {symptom}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selected: {testData.symptoms.join(', ') || 'None'}
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button 
              onClick={() => console.log('🧪 Save clicked, current data:', testData)}
              disabled={isReadOnly}
            >
              Test Save Button
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Display */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm">Current Form Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(testData, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-2">🧪 Test Instructions:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Try typing in the text input above</li>
            <li>Try typing in the textarea</li>
            <li>Try moving the pain scale slider</li>
            <li>Try clicking the checkboxes</li>
            <li>Check if the values update in real-time</li>
            <li>Look at browser console for debug messages</li>
          </ol>
          <p className="text-xs text-blue-600 mt-3">
            If this test version works but the original doesn't, then the issue is in the original component.
            If this test version also doesn't work, then the issue is in the React setup or parent component.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}