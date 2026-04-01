'use client'

/**
 * Sidebar Chat Panel — Voice + Text AI Command Center
 *
 * Session 12: Created as text-only chat
 * Session 13: Reverted to text-only (voice restored to floating controller)
 * Session 14: FULL VOICE UPGRADE — mic button, live transcript, TTS,
 *             agent activity panel, streaming conductor steps
 *
 * This is now the SINGLE AI interface. The floating controller is stripped
 * to a MicPod (pure audio capture) that feeds transcripts here via CustomEvent.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Send, Loader2, Sparkles, User, Bot, Trash2,
  Mic, MicOff, Volume2, VolumeX, ChevronDown, ChevronUp, ChevronRight,
  CheckCircle2, XCircle, Circle, Loader,
  Square, Pause, Play, Brain, X as XIcon,
  Stethoscope, Pill, AlertTriangle, BookOpen, ExternalLink,
} from 'lucide-react'
// NOTE: Server action processEndoFlowQuery deadlocks due to cookies() in Next.js 15.
// Use the API route instead which runs in Route Handler context where cookies() works.
// import { processEndoFlowQuery } from '@/lib/actions/endoflow-master'
import { speakWithTTS } from '@/lib/services/tts-service'
import { useAgentStream, type AgentStreamState } from '@/lib/hooks/use-agent-stream'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  agentName?: string
  isVoice?: boolean
  actionData?: Record<string, any> // Session 15: structured data from AI (candidates, patient list)
}

// ─── SessionStorage Helpers ─────────────────────────────
const STORAGE_KEY_MESSAGES = 'endoflow_chat_messages'
const STORAGE_KEY_CONVERSATION = 'endoflow_conversation_id'

function loadMessagesFromStorage(): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY_MESSAGES)
    if (!stored) return []
    const parsed = JSON.parse(stored) as any[]
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
  } catch { return [] }
}

function saveMessagesToStorage(messages: ChatMessage[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages))
  } catch { /* storage full — silently fail */ }
}

function loadConversationFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(STORAGE_KEY_CONVERSATION)
}

function saveConversationToStorage(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) sessionStorage.setItem(STORAGE_KEY_CONVERSATION, id)
  else sessionStorage.removeItem(STORAGE_KEY_CONVERSATION)
}

interface AgentStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
}

type PanelMode = 'master' | 'copilot'
type CopilotTab = 'diagnosis' | 'treatment' | 'gaps' | 'evidence'

interface SidebarChatPanelProps {
  onActionCommand?: (command: any) => void
  dentistId?: string
  /** Session 18: When true, renders inside mobile bottom Sheet — larger touch targets */
  isMobileSheet?: boolean
  /** Session 20: When true, restore copilot mode on mount (for mobile Sheet re-open) */
  restoreCopilotMode?: boolean
}

// ─── Component ───────────────────────────────────────────

