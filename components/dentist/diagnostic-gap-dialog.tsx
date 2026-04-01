"use client"

/**
 * Diagnostic Gap Dialog
 *
 * Conversational gap-filling UI with batch optimization (Session 12):
 * 1. Shows current diagnosis with confidence percentage
 * 2. Presents one question at a time (highest priority first)
 * 3. Accepts text or voice input
 * 4. Fast-parses each answer with Gemini (~3s) — NO per-turn Claude call
 * 5. Shows estimated confidence delta (deterministic, instant)
 * 6. After all questions: single batch Claude re-synthesis (~80s)
 * 7. Displays final accurate diagnosis
 *
 * Optimization: ~482s → ~100s (80% faster, 92% fewer tokens)
 *
 * Phase 4.1 of Session 6 / Session 12: Batch Gap-Filling
 */

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Brain, Target, TrendingUp, Send, SkipForward, Mic, MicOff, Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { runPipelineAction, parseGapAnswerFastAction, processAllGapAnswersAction } from "@/lib/actions/consultation-pipeline"
import { useVoiceManager, MIC_PRIORITY } from "@/lib/contexts/voice-manager-context"

// Inline type definitions to avoid importing server-only agent modules in client component.

interface ConversationContext {
  chiefComplaint?: {
    primary_complaint: string
    patient_description?: string
    onset_duration?: string
    associated_symptoms?: string[]
    triggers?: string[]
  }
  hopi?: {
    pain_characteristics?: { quality: string; intensity: number; frequency: string; duration: string }
    aggravating_factors?: string[]
    relieving_factors?: string[]
    associated_symptoms?: string[]
    previous_treatments?: string[]
  }
  medicalHistory?: {
    medical_conditions?: string[]
    current_medications?: string[]
    allergies?: string[]
    previous_dental_treatments?: string[]
  }
  clinicalExamination?: {
    extraoral_findings?: string[]
    intraoral_findings?: string[]
    oral_hygiene?: string
    gingival_condition?: string
  }
  investigations?: {
    vitality_tests?: string
    percussion_test?: string
    palpation_test?: string
    radiographic_findings?: string
    radiographic_types?: string[]
    additional_tests?: string[]
  }
  restorationAssessment?: {
    caries_extent?: string
    surfaces_involved?: string[]
    existing_restoration?: string
    remaining_tooth_structure?: string
    cusp_involvement?: string[]
    ferrule_assessment?: string
    isolation_feasibility?: string
    esthetic_zone?: string
    occlusal_load?: string
    material_preference?: string
    restoration_type_preference?: string
  }
  confidence?: number
}

interface PrioritizedGapQuestion {
  question_id: string
  natural_language: string
  why_it_matters: string
  priority: number
  questionnaire_source: string
  diagnostic_weight: number
  track?: string
}

interface TreatmentOption {
  name: string
  description: string
  success_rate: number
  evidence_level: 'high' | 'moderate' | 'low'
  from_literature: boolean
  from_clinic_data: boolean
  indications: string[]
  contraindications: string[]
}

interface RestorativeDiagnosisOutput {
  primary: string
  caries_classification: string
  surfaces_involved: string[]
  caries_depth: string
  restoration_type: string
  restoration_material: string
  confidence: number
  treatment_options: TreatmentOption[]
  clinical_notes?: string
}

interface SynthesisOutput {
  primary_diagnosis: string
  differential_diagnoses: { diagnosis: string; probability: number }[]
  aae_classification: string
  diagnosis_confidence: number
  treatment_options: TreatmentOption[]
  recommended_treatment: string
  treatment_confidence: number
  needs_more_info: boolean
  priority_questions: PrioritizedGapQuestion[]
  literature_citations: any[]
  clinic_outcomes_summary: string
  prognosis: string
  prognosis_factors: string[]
  restorative_diagnosis?: RestorativeDiagnosisOutput
  combined_treatment_sequence?: string
}

