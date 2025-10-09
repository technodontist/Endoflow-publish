'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Cigarette, Wine, Coffee, Utensils, Sparkles, User, Activity, Clock } from "lucide-react"

interface SmokingHistory {
  status: 'never' | 'current' | 'former'
  duration: string
  quantity: string
  type: string
  quit_date?: string
}

interface AlcoholHistory {
  status: 'never' | 'occasional' | 'regular' | 'heavy'
  frequency: string
  quantity: string
  type: string[]
}

interface TobaccoHistory {
  status: 'never' | 'current' | 'former'
  type: string[]
  duration: string
  frequency: string
  quit_date?: string
}

interface OralHygiene {
  brushing_frequency: string
  brushing_technique: string
  flossing: string
  mouthwash: string
  last_cleaning: string
  toothbrush_type: string
  fluoride_exposure: string[]
}

interface PersonalHistoryData {
  smoking: SmokingHistory
  alcohol: AlcoholHistory
  tobacco: TobaccoHistory
  dietary_habits: string[]
  oral_hygiene: OralHygiene
  other_habits: string[]
  exercise_habits: string
  sleep_patterns: string
  stress_levels: string
  occupation: string
  occupational_hazards: string[]
  lifestyle_factors: string[]
}

interface PersonalHistoryTabProps {
  data: PersonalHistoryData
  onChange: (data: PersonalHistoryData) => void
  isReadOnly?: boolean
}

