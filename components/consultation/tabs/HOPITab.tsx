'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

export function HOPITab({ data, onChange, isReadOnly = false, onSave }: any) {
  // Local state management - initialize with stable defaults to prevent controlled/uncontrolled switches
  const [onsetDetails, setOnsetDetails] = useState('')
  const [duration, setDuration] = useState('')
  const [aggravatingFactors, setAggravatingFactors] = useState<string[]>([])
  const [relievingFactors, setRelievingFactors] = useState<string[]>([])
  const [previousEpisodes, setPreviousEpisodes] = useState('')
  const [previousTreatments, setPreviousTreatments] = useState<string[]>([])

  // Update local state when data prop changes - ensure stable defaults
  useEffect(() => {
    setOnsetDetails(data?.onset_details || '')
    setDuration(data?.duration || '')
    setAggravatingFactors(data?.aggravating_factors || [])
    setRelievingFactors(data?.relieving_factors || [])
    setPreviousEpisodes(data?.previous_episodes || '')
    setPreviousTreatments(data?.previous_treatments || [])
  }, [data])


  // Event handlers
  const handleOnsetChange = (value: string) => {
    setOnsetDetails(value)
    if (onChange) {
      onChange({
        onset_details: value,
        duration: duration,
        aggravating_factors: aggravatingFactors,
        relieving_factors: relievingFactors,
        previous_episodes: previousEpisodes,
        previous_treatments: previousTreatments
      })
    }
  }

  const handleDurationChange = (value: string) => {
    setDuration(value)
    if (onChange) {
      onChange({
        onset_details: onsetDetails,
        duration: value,
        aggravating_factors: aggravatingFactors,
        relieving_factors: relievingFactors,
        previous_episodes: previousEpisodes,
        previous_treatments: previousTreatments
      })
    }
  }

  const handlePreviousEpisodesChange = (value: string) => {
    setPreviousEpisodes(value)
    if (onChange) {
      onChange({
        onset_details: onsetDetails,
        duration: duration,
        aggravating_factors: aggravatingFactors,
        relieving_factors: relievingFactors,
        previous_episodes: value,
        previous_treatments: previousTreatments
      })
    }
  }

  const handleAggravatingFactorToggle = (factor: string) => {
    const newFactors = aggravatingFactors.includes(factor)
      ? aggravatingFactors.filter(f => f !== factor)
      : [...aggravatingFactors, factor]
    setAggravatingFactors(newFactors)
    if (onChange) {
      onChange({
        onset_details: onsetDetails,
        duration: duration,
        aggravating_factors: newFactors,
        relieving_factors: relievingFactors,
        previous_episodes: previousEpisodes,
        previous_treatments: previousTreatments
      })
    }
  }

  const handleRelievingFactorToggle = (factor: string) => {
    const newFactors = relievingFactors.includes(factor)
      ? relievingFactors.filter(f => f !== factor)
      : [...relievingFactors, factor]
    setRelievingFactors(newFactors)
    if (onChange) {
      onChange({
        onset_details: onsetDetails,
        duration: duration,
        aggravating_factors: aggravatingFactors,
        relieving_factors: newFactors,
        previous_episodes: previousEpisodes,
        previous_treatments: previousTreatments
      })
    }
  }

  const handleTreatmentToggle = (treatment: string) => {
    const newTreatments = previousTreatments.includes(treatment)
      ? previousTreatments.filter(t => t !== treatment)
      : [...previousTreatments, treatment]
    setPreviousTreatments(newTreatments)
    if (onChange) {
      onChange({
        onset_details: onsetDetails,
        duration: duration,
        aggravating_factors: aggravatingFactors,
        relieving_factors: relievingFactors,
        previous_episodes: previousEpisodes,
        previous_treatments: newTreatments
      })
    }
  }

  // Simple option arrays
  const aggravatingOptions = [
    'Hot food/drinks', 'Cold food/drinks', 'Sweet foods', 'Chewing',
    'Pressure', 'Lying down', 'Physical activity', 'Stress'
  ]

  const relievingOptions = [
    'Cold application', 'Heat application', 'Pain medications',
    'Rest', 'Avoiding chewing', 'Salt water rinse', 'Elevation', 'Nothing helps'
  ]

  const treatmentOptions = [
    'Over-the-counter pain relief', 'Prescription medication', 'Antibiotics',
    'Home remedies', 'Previous dental visit', 'Emergency room visit', 'No treatment'
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-teal-600">History of Present Illness (HOPI)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Onset Details */}
          <div>
            <Label htmlFor="onset-details">How did the problem start?</Label>
            <Textarea
              id="onset-details"
              value={onsetDetails}
              onChange={(e) => handleOnsetChange(e.target.value)}
              placeholder="Describe when and how the problem began (sudden/gradual onset, triggers, circumstances)..."
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Duration */}
          <div>
            <Label htmlFor="duration">Duration</Label>
            <Input
              id="duration"
              value={duration}
              onChange={(e) => handleDurationChange(e.target.value)}
              placeholder="How long has this been going on? (e.g., 3 days, 2 weeks, 6 months)"
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Aggravating Factors */}
          <div>
            <Label>What makes it worse?</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {aggravatingOptions.map(factor => (
                <div key={factor} className="flex items-center space-x-2">
                  <Checkbox
                    id={`aggravating-${factor}`}
                    checked={aggravatingFactors.includes(factor)}
                    onCheckedChange={() => handleAggravatingFactorToggle(factor)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`aggravating-${factor}`} className="text-sm cursor-pointer">
                    {factor}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Relieving Factors */}
          <div>
            <Label>What makes it better?</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {relievingOptions.map(factor => (
                <div key={factor} className="flex items-center space-x-2">
                  <Checkbox
                    id={`relieving-${factor}`}
                    checked={relievingFactors.includes(factor)}
                    onCheckedChange={() => handleRelievingFactorToggle(factor)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`relieving-${factor}`} className="text-sm cursor-pointer">
                    {factor}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Previous Episodes */}
          <div>
            <Label htmlFor="previous-episodes">Previous Episodes</Label>
            <Textarea
              id="previous-episodes"
              value={previousEpisodes}
              onChange={(e) => handlePreviousEpisodesChange(e.target.value)}
              placeholder="Has this happened before? When? How similar? Any patterns?"
              rows={3}
              disabled={isReadOnly}
              className="mt-2"
            />
          </div>

          {/* Previous Treatments */}
          <div>
            <Label>Previous treatments tried</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {treatmentOptions.map(treatment => (
                <div key={treatment} className="flex items-center space-x-2">
                  <Checkbox
                    id={`treatment-${treatment}`}
                    checked={previousTreatments.includes(treatment)}
                    onCheckedChange={() => handleTreatmentToggle(treatment)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`treatment-${treatment}`} className="text-sm cursor-pointer">
                    {treatment}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          {!isReadOnly && onSave && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => {
                  if (onSave) {
                    onSave({
                      onset_details: onsetDetails,
                      duration: duration,
                      aggravating_factors: aggravatingFactors,
                      relieving_factors: relievingFactors,
                      previous_episodes: previousEpisodes,
                      previous_treatments: previousTreatments
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