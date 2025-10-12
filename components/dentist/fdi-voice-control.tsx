'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Mic, MicOff, AlertCircle, CheckCircle, 
  Loader2, FileText, Activity, Sparkles,
  ChevronRight, X, Eye, Check
} from 'lucide-react'
import { extractDentalFindings, mapFindingsToChartUpdate, type ToothFinding, type DentalExaminationData } from '@/lib/services/dental-voice-parser'
import { getDentalRAGSuggestions, type DiagnosisSuggestion } from '@/lib/services/dental-rag-service'
import { cn } from '@/lib/utils'
import { useVoiceManager } from '@/lib/contexts/voice-manager-context'

interface FDIVoiceControlProps {
  patientId: string
  consultationId?: string
  onToothUpdate?: (updates: Record<string, any>) => void
  onSuggestionsReceived?: (suggestions: DiagnosisSuggestion[]) => void
  patientHistory?: {
    medical_conditions?: string[]
    medications?: string[]
    allergies?: string[]
    previous_treatments?: string[]
  }
}

export function FDIVoiceControl({
  patientId,
  consultationId,
  onToothUpdate,
  onSuggestionsReceived,
  patientHistory
}: FDIVoiceControlProps) {
  // Get voice manager
  const voiceManager = useVoiceManager()
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<'extracting' | 'querying' | 'complete'>('extracting')
  const [progress, setProgress] = useState(0)
  
  // Results states
  const [dentalFindings, setDentalFindings] = useState<DentalExaminationData | null>(null)
  const [ragSuggestions, setRagSuggestions] = useState<DiagnosisSuggestion[]>([])
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set())
  
  // UI states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('findings')
  const [error, setError] = useState<string | null>(null)
  
  // Refs
  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef('')
  
  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      
      recognition.onresult = (event: any) => {
        let interim = ''
        let final = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            final += transcript + ' '
          } else {
            interim += transcript
          }
        }
        
        if (final) {
          finalTranscriptRef.current += final
          setTranscript(finalTranscriptRef.current)
        }
        setInterimTranscript(interim)
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setError(`Voice recognition error: ${event.error}`)
        setIsRecording(false)
      }
      
      recognition.onend = () => {
        setIsRecording(false)
        if (finalTranscriptRef.current) {
          processTranscript(finalTranscriptRef.current)
        }
      }
      
      recognitionRef.current = recognition
    } else {
      setError('Speech recognition not supported in this browser')
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])
  
  // Start/stop recording
  const toggleRecording = () => {
    if (isRecording) {
      // Stopping recording
      recognitionRef.current?.stop()
      setIsRecording(false)
      voiceManager.unregisterMicUsage('fdi-voice-control')
      console.log('🛑 [FDI VOICE] Unregistered from voice manager')
    } else {
      // Starting recording
      voiceManager.registerMicUsage('fdi-voice-control')
      console.log('🎙️ [FDI VOICE] Registered with voice manager')
      
      finalTranscriptRef.current = ''
      setTranscript('')
      setInterimTranscript('')
      setError(null)
      recognitionRef.current?.start()
      setIsRecording(true)
    }
  }
  
  // Process transcript with AI
  const processTranscript = async (text: string) => {
    if (!text || text.trim().length < 10) {
      setError('Transcript too short. Please provide more detail.')
      return
    }
    
    setIsProcessing(true)
    setProcessingStep('extracting')
    setProgress(20)
    setError(null)
    
    try {
      // Step 1: Extract dental findings
      console.log('🎤 [FDI VOICE] Processing transcript:', text.substring(0, 100) + '...')
      const findings = await extractDentalFindings(text, patientId)
      
      if (!findings.tooth_findings || findings.tooth_findings.length === 0) {
        throw new Error('No tooth-specific findings detected in the transcript')
      }
      
      setDentalFindings(findings)
      setProgress(50)
      
      // Step 2: Get RAG suggestions if we have findings
      setProcessingStep('querying')
      const suggestions = await getDentalRAGSuggestions(
        findings.tooth_findings,
        patientHistory
      )
      
      setRagSuggestions(suggestions)
      setProgress(100)
      setProcessingStep('complete')
      
      // Auto-select high confidence findings
      const autoSelect = new Set<string>()
      findings.tooth_findings.forEach(finding => {
        if (finding.confidence > 0.8) {
          autoSelect.add(finding.tooth_number)
        }
      })
      setSelectedFindings(autoSelect)
      
      // Show confirmation dialog
      setShowConfirmDialog(true)
      
      // Notify parent component
      if (onSuggestionsReceived) {
        onSuggestionsReceived(suggestions)
      }
      
    } catch (error: any) {
      console.error('❌ [FDI VOICE] Processing error:', error)
      setError(error.message || 'Failed to process voice input')
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }
  
  // Apply selected findings to FDI chart
  const applyFindings = () => {
    if (!dentalFindings || selectedFindings.size === 0) return
    
    const selectedToothFindings = dentalFindings.tooth_findings.filter(
      f => selectedFindings.has(f.tooth_number)
    )
    
    const chartUpdates = mapFindingsToChartUpdate(selectedToothFindings)
    
    console.log('✅ [FDI VOICE] Applying updates to chart:', chartUpdates)
    
    if (onToothUpdate) {
      onToothUpdate(chartUpdates)
    }
    
    setShowConfirmDialog(false)
    resetState()
  }
  
  // Reset all states
  const resetState = () => {
    setTranscript('')
    setInterimTranscript('')
    finalTranscriptRef.current = ''
    setDentalFindings(null)
    setRagSuggestions([])
    setSelectedFindings(new Set())
    setError(null)
  }
  
  // Toggle tooth selection
  const toggleToothSelection = (toothNumber: string) => {
    const newSelection = new Set(selectedFindings)
    if (newSelection.has(toothNumber)) {
      newSelection.delete(toothNumber)
    } else {
      newSelection.add(toothNumber)
    }
    setSelectedFindings(newSelection)
  }
  
  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: 'bg-green-100 text-green-800',
      caries: 'bg-red-100 text-red-800',
      filled: 'bg-blue-100 text-blue-800',
      crown: 'bg-yellow-100 text-yellow-800',
      missing: 'bg-gray-100 text-gray-800',
      attention: 'bg-orange-100 text-orange-800',
      root_canal: 'bg-purple-100 text-purple-800',
      extraction_needed: 'bg-red-200 text-red-900'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }
  
  // Get urgency color
  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      immediate: 'bg-red-500',
      urgent: 'bg-orange-500',
      routine: 'bg-blue-500',
      observation: 'bg-gray-500'
    }
    return colors[urgency] || 'bg-gray-500'
  }
  
  return (
    <>
      {/* Main Voice Control Panel */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Voice Control for FDI Chart
            </span>
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Recording Button and Status */}
            <div className="flex items-center gap-4">
              <Button
                onClick={toggleRecording}
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                disabled={isProcessing}
                className="min-w-[160px]"
              >
                {isRecording ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2 animate-pulse" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>
              
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-gray-600">Recording...</span>
                </div>
              )}
              
              {isProcessing && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-600">
                    {processingStep === 'extracting' && 'Extracting findings...'}
                    {processingStep === 'querying' && 'Searching evidence...'}
                    {processingStep === 'complete' && 'Complete!'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Progress Bar */}
            {isProcessing && (
              <Progress value={progress} className="w-full h-2" />
            )}
            
            {/* Transcript Display */}
            {(transcript || interimTranscript) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Transcript:</div>
                <div className="text-sm text-gray-900">
                  {transcript}
                  {interimTranscript && (
                    <span className="text-gray-500 italic">{interimTranscript}</span>
                  )}
                </div>
              </div>
            )}
            
            {/* Quick Findings Preview */}
            {dentalFindings && dentalFindings.tooth_findings.length > 0 && !showConfirmDialog && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Findings Extracted</AlertTitle>
                <AlertDescription>
                  Found {dentalFindings.tooth_findings.length} tooth findings with {dentalFindings.confidence}% overall confidence
                </AlertDescription>
              </Alert>
            )}
            
            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Voice Command Examples */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900 mb-2">Example Commands:</div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>• "Tooth 16 has deep caries, needs root canal treatment"</div>
                <div>• "Upper right first molar showing periapical lesion"</div>
                <div>• "Teeth 24, 25, and 26 have composite fillings"</div>
                <div>• "Lower left wisdom tooth impacted, extraction needed"</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Review Voice-Extracted Findings</span>
              <Badge variant="outline">
                {selectedFindings.size}/{dentalFindings?.tooth_findings.length || 0} Selected
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="findings">Tooth Findings</TabsTrigger>
              <TabsTrigger value="suggestions">Treatment Suggestions</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto">
              <TabsContent value="findings" className="space-y-4 p-4">
                {dentalFindings?.tooth_findings.map(finding => (
                  <Card 
                    key={finding.tooth_number}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedFindings.has(finding.tooth_number) 
                        ? "ring-2 ring-blue-500" 
                        : "hover:shadow-md"
                    )}
                    onClick={() => toggleToothSelection(finding.tooth_number)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">Tooth {finding.tooth_number}</span>
                            <Badge className={getStatusColor(finding.status)}>
                              {finding.status}
                            </Badge>
                            <Badge className={cn("text-white", getUrgencyColor(finding.urgency))}>
                              {finding.urgency}
                            </Badge>
                            <Badge variant="outline">
                              {Math.round(finding.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="font-medium">Diagnosis:</span>{' '}
                              {finding.diagnosis.join(', ')}
                            </div>
                            <div>
                              <span className="font-medium">Treatment:</span>{' '}
                              {finding.treatment.join(', ')}
                            </div>
                            {finding.notes && (
                              <div>
                                <span className="font-medium">Notes:</span>{' '}
                                {finding.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="ml-4">
                          {selectedFindings.has(finding.tooth_number) ? (
                            <CheckCircle className="h-6 w-6 text-blue-500" />
                          ) : (
                            <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {dentalFindings?.general_findings && (
                  <Card className="bg-gray-50">
                    <CardContent className="p-4">
                      <div className="font-medium mb-2">General Findings</div>
                      <div className="text-sm space-y-1">
                        {dentalFindings.general_findings.periodontal_status && (
                          <div>Periodontal: {dentalFindings.general_findings.periodontal_status}</div>
                        )}
                        {dentalFindings.general_findings.occlusion && (
                          <div>Occlusion: {dentalFindings.general_findings.occlusion}</div>
                        )}
                        {dentalFindings.general_findings.oral_hygiene && (
                          <div>Oral Hygiene: {dentalFindings.general_findings.oral_hygiene}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="suggestions" className="space-y-4 p-4">
                {ragSuggestions.map(suggestion => (
                  <Card key={suggestion.tooth_number}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Tooth {suggestion.tooth_number} - {suggestion.primary_diagnosis}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-sm">
                        <span className="font-medium">Prognosis:</span> {suggestion.prognosis}
                      </div>
                      
                      <div>
                        <div className="font-medium text-sm mb-2">Recommended Tests:</div>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.clinical_tests_recommended.map(test => (
                            <Badge key={test} variant="outline" className="text-xs">
                              {test}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-sm mb-2">Treatment Options:</div>
                        <div className="space-y-2">
                          {suggestion.treatment_suggestions.map((treatment, idx) => (
                            <div key={idx} className="bg-gray-50 rounded p-3 text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{treatment.treatment_name}</span>
                                {treatment.success_rate && (
                                  <Badge variant="outline" className="text-xs">
                                    {treatment.success_rate}% success
                                  </Badge>
                                )}
                              </div>
                              <div className="text-gray-600 text-xs">
                                {treatment.description}
                              </div>
                              {treatment.citations.length > 0 && (
                                <div className="mt-1 text-xs text-blue-600">
                                  📚 {treatment.citations.length} supporting studies
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {suggestion.evidence_summary}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </div>
          </Tabs>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveTab('suggestions')}
                disabled={activeTab === 'suggestions'}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Suggestions
              </Button>
              <Button 
                onClick={applyFindings}
                disabled={selectedFindings.size === 0}
              >
                <Check className="h-4 w-4 mr-2" />
                Apply Selected ({selectedFindings.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}