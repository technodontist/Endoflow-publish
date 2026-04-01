'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, AlertCircle, CheckCircle2, TrendingUp, Search, FileText } from 'lucide-react'
import { getAIDiagnosisSuggestionAction, AIDiagnosisSuggestion } from '@/lib/actions/ai-diagnosis-suggestions'
import { cn } from '@/lib/utils'
import type { ConversationContext } from '@/lib/services/medical-conversation-parser'

interface DiagnosisAICopilotProps {
  symptoms: string[]
  painCharacteristics?: {
    quality?: string
    intensity?: number
    location?: string
    duration?: string
  }
  clinicalFindings?: string
  toothNumber?: string
  patientContext?: {
    age?: number
    medicalHistory?: string
  }
  conversationContext?: ConversationContext
  onAcceptSuggestion?: (diagnosis: string) => void
}

export default function DiagnosisAICopilot({
  symptoms,
  painCharacteristics,
  clinicalFindings,
  toothNumber,
  patientContext,
  conversationContext,
  onAcceptSuggestion
}: DiagnosisAICopilotProps) {
  const [suggestion, setSuggestion] = useState<AIDiagnosisSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [manualTrigger, setManualTrigger] = useState(false)

  // Auto-fetch suggestion when symptoms change (only if symptoms exist)
  useEffect(() => {
    if (symptoms && symptoms.length > 0) {
      // Only auto-fetch if not manually triggered mode
      if (!manualTrigger) {
        fetchSuggestion()
      }
    } else {
      setSuggestion(null)
      setError(null)
    }
  }, [symptoms, painCharacteristics, clinicalFindings])

  const fetchSuggestion = async () => {
    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const result = await getAIDiagnosisSuggestionAction({
        symptoms,
        painCharacteristics,
        clinicalFindings,
        toothNumber,
        patientContext,
        conversationContext
      })

      if (result.success && result.data) {
        setSuggestion(result.data)
        setCached(result.cached || false)
        setProcessingTime(result.processingTime || null)
      } else {
        setError(result.error || 'Failed to get AI diagnosis suggestion')
      }
    } catch (err) {
      console.error('AI diagnosis suggestion error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptSuggestion = () => {
    if (suggestion && onAcceptSuggestion) {
      onAcceptSuggestion(suggestion.diagnosis)
    }
  }

  // Empty state - waiting for symptoms
  if (!symptoms || symptoms.length === 0) {
    return (
      <Card className="border-dashed border-2 border-border">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/70 mb-3" />
          <h3 className="font-semibold text-foreground mb-2">AI Diagnosis Assistant Ready</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Enter symptoms or pain characteristics to receive AI-powered diagnostic suggestions based on latest research
          </p>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (loading) {
    return (
      <Card className="border-blue-200 border-2">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-teal-500/10">
          <CardTitle className="flex items-center gap-2 text-blue-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
            AI Diagnosis Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-4" />
          <p className="text-sm text-muted-foreground mb-2">Analyzing symptoms and clinical data...</p>
          <p className="text-xs text-muted-foreground">Searching medical knowledge base</p>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="border-orange-200 border-2">
        <CardHeader className="bg-orange-500/10">
          <CardTitle className="flex items-center gap-2 text-orange-400">
            <AlertCircle className="h-5 w-5" />
            AI Diagnosis Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-8 w-8 text-orange-500 mb-3" />
            <p className="text-sm text-foreground mb-4">{error}</p>
            {error.includes('No relevant medical knowledge') && (
              <div className="bg-blue-500/10 p-3 rounded-lg text-left w-full">
                <p className="text-xs text-blue-400 mb-2">
                  <strong>To enable AI diagnosis suggestions:</strong>
                </p>
                <ol className="text-xs text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Upload medical textbooks and research papers</li>
                  <li>Ensure database migration is complete</li>
                  <li>Configure GEMINI_API_KEY</li>
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
      <Card className="border-blue-200 border-2">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-teal-500/10">
          <CardTitle className="flex items-center gap-2 text-blue-400">
            <Sparkles className="h-5 w-5" />
            AI Diagnosis Suggestion
            {cached && (
              <Badge variant="outline" className="ml-2 text-xs">
                Cached
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-4">
          {/* Primary Diagnosis */}
          <div className="bg-card p-4 rounded-lg border-2 border-blue-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-5 w-5 text-blue-400" />
                  <h4 className="font-semibold text-blue-400">{suggestion.diagnosis}</h4>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={cn(
                    "text-xs",
                    suggestion.confidence >= 80 ? "bg-green-500/15 text-green-400" :
                    suggestion.confidence >= 60 ? "bg-yellow-500/15 text-yellow-400" :
                    "bg-orange-500/15 text-orange-400"
                  )}>
                    {suggestion.confidence}% Confidence
                  </Badge>
                  {processingTime && (
                    <Badge variant="outline" className="text-xs">
                      {processingTime}ms
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                onClick={handleAcceptSuggestion}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Accept
              </Button>
            </div>

            {/* Reasoning */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-foreground mb-1">Evidence-Based Reasoning:</p>
              <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
            </div>

            {/* Clinical Significance */}
            {suggestion.clinicalSignificance && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-foreground mb-1">Clinical Significance:</p>
                <p className="text-xs text-muted-foreground">{suggestion.clinicalSignificance}</p>
              </div>
            )}
          </div>

          {/* Differential Diagnoses */}
          {suggestion.differentialDiagnoses && suggestion.differentialDiagnoses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <p className="text-xs font-semibold text-foreground">Differential Diagnoses:</p>
              </div>
              <div className="space-y-1">
                {suggestion.differentialDiagnoses.map((diff, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-xs text-blue-400 mt-0.5">•</span>
                    <p className="text-xs text-muted-foreground">{diff}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Tests */}
          {suggestion.recommendedTests && suggestion.recommendedTests.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <p className="text-xs font-semibold text-foreground">Recommended Tests:</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestion.recommendedTests.map((test, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {test}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Sources */}
          {suggestion.sources && suggestion.sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Evidence Sources:</p>
              <div className="space-y-2">
                {suggestion.sources.slice(0, 3).map((source, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    <p className="font-medium">{source.title}</p>
                    <p className="text-muted-foreground">
                      {source.journal} ({source.year})
                      {source.doi && (
                        <span className="ml-2 text-blue-400">DOI: {source.doi}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return null
}