interface PipelineResult {
  synthesis: SynthesisOutput
  checklistResults: any[]
  subspecialtyClassification: any
  gapAnalysis: any
  ragDocuments: any[]
  clinicalDataContext: any
  timing: { agentsMs: number; ragMs: number; synthesisMs: number; totalMs: number }
  hasRestorativeTrack?: boolean
  endoConfidence?: number
  restorativeConfidence?: number
  synthesisSessionId?: string
  conductorOutput?: {
    treatment_sequence: { step: number; track: string; treatment: string; timing: string; notes?: string }[]
    interaction_warnings: { tracks: string[]; warning: string; severity: 'info' | 'important' | 'critical' }[]
    overall_prognosis: string
    prognosis_grade: 'excellent' | 'good' | 'fair' | 'poor' | 'hopeless'
    conflicts: { description: string; resolution: string; affected_tracks: string[] }[]
    clinical_summary: string
    recommendation: 'proceed' | 'investigate_further' | 'refer_specialist'
    recommendation_reason?: string
  } | null
}

// =====================================================
// PROPS
// =====================================================

interface DiagnosticGapDialogProps {
  conversationContext: ConversationContext
  toothNumber: string
  patientId?: string
  consultationId?: string
  rawTranscript?: string
  patientAge?: number | null
  onDiagnosisAccepted?: (diagnosis: string) => void
  onTreatmentAccepted?: (treatment: string) => void
}

// =====================================================
// STATE TYPES
// =====================================================

type PipelinePhase =
  | 'idle'
  | 'running_pipeline'
  | 'showing_diagnosis'
  | 'asking_question'
  | 'parsing_answer'       // Fast Gemini parse (~3s)
  | 'batch_processing'     // Single Claude re-synthesis (~80s)
  | 'complete'

interface AnswerHistoryEntry {
  question: PrioritizedGapQuestion
  answer: string
  parsedValue: string
  confidenceDelta: number
  isPositiveFinding: boolean
}

// =====================================================
// COMPONENT
// =====================================================

