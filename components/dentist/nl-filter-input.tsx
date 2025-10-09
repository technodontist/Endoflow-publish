'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Volume2,
  RefreshCw
} from 'lucide-react'
import type { FilterCriteria } from '@/lib/actions/research-projects'
import { filtersToNaturalLanguage } from '@/lib/services/nl-filter-extractor'

interface NLFilterInputProps {
  onFiltersExtracted: (filters: FilterCriteria[]) => void
  disabled?: boolean
}

export function NLFilterInput({ onFiltersExtracted, disabled = false }: NLFilterInputProps) {
  // Text input state
  const [textInput, setTextInput] = useState('')
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef<string>('') // Track latest transcript value
  const finalTranscriptRef = useRef<string>('') // Track only final results
  const isRecordingRef = useRef<boolean>(false) // Track recording state for callbacks
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Results state
  const [extractedFilters, setExtractedFilters] = useState<FilterCriteria[]>([])
  const [confidence, setConfidence] = useState<number>(0)
  const [explanation, setExplanation] = useState<string>('')
  const [showResults, setShowResults] = useState(false)

  // Setup speech recognition on mount (only once)
  useEffect(() => {
    console.log('🔧 [NL FILTER] Setting up speech recognition...')
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'
      recognitionRef.current.maxAlternatives = 1
      
      recognitionRef.current.onstart = () => {
        console.log('🎤 [NL FILTER] Speech recognition started')
      }
      
      recognitionRef.current.onresult = (event: any) => {
        console.log('🎤 [NL FILTER] Speech recognition result received')
        let interimTranscript = ''
        
        // Process only the new results (starting from resultIndex)
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            // Add final result to our permanent transcript
            finalTranscriptRef.current += transcript + ' '
            console.log('✅ [NL FILTER] Final transcript added:', transcript)
            console.log('📝 [NL FILTER] Total final transcript:', finalTranscriptRef.current)
          } else {
            // Interim results are temporary - they replace previous interim
            interimTranscript += transcript
            console.log('⏳ [NL FILTER] Interim transcript (temporary):', transcript)
          }
        }
        
        // Combine final (permanent) + interim (temporary)
        const fullTranscript = finalTranscriptRef.current + interimTranscript
        transcriptRef.current = fullTranscript // Update ref with latest transcript
        setTranscript(fullTranscript)
        console.log('📊 [NL FILTER] Full transcript displayed:', fullTranscript.substring(0, 100) + '...')
      }
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('❌ [NL FILTER] Speech recognition error:', event.error)
        if (event.error === 'no-speech') {
          console.log('⚠️ [NL FILTER] No speech detected, continuing...')
          return // Don't show error for no-speech
        }
        if (event.error === 'aborted') {
          console.log('⚠️ [NL FILTER] Recognition aborted (normal stop)')
          return // Don't show error for normal stops
        }
        setError(`Voice recognition error: ${event.error}`)
        setIsRecording(false)
        isRecordingRef.current = false
      }
      
      recognitionRef.current.onend = () => {
        console.log('🛑 [NL FILTER] Speech recognition ended, isRecordingRef:', isRecordingRef.current)
        // Use ref instead of state to avoid stale closure
        if (isRecordingRef.current) {
          // Restart if we're still supposed to be recording
          try {
            console.log('🔄 [NL FILTER] Restarting speech recognition...')
            recognitionRef.current.start()
          } catch (e) {
            console.error('❌ [NL FILTER] Failed to restart recognition:', e)
          }
        } else {
          console.log('ℹ️ [NL FILTER] Not restarting - recording stopped by user')
        }
      }
      
      console.log('✅ [NL FILTER] Speech recognition setup complete')
    } else {
      console.warn('⚠️ [NL FILTER] Speech recognition not supported in this browser')
    }
    
    return () => {
      console.log('🧹 [NL FILTER] Cleaning up speech recognition')
      isRecordingRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.log('Recognition cleanup error (can be ignored):', e)
        }
      }
    }
  }, []) // Empty dependency array - setup only once

  const startVoiceRecording = () => {
    console.log('🎤 [NL FILTER] Start voice recording requested')
    console.log('🔍 [NL FILTER] Browser info:', navigator.userAgent)
    console.log('🔍 [NL FILTER] Recognition ref exists:', !!recognitionRef.current)
    
    if (!recognitionRef.current) {
      console.error('❌ [NL FILTER] Recognition not available')
      setError('Voice recognition not supported in this browser. Please use Chrome, Edge, or Safari.')
      return
    }
    
    console.log('🧪 [NL FILTER] Clearing previous state...')
    setError(null)
    setShowResults(false)
    transcriptRef.current = '' // Reset transcript ref
    finalTranscriptRef.current = '' // Reset final transcript ref
    setTranscript('')
    setIsRecording(true)
    isRecordingRef.current = true // Set ref for callbacks
    
    try {
      console.log('🚀 [NL FILTER] Starting speech recognition...')
      recognitionRef.current.start()
      console.log('✅ [NL FILTER] Speech recognition start() called successfully')
    } catch (e: any) {
      console.error('❌ [NL FILTER] Failed to start recognition:', e)
      setError(`Failed to start voice recording: ${e.message}`)
      setIsRecording(false)
      isRecordingRef.current = false
    }
  }

  const stopVoiceRecording = () => {
    console.log('🛑 [NL FILTER] Stop voice recording requested')
    setIsRecording(false)
    isRecordingRef.current = false // Update ref immediately
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        console.log('✅ [NL FILTER] Speech recognition stopped')
      } catch (e) {
        console.error('❌ [NL FILTER] Error stopping recognition:', e)
      }
    }
    
    // Use the final transcript for processing
    const finalText = finalTranscriptRef.current.trim()
    console.log('📋 [NL FILTER] Final transcript length:', finalText.length)
    console.log('📋 [NL FILTER] Final transcript:', finalText)
    
    if (finalText) {
      setTextInput(finalText)
      console.log('✅ [NL FILTER] Transcript set to text input')
    } else {
      console.warn('⚠️ [NL FILTER] No transcript captured')
      setError('No speech was detected. Please try again and speak clearly.')
    }
  }

  const processInput = async (input: string) => {
    if (!input.trim()) {
      setError('Please provide a filter description')
      return
    }

    setIsProcessing(true)
    setError(null)
    setShowResults(false)

    try {
      console.log('🔍 [NL FILTER UI] Processing input:', input)

      const response = await fetch('/api/research/extract-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      })

      const result = await response.json()

      console.log('✅ [NL FILTER UI] Received result:', result)

      if (result.success && result.filters.length > 0) {
        setExtractedFilters(result.filters)
        setConfidence(result.confidence)
        setExplanation(result.explanation)
        setShowResults(true)
      } else {
        setError(result.error || 'No filters could be extracted from your input. Try being more specific.')
      }
    } catch (error) {
      console.error('❌ [NL FILTER UI] Processing error:', error)
      setError('Failed to process your input. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTextSubmit = () => {
    processInput(textInput)
  }

  const handleApplyFilters = () => {
    onFiltersExtracted(extractedFilters)
    setShowResults(false)
    setTextInput('')
    setTranscript('')
  }

  const handleClear = () => {
    setTextInput('')
    setTranscript('')
    setExtractedFilters([])
    setShowResults(false)
    setError(null)
  }

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">Natural Language Filters</h3>
            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
              AI-Powered
            </Badge>
          </div>
          
          {showResults && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Instructions */}
        <p className="text-sm text-gray-600">
          Describe your patient cohort in plain English using voice or text. 
          AI will convert it to structured filters.
        </p>

        {/* Input Methods */}
        {!showResults && (
          <>
            {/* Text Input */}
            <div className="space-y-2">
              <Textarea
                placeholder='Try: "Find patients over 30 with moderate caries and pain above 5" or "Show me patients with irreversible pulpitis who had root canal treatment"'
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={disabled || isRecording || isProcessing}
                className="min-h-[80px] border-purple-200 focus:border-purple-400 focus:ring-purple-400"
              />
              
              {/* Voice transcript display */}
              {transcript && (
                <div className="p-2 bg-purple-50 rounded border border-purple-200 text-sm text-purple-900">
                  <div className="flex items-center gap-1 text-xs text-purple-600 mb-1">
                    <Volume2 className="w-3 h-3" />
                    Voice Transcript
                  </div>
                  {transcript}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Voice Recording Button */}
              <Button
                variant={isRecording ? "destructive" : "outline"}
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={disabled || isProcessing}
                className={isRecording ? "animate-pulse" : "border-purple-300 hover:bg-purple-50"}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Voice Input
                  </>
                )}
              </Button>

              {/* Process Text Button */}
              <Button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || disabled || isProcessing}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting Filters...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Extract Filters
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Display */}
        {showResults && extractedFilters.length > 0 && (
          <div className="space-y-3">
            {/* Confidence Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">
                  {extractedFilters.length} filter{extractedFilters.length > 1 ? 's' : ''} extracted
                </span>
              </div>
              <Badge
                variant="outline"
                className={`${
                  confidence >= 0.8
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : confidence >= 0.6
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                    : 'bg-orange-50 text-orange-700 border-orange-300'
                }`}
              >
                {Math.round(confidence * 100)}% confidence
              </Badge>
            </div>

            {/* AI Explanation */}
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-900">{explanation}</p>
            </div>

            {/* Extracted Filters Summary */}
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Extracted Filters:</h4>
              <div className="text-sm text-gray-600">
                {filtersToNaturalLanguage(extractedFilters)}
              </div>
            </div>

            {/* Apply Button */}
            <Button
              onClick={handleApplyFilters}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Apply These Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