export function SidebarChatPanel({ onActionCommand, dentistId, isMobileSheet = false, restoreCopilotMode = false }: SidebarChatPanelProps) {
  // Chat state — Session 15: hydrate from sessionStorage to survive sidebar collapse
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessagesFromStorage())
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(() => loadConversationFromStorage())

  // Voice state — check if mic is already active on mount (e.g. MicPod started
  // before sidebar expanded, so we missed the endoflow:mic_started event)
  const [isMicActive, setIsMicActive] = useState(() => {
    // Check singleton state from use-mic-manager module
    if (typeof window !== 'undefined') {
      return (window as any).__endoflow_mic_active === true
    }
    return false
  })
  const [liveTranscript, setLiveTranscript] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(true) // TTS on/off
  const [selectedLanguage, setSelectedLanguage] = useState<'en-US' | 'en-IN' | 'hi-IN'>('en-US')

  // Session 16: Block sidebar voice during clinical recording (mic handoff)
  const [isConsultationRecording, setIsConsultationRecording] = useState(false)
  const isConsultationRecordingRef = useRef(false)

  // Session 17: Panel mode — Master AI ↔ Clinical Co-Pilot
  const [panelMode, setPanelMode] = useState<PanelMode>('master')
  const [copilotTab, setCopilotTab] = useState<CopilotTab>('diagnosis')
  const [modeTransition, setModeTransition] = useState(false) // flash animation
  const [copilotRecordingDuration, setCopilotRecordingDuration] = useState(0)
  const [copilotSegmentCount, setCopilotSegmentCount] = useState(0)
  const [copilotIsPaused, setCopilotIsPaused] = useState(false)
  const copilotDurationRef = useRef<NodeJS.Timeout | null>(null)

  // Session 17: AI pipeline results for copilot tabs
  const [aiResults, setAiResults] = useState<{
    processedContent: any | null
    toothDiagnoses: any[]
  }>({ processedContent: null, toothDiagnoses: [] })
  const [synthesisResult, setSynthesisResult] = useState<any | null>(null) // Full synthesis from diagnostic pipeline
  const [gapQuestionSpoken, setGapQuestionSpoken] = useState<Set<string>>(new Set())
  // Session 20: Real pipeline gap questions (from gap-finder agent, replaces hardcoded checks)
  const [pipelineGapQuestions, setPipelineGapQuestions] = useState<any[]>([])
  // Session 18: Evidence citations from consultation_evidence table
  const [evidenceCitations, setEvidenceCitations] = useState<any[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  // Session 18: Track active tooth + patient for copilot accept/multi-tooth
  const [copilotToothNumber, setCopilotToothNumber] = useState<string | null>(null)
  const [copilotPatientId, setCopilotPatientId] = useState<string | null>(null)
  const [copilotConsultationId, setCopilotConsultationId] = useState<string | null>(null)
  const [acceptSaving, setAcceptSaving] = useState(false)
  const [acceptSaved, setAcceptSaved] = useState(false)
  // Session 18: Copilot input state
  const [copilotInput, setCopilotInput] = useState('')
  const [copilotInputProcessing, setCopilotInputProcessing] = useState(false)

  // Agent activity state
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [showAgentActivity, setShowAgentActivity] = useState(false)

  // Conductor streaming hook
  const agentStream = useAgentStream()

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isMicActiveRef = useRef(false)
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const finalTranscriptRef = useRef('')

  // Keep mic ref in sync
  useEffect(() => { isMicActiveRef.current = isMicActive }, [isMicActive])
  useEffect(() => { isConsultationRecordingRef.current = isConsultationRecording }, [isConsultationRecording])

  // Session 20: Restore copilot mode when mobile Sheet re-opens
  useEffect(() => {
    if (restoreCopilotMode && panelMode !== 'copilot') {
      console.log('🔄 [SIDEBAR] Restoring copilot mode on Sheet re-open')
      setPanelMode('copilot')
      // Check if recording is still active (GlobalVoiceRecorder singleton)
      const isRecActive = !!(window as any).__endoflow_recording_active
      setIsConsultationRecording(isRecActive)
      setCopilotIsPaused(!isRecActive)
    }
  }, [restoreCopilotMode]) // Only run on mount / prop change

  // Session 16+17: Track recording state — block sidebar voice + switch panel mode
  // Listen for BOTH start_recording (early signal from page) AND recording_started (confirmation from recorder)
  useEffect(() => {
    const switchToCopilot = () => {
      if (panelMode === 'copilot') return // already in copilot mode
      console.log('🔇 [SIDEBAR] Switching to Co-Pilot mode')
      setIsConsultationRecording(true)
      setPanelMode('copilot')
      setCopilotIsPaused(false)
      setModeTransition(true)
      setTimeout(() => setModeTransition(false), 600)
      // Start local timer for copilot display
      const start = Date.now()
      if (copilotDurationRef.current) clearInterval(copilotDurationRef.current)
      copilotDurationRef.current = setInterval(() => {
        setCopilotRecordingDuration(Date.now() - start)
      }, 1000)
    }

    const handleStartRecording = () => {
      // Only switch to copilot if GlobalVoiceRecorder will handle it (consultation context)
      // Check if there's an active consultation command in session storage
      const cmd = sessionStorage.getItem('endoflow_consultation_command')
      if (cmd) {
        console.log('🎤 [SIDEBAR] start_recording event + consultation context — switch to Co-Pilot')
        switchToCopilot()
      } else {
        console.log('🎤 [SIDEBAR] start_recording event but no consultation context — staying in Master')
      }
    }
    const handleRecStarted = () => {
      console.log('🎤 [SIDEBAR] recording_started event — confirming Co-Pilot mode')
      switchToCopilot()
    }
    const handleRecStopped = () => {
      console.log('🎤 [SIDEBAR] Clinical recording stopped — staying in Co-Pilot for results review')
      setIsConsultationRecording(false)
      // Session 17 fix: Do NOT switch back to master here — dentist needs to review AI results,
      // process the recording, and potentially generate PDF. Stay in copilot mode.
      // The copilot panel will show a "Back to Master AI" button for explicit dismissal.
      setCopilotIsPaused(true) // Mark as stopped (not paused, but recording ended)
      if (copilotDurationRef.current) {
        clearInterval(copilotDurationRef.current)
        copilotDurationRef.current = null
      }
    }
    window.addEventListener('endoflow:start_recording', handleStartRecording)
    window.addEventListener('endoflow:recording_started', handleRecStarted)
    window.addEventListener('endoflow:recording_stopped', handleRecStopped)
    return () => {
      window.removeEventListener('endoflow:start_recording', handleStartRecording)
      window.removeEventListener('endoflow:recording_started', handleRecStarted)
      window.removeEventListener('endoflow:recording_stopped', handleRecStopped)
      if (copilotDurationRef.current) clearInterval(copilotDurationRef.current)
    }
  }, [panelMode])

  // Session 17: Listen for AI pipeline results to populate copilot tabs
  useEffect(() => {
    const handleAiResults = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) {
        console.log('🧠 [COPILOT] AI transcript results received:', {
          hasContent: !!detail.processedContent,
          toothCount: detail.toothDiagnoses?.length || 0,
        })
        setAiResults({
          processedContent: detail.processedContent,
          toothDiagnoses: detail.toothDiagnoses || [],
        })
        // Session 18: Capture consultation context from ai results
        if (detail.consultationId) setCopilotConsultationId(detail.consultationId)
        if (detail.patientId) setCopilotPatientId(detail.patientId)
      }
    }
    // Session 17: Listen for full synthesis results from diagnostic pipeline
    const handleSynthesisComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.synthesis) {
        console.log('🧬 [COPILOT] Synthesis complete:', {
          diagnosis: detail.synthesis.primary_diagnosis,
          confidence: detail.synthesis.diagnosis_confidence,
          tooth: detail.toothNumber,
        })
        setSynthesisResult(detail.synthesis)
        setAcceptSaved(false) // Reset accept state for new synthesis
        // Session 18: Track tooth/patient for Accept button
        if (detail.toothNumber) setCopilotToothNumber(detail.toothNumber)
        if (detail.patientId) setCopilotPatientId(detail.patientId)
      }
    }
    // Session 18: Listen for tooth selection events from FDI chart
    const handleToothSelected = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.toothNumber) {
        setCopilotToothNumber(detail.toothNumber)
      }
    }
    // Session 20: Listen for initial pipeline results (gap questions from gap-finder agent)
    const handlePipelineInitial = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.priorityQuestions?.length > 0) {
        console.log('🔎 [COPILOT] Pipeline gap questions received:', detail.priorityQuestions.length)
        setPipelineGapQuestions(detail.priorityQuestions)
        setGapQuestionSpoken(new Set()) // Reset spoken state for new questions
      }
      // Also set initial synthesis result if not already set
      if (detail?.synthesis && !synthesisResult) {
        setSynthesisResult(detail.synthesis)
      }
    }
    window.addEventListener('endoflow:ai_results_ready', handleAiResults)
    window.addEventListener('endoflow:synthesis_complete', handleSynthesisComplete)
    window.addEventListener('endoflow:tooth_selected', handleToothSelected)
    window.addEventListener('endoflow:pipeline_initial_result', handlePipelineInitial)
    return () => {
      window.removeEventListener('endoflow:ai_results_ready', handleAiResults)
      window.removeEventListener('endoflow:synthesis_complete', handleSynthesisComplete)
      window.removeEventListener('endoflow:tooth_selected', handleToothSelected)
      window.removeEventListener('endoflow:pipeline_initial_result', handlePipelineInitial)
    }
  }, [])

  // Session 15: Persist messages to sessionStorage on change
  useEffect(() => { saveMessagesToStorage(messages) }, [messages])
  useEffect(() => { saveConversationToStorage(conversationId) }, [conversationId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, liveTranscript, agentSteps])

  // ─── Mic transcript listener (from MicPod via CustomEvent) ──────
  useEffect(() => {
    const handleTranscript = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      // Session 16: Don't process voice transcripts during clinical recording
      if (isConsultationRecordingRef.current) return

      if (detail.isFinal && detail.text.trim()) {
        // Final transcript — accumulate
        finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + detail.text).trim()
        setLiveTranscript(finalTranscriptRef.current)

        // Session 16: Reset auto-submit timer (5s silence + 3-word minimum to reduce ambient noise)
        if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = setTimeout(() => {
          const text = finalTranscriptRef.current.trim()
          if (isMicActiveRef.current && text && text.split(/\s+/).length >= 3) {
            handleVoiceSubmit(text)
          }
        }, 5000)
      } else if (!detail.isFinal) {
        // Interim transcript — show live
        setLiveTranscript(finalTranscriptRef.current + ' ' + detail.text)
      }
    }

    const handleUtteranceEnd = () => {
      // Session 16: Deepgram detected end of speech — submit after delay, with 4-word minimum
      // Increased to 3.5s to avoid cutting off mid-thought pauses
      const text = finalTranscriptRef.current.trim()
      if (text && text.split(/\s+/).length >= 4) {
        if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = setTimeout(() => {
          if (isMicActiveRef.current && finalTranscriptRef.current.trim()) {
            handleVoiceSubmit(finalTranscriptRef.current.trim())
          }
        }, 3500)
      }
    }

    const handleMicStarted = () => setIsMicActive(true)
    const handleMicStopped = () => {
      setIsMicActive(false)
      setLiveTranscript('')
    }

    // Session 17: Stop sidebar mic immediately when mic handoff happens
    const handleMicDeactivate = () => {
      console.log('🔇 [SIDEBAR] mic_deactivate received — clearing sidebar voice state')
      setIsMicActive(false)
      setLiveTranscript('')
      finalTranscriptRef.current = ''
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = null
      }
    }

    window.addEventListener('endoflow:mic_transcript', handleTranscript)
    window.addEventListener('endoflow:mic_utterance_end', handleUtteranceEnd)
    window.addEventListener('endoflow:mic_started', handleMicStarted)
    window.addEventListener('endoflow:mic_stopped', handleMicStopped)
    window.addEventListener('endoflow:mic_deactivate', handleMicDeactivate)

    return () => {
      window.removeEventListener('endoflow:mic_transcript', handleTranscript)
      window.removeEventListener('endoflow:mic_utterance_end', handleUtteranceEnd)
      window.removeEventListener('endoflow:mic_started', handleMicStarted)
      window.removeEventListener('endoflow:mic_stopped', handleMicStopped)
      window.removeEventListener('endoflow:mic_deactivate', handleMicDeactivate)
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Agent stream step updates → agent activity panel ───
  useEffect(() => {
    if (agentStream.steps.length > 0) {
      setAgentSteps(agentStream.steps)
      setShowAgentActivity(true)
    }
    if (agentStream.finalResult) {
      // Auto-hide activity panel after 5s
      setTimeout(() => setShowAgentActivity(false), 5000)
    }
  }, [agentStream.steps, agentStream.finalResult])

  // TTS speak queue from conductor
  useEffect(() => {
    if (agentStream.speakQueue.length > 0 && voiceEnabled) {
      const text = agentStream.speakQueue[0]
      speakWithTTS(text, {
        language: selectedLanguage,
        onEnd: () => agentStream.clearSpeakItem(),
        onError: () => agentStream.clearSpeakItem(),
      })
    }
  }, [agentStream.speakQueue, voiceEnabled, selectedLanguage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Submit handlers ───────────────────────────────────

  const handleVoiceSubmit = useCallback(async (transcript: string) => {
    // Session 16: Don't send voice to sidebar AI during clinical recording
    if (isConsultationRecordingRef.current) return
    // Clear live transcript
    setLiveTranscript('')
    finalTranscriptRef.current = ''
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current)
      autoSubmitTimerRef.current = null
    }

    // Process as voice input
    await processQuery(transcript, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTextSubmit = useCallback(async () => {
    const query = inputValue.trim()
    if (!query || isProcessing) return
    setInputValue('')
    await processQuery(query, false)
  }, [inputValue, isProcessing]) // eslint-disable-line react-hooks/exhaustive-deps

  async function processQuery(query: string, isVoice: boolean) {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
      isVoice,
    }
    setMessages(prev => [...prev, userMsg])
    setIsProcessing(true)

    try {
      // Use API route instead of server action to avoid cookies() deadlock in Next.js 15
      const res = await fetch('/api/endoflow/process-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          conversationId,
          language: selectedLanguage,
          isVoiceInput: isVoice,
        }),
      })
      const result = await res.json()

      if (result.success && result.response) {
        // Session 15: Extract actionData from agent responses (candidates, patient lists)
        let actionData: Record<string, any> | undefined
        const agentData = result.agentResponses?.[0]?.data
        if (agentData?.action === 'patient_selection_confirm' || agentData?.action === 'patient_selection_prompt') {
          actionData = agentData
        }
        // Also check actionCommand for candidate data
        if (result.actionCommand?.action === 'patient_selection_confirm') {
          actionData = result.actionCommand
        }

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          agentName: result.agentResponses?.[0]?.agentName,
          actionData,
        }
        setMessages(prev => [...prev, assistantMsg])
        if (result.conversationId) setConversationId(result.conversationId)

        // TTS for voice responses
        if (isVoice && voiceEnabled) {
          speakWithTTS(result.response, { language: selectedLanguage })
        }

        // Handle action commands
        if (result.actionCommand && onActionCommand) {
          onActionCommand(result.actionCommand)
        }

        // Update agent activity from conductor responses
        const conductorAgent = result.agentResponses?.find((r: any) => r.agentName === 'MCPConductor')
        if (conductorAgent?.data?.steps) {
          setAgentSteps(conductorAgent.data.steps)
          setShowAgentActivity(true)
          setTimeout(() => setShowAgentActivity(false), 5000)
        }
      } else {
        const errorMsg: ChatMessage = {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: result.error || 'Sorry, something went wrong.',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMsg])
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Connection error. Please check your network.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTextSubmit()
    }
  }

  const toggleMic = () => {
    if (isMicActive) {
      window.dispatchEvent(new CustomEvent('endoflow:mic_deactivate'))
    } else {
      window.dispatchEvent(new CustomEvent('endoflow:mic_activate'))
    }
  }

  const clearChat = () => {
    setMessages([])
    setConversationId(null)
    setAgentSteps([])
    // Session 15: Clear sessionStorage too
    sessionStorage.removeItem(STORAGE_KEY_MESSAGES)
    sessionStorage.removeItem(STORAGE_KEY_CONVERSATION)
  }

  // ─── Step status icon helper ───────────────────────────

  function StepIcon({ status }: { status: string }) {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3 h-3 text-green-400" />
      case 'failed': return <XCircle className="w-3 h-3 text-red-400" />
      case 'running': return <Loader className="w-3 h-3 text-teal-400 animate-spin" />
      case 'skipped': return <Circle className="w-3 h-3 text-muted-foreground/50" />
      default: return <Circle className="w-3 h-3 text-muted-foreground/30" />
    }
  }

  // Session 17: Format duration for copilot display
  const formatCopilotDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Session 18→20: Fetch evidence citations from consultation_evidence table
  // Session 20: Also passes dentistId as fallback for placeholder consultation IDs
  const fetchEvidence = useCallback(async (consultationId: string) => {
    setEvidenceLoading(true)
    try {
      const params = new URLSearchParams({ consultationId })
      if (dentistId) params.set('dentistId', dentistId)
      const res = await fetch(`/api/endoflow/consultation-evidence?${params.toString()}`)
      const result = await res.json()
      if (result.success && result.evidence) {
        setEvidenceCitations(result.evidence)
      }
    } catch (err) {
      console.error('❌ [COPILOT] Failed to fetch evidence:', err)
    } finally {
      setEvidenceLoading(false)
    }
  }, [dentistId])

  // Session 18: Auto-fetch evidence after synthesis completes (if consultationId available)
  useEffect(() => {
    if (synthesisResult && copilotConsultationId) {
      fetchEvidence(copilotConsultationId)
    }
  }, [synthesisResult, copilotConsultationId, fetchEvidence])

  // Session 18: Accept and save diagnosis from copilot
  const handleAcceptDiagnosis = useCallback(async () => {
    if (!synthesisResult || !copilotPatientId || !copilotToothNumber) return
    setAcceptSaving(true)
    try {
      // Determine tooth status from diagnosis
      let toothStatus = 'attention'
      const dx = (synthesisResult.primary_diagnosis || '').toLowerCase()
      if (dx.includes('caries') || dx.includes('decay')) toothStatus = 'caries'
      else if (dx.includes('pulp') || dx.includes('irreversible') || dx.includes('necrosis')) toothStatus = 'root_canal'
      else if (dx.includes('fracture') || dx.includes('extraction')) toothStatus = 'extraction_needed'
      else if (dx.includes('crown')) toothStatus = 'crown'

      const res = await fetch('/api/endoflow/save-tooth-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: copilotConsultationId,
          patientId: copilotPatientId,
          toothNumber: copilotToothNumber,
          status: toothStatus,
          primaryDiagnosis: synthesisResult.primary_diagnosis,
          diagnosisDetails: synthesisResult.clinical_reasoning || synthesisResult.differential_diagnoses?.map((d: any) => typeof d === 'string' ? d : d.diagnosis).join(', '),
          recommendedTreatment: synthesisResult.recommended_treatment || synthesisResult.treatment_options?.[0]?.name,
          treatmentPriority: synthesisResult.diagnosis_confidence >= 80 ? 'high' : 'medium',
          treatmentDetails: synthesisResult.combined_treatment_sequence || synthesisResult.treatment_options?.map((t: any) => t.name || t.treatment).join(' → '),
          endodonticDiagnosis: synthesisResult.aae_classification,
          endodonticConfidence: synthesisResult.diagnosis_confidence,
          restorativeDiagnosis: synthesisResult.restorative_diagnosis?.primary,
          restorativeConfidence: synthesisResult.restorative_diagnosis?.confidence,
          combinedTreatmentSequence: synthesisResult.combined_treatment_sequence,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setAcceptSaved(true)
        // Notify the FDI chart to refresh
        window.dispatchEvent(new CustomEvent('endoflow:tooth_diagnosis_saved', {
          detail: { toothNumber: copilotToothNumber, patientId: copilotPatientId }
        }))
      } else {
        console.error('❌ [COPILOT] Failed to save diagnosis:', result.error)
      }
    } catch (err) {
      console.error('❌ [COPILOT] Error saving diagnosis:', err)
    } finally {
      setAcceptSaving(false)
    }
  }, [synthesisResult, copilotPatientId, copilotToothNumber, copilotConsultationId])

  // Session 18: Handle copilot input submit (gap answers or co-pilot questions)
  const handleCopilotInputSubmit = useCallback(async () => {
    const text = copilotInput.trim()
    if (!text || copilotInputProcessing) return
    setCopilotInput('')
    setCopilotInputProcessing(true)

    try {
      // Route to Master AI processQuery — co-pilot input goes through same pipeline
      await processQuery(text, false)
    } finally {
      setCopilotInputProcessing(false)
    }
  }, [copilotInput, copilotInputProcessing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Session 18: Select next tooth from copilot (multi-tooth workflow)
  const handleSelectNextTooth = useCallback(() => {
    // Dispatch event for V4 to prompt tooth selection on FDI chart
    window.dispatchEvent(new CustomEvent('endoflow:copilot_select_tooth'))
    // Reset synthesis state for the next tooth
    setSynthesisResult(null)
    setAcceptSaved(false)
    setEvidenceCitations([])
  }, [])

  return (
    <div className={cn(
      'flex flex-col h-full transition-all duration-300',
      modeTransition && panelMode === 'copilot' && 'ring-1 ring-red-500/50',
      modeTransition && panelMode === 'master' && 'ring-1 ring-teal-500/50',
    )}>
      {/* ─── Mode Indicator Bar ──────────────────────────── */}
      <div className={cn(
        'px-3 py-2 border-b flex items-center gap-2 shrink-0 transition-colors duration-300',
        panelMode === 'copilot' ? 'border-red-500/30 bg-red-500/5' : 'border-border'
      )}>
        <div className={cn(
          'w-2 h-2 rounded-full',
          panelMode === 'copilot' ? 'bg-red-500 animate-pulse' : 'bg-teal-500'
        )} />
        <span className={cn(
          'text-[11px] font-bold uppercase tracking-wider',
          panelMode === 'copilot' ? 'text-red-400' : 'text-teal-400'
        )}>
          {panelMode === 'copilot' ? 'Clinical Co-Pilot' : 'EndoFlow Master AI'}
        </span>
        {panelMode === 'copilot' && (
          <span className="text-xs text-red-400/70 ml-auto tabular-nums font-mono">
            {formatCopilotDuration(copilotRecordingDuration)}
          </span>
        )}
      </div>

      {/* ═══ COPILOT MODE ═══ */}
      {panelMode === 'copilot' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Recording Controls Strip — adapts to recording vs stopped state */}
          <div className={cn(
            'border-b border-border flex items-center flex-wrap shrink-0',
            isMobileSheet ? 'px-4 py-3 gap-2' : 'px-3 py-2 gap-1.5',
            isConsultationRecording ? 'bg-red-500/5' : 'bg-teal-500/5'
          )}>
            {isConsultationRecording ? (
              <>
                {/* Active recording controls — Session 18b: Stop now accumulates without processing */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('endoflow:stop_recording_no_process'))}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500 text-white text-[11px] font-semibold hover:bg-red-600 transition-colors"
                  title="Stop recording (segment saved, can record more or process)"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
                <button
                  onClick={() => {
                    if (copilotIsPaused) {
                      window.dispatchEvent(new CustomEvent('endoflow:resume_recording'))
                      setCopilotIsPaused(false)
                    } else {
                      window.dispatchEvent(new CustomEvent('endoflow:pause_recording'))
                      setCopilotIsPaused(true)
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition-colors',
                    copilotIsPaused
                      ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20'
                  )}
                >
                  {copilotIsPaused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('endoflow:process_recording'))}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/30 text-[11px] font-semibold hover:bg-green-500/20 transition-colors"
                  title="Stop recording AND run AI pipeline on all segments"
                >
                  <Brain className="w-3 h-3" /> Process
                </button>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('endoflow:stop_recording'))
                  }}
                  className="flex items-center gap-1 px-1.5 py-1.5 rounded-md text-muted-foreground border border-border text-[11px] hover:text-red-400 hover:border-red-500/30 transition-colors ml-auto"
                  title="Discard recording and processing"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                {/* Recording stopped — Session 18b: Record More, Process All, Pipeline, Back */}
                <Badge variant="outline" className="text-[10px] text-teal-400 border-teal-500/30 bg-teal-500/10">
                  Segment saved
                </Badge>
                <span className="text-[10px] text-muted-foreground ml-1">
                  {formatCopilotDuration(copilotRecordingDuration)}
                </span>
                {/* Record More — restart recording for another segment/tooth */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('endoflow:start_recording'))}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-semibold hover:bg-red-500/20 transition-colors"
                  title="Record another segment (for additional teeth or findings)"
                >
                  <Mic className="w-3 h-3" /> Record More
                </button>
                {/* Process All — send all accumulated segments to AI */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('endoflow:process_recording'))}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/30 text-[10px] font-semibold hover:bg-green-500/20 transition-colors"
                  title="Process all recorded segments through AI pipeline"
                >
                  <Brain className="w-3 h-3" /> Process All
                </button>
                {/* Run Pipeline — for individual tooth diagnosis */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('endoflow:run_diagnosis_pipeline'))}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[10px] font-semibold hover:bg-teal-500/20 transition-colors"
                  title="Run AI diagnosis pipeline for selected tooth"
                >
                  <Stethoscope className="w-3 h-3" /> Pipeline
                </button>
                <button
                  onClick={() => {
                    setPanelMode('master')
                    setModeTransition(true)
                    setTimeout(() => setModeTransition(false), 600)
                    setCopilotRecordingDuration(0)
                    setCopilotSegmentCount(0)
                    setAiResults({ processedContent: null, toothDiagnoses: [] })
                    setSynthesisResult(null)
                    setEvidenceCitations([])
                    setPipelineGapQuestions([])
                    setAcceptSaved(false)
                    setCopilotToothNumber(null)
                    setCopilotPatientId(null)
                    setCopilotConsultationId(null)
                    // Session 20: Notify page.tsx to dismiss mobile copilot strip
                    window.dispatchEvent(new CustomEvent('endoflow:copilot_dismissed'))
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-muted-foreground border border-border text-[11px] font-semibold hover:text-teal-400 hover:border-teal-500/30 transition-colors ml-auto"
                >
                  <Sparkles className="w-3 h-3" /> Back to Master AI
                </button>
              </>
            )}
          </div>

          {/* Copilot Tabs */}
          <div className="flex gap-1 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
            {([
              { id: 'diagnosis' as CopilotTab, label: 'Diagnosis', icon: Stethoscope },
              { id: 'treatment' as CopilotTab, label: 'Treatment', icon: Pill },
              { id: 'gaps' as CopilotTab, label: 'Gaps', icon: AlertTriangle },
              { id: 'evidence' as CopilotTab, label: 'Evidence', icon: BookOpen },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setCopilotTab(tab.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                  copilotTab === tab.id
                    ? 'bg-teal-500/15 text-teal-400'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Copilot Tab Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {copilotTab === 'diagnosis' && (
              <div className="space-y-3">
                {/* Priority: Show full synthesis result from diagnostic pipeline */}
                {synthesisResult ? (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center">
                            <Stethoscope className="w-3.5 h-3.5 text-red-400" />
                          </div>
                          <span className="text-xs font-semibold">{synthesisResult.primary_diagnosis}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] text-teal-400 border-teal-500/30">
                            {synthesisResult.diagnosis_confidence}%
                          </Badge>
                          {/* Session 20: Evidence source indicator */}
                          <Badge variant="outline" className={cn(
                            "text-[9px]",
                            evidenceCitations.length > 0 || synthesisResult.literature_citations?.length > 0
                              ? "text-green-400 border-green-500/30"
                              : "text-amber-400 border-amber-500/30"
                          )}>
                            {evidenceCitations.length > 0 || synthesisResult.literature_citations?.length > 0
                              ? 'RAG'
                              : 'AI only'}
                          </Badge>
                        </div>
                      </div>
                      {/* Session 20: Warning when no RAG evidence */}
                      {evidenceCitations.length === 0 && (!synthesisResult.literature_citations || synthesisResult.literature_citations.length === 0) && (
                        <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 mt-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-[10px] text-amber-300 leading-relaxed">
                            Generated using AI clinical knowledge without specific literature references.
                          </p>
                        </div>
                      )}
                      {synthesisResult.clinical_reasoning && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{synthesisResult.clinical_reasoning}</p>
                      )}
                    </div>
                    {/* Differentials */}
                    {synthesisResult.differential_diagnoses?.length > 0 && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Differentials</span>
                        <div className="mt-1.5 space-y-1">
                          {synthesisResult.differential_diagnoses.map((d: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-foreground">{typeof d === 'string' ? d : d.diagnosis}</span>
                              {typeof d !== 'string' && d.probability && (
                                <span className="text-muted-foreground">{d.probability}%</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Restorative diagnosis if present */}
                    {synthesisResult.restorative_diagnosis && (
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Restorative</span>
                          {synthesisResult.restorative_diagnosis.confidence && (
                            <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                              {synthesisResult.restorative_diagnosis.confidence}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground">{synthesisResult.restorative_diagnosis.primary}</p>
                        {synthesisResult.restorative_diagnosis.surfaces_involved?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Surfaces: {synthesisResult.restorative_diagnosis.surfaces_involved.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Session 18: Accept + Next Tooth action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAcceptDiagnosis}
                        disabled={acceptSaving || acceptSaved}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold transition-colors',
                          acceptSaved
                            ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                            : 'bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20'
                        )}
                      >
                        {acceptSaving ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                        ) : acceptSaved ? (
                          <><CheckCircle2 className="w-3 h-3" /> Saved to #{copilotToothNumber}</>
                        ) : (
                          <><CheckCircle2 className="w-3 h-3" /> Accept &amp; Save</>
                        )}
                      </button>
                      <button
                        onClick={handleSelectNextTooth}
                        className="flex items-center gap-1 px-3 py-2 rounded-md text-muted-foreground border border-border text-[11px] font-semibold hover:text-foreground hover:border-foreground/30 transition-colors"
                        title="Select next tooth for diagnosis"
                      >
                        <ChevronRight className="w-3 h-3" /> Next Tooth
                      </button>
                    </div>
                  </>
                ) : aiResults.toothDiagnoses.length > 0 ? (
                  aiResults.toothDiagnoses.map((diag: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-red-400">#{diag.toothNumber}</span>
                          </div>
                          <span className="text-xs font-semibold">{diag.primaryDiagnosis || 'Unknown'}</span>
                        </div>
                      </div>
                      {diag.diagnosisDetails && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{diag.diagnosisDetails}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center">
                        <Stethoscope className="w-3.5 h-3.5 text-red-400" />
                      </div>
                      <span className="text-xs font-semibold">AI Diagnosis</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                      Select a tooth from the FDI chart, then run the pipeline here.
                    </p>
                    <button
                      onClick={() => {
                        // Dispatch event to open tooth diagnosis dialog with pipeline
                        window.dispatchEvent(new CustomEvent('endoflow:run_diagnosis_pipeline'))
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[11px] font-semibold hover:bg-teal-500/20 transition-colors"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      Run AI Diagnosis Pipeline
                    </button>
                  </div>
                )}
              </div>
            )}
            {copilotTab === 'treatment' && (
              <div className="space-y-3">
                {/* Priority: Show synthesis treatment options */}
                {synthesisResult?.treatment_options?.length > 0 ? (
                  <>
                    {synthesisResult.treatment_options.map((tx: any, idx: number) => (
                      <div key={idx} className={cn(
                        'p-3 rounded-lg border',
                        idx === 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-muted/50 border-border'
                      )}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-foreground">{tx.name || tx.treatment}</span>
                          {idx === 0 && <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">Recommended</Badge>}
                        </div>
                        {tx.rationale && <p className="text-xs text-muted-foreground leading-relaxed">{tx.rationale}</p>}
                        {tx.prognosis && <p className="text-[10px] text-muted-foreground mt-1">Prognosis: {tx.prognosis}</p>}
                      </div>
                    ))}
                    {/* Combined treatment sequence */}
                    {synthesisResult.combined_treatment_sequence && (
                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Treatment Sequence</span>
                        <p className="text-xs text-foreground mt-1">{synthesisResult.combined_treatment_sequence}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-green-500/15 flex items-center justify-center">
                        <Pill className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      <span className="text-xs font-semibold">Treatment Plan</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Treatment options appear after diagnostic pipeline completes.
                    </p>
                  </div>
                )}
              </div>
            )}
            {copilotTab === 'gaps' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 mb-1">
                    Gap Analysis
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pipelineGapQuestions.length > 0
                      ? `${pipelineGapQuestions.length} diagnostic gaps identified by AI pipeline. Answer via TTS or type below.`
                      : 'AI identifies missing clinical information. Run the diagnostic pipeline to detect gaps.'}
                  </p>
                </div>

                {/* Session 20: Real pipeline gap questions from gap-finder agent (replaces hardcoded checks) */}
                {pipelineGapQuestions.length > 0 ? (
                  <>
                    {pipelineGapQuestions.map((gq: any, idx: number) => (
                      <div key={gq.question_id || idx} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                              Q{idx + 1}
                            </span>
                            {gq.track && (
                              <span className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                                gq.track === 'endodontic' ? "bg-purple-500/20 text-purple-400" :
                                gq.track === 'restorative' ? "bg-green-500/20 text-green-400" :
                                "bg-blue-500/20 text-blue-400"
                              )}>
                                {gq.track === 'endodontic' ? 'Endo' : gq.track === 'restorative' ? 'Rest' : gq.track}
                              </span>
                            )}
                            <span className="text-[9px] text-muted-foreground">
                              wt: {typeof gq.diagnostic_weight === 'number' ? (gq.diagnostic_weight * 100).toFixed(0) + '%' : '—'}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              speakWithTTS(gq.natural_language, { language: selectedLanguage })
                              setGapQuestionSpoken(prev => new Set([...prev, gq.question_id]))
                            }}
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-md transition-colors',
                              gapQuestionSpoken.has(gq.question_id)
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                            )}
                          >
                            {gapQuestionSpoken.has(gq.question_id) ? 'Spoken' : 'Speak'}
                          </button>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{gq.natural_language}</p>
                        {gq.why_it_matters && (
                          <p className="text-[10px] text-muted-foreground italic mt-1">{gq.why_it_matters}</p>
                        )}
                        {gq.questionnaire_source && (
                          <p className="text-[9px] text-muted-foreground mt-0.5">Source: {gq.questionnaire_source}</p>
                        )}
                      </div>
                    ))}
                  </>
                ) : aiResults.processedContent ? (
                  /* Fallback: Simple field-presence checks when pipeline hasn't run yet */
                  (() => {
                    const pc = aiResults.processedContent
                    const gaps: { id: string; question: string }[] = []
                    if (!pc.chiefComplaint) gaps.push({ id: 'cc', question: 'What is the patient\'s chief complaint?' })
                    if (!pc.painLocation && !pc.painCharacter) gaps.push({ id: 'pain', question: 'Can you describe the pain — location, character, and intensity?' })
                    if (!pc.medicalHistory || (Array.isArray(pc.medicalHistory) && pc.medicalHistory.length === 0)) {
                      gaps.push({ id: 'medhx', question: 'Does the patient have any relevant medical history or ongoing medications?' })
                    }
                    if (!pc.radiographicFindings) gaps.push({ id: 'xray', question: 'What do the radiographic findings show?' })
                    if (!pc.provisionalDiagnosis && !pc.finalDiagnosis?.length) {
                      gaps.push({ id: 'dx', question: 'What is your provisional diagnosis?' })
                    }
                    return gaps.length > 0 ? (
                      <>
                        <p className="text-[10px] text-amber-400 font-medium">Basic checks (run pipeline for detailed gap analysis):</p>
                        {gaps.map((gap, idx) => (
                          <div key={gap.id} className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-yellow-400">Q{idx + 1}</span>
                              <button
                                onClick={() => {
                                  speakWithTTS(gap.question, { language: selectedLanguage })
                                  setGapQuestionSpoken(prev => new Set([...prev, gap.id]))
                                }}
                                className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-md transition-colors',
                                  gapQuestionSpoken.has(gap.id)
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                                )}
                              >
                                {gapQuestionSpoken.has(gap.id) ? 'Spoken' : 'Speak'}
                              </button>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed">{gap.question}</p>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">All Clear</div>
                        <p className="text-xs text-muted-foreground leading-relaxed">No critical gaps detected in the current data.</p>
                      </div>
                    )
                  })()
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Process the recording to identify gaps
                  </p>
                )}
              </div>
            )}
            {copilotTab === 'evidence' && (
              <div className="space-y-3">
                {evidenceLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400 mr-2" />
                    <span className="text-xs text-muted-foreground">Fetching evidence...</span>
                  </div>
                ) : evidenceCitations.length > 0 ? (
                  <>
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        {evidenceCitations.length} Citation{evidenceCitations.length !== 1 ? 's' : ''} Retrieved
                      </span>
                    </div>
                    {evidenceCitations.map((cite: any, idx: number) => (
                      <div key={cite.id || idx} className="p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-blue-400 mt-0.5 shrink-0">
                            [{cite.retrieval_rank || idx + 1}]
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-snug">
                              {cite.citation_title || 'Untitled'}
                            </p>
                            {cite.citation_authors && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                {cite.citation_authors}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {cite.citation_journal && (
                                <span className="text-[10px] text-blue-400 italic">{cite.citation_journal}</span>
                              )}
                              {cite.citation_year && (
                                <span className="text-[10px] text-muted-foreground">({cite.citation_year})</span>
                              )}
                              {cite.similarity_score && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 text-teal-400 border-teal-500/30">
                                  {(parseFloat(cite.similarity_score) * 100).toFixed(0)}% match
                                </Badge>
                              )}
                            </div>
                            {cite.citation_doi && (
                              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                <ExternalLink className="w-2.5 h-2.5" />
                                DOI: {cite.citation_doi}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center">
                        <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <span className="text-xs font-semibold">Clinical Evidence</span>
                    </div>
                    {/* Session 20: Fallback to inline literature_citations from synthesis when DB evidence is empty */}
                    {synthesisResult?.literature_citations?.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[10px] text-amber-400 font-medium mb-1">
                          From AI synthesis (not yet saved to evidence database):
                        </p>
                        {synthesisResult.literature_citations.map((cite: any, idx: number) => (
                          <div key={idx} className="flex gap-2 items-start p-2 rounded-md bg-background/50 border border-border/50">
                            <span className="text-[10px] text-muted-foreground font-bold shrink-0 mt-0.5">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-foreground leading-snug">{cite.title || cite}</p>
                              {cite.authors && <p className="text-[10px] text-muted-foreground mt-0.5">{cite.authors}</p>}
                              {cite.journal && <span className="text-[10px] text-blue-400 italic">{cite.journal}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {synthesisResult
                            ? 'No literature citations available. The medical knowledge base may need more documents, or the RAG search did not find relevant matches for this case.'
                            : 'Run the diagnostic pipeline to retrieve clinical literature citations.'}
                        </p>
                        {synthesisResult && (
                          <p className="text-[10px] text-amber-400/80 mt-1.5">
                            Diagnosis was generated using AI clinical knowledge without specific literature references.
                          </p>
                        )}
                      </>
                    )}
                    {copilotConsultationId && !synthesisResult && (
                      <button
                        onClick={() => fetchEvidence(copilotConsultationId!)}
                        className="mt-2 flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-semibold hover:bg-blue-500/20 transition-colors"
                      >
                        <BookOpen className="w-3 h-3" /> Fetch Evidence
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Copilot Input — Session 18: Wired to processQuery */}
          <div className="p-3 border-t border-border shrink-0">
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleCopilotInputSubmit()
                  }
                }}
                placeholder="Ask the co-pilot or answer a gap question..."
                disabled={copilotInputProcessing}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopilotInputSubmit}
                disabled={!copilotInput.trim() || copilotInputProcessing}
                className="h-7 w-7 p-0 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
              >
                {copilotInputProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MASTER AI MODE ═══ */}
      {panelMode === 'master' && <>
      {/* ─── Voice Controls Bar ──────────────────────────── */}
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-1.5 shrink-0">
        {/* Mic toggle */}
        <button
          onClick={toggleMic}
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
            isMicActive
              ? 'bg-red-500/15 text-red-400 animate-pulse'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isMicActive ? 'Stop listening' : 'Start listening'}
        >
          {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        {/* TTS toggle */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
            voiceEnabled
              ? 'text-teal-400 hover:bg-teal-500/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
        >
          {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Language selector */}
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value as any)}
          className="text-[10px] bg-transparent text-muted-foreground border-none outline-none cursor-pointer"
        >
          <option value="en-US">EN</option>
          <option value="en-IN">EN-IN</option>
          <option value="hi-IN">HI</option>
        </select>

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-1">
          {isMicActive && (
            <span className="text-[10px] text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Listening
            </span>
          )}
          {isProcessing && (
            <span className="text-[10px] text-teal-400 flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Thinking
            </span>
          )}
        </div>
      </div>

      {/* ─── Agent Activity Panel (collapsible) ──────────── */}
      {agentSteps.length > 0 && (
        <div className="border-b border-border">
          <button
            onClick={() => setShowAgentActivity(!showAgentActivity)}
            className="w-full px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="w-3 h-3 text-teal-400" />
            <span>Agent Activity ({agentSteps.filter(s => s.status === 'completed').length}/{agentSteps.length})</span>
            {showAgentActivity ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showAgentActivity && (
            <div className="px-3 pb-2 space-y-1">
              {agentSteps.map((step) => (
                <div key={step.id} className="flex items-center gap-2 text-[10px]">
                  <StepIcon status={step.status} />
                  <span className={cn(
                    step.status === 'completed' ? 'text-foreground' :
                    step.status === 'failed' ? 'text-red-400' :
                    step.status === 'running' ? 'text-teal-400' :
                    'text-muted-foreground'
                  )}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Live Transcript (when mic is active) ────────── */}
      {isMicActive && liveTranscript && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            {liveTranscript}
          </p>
        </div>
      )}

      {/* ─── Messages Area ────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div ref={scrollRef} className="p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">EndoFlow AI</p>
                <p className="text-xs text-muted-foreground mb-1">
                  Type or speak a command
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  Say &quot;Hey EndoFlow&quot; or click the mic
                </p>
                <div className="mt-4 space-y-1.5">
                  {[
                    'Start consultation with...',
                    'Show today\'s schedule',
                    'Open patient records',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInputValue(suggestion)
                        inputRef.current?.focus()
                      }}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-md bg-teal-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-teal-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-teal-500 text-white'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {msg.isVoice && msg.role === 'user' && (
                      <Mic className="w-2.5 h-2.5 inline mr-1 opacity-70" />
                    )}
                    {msg.content}
                    {/* Session 15: Candidate selection buttons for fuzzy patient matches */}
                    {msg.actionData?.candidates && msg.actionData.candidates.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {msg.actionData.candidates.map((c: any, idx: number) => (
                          <button
                            key={c.id || idx}
                            onClick={() => {
                              const name = `${c.first_name} ${c.last_name}`.trim()
                              processQuery(
                                msg.actionData?.action === 'patient_selection_confirm'
                                  ? `Start consultation with ${name}`
                                  : `Tell me about ${name}`,
                                false
                              )
                            }}
                            className="text-left text-[11px] px-2 py-1.5 rounded-md bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 transition-colors"
                          >
                            {idx + 1}. {c.first_name} {c.last_name}
                            {c.score && <span className="ml-1 opacity-50">({(c.score * 100).toFixed(0)}%)</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Session 15: Patient list buttons for selection prompt */}
                    {msg.actionData?.patientList && msg.actionData.patientList.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {msg.actionData.patientList.map((p: any, idx: number) => (
                          <button
                            key={p.id || idx}
                            onClick={() => processQuery(`Start consultation with ${p.name}`, false)}
                            className="text-left text-[11px] px-2 py-1.5 rounded-md bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 transition-colors"
                          >
                            {idx + 1}. {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.agentName && (
                      <div className="mt-1">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-border text-muted-foreground">
                          {msg.agentName}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                </div>
              ))
            )}

            {isProcessing && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-md bg-teal-500/15 flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Clear button */}
      {messages.length > 0 && (
        <div className="px-3 py-1">
          <button
            onClick={clearChat}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear chat
          </button>
        </div>
      )}

      {/* ─── Input Area — Text + Mic ──────────────────────── */}
      <div className={cn('border-t border-border', isMobileSheet ? 'p-4 pb-6' : 'p-3')}>
        <div className={cn(
          'flex items-center gap-2 bg-muted rounded-xl',
          isMobileSheet ? 'px-4 py-3' : 'px-3 py-2'
        )}>
          {/* Mic button — larger on mobile for 44px touch target */}
          <button
            onClick={toggleMic}
            className={cn(
              'shrink-0 rounded-lg flex items-center justify-center transition-all',
              isMobileSheet ? 'w-11 h-11' : 'w-7 h-7',
              isMicActive
                ? 'bg-red-500 text-white'
                : 'text-muted-foreground hover:text-teal-400 hover:bg-teal-500/10'
            )}
          >
            {isMicActive
              ? <MicOff className={isMobileSheet ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
              : <Mic className={isMobileSheet ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
            }
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMicActive ? 'Listening...' : 'Type a command...'}
            disabled={isProcessing}
            className={cn(
              'flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none',
              isMobileSheet ? 'text-sm' : 'text-xs'
            )}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleTextSubmit}
            disabled={!inputValue.trim() || isProcessing}
            className={cn(
              'p-0 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10',
              isMobileSheet ? 'h-11 w-11' : 'h-7 w-7'
            )}
          >
            {isProcessing ? (
              <Loader2 className={isMobileSheet ? 'w-5 h-5 animate-spin' : 'w-3.5 h-3.5 animate-spin'} />
            ) : (
              <Send className={isMobileSheet ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
            )}
          </Button>
        </div>
      </div>
      </>}
    </div>
  )
}
