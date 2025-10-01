'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

export function IsolatedTestForm() {
  const [text, setText] = useState('')
  const [description, setDescription] = useState('')
  const [painScale, setPainScale] = useState(0)
  const [symptoms, setSymptoms] = useState<string[]>([])

  console.log('🧪 IsolatedTestForm rendering with:', { text, description, painScale, symptoms })

  const handleTextChange = (value: string) => {
    console.log('🧪 Text changing to:', value)
    setText(value)
  }

  const handleDescriptionChange = (value: string) => {
    console.log('🧪 Description changing to:', value)
    setDescription(value)
  }

  const handlePainChange = (value: number) => {
    console.log('🧪 Pain scale changing to:', value)
    setPainScale(value)
  }

  const toggleSymptom = (symptom: string) => {
    console.log('🧪 Toggling symptom:', symptom)
    const newSymptoms = symptoms.includes(symptom)
      ? symptoms.filter(s => s !== symptom)
      : [...symptoms, symptom]
    console.log('🧪 New symptoms array:', newSymptoms)
    setSymptoms(newSymptoms)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>🧪 ISOLATED TEST FORM - Should Always Work</CardTitle>
          <p className="text-sm text-gray-600">
            This is a completely standalone form to test if React inputs work at all
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Test 1: Basic Text Input */}
          <div>
            <Label htmlFor="test-text">Test 1: Basic Text Input</Label>
            <Input
              id="test-text"
              type="text"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Type anything here..."
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">Current value: "{text}"</p>
          </div>

          {/* Test 2: Textarea */}
          <div>
            <Label htmlFor="test-textarea">Test 2: Textarea</Label>
            <Textarea
              id="test-textarea"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Type a longer description..."
              rows={3}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">Current value: "{description}"</p>
          </div>

          {/* Test 3: Range Input */}
          <div>
            <Label htmlFor="test-range">Test 3: Pain Scale {painScale}/10</Label>
            <input
              id="test-range"
              type="range"
              min="0"
              max="10"
              value={painScale}
              onChange={(e) => handlePainChange(parseInt(e.target.value))}
              className="w-full mt-2"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Test 4: Checkboxes */}
          <div>
            <Label>Test 4: Symptoms</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {['Pain', 'Swelling', 'Bleeding', 'Sensitivity'].map(symptom => (
                <div key={symptom} className="flex items-center space-x-2">
                  <Checkbox
                    id={`isolated-${symptom}`}
                    checked={symptoms.includes(symptom)}
                    onCheckedChange={() => toggleSymptom(symptom)}
                  />
                  <Label htmlFor={`isolated-${symptom}`} className="text-sm">
                    {symptom}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selected: {symptoms.join(', ') || 'None'}
            </p>
          </div>

          {/* Current State Display */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="font-medium mb-2">Live Form State:</h4>
            <div className="bg-gray-100 p-3 rounded text-xs">
              <div><strong>Text:</strong> "{text}"</div>
              <div><strong>Description:</strong> "{description}"</div>
              <div><strong>Pain Scale:</strong> {painScale}</div>
              <div><strong>Symptoms:</strong> {symptoms.join(', ')}</div>
            </div>
          </div>

          {/* Test Button */}
          <div>
            <Button 
              onClick={() => {
                const currentState = { text, description, painScale, symptoms }
                console.log('🧪 Button clicked - current state:', currentState)
                alert(`Form state: ${JSON.stringify(currentState, null, 2)}`)
              }}
              className="w-full"
            >
              Test Button - Check State
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}