'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, BookOpen, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react'
import { getAITreatmentSuggestionAction, AISuggestion } from '@/lib/actions/ai-treatment-suggestions'
import { cn } from '@/lib/utils'

interface EndoAICopilotLiveProps {
  diagnosis: string
  toothNumber: string
  patientContext?: {
    age?: number
    medicalHistory?: string
    previousTreatments?: string
  }
  onAcceptSuggestion?: (treatment: string) => void
}

export default function EndoAICopilotLive({
  diagnosis,
  toothNumber,
  patientContext,
  onAcceptSuggestion
}: EndoAICopilotLiveProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [processingTime, setProcessingTime] = useState<number | null>(null)

  // Auto-fetch suggestion when diagnosis changes
  useEffect(() => {
    if (diagnosis && toothNumber) {
      fetchSuggestion()
    } else {
      setSuggestion(null)
      setError(null)
    }
  }, [diagnosis, toothNumber])

  const fetchSuggestion = async () => {
    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const result = await getAITreatmentSuggestionAction({
        diagnosis,
        toothNumber,
        patientContext
      })

      if (result.success && result.data) {
        setSuggestion(result.data)
        setCached(result.cached || false)
        setProcessingTime(result.processingTime || null)
      } else {
        setError(result.error || 'Failed to get AI suggestion')
      }
    } catch (err) {
      console.error('AI suggestion error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptSuggestion = () => {
    if (suggestion && onAcceptSuggestion) {
      onAcceptSuggestion(suggestion.treatment)
    }
  }

  // Empty state
  if (!diagnosis || !toothNumber) {
    return (
      <Card className="border-dashed border-2 border-gray-300">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="h-12 w-12 text-gray-400 mb-3" />
          <h3 className="font-semibold text-gray-700 mb-2">Endo-AI Co-Pilot Ready</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            Select a diagnosis to receive AI-powered treatment recommendations based on latest research
          </p>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (loading) {
    return (
      <Card className="border-teal-200 border-2">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50">
          <CardTitle className="flex items-center gap-2 text-teal-700">
            <Sparkles className="h-5 w-5 animate-pulse" />
            Endo-AI Co-Pilot
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-teal-600 animate-spin mb-4" />
          <p className="text-sm text-gray-600 mb-2">Analyzing medical evidence...</p>
          <p className="text-xs text-gray-500">Searching research papers and textbooks</p>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="border-orange-200 border-2">
        <CardHeader className="bg-orange-50">
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="h-5 w-5" />
            Endo-AI Co-Pilot
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-8 w-8 text-orange-500 mb-3" />
            <p className="text-sm text-gray-700 mb-4">{error}</p>
            {error.includes('No relevant medical knowledge') && (
              <div className="bg-blue-50 p-3 rounded-lg text-left w-full">
                <p className="text-xs text-blue-700 mb-2">
                  <strong>To enable AI suggestions:</strong>
                </p>
                <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                  <li>Upload medical textbooks and research papers</li>
                  <li>Ensure database migration is complete</li>
                  <li>Configure OpenAI API key</li>
                </ol>
              </div>
            )}
            <Button
              onClick={fetchSuggestion}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state with suggestion
  if (suggestion) {
    return (
      <Card className="border-teal-300 border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-teal-700">
              <Sparkles className="h-5 w-5" />
              Endo-AI Co-Pilot
              {cached && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Cached
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={suggestion.confidence >= 80 ? 'default' : suggestion.confidence >= 60 ? 'secondary' : 'outline'}
                className={cn(
                  "font-semibold",
                  suggestion.confidence >= 80 && "bg-green-500",
                  suggestion.confidence >= 60 && suggestion.confidence < 80 && "bg-yellow-500"
                )}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                {suggestion.confidence}% Confidence
              </Badge>
            </div>
          </div>
          {processingTime && !cached && (
            <p className="text-xs text-gray-500 mt-1">Generated in {processingTime}ms</p>
          )}
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Primary Treatment Recommendation */}
          <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-teal-900 mb-1">Recommended Treatment</h4>
                <p className="text-sm text-gray-800 font-medium">{suggestion.treatment}</p>
              </div>
            </div>
          </div>

          {/* Evidence-Based Reasoning */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Evidence-Based Reasoning
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border">
              {suggestion.reasoning}
            </p>
          </div>

          {/* Research Sources */}
          {suggestion.sources && suggestion.sources.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Research Sources</h4>
              <div className="space-y-2">
                {suggestion.sources.map((source, idx) => (
                  <div key={idx} className="text-xs bg-white p-3 rounded border border-gray-200">
                    <p className="font-medium text-gray-800">{source.title}</p>
                    <p className="text-gray-600 mt-1">
                      {source.journal} • {source.year}
                      {source.doi && (
                        <span className="ml-2 text-blue-600">DOI: {source.doi}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alternative Treatments */}
          {suggestion.alternativeTreatments && suggestion.alternativeTreatments.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Alternative Treatments</h4>
              <ul className="text-sm space-y-1">
                {suggestion.alternativeTreatments.map((alt, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span className="text-gray-700">{alt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contraindications */}
          {suggestion.contraindications && suggestion.contraindications.length > 0 && (
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Contraindications
              </h4>
              <ul className="text-sm space-y-1">
                {suggestion.contraindications.map((contra, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">⚠</span>
                    <span className="text-orange-700">{contra}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleAcceptSuggestion}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Accept Suggestion
            </Button>
            <Button
              onClick={fetchSuggestion}
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-gray-500 italic border-t pt-3">
            ⚕️ AI-generated suggestion based on medical literature. Always verify with clinical judgment and patient-specific factors.
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