export default function DiagnosticGapDialog({
  conversationContext,
  toothNumber,
  patientId,
  consultationId,
  rawTranscript,
  patientAge,
  onDiagnosisAccepted,
  onTreatmentAccepted,
}: DiagnosticGapDialogProps) {
  // Pipeline state
  const [phase, setPhase] = useState<PipelinePhase>('idle')
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [currentSynthesis, setCurrentSynthesis] = useState<SynthesisOutput | null>(null)
  const [initialDiagnosis, setInitialDiagnosis] = useState<SynthesisOutput | null>(null)

  // Gap-filling state (batch mode)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [remainingQuestions, setRemainingQuestions] = useState<PrioritizedGapQuestion[]>([])
  const [answerText, setAnswerText] = useState("")
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([])
  const [estimatedConfidence, setEstimatedConfidence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [batchTimeMs, setBatchTimeMs] = useState<number | null>(null)

  // Voice state
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const recognitionRef = useRef<any>(null)
  const voiceManager = useVoiceManager()

  // Dynamic MAX_QUESTIONS: scales with active tracks
  const activeTrackCount = pipelineResult?.gapAnalysis?.active_tracks?.length || 1
  const MAX_QUESTIONS = Math.min(8, 3 + activeTrackCount * 2)
  const CONFIDENCE_THRESHOLD = 85

  const inputRef = useRef<HTMLInputElement>(null)
  const submitAnswerRef = useRef<(() => void) | null>(null)
  const skipQuestionRef = useRef<(() => void) | null>(null)

  // Auto-focus input when asking
  useEffect(() => {
    if (phase === 'asking_question' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [phase, currentQuestionIndex])

  // ────────────────────────────────────────────
  // START PIPELINE
  // ────────────────────────────────────────────
  const startPipeline = useCallback(async () => {
    setPhase('running_pipeline')
    setError(null)
    setAnswerHistory([])
    setCurrentQuestionIndex(0)
    setBatchTimeMs(null)

    try {
      const result = await runPipelineAction({
        conversationContext,
        toothNumber,
        patientAge,
        patientId,
        consultationId,
        rawTranscript,
      })

      setPipelineResult(result as PipelineResult)
      setCurrentSynthesis(result.synthesis as SynthesisOutput)
      setInitialDiagnosis(result.synthesis as SynthesisOutput)
      setEstimatedConfidence(result.synthesis.diagnosis_confidence)

      // Session 20: Dispatch initial pipeline results so sidebar Gaps tab shows real gap questions
      window.dispatchEvent(new CustomEvent('endoflow:pipeline_initial_result', {
        detail: {
          synthesis: result.synthesis,
          gapAnalysis: result.gapAnalysis,
          priorityQuestions: result.synthesis.priority_questions || [],
          toothNumber,
          patientId,
          ragDocumentCount: result.ragDocuments?.length || 0,
        }
      }))

      if (result.synthesis.needs_more_info && result.synthesis.priority_questions.length > 0) {
        setRemainingQuestions(result.synthesis.priority_questions)
        setPhase('showing_diagnosis')
      } else {
        setPhase('complete')
      }
    } catch (err) {
      console.error('Pipeline failed:', err)
      setError(err instanceof Error ? err.message : 'Pipeline failed')
      setPhase('idle')
    }
  }, [conversationContext, toothNumber, patientAge, patientId, rawTranscript])

  // ────────────────────────────────────────────
  // VOICE INPUT
  // ────────────────────────────────────────────
  const startVoiceInput = useCallback(() => {
    const granted = voiceManager.requestMic('gap-dialog-voice', MIC_PRIORITY.GAP_DIALOG)
    if (!granted) {
      console.log('Mic request denied — another component has higher priority')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let final = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final) {
        const lower = final.toLowerCase().trim()
        if (lower === 'skip' || lower === 'skip question' || lower === 'next question' || lower === 'next') {
          stopVoiceInput()
          skipQuestionRef.current?.()
          return
        }
        if (lower === 'accept' || lower === 'accept diagnosis' || lower === 'done') {
          stopVoiceInput()
          // Trigger batch processing if we have answers
          if (answerHistory.length > 0) {
            runBatchSynthesis()
          } else if (currentSynthesis) {
            onDiagnosisAccepted?.(currentSynthesis.primary_diagnosis)
          }
          return
        }
        setAnswerText(prev => (prev + ' ' + final).trim())
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Voice error:', event.error)
      }
    }

    recognition.onend = () => {
      setIsVoiceActive(false)
      voiceManager.releaseMic('gap-dialog-voice')
      setInterimTranscript("")
      setTimeout(() => {
        if (inputRef.current && inputRef.current.value.trim()) {
          submitAnswerRef.current?.()
        }
      }, 300)
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsVoiceActive(true)
  }, [voiceManager, onDiagnosisAccepted, currentSynthesis, answerHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsVoiceActive(false)
    setInterimTranscript("")
    voiceManager.releaseMic('gap-dialog-voice')
  }, [voiceManager])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        voiceManager.releaseMic('gap-dialog-voice')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ────────────────────────────────────────────
  // SESSION 13: Auto-Voice Mode — TTS reads question, mic auto-activates
  // ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'asking_question') return
    const question = remainingQuestions[currentQuestionIndex]
    if (!question) return

    // Read the question aloud via TTS
    const readQuestion = async () => {
      try {
        const { speakWithTTS } = await import('@/lib/services/tts-service')
        const questionText = question.natural_language
        await speakWithTTS(questionText)
        // After TTS finishes speaking, auto-activate mic for answer
        setTimeout(() => {
          if (phase === 'asking_question' && !isVoiceActive) {
            startVoiceInput()
          }
        }, 500)
      } catch (e) {
        // TTS failed — activate mic anyway
        if (!isVoiceActive) startVoiceInput()
      }
    }

    readQuestion()
  }, [phase, currentQuestionIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Session 13: External voice command event listeners
  useEffect(() => {
    const handleAnswerGap = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.answer && phase === 'asking_question') {
        setAnswerText(detail.answer)
        setTimeout(() => submitAnswerRef.current?.(), 100)
      }
    }
    const handleSkipGap = () => {
      if (phase === 'asking_question') {
        skipQuestionRef.current?.()
      }
    }
    const handleRepeatGap = async () => {
      const question = remainingQuestions[currentQuestionIndex]
      if (question) {
        try {
          const { speakWithTTS } = await import('@/lib/services/tts-service')
          speakWithTTS(question.natural_language)
        } catch {}
      }
    }
    const handleCloseGap = () => {
      if (answerHistory.length > 0) {
        runBatchSynthesis()
      }
    }

    window.addEventListener('endoflow:answer_gap', handleAnswerGap)
    window.addEventListener('endoflow:skip_gap', handleSkipGap)
    window.addEventListener('endoflow:repeat_gap', handleRepeatGap)
    window.addEventListener('endoflow:close_gap_dialog', handleCloseGap)

    return () => {
      window.removeEventListener('endoflow:answer_gap', handleAnswerGap)
      window.removeEventListener('endoflow:skip_gap', handleSkipGap)
      window.removeEventListener('endoflow:repeat_gap', handleRepeatGap)
      window.removeEventListener('endoflow:close_gap_dialog', handleCloseGap)
    }
  }, [phase, currentQuestionIndex, answerHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // ────────────────────────────────────────────
  // SUBMIT ANSWER (Fast parse — Gemini ~3s, NO Claude)
  // ────────────────────────────────────────────
  const submitAnswer = useCallback(async () => {
    if (!answerText.trim() || !pipelineResult || !currentSynthesis) return

    const question = remainingQuestions[currentQuestionIndex]
    if (!question) return

    setPhase('parsing_answer')

    try {
      // Fast parse with Gemini (~3s)
      const parsed = await parseGapAnswerFastAction({
        question: {
          question_id: question.question_id,
          natural_language: question.natural_language,
          why_it_matters: question.why_it_matters,
          priority: question.priority,
          questionnaire_source: question.questionnaire_source,
          diagnostic_weight: question.diagnostic_weight,
          track: question.track,
        },
        rawAnswer: answerText,
      })

      // Update estimated confidence (deterministic, instant)
      const newEstimated = Math.min(95, estimatedConfidence + parsed.confidenceDelta)
      setEstimatedConfidence(newEstimated)

      // Record locally (no Claude call yet)
      setAnswerHistory(prev => [
        ...prev,
        {
          question,
          answer: answerText,
          parsedValue: parsed.parsedValue,
          confidenceDelta: parsed.confidenceDelta,
          isPositiveFinding: parsed.isPositiveFinding,
        },
      ])

      setAnswerText("")
      const nextIndex = currentQuestionIndex + 1

      // Check if we should stop collecting and trigger batch synthesis
      if (
        newEstimated >= CONFIDENCE_THRESHOLD ||
        nextIndex >= remainingQuestions.length ||
        nextIndex >= MAX_QUESTIONS
      ) {
        // All answers collected — run batch synthesis
        await runBatchSynthesisWithAnswers([
          ...answerHistory,
          {
            question,
            answer: answerText,
            parsedValue: parsed.parsedValue,
            confidenceDelta: parsed.confidenceDelta,
            isPositiveFinding: parsed.isPositiveFinding,
          },
        ])
      } else {
        setCurrentQuestionIndex(nextIndex)
        setPhase('asking_question')
      }
    } catch (err) {
      console.error('Fast parse failed:', err)
      setError('Failed to parse answer. Try again.')
      setPhase('asking_question')
    }
  }, [answerText, pipelineResult, currentSynthesis, remainingQuestions, currentQuestionIndex, estimatedConfidence, answerHistory, MAX_QUESTIONS, CONFIDENCE_THRESHOLD]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    submitAnswerRef.current = submitAnswer
  }, [submitAnswer])

  // ────────────────────────────────────────────
  // BATCH SYNTHESIS (Single Claude call — ~80s)
  // ────────────────────────────────────────────
  const runBatchSynthesisWithAnswers = useCallback(async (allAnswers: AnswerHistoryEntry[]) => {
    if (!pipelineResult || !initialDiagnosis) return

    setPhase('batch_processing')
    setError(null)

    try {
      const result = await processAllGapAnswersAction({
        answers: allAnswers.map(a => ({
          questionId: a.question.question_id,
          questionText: a.question.natural_language,
          rawAnswer: a.answer,
          parsedValue: a.parsedValue,
          track: a.question.track || 'endodontic',
        })),
        previousSynthesis: initialDiagnosis,
        toothNumber,
        patientId,
        consultationId,
        previousPipelineResult: pipelineResult,
      })

      setCurrentSynthesis(result.synthesis as SynthesisOutput)
      setBatchTimeMs(result.batchTimeMs)
      setPhase('complete')

      // Session 17: Dispatch synthesis results for sidebar copilot tabs
      window.dispatchEvent(new CustomEvent('endoflow:synthesis_complete', {
        detail: {
          synthesis: result.synthesis,
          toothNumber,
          patientId,
          batchTimeMs: result.batchTimeMs,
        }
      }))
    } catch (err) {
      console.error('Batch synthesis failed:', err)
      setError('Batch synthesis failed. Using estimated results.')
      setPhase('complete')
    }
  }, [pipelineResult, initialDiagnosis, toothNumber, patientId])

  // Voice "done" command handler
  const runBatchSynthesis = useCallback(() => {
    if (answerHistory.length > 0) {
      runBatchSynthesisWithAnswers(answerHistory)
    }
  }, [answerHistory, runBatchSynthesisWithAnswers])

  // Skip question
  const skipQuestion = useCallback(() => {
    const nextIndex = currentQuestionIndex + 1
    if (nextIndex >= remainingQuestions.length || nextIndex >= MAX_QUESTIONS) {
      // All done — run batch if we have any answers
      if (answerHistory.length > 0) {
        runBatchSynthesisWithAnswers(answerHistory)
      } else {
        setPhase('complete')
      }
    } else {
      setCurrentQuestionIndex(nextIndex)
      setAnswerText("")
    }
  }, [currentQuestionIndex, remainingQuestions, MAX_QUESTIONS, answerHistory, runBatchSynthesisWithAnswers])

  useEffect(() => {
    skipQuestionRef.current = skipQuestion
  }, [skipQuestion])

  const startGapFilling = useCallback(() => {
    setPhase('asking_question')
  }, [])

  // ────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* IDLE — Start button */}
      {phase === 'idle' && (
        <div className="text-center py-8">
          <Brain className="h-12 w-12 text-teal-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">Unified AI Diagnosis</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            Multi-agent pipeline: analyzes conversation, checks clinical checklists,
            retrieves evidence, and generates diagnosis with treatment plan.
          </p>
          <Button onClick={startPipeline} className="bg-teal-600 hover:bg-teal-700">
            <Sparkles className="h-4 w-4 mr-2" />
            Run AI Diagnosis Pipeline
          </Button>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      )}

      {/* RUNNING — Progress */}
      {phase === 'running_pipeline' && (
        <div className="text-center py-8">
          <Loader2 className="h-10 w-10 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Running multi-agent pipeline...</p>
          <p className="text-xs text-gray-400 mt-1">Analyzing checklists, classifying subspecialty, finding gaps...</p>
        </div>
      )}

      {/* SHOWING DIAGNOSIS (before gap-filling starts) */}
      {phase === 'showing_diagnosis' && currentSynthesis && (
        <div className="space-y-4">
          <DiagnosisSummaryCard synthesis={currentSynthesis} hasRagEvidence={pipelineResult ? (pipelineResult.ragDocuments?.length || 0) > 0 : undefined} />
          {remainingQuestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {remainingQuestions.length} gap{remainingQuestions.length > 1 ? 's' : ''} detected
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Answer a few quick questions to improve diagnosis confidence from {currentSynthesis.diagnosis_confidence}%
                  </p>
                  <Button
                    onClick={startGapFilling}
                    size="sm"
                    className="mt-3 bg-amber-600 hover:bg-amber-700"
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Answer Questions
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ASKING / PARSING (fast Gemini, ~3s per answer) */}
      {(phase === 'asking_question' || phase === 'parsing_answer') && currentSynthesis && (
        <div className="space-y-4">
          {/* Compact diagnosis header with ESTIMATED confidence */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <span className="text-sm font-medium">{currentSynthesis.primary_diagnosis}</span>
              <span className="text-xs text-gray-500 ml-2">{currentSynthesis.aae_classification}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 uppercase">Estimated</span>
              <ConfidenceBadge value={Math.round(estimatedConfidence)} estimated />
            </div>
          </div>

          {/* Estimated confidence bar */}
          <div className="px-1">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Estimated confidence</span>
              <span className="tabular-nums">{Math.round(estimatedConfidence)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  estimatedConfidence >= 85 ? "bg-green-500" :
                  estimatedConfidence >= 60 ? "bg-yellow-500" :
                  "bg-red-400"
                )}
                style={{ width: `${Math.min(100, estimatedConfidence)}%` }}
              />
            </div>
          </div>

          {/* Answer history */}
          {answerHistory.length > 0 && (
            <div className="space-y-1">
              {answerHistory.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="truncate">{entry.question.natural_language}</span>
                  <span className={cn(
                    "font-medium whitespace-nowrap",
                    entry.isPositiveFinding ? "text-amber-600" : "text-green-600"
                  )}>
                    +{entry.confidenceDelta}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Current question */}
          {remainingQuestions[currentQuestionIndex] && (
            <Card className="border-teal-200 bg-teal-50/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                    Q{currentQuestionIndex + 1}/{Math.min(remainingQuestions.length, MAX_QUESTIONS)}
                  </span>
                  {remainingQuestions[currentQuestionIndex].track && (
                    <TrackBadge track={remainingQuestions[currentQuestionIndex].track || 'endodontic'} />
                  )}
                  <span className="text-xs text-gray-400">
                    {remainingQuestions[currentQuestionIndex].questionnaire_source}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 mt-2">
                  {remainingQuestions[currentQuestionIndex].natural_language}
                </p>
                <p className="text-xs text-gray-500 mt-1 italic">
                  {remainingQuestions[currentQuestionIndex].why_it_matters}
                </p>

                {/* Answer input with voice */}
                <div className="flex gap-2 mt-3">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={isVoiceActive ? (answerText + (interimTranscript ? ` ${interimTranscript}` : '')).trim() : answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={isVoiceActive ? "Listening... speak your answer" : "Type or tap mic to answer..."}
                      disabled={phase !== 'asking_question'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && answerText.trim()) submitAnswer()
                      }}
                      className={cn("text-sm pr-10", isVoiceActive && "border-teal-400 bg-teal-50")}
                    />
                    {isVoiceActive && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={isVoiceActive ? stopVoiceInput : startVoiceInput}
                    disabled={phase !== 'asking_question'}
                    size="sm"
                    variant={isVoiceActive ? "default" : "outline"}
                    className={cn(isVoiceActive && "bg-red-500 hover:bg-red-600")}
                    title={isVoiceActive ? "Stop listening" : "Answer by voice"}
                  >
                    {isVoiceActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={submitAnswer}
                    disabled={!answerText.trim() || phase !== 'asking_question'}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {phase === 'parsing_answer' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    onClick={skipQuestion}
                    disabled={phase !== 'asking_question'}
                    size="sm"
                    variant="ghost"
                    title="Skip this question"
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                {phase === 'parsing_answer' && (
                  <p className="text-xs text-teal-600 mt-1 animate-pulse">Parsing answer...</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* "Done early" button — lets dentist trigger batch before all questions */}
          {answerHistory.length >= 2 && phase === 'asking_question' && (
            <Button
              onClick={runBatchSynthesis}
              variant="outline"
              size="sm"
              className="w-full border-teal-300 text-teal-700 hover:bg-teal-50"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Done — Finalize Diagnosis ({answerHistory.length} answers)
            </Button>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      )}

      {/* BATCH PROCESSING (single Claude re-synthesis, ~60-90s) */}
      {phase === 'batch_processing' && (
        <div className="space-y-4">
          {/* Keep diagnosis visible */}
          {currentSynthesis && (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 opacity-75">
              <div>
                <span className="text-sm font-medium">{currentSynthesis.primary_diagnosis}</span>
                <span className="text-xs text-gray-500 ml-2">{currentSynthesis.aae_classification}</span>
              </div>
              <ConfidenceBadge value={Math.round(estimatedConfidence)} estimated />
            </div>
          )}

          {/* Processing indicator */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <Brain className="h-10 w-10 text-blue-500 mx-auto mb-3 animate-pulse" />
                <p className="text-sm font-medium text-blue-800">
                  Analyzing all {answerHistory.length} responses...
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Running final diagnostic synthesis with complete clinical picture
                </p>

                {/* Animated progress bar */}
                <div className="h-2 bg-blue-200 rounded-full overflow-hidden mt-4 mx-auto max-w-xs">
                  <div className="h-full bg-blue-500 rounded-full animate-progress" />
                </div>

                <p className="text-xs text-blue-400 mt-3">
                  This takes about 60-90 seconds
                </p>
              </div>

              {/* Show collected answers summary */}
              <div className="mt-4 space-y-1">
                {answerHistory.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-blue-700">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="truncate">{entry.parsedValue}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* COMPLETE */}
      {phase === 'complete' && currentSynthesis && (
        <div className="space-y-4">
          <DiagnosisSummaryCard synthesis={currentSynthesis} hasRagEvidence={pipelineResult ? (pipelineResult.ragDocuments?.length || 0) > 0 : undefined} />

          {/* Confidence journey */}
          {answerHistory.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Confidence: {initialDiagnosis?.diagnosis_confidence ?? 0}% → {currentSynthesis.diagnosis_confidence}%
                </span>
                {batchTimeMs && (
                  <span className="text-xs text-green-500 ml-auto">
                    {Math.round(batchTimeMs / 1000)}s synthesis
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {answerHistory.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="truncate flex-1">{entry.parsedValue}</span>
                    {entry.question.track && <TrackBadge track={entry.question.track} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Treatment options */}
          {currentSynthesis.treatment_options.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Treatment Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentSynthesis.treatment_options.map((t, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer hover:border-teal-400 transition",
                      t.name === currentSynthesis.recommended_treatment
                        ? "border-teal-500 bg-teal-50"
                        : "border-gray-200"
                    )}
                    onClick={() => onTreatmentAccepted?.(t.name)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          t.evidence_level === 'high' ? "bg-green-100 text-green-700" :
                          t.evidence_level === 'moderate' ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        )}>
                          {t.evidence_level}
                        </span>
                        {t.success_rate > 0 && (
                          <span className="text-xs text-gray-500">{t.success_rate}%</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    {t.name === currentSynthesis.recommended_treatment && (
                      <span className="text-xs text-teal-600 font-medium mt-1 inline-block">Recommended</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Prognosis */}
          {currentSynthesis.prognosis && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <span className="font-medium text-gray-700">Prognosis: </span>
              {currentSynthesis.prognosis}
            </div>
          )}

          {/* Restorative diagnosis */}
          {currentSynthesis.restorative_diagnosis && (
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4 text-green-600" />
                  Restorative Diagnosis
                  <ConfidenceBadge value={currentSynthesis.restorative_diagnosis.confidence} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Classification:</span>
                    <span className="ml-1 font-medium">{currentSynthesis.restorative_diagnosis.caries_classification}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Surfaces:</span>
                    <span className="ml-1 font-medium text-red-600">{currentSynthesis.restorative_diagnosis.surfaces_involved.join('')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Depth:</span>
                    <span className="ml-1 font-medium">{currentSynthesis.restorative_diagnosis.caries_depth.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Material:</span>
                    <span className="ml-1 font-medium">{currentSynthesis.restorative_diagnosis.restoration_material}</span>
                  </div>
                </div>
                {currentSynthesis.restorative_diagnosis.treatment_options.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {currentSynthesis.restorative_diagnosis.treatment_options.map((t, i) => (
                      <div
                        key={i}
                        className="p-2 rounded border border-green-200 hover:border-green-400 cursor-pointer text-xs"
                        onClick={() => onTreatmentAccepted?.(t.name)}
                      >
                        <span className="font-medium">{t.name}</span>
                        {t.success_rate > 0 && <span className="text-gray-500 ml-2">{t.success_rate}%</span>}
                      </div>
                    ))}
                  </div>
                )}
                {currentSynthesis.restorative_diagnosis.clinical_notes && (
                  <p className="text-xs text-gray-500 italic">{currentSynthesis.restorative_diagnosis.clinical_notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Conductor Output (N-track) */}
          {pipelineResult?.conductorOutput && (
            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  Unified Treatment Plan
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    pipelineResult.conductorOutput.prognosis_grade === 'excellent' || pipelineResult.conductorOutput.prognosis_grade === 'good'
                      ? "bg-green-100 text-green-700"
                      : pipelineResult.conductorOutput.prognosis_grade === 'fair'
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  )}>
                    Prognosis: {pipelineResult.conductorOutput.prognosis_grade}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  {pipelineResult.conductorOutput.treatment_sequence.map((step) => (
                    <div key={step.step} className="flex items-start gap-2 text-xs">
                      <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 font-bold">
                        {step.step}
                      </span>
                      <div>
                        <span className="font-medium">{step.treatment}</span>
                        <span className="text-gray-400 ml-1">({step.timing})</span>
                        {step.notes && <p className="text-gray-500 italic">{step.notes}</p>}
                      </div>
                      <TrackBadge track={step.track} />
                    </div>
                  ))}
                </div>

                {pipelineResult.conductorOutput.interaction_warnings.length > 0 && (
                  <div className="space-y-1">
                    {pipelineResult.conductorOutput.interaction_warnings.map((w, i) => (
                      <div key={i} className={cn(
                        "text-xs rounded p-2",
                        w.severity === 'critical' ? "bg-red-50 text-red-700 border border-red-200" :
                        w.severity === 'important' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-gray-50 text-gray-600"
                      )}>
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {w.warning}
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500">{pipelineResult.conductorOutput.clinical_summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Fallback: Combined treatment sequence without conductor */}
          {!pipelineResult?.conductorOutput && currentSynthesis.combined_treatment_sequence && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span className="text-xs font-medium text-blue-800">Treatment Sequence: </span>
              <span className="text-xs text-blue-700">{currentSynthesis.combined_treatment_sequence}</span>
            </div>
          )}

          {/* Accept buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onDiagnosisAccepted?.(currentSynthesis.primary_diagnosis)
                if (currentSynthesis.restorative_diagnosis) {
                  onTreatmentAccepted?.(currentSynthesis.combined_treatment_sequence || currentSynthesis.recommended_treatment)
                }
              }}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              size="sm"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {currentSynthesis.restorative_diagnosis ? 'Accept Both Diagnoses' : 'Accept Diagnosis'}
            </Button>
            <Button
              onClick={() => {
                setPhase('idle')
                setPipelineResult(null)
                setCurrentSynthesis(null)
                setInitialDiagnosis(null)
                setAnswerHistory([])
                setBatchTimeMs(null)
              }}
              variant="outline"
              size="sm"
            >
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function DiagnosisSummaryCard({ synthesis, hasRagEvidence }: { synthesis: SynthesisOutput; hasRagEvidence?: boolean }) {
  return (
    <Card className="border-teal-200">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-base font-semibold">{synthesis.primary_diagnosis}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{synthesis.aae_classification}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ConfidenceBadge value={synthesis.diagnosis_confidence} />
            {/* Session 20: Evidence source indicator */}
            {hasRagEvidence !== undefined && (
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                hasRagEvidence
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              )}>
                {hasRagEvidence ? 'Literature-backed' : 'AI knowledge only'}
              </span>
            )}
          </div>
        </div>

        {/* Session 20: Warning when no RAG evidence */}
        {hasRagEvidence === false && (
          <div className="flex items-start gap-2 p-2 mb-2 rounded-md bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              This diagnosis was generated using AI clinical knowledge without specific literature references.
              Consider verifying key findings with clinical guidelines.
            </p>
          </div>
        )}

        {synthesis.differential_diagnoses.length > 0 && (
          <div className="mt-2">
            <span className="text-xs font-medium text-gray-600">Differentials:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {synthesis.differential_diagnoses.map((d, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {d.diagnosis} ({d.probability}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {synthesis.recommended_treatment && (
          <div className="mt-3 pt-2 border-t">
            <span className="text-xs font-medium text-gray-600">Recommended: </span>
            <span className="text-sm text-teal-700 font-medium">{synthesis.recommended_treatment}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ConfidenceBadge({ value, estimated }: { value: number; estimated?: boolean }) {
  const color =
    value >= 85 ? "bg-green-100 text-green-700 border-green-300" :
    value >= 60 ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
    "bg-red-100 text-red-700 border-red-300"

  return (
    <div className={cn(
      "px-2.5 py-1 rounded-full border text-xs font-bold tabular-nums",
      color,
      estimated && "border-dashed"
    )}>
      {estimated && "~"}{value}%
    </div>
  )
}

/** N-track badge with dynamic colors */
const TRACK_COLORS: Record<string, { bg: string; text: string }> = {
  endodontic: { bg: 'bg-purple-100', text: 'text-purple-700' },
  restorative: { bg: 'bg-green-100', text: 'text-green-700' },
  periodontal: { bg: 'bg-blue-100', text: 'text-blue-700' },
  prosthodontic: { bg: 'bg-amber-100', text: 'text-amber-700' },
  surgical: { bg: 'bg-red-100', text: 'text-red-700' },
  trauma: { bg: 'bg-orange-100', text: 'text-orange-700' },
}

const TRACK_LABELS: Record<string, string> = {
  endodontic: 'Endo',
  restorative: 'Rest',
  periodontal: 'Perio',
  prosthodontic: 'Prosth',
  surgical: 'Surg',
  trauma: 'Trauma',
}

function TrackBadge({ track }: { track: string }) {
  const colors = TRACK_COLORS[track] || { bg: 'bg-gray-100', text: 'text-gray-700' }
  const label = TRACK_LABELS[track] || track
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", colors.bg, colors.text)}>
      {label}
    </span>
  )
}