export function PersonalHistoryTab({ data, onChange, isReadOnly = false }: PersonalHistoryTabProps) {
  const [localData, setLocalData] = useState<PersonalHistoryData>(data)

  useEffect(() => {
    setLocalData(data)
  }, [data])

  const handleUpdate = (field: keyof PersonalHistoryData, value: any) => {
    const updatedData = { ...localData, [field]: value }
    setLocalData(updatedData)
    onChange(updatedData)
  }

  const handleNestedUpdate = (section: keyof PersonalHistoryData, field: string, value: any) => {
    const updatedSection = { ...localData[section], [field]: value }
    handleUpdate(section, updatedSection)
  }

  const toggleArrayItem = (field: keyof PersonalHistoryData, item: string) => {
    const currentArray = (localData[field] as string[]) || []
    const updatedArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item]
    handleUpdate(field, updatedArray)
  }

  const toggleNestedArrayItem = (section: keyof PersonalHistoryData, field: string, item: string) => {
    const currentSection = localData[section] as any
    const currentArray = currentSection[field] || []
    const updatedArray = currentArray.includes(item)
      ? currentArray.filter((i: string) => i !== item)
      : [...currentArray, item]
    handleNestedUpdate(section, field, updatedArray)
  }

  const smokingTypes = [
    "Cigarettes", "Cigars", "Pipe", "E-cigarettes/Vaping", "Hookah", "Other"
  ]

  const alcoholTypes = [
    "Beer", "Wine", "Spirits", "Mixed drinks", "Traditional drinks"
  ]

  const tobaccoTypes = [
    "Chewing tobacco", "Snuff", "Betel nut", "Paan", "Gutkha", "Zarda", "Other smokeless"
  ]

  const dietaryHabits = [
    "Vegetarian", "Non-vegetarian", "Vegan", "High sugar diet", "High acid diet",
    "Frequent snacking", "Carbonated drinks", "Energy drinks", "Sticky foods",
    "Hard foods", "Balanced diet", "Mediterranean diet"
  ]

  const otherHabits = [
    "Nail biting", "Lip biting", "Cheek biting", "Teeth grinding (bruxism)",
    "Jaw clenching", "Pen/pencil chewing", "Ice chewing", "Tongue thrusting",
    "Mouth breathing", "Thumb sucking", "Hair twirling", "Stress eating"
  ]

  const occupationalHazards = [
    "Chemical exposure", "Dust exposure", "Radiation", "Heavy metals",
    "Acid vapors", "High stress", "Night shifts", "Physical trauma risk",
    "Repetitive motion", "Poor posture", "Computer work", "Manual labor"
  ]

  const lifestyleFactors = [
    "Regular exercise", "Sedentary lifestyle", "High stress job", "Irregular meals",
    "Adequate sleep", "Poor sleep quality", "Social drinking", "Frequent travel",
    "Outdoor activities", "Indoor lifestyle", "Regular medical checkups"
  ]

  const fluorideExposure = [
    "Fluoridated water", "Fluoride toothpaste", "Fluoride mouth rinse",
    "Professional fluoride treatment", "Fluoride supplements", "None"
  ]

  const getStatusColor = (status: string, type: 'smoking' | 'alcohol' | 'tobacco') => {
    if (type === 'smoking' || type === 'tobacco') {
      switch (status) {
        case 'never': return 'text-green-600 bg-green-100'
        case 'former': return 'text-yellow-600 bg-yellow-100'
        case 'current': return 'text-red-600 bg-red-100'
        default: return 'text-gray-600 bg-gray-100'
      }
    } else { // alcohol
      switch (status) {
        case 'never': return 'text-green-600 bg-green-100'
        case 'occasional': return 'text-blue-600 bg-blue-100'
        case 'regular': return 'text-yellow-600 bg-yellow-100'
        case 'heavy': return 'text-red-600 bg-red-100'
        default: return 'text-gray-600 bg-gray-100'
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Auto-Fill Indicator */}
      {(data as any)?.auto_extracted && (
        <Alert className="bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 border-2 border-purple-200 shadow-sm">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-purple-600 animate-pulse mt-0.5" />
            <div className="flex-1">
              <AlertTitle className="text-purple-900 font-semibold flex items-center gap-2">
                🤖 AI-Extracted Personal History
                <Badge variant="outline" className="bg-white text-purple-700 border-purple-300">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Confidence: {(data as any).confidence || 85}%
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-purple-700 text-sm mt-1">
                Personal history and lifestyle information extracted from voice recording using Gemini AI.
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
      
      {/* Header */}
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-900">Personal History</h3>
        </div>
        <p className="text-sm text-orange-700">Lifestyle factors, habits, and personal health behaviors</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Smoking History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                <Cigarette className="w-4 h-4 text-red-500" />
                Smoking History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Smoking status</Label>
                <Select
                  value={localData.smoking.status}
                  onValueChange={(value) => handleNestedUpdate('smoking', 'status', value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never smoked</SelectItem>
                    <SelectItem value="current">Current smoker</SelectItem>
                    <SelectItem value="former">Former smoker</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className={`mt-2 ${getStatusColor(localData.smoking.status, 'smoking')}`}>
                  {localData.smoking.status === 'never' && 'Non-smoker'}
                  {localData.smoking.status === 'current' && 'Active smoker'}
                  {localData.smoking.status === 'former' && 'Ex-smoker'}
                </Badge>
              </div>

              {localData.smoking.status !== 'never' && (
                <>
                  <div>
                    <Label>Type of smoking</Label>
                    <Select
                      value={localData.smoking.type}
                      onValueChange={(value) => handleNestedUpdate('smoking', 'type', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {smokingTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration</Label>
                      <Input
                        value={localData.smoking.duration}
                        onChange={(e) => handleNestedUpdate('smoking', 'duration', e.target.value)}
                        placeholder="e.g., 5 years"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <Label>Quantity per day</Label>
                      <Input
                        value={localData.smoking.quantity}
                        onChange={(e) => handleNestedUpdate('smoking', 'quantity', e.target.value)}
                        placeholder="e.g., 10 cigarettes"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  {localData.smoking.status === 'former' && (
                    <div>
                      <Label>Quit date</Label>
                      <Input
                        type="date"
                        value={localData.smoking.quit_date}
                        onChange={(e) => handleNestedUpdate('smoking', 'quit_date', e.target.value)}
                        disabled={isReadOnly}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Alcohol History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                <Wine className="w-4 h-4 text-purple-500" />
                Alcohol Consumption
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Alcohol consumption</Label>
                <Select
                  value={localData.alcohol.status}
                  onValueChange={(value) => handleNestedUpdate('alcohol', 'status', value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never drinks</SelectItem>
                    <SelectItem value="occasional">Occasional</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="heavy">Heavy drinker</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className={`mt-2 ${getStatusColor(localData.alcohol.status, 'alcohol')}`}>
                  {localData.alcohol.status.charAt(0).toUpperCase() + localData.alcohol.status.slice(1)} drinker
                </Badge>
              </div>

              {localData.alcohol.status !== 'never' && (
                <>
                  <div>
                    <Label>Types of alcohol</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {alcoholTypes.map(type => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`alcohol-${type}`}
                            checked={((localData.alcohol.type as string[]) || []).includes(type)}
                            onCheckedChange={() => toggleNestedArrayItem('alcohol', 'type', type)}
                            disabled={isReadOnly}
                          />
                          <Label
                            htmlFor={`alcohol-${type}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {type}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Frequency</Label>
                      <Input
                        value={localData.alcohol.frequency}
                        onChange={(e) => handleNestedUpdate('alcohol', 'frequency', e.target.value)}
                        placeholder="e.g., 2-3 times/week"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        value={localData.alcohol.quantity}
                        onChange={(e) => handleNestedUpdate('alcohol', 'quantity', e.target.value)}
                        placeholder="e.g., 2 drinks"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tobacco History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-brown-500" />
                Tobacco Use (Smokeless)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tobacco use status</Label>
                <Select
                  value={localData.tobacco.status}
                  onValueChange={(value) => handleNestedUpdate('tobacco', 'status', value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never used</SelectItem>
                    <SelectItem value="current">Current user</SelectItem>
                    <SelectItem value="former">Former user</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className={`mt-2 ${getStatusColor(localData.tobacco.status, 'tobacco')}`}>
                  {localData.tobacco.status === 'never' && 'Non-user'}
                  {localData.tobacco.status === 'current' && 'Active user'}
                  {localData.tobacco.status === 'former' && 'Former user'}
                </Badge>
              </div>

              {localData.tobacco.status !== 'never' && (
                <>
                  <div>
                    <Label>Types of tobacco products</Label>
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      {tobaccoTypes.map(type => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tobacco-${type}`}
                            checked={((localData.tobacco.type as string[]) || []).includes(type)}
                            onCheckedChange={() => toggleNestedArrayItem('tobacco', 'type', type)}
                            disabled={isReadOnly}
                          />
                          <Label
                            htmlFor={`tobacco-${type}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {type}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration</Label>
                      <Input
                        value={localData.tobacco.duration}
                        onChange={(e) => handleNestedUpdate('tobacco', 'duration', e.target.value)}
                        placeholder="e.g., 3 years"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <Label>Frequency</Label>
                      <Input
                        value={localData.tobacco.frequency}
                        onChange={(e) => handleNestedUpdate('tobacco', 'frequency', e.target.value)}
                        placeholder="e.g., 5 times/day"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  {localData.tobacco.status === 'former' && (
                    <div>
                      <Label>Quit date</Label>
                      <Input
                        type="date"
                        value={localData.tobacco.quit_date}
                        onChange={(e) => handleNestedUpdate('tobacco', 'quit_date', e.target.value)}
                        disabled={isReadOnly}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Dietary Habits */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-green-500" />
                Dietary Habits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {dietaryHabits.map(habit => (
                  <div key={habit} className="flex items-center space-x-2">
                    <Checkbox
                      id={`diet-${habit}`}
                      checked={(localData.dietary_habits || []).includes(habit)}
                      onCheckedChange={() => toggleArrayItem('dietary_habits', habit)}
                      disabled={isReadOnly}
                    />
                    <Label
                      htmlFor={`diet-${habit}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {habit}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Oral Hygiene Habits */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Oral Hygiene Habits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brushing frequency</Label>
                  <Select
                    value={localData.oral_hygiene.brushing_frequency}
                    onValueChange={(value) => handleNestedUpdate('oral_hygiene', 'brushing_frequency', value)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="How often..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="occasionally">Occasionally</SelectItem>
                      <SelectItem value="once_daily">Once daily</SelectItem>
                      <SelectItem value="twice_daily">Twice daily</SelectItem>
                      <SelectItem value="after_meals">After meals</SelectItem>
                      <SelectItem value="more_than_3">More than 3 times</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Toothbrush type</Label>
                  <Select
                    value={localData.oral_hygiene.toothbrush_type}
                    onValueChange={(value) => handleNestedUpdate('oral_hygiene', 'toothbrush_type', value)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soft">Soft bristles</SelectItem>
                      <SelectItem value="medium">Medium bristles</SelectItem>
                      <SelectItem value="hard">Hard bristles</SelectItem>
                      <SelectItem value="electric">Electric toothbrush</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Flossing frequency</Label>
                  <Select
                    value={localData.oral_hygiene.flossing}
                    onValueChange={(value) => handleNestedUpdate('oral_hygiene', 'flossing', value)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="How often..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="rarely">Rarely</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mouthwash use</Label>
                  <Select
                    value={localData.oral_hygiene.mouthwash}
                    onValueChange={(value) => handleNestedUpdate('oral_hygiene', 'mouthwash', value)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="How often..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="occasionally">Occasionally</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="twice_daily">Twice daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Last professional cleaning</Label>
                <Input
                  value={localData.oral_hygiene.last_cleaning}
                  onChange={(e) => handleNestedUpdate('oral_hygiene', 'last_cleaning', e.target.value)}
                  placeholder="e.g., 6 months ago, 1 year ago"
                  disabled={isReadOnly}
                />
              </div>

              <div>
                <Label>Fluoride exposure</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {fluorideExposure.map(exposure => (
                    <div key={exposure} className="flex items-center space-x-2">
                      <Checkbox
                        id={`fluoride-${exposure}`}
                        checked={((localData.oral_hygiene.fluoride_exposure as string[]) || []).includes(exposure)}
                        onCheckedChange={() => toggleNestedArrayItem('oral_hygiene', 'fluoride_exposure', exposure)}
                        disabled={isReadOnly}
                      />
                      <Label
                        htmlFor={`fluoride-${exposure}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {exposure}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Other Habits */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700">Other Oral Habits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {otherHabits.map(habit => (
                  <div key={habit} className="flex items-center space-x-2">
                    <Checkbox
                      id={`habit-${habit}`}
                      checked={(localData.other_habits || []).includes(habit)}
                      onCheckedChange={() => toggleArrayItem('other_habits', habit)}
                      disabled={isReadOnly}
                    />
                    <Label
                      htmlFor={`habit-${habit}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {habit}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lifestyle and Occupation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              Lifestyle Factors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Exercise habits</Label>
              <Textarea
                value={localData.exercise_habits}
                onChange={(e) => handleUpdate('exercise_habits', e.target.value)}
                placeholder="Describe exercise routine, frequency, intensity..."
                rows={2}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <Label>Sleep patterns</Label>
              <Textarea
                value={localData.sleep_patterns}
                onChange={(e) => handleUpdate('sleep_patterns', e.target.value)}
                placeholder="Hours of sleep, sleep quality, sleep disorders..."
                rows={2}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <Label>Stress levels</Label>
              <Select
                value={localData.stress_levels}
                onValueChange={(value) => handleUpdate('stress_levels', value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stress level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low stress</SelectItem>
                  <SelectItem value="moderate">Moderate stress</SelectItem>
                  <SelectItem value="high">High stress</SelectItem>
                  <SelectItem value="chronic">Chronic stress</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Lifestyle factors</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {lifestyleFactors.map(factor => (
                  <div key={factor} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lifestyle-${factor}`}
                      checked={(localData.lifestyle_factors || []).includes(factor)}
                      onCheckedChange={() => toggleArrayItem('lifestyle_factors', factor)}
                      disabled={isReadOnly}
                    />
                    <Label
                      htmlFor={`lifestyle-${factor}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {factor}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-700">Occupation & Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Occupation</Label>
              <Input
                value={localData.occupation}
                onChange={(e) => handleUpdate('occupation', e.target.value)}
                placeholder="Patient's occupation..."
                disabled={isReadOnly}
              />
            </div>

            <div>
              <Label>Occupational hazards</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {occupationalHazards.map(hazard => (
                  <div key={hazard} className="flex items-center space-x-2">
                    <Checkbox
                      id={`hazard-${hazard}`}
                      checked={(localData.occupational_hazards || []).includes(hazard)}
                      onCheckedChange={() => toggleArrayItem('occupational_hazards', hazard)}
                      disabled={isReadOnly}
                    />
                    <Label
                      htmlFor={`hazard-${hazard}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {hazard}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Assessment Summary */}
      {(localData.smoking.status === 'current' || localData.alcohol.status === 'heavy' || (localData.other_habits || []).length > 0) && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-yellow-700">Risk Factors Identified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {localData.smoking.status === 'current' && (
                <Badge variant="outline" className="mr-2 mb-2 text-red-700 border-red-300">
                  Active smoker
                </Badge>
              )}
              {localData.alcohol.status === 'heavy' && (
                <Badge variant="outline" className="mr-2 mb-2 text-red-700 border-red-300">
                  Heavy alcohol use
                </Badge>
              )}
              {localData.tobacco.status === 'current' && (
                <Badge variant="outline" className="mr-2 mb-2 text-red-700 border-red-300">
                  Tobacco use
                </Badge>
              )}
              {(localData.other_habits || []).includes("Teeth grinding (bruxism)") && (
                <Badge variant="outline" className="mr-2 mb-2 text-orange-700 border-orange-300">
                  Bruxism
                </Badge>
              )}
              {(localData.other_habits || []).includes("Nail biting") && (
                <Badge variant="outline" className="mr-2 mb-2 text-orange-700 border-orange-300">
                  Nail biting
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}