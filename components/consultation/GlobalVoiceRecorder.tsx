'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Mic, MicOff, Square, Play, Pause, Volume2, AlertCircle, Sparkles, Activity, Globe, Layers, Brain, X } from "lucide-react"
import { detectKeywords, analyzeConversationCompleteness } from '@/lib/services/medical-conversation-parser'
import { useVoiceManager } from '@/lib/contexts/voice-manager-context'
import { DeepgramSTTService, type DeepgramTranscriptEvent } from '@/lib/services/deepgram-stt'
import { cn } from '@/lib/utils'

interface VoiceRecording {
  isRecording: boolean
  isPaused: boolean
  startTime: Date | null
  duration: number
  transcript: string
  audioBlob: Blob | null
  sessionId: string | null
}

interface ProcessedContent {
  chiefComplaint: any
  hopi: any
  medicalHistory: any
  personalHistory: any
  clinicalExamination: any
  investigations: any
  diagnosis: any
  treatmentPlan: any
  confidence: number
}

interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  isProcessing: boolean
  duration: number
  segmentCount: number
}

interface GlobalVoiceRecorderProps {
  consultationId?: string
  onContentProcessed?: (content: ProcessedContent) => void
  onToothDiagnosesExtracted?: (toothDiagnoses: any[]) => void
  isEnabled?: boolean
  /** Session 17: Live transcript callback for parent display */
  onTranscriptUpdate?: (transcript: string) => void
  /** Session 17: Recording state callback for parent UI */
  onRecordingStateChange?: (state: RecordingState) => void
  /** Session 17: If true, hide the built-in UI (controls moved to sidebar) */
  headless?: boolean
}

/** Map locale codes to Deepgram language codes */
function mapLanguageForDeepgram(lang: string): string {
  const map: Record<string, string> = {
    'en-US': 'en',
    'en-IN': 'en',
    'hi-IN': 'hi',
  }
  return map[lang] || 'en'
}

/** Check if text contains a stop command */
function detectStopCommand(text: string): boolean {
  const lower = text.toLowerCase().trim()
  const stopPhrases = [
    'stop recording',
    'done recording',
    'end recording',
    'stop consultation',
    'end consultation',
    'okay done recording',
    'ok done recording',
    'that is all',
    'that\'s all',
    'finish recording',
  ]
  return stopPhrases.some(phrase => lower.includes(phrase))
}

export function GlobalVoiceRecorder({
  consultationId,
  onContentProcessed,
  onToothDiagnosesExtracted,
  isEnabled = true,
  onTranscriptUpdate,
  onRecordingStateChange,
  headless = false,
}: GlobalVoiceRecorderProps) {
  const voiceManager = useVoiceManager()

  const [recording, setRecording] = useState<VoiceRecording>({
    isRecording: false,
    isPaused: false,
    startTime: null,
    duration: 0,
    transcript: '',
    audioBlob: null,
    sessionId: null
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [selectedLanguage, setSelectedLanguage] = useState<'en-US' | 'en-IN' | 'hi-IN'>('en-US')
  const [sttMode, setSttMode] = useState<'deepgram' | 'browser'>('deepgram')
  const [segmentCount, setSegmentCount] = useState(0)
  const [isWakeWordListening, setIsWakeWordListening] = useState(false)
  const [deepgramStatus, setDeepgramStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<string>('')
  const finalTranscriptRef = useRef<string>('')
  // Session 20: Diarized transcript with speaker labels (parallel to raw transcript)
  const diarizedSegmentsRef = useRef<string[]>([])
  const isRecordingRef = useRef(false)

  // Session 16: Prop refs for closures (event handlers capture stale props otherwise)
  const isEnabledRef = useRef(isEnabled)
  const consultationIdRef = useRef(consultationId)
  useEffect(() => { isEnabledRef.current = isEnabled }, [isEnabled])
  useEffect(() => { consultationIdRef.current = consultationId }, [consultationId])

  // Session 17: Fire transcript and recording state callbacks
  useEffect(() => {
    onTranscriptUpdate?.(recording.transcript)
  }, [recording.transcript])

  useEffect(() => {
    onRecordingStateChange?.({
      isRecording: recording.isRecording,
      isPaused: recording.isPaused,
      isProcessing,
      duration: recording.duration,
      segmentCount,
    })
  }, [recording.isRecording, recording.isPaused, isProcessing, recording.duration, segmentCount])

  // Deepgram refs
  const deepgramServiceRef = useRef<DeepgramSTTService | null>(null)
  const deepgramConnectedRef = useRef(false)

  // Multi-segment accumulation
  const accumulatedTranscriptsRef = useRef<string[]>([])

  // Session 18b: Flag to stop recording without triggering AI processing
  // When true, onstop handler accumulates the segment but skips processRecording
  const skipProcessOnStopRef = useRef(false)

  // Wake word refs (for "Start consultation" / "Start recording")
  const wakeWordRecognitionRef = useRef<any>(null)

  // Browser STT refs (fallback)
  const browserRecognitionRef = useRef<any>(null)

  useEffect(() => {
    checkMicrophonePermissions()
    return () => {
      stopRecording()
      cleanup()
      stopWakeWordListening()
    }
  }, [])

  const checkMicrophonePermissions = async () => {
    // Session 18: Guard for non-secure contexts (e.g. HTTP on mobile LAN)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      console.warn('🎤 [GLOBAL VOICE] Non-secure context — mic unavailable. Use HTTPS.')
      setError('Microphone requires HTTPS. Run pnpm dev:https for mobile testing.')
      setPermissionStatus('denied')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('🎤 [GLOBAL VOICE] getUserMedia not available')
      setPermissionStatus('denied')
      return
    }

    try {
      // Safari may throw TypeError for unsupported permission names
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setPermissionStatus(result.state)
      result.onchange = () => setPermissionStatus(result.state)
    } catch (error) {
      // iOS Safari doesn't support permissions.query for 'microphone' — assume prompt state
      console.log('🎤 [GLOBAL VOICE] permissions.query not supported, assuming prompt state')
      setPermissionStatus('prompt')
    }
  }

  // ─── WAKE WORD DETECTION ──────────────────────────────────────
  const startWakeWordListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return
    if (isRecordingRef.current) return

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US' // Wake words are always English

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.toLowerCase().trim()
        const wakeWords = [
          'start consultation', 'start recording', 'begin consultation',
          'begin recording', 'start the consultation', 'start the recording',
        ]
        if (wakeWords.some(w => text.includes(w))) {
          console.log('🎯 [WAKE WORD] Detected:', text)
          stopWakeWordListening()
          startRecording()
          return
        }
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.warn('⚠️ [WAKE WORD] Error:', event.error)
    }

    recognition.onend = () => {
      // Auto-restart wake word listening unless we're recording
      if (!isRecordingRef.current && isWakeWordListening) {
        try {
          setTimeout(() => {
            if (!isRecordingRef.current && wakeWordRecognitionRef.current) {
              wakeWordRecognitionRef.current.start()
            }
          }, 200)
        } catch (e) { /* ignore */ }
      }
    }

    wakeWordRecognitionRef.current = recognition
    try {
      recognition.start()
      setIsWakeWordListening(true)
      console.log('👂 [WAKE WORD] Listening for "Start consultation" or "Start recording"...')
    } catch (e) {
      console.warn('⚠️ [WAKE WORD] Failed to start:', e)
    }
  }, [])

  const stopWakeWordListening = useCallback(() => {
    if (wakeWordRecognitionRef.current) {
      try {
        wakeWordRecognitionRef.current.stop()
      } catch (e) { /* ignore */ }
      wakeWordRecognitionRef.current = null
    }
    setIsWakeWordListening(false)
  }, [])

  // ─── DEEPGRAM STT ─────────────────────────────────────────────

  const startDeepgramSTT = async (): Promise<boolean> => {
    try {
      setDeepgramStatus('connecting')
      console.log('🎙️ [GLOBAL VOICE] Starting Deepgram STT...')

      // Session 20: Enable clinicalMode — activates diarization (Dr./Patient labels),
      // medical model selection, and full dental keyword boosting
      const service = new DeepgramSTTService({
        language: mapLanguageForDeepgram(selectedLanguage),
        clinicalMode: true, // Session 20: Enables diarize=true, endpointing=400, medical model, full vocabulary
        interimResults: true,
        smartFormat: true,
        utteranceEndMs: 1500, // Session 17: 1.5s — endpointing (400ms) handles mid-sentence pauses, utteranceEnd handles actual end-of-speech
        vadEvents: true,
      })

      service.on('transcript', (event: DeepgramTranscriptEvent) => {
        if (event.isFinal) {
          finalTranscriptRef.current += event.text + ' '

          // Session 20: Accumulate diarized text for display when available
          if (event.diarizedText) {
            diarizedSegmentsRef.current.push(event.diarizedText)
          }

          // Check for stop command in the final transcript
          if (detectStopCommand(event.text)) {
            console.log('🛑 [STOP COMMAND] Detected voice stop command:', event.text)
            // Remove the stop command from transcript
            const stopPhrases = [
              'stop recording', 'done recording', 'end recording',
              'stop consultation', 'end consultation', 'okay done recording',
              'ok done recording', 'that is all', 'that\'s all', 'finish recording',
            ]
            let cleaned = finalTranscriptRef.current
            for (const phrase of stopPhrases) {
              cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '').trim()
            }
            finalTranscriptRef.current = cleaned
            transcriptRef.current = cleaned

            // Trigger stop
            setTimeout(() => stopRecording(), 500)
            return
          }

          // Session 16→20: Show ALL accumulated segments + current segment
          // Session 20: Use diarized text for display when available, raw text for AI processing
          const hasDiarization = diarizedSegmentsRef.current.length > 0
          const displayText = hasDiarization
            ? [...accumulatedTranscriptsRef.current.map((seg, i) => {
                // Use diarized version if available for this segment index
                return diarizedSegmentsRef.current[i] || seg
              }), event.diarizedText || finalTranscriptRef.current].filter(Boolean).join('\n')
            : [...accumulatedTranscriptsRef.current, finalTranscriptRef.current].join(' ').trim()

          // Raw text always stored for AI processing (no speaker labels)
          const rawFullText = [...accumulatedTranscriptsRef.current, finalTranscriptRef.current].join(' ').trim()
          transcriptRef.current = rawFullText
          setRecording(prev => ({ ...prev, transcript: displayText }))
        } else {
          // Interim: show accumulated + final + interim (no diarization for interim)
          const fullText = [...accumulatedTranscriptsRef.current, finalTranscriptRef.current + event.text].join(' ').trim()
          setRecording(prev => ({
            ...prev,
            transcript: fullText
          }))
        }
      })

      service.on('utteranceEnd', () => {
        console.log('🔇 [GLOBAL VOICE] Deepgram utterance end (1.5s silence)')
        // Session 17: Save current segment and CLEAR finalTranscriptRef to start fresh
        // The accumulated display still shows all previous segments + new text
        if (finalTranscriptRef.current.trim().length > 0) {
          console.log('📝 [GLOBAL VOICE] Auto-saving segment', segmentCount + 1, ':', finalTranscriptRef.current.trim().substring(0, 60))
          accumulatedTranscriptsRef.current.push(finalTranscriptRef.current.trim())
          setSegmentCount(prev => prev + 1)
          finalTranscriptRef.current = '' // Clear for next segment — accumulated text shown via accumulatedTranscriptsRef
        }
      })

      service.on('error', (err: Error) => {
        console.error('❌ [GLOBAL VOICE] Deepgram error:', err.message)
        setDeepgramStatus('error')
        // Fall back to browser STT
        console.log('🔄 [GLOBAL VOICE] Falling back to browser Speech API...')
        setSttMode('browser')
        startBrowserSTT()
      })

      service.on('status', (status: string) => {
        if (status === 'connected') {
          setDeepgramStatus('connected')
          deepgramConnectedRef.current = true
          console.log('✅ [GLOBAL VOICE] Deepgram connected — recording with no time limit')
        } else if (status === 'disconnected') {
          setDeepgramStatus('idle')
          deepgramConnectedRef.current = false
          // If still recording, Deepgram dropped — auto-reconnect
          if (isRecordingRef.current) {
            console.log('🔄 [GLOBAL VOICE] Deepgram disconnected while recording, reconnecting...')
            // Save current segment first
            if (finalTranscriptRef.current.trim().length > 0) {
              accumulatedTranscriptsRef.current.push(finalTranscriptRef.current.trim())
              setSegmentCount(prev => prev + 1)
              finalTranscriptRef.current = ''
            }
            // Session 20: Stabilize display during reconnection gap — show accumulated text
            // so the transcript doesn't flicker/reset while Deepgram reconnects
            const stableText = accumulatedTranscriptsRef.current.join(' ').trim()
            if (stableText) {
              transcriptRef.current = stableText
              setRecording(prev => ({ ...prev, transcript: stableText }))
              onTranscriptUpdate?.(stableText)
            }
            // Reconnect after brief delay
            setTimeout(() => {
              if (isRecordingRef.current) {
                startDeepgramSTT()
              }
            }, 1000)
          }
        }
      })

      deepgramServiceRef.current = service
      await service.connect()
      return true
    } catch (err) {
      console.error('❌ [GLOBAL VOICE] Deepgram failed to start:', err)
      setDeepgramStatus('error')
      return false
    }
  }

  // ─── BROWSER STT (FALLBACK) ───────────────────────────────────

  const startBrowserSTT = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser')
      return
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = selectedLanguage

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript + ' '

          // Check for stop command
          if (detectStopCommand(transcript)) {
            console.log('🛑 [STOP COMMAND] Detected voice stop command:', transcript)
            setTimeout(() => stopRecording(), 500)
            return
          }
        } else {
          interimTranscript += transcript
        }
      }
      const fullTranscript = finalTranscriptRef.current + interimTranscript
      transcriptRef.current = fullTranscript
      setRecording(prev => ({ ...prev, transcript: fullTranscript }))
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('Speech recognition error:', event.error)
      setError(`Speech recognition error: ${event.error}`)
    }

    recognition.onend = () => {
      // Auto-restart if still recording (handles Chrome's ~60s cutoff)
      if (isRecordingRef.current) {
        // Save current segment before restart
        if (finalTranscriptRef.current.trim().length > 0) {
          accumulatedTranscriptsRef.current.push(finalTranscriptRef.current.trim())
          setSegmentCount(prev => prev + 1)
          // Keep the full transcript visible
        }
        setTimeout(() => {
          if (isRecordingRef.current && browserRecognitionRef.current) {
            try {
              console.log('🔄 [GLOBAL VOICE] Auto-restarting browser STT (segment', accumulatedTranscriptsRef.current.length + 1, ')...')
              browserRecognitionRef.current.start()
            } catch (e) {
              console.error('❌ [GLOBAL VOICE] Failed to restart browser STT:', e)
            }
          }
        }, 200)
      }
    }

    browserRecognitionRef.current = recognition
    try {
      recognition.start()
      console.log('🎤 [GLOBAL VOICE] Browser Speech API started (fallback mode)')
    } catch (e) {
      console.error('❌ [GLOBAL VOICE] Failed to start browser STT:', e)
    }
  }

  // ─── RECORDING LIFECYCLE ──────────────────────────────────────

  const requestMicrophoneAccess = async (): Promise<MediaStream | null> => {
    // Session 18: Check secure context before attempting mic access
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('Microphone requires HTTPS. Access the app via https:// to enable voice features.')
      setPermissionStatus('denied')
      return null
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone API not available in this browser/context.')
      setPermissionStatus('denied')
      return null
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      setPermissionStatus('granted')
      setError(null)
      return stream
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setPermissionStatus('denied')
      setError('Microphone access denied. Please allow microphone access to use voice recording.')
      return null
    }
  }

  const startRecording = async (force = false) => {
    // Session 16+17: Use ref for up-to-date prop value. Allow force=true to bypass when
    // event handler already waited for consultationId and timed out.
    if (!isEnabledRef.current && !force) {
      console.warn('⚠️ [GLOBAL VOICE] startRecording called but isEnabled=false (no consultationId)')
      return
    }

    try {
      // Stop wake word listening
      stopWakeWordListening()

      // Session 16: Defensive mic handoff — ensure sidebar mic is deactivated
      window.dispatchEvent(new CustomEvent('endoflow:mic_deactivate'))
      await new Promise(resolve => setTimeout(resolve, 300))

      // Register with voice manager
      voiceManager.registerMicUsage('global-voice-recorder')
      console.log('🎙️ [GLOBAL VOICE] Registered with voice manager')

      await new Promise(resolve => setTimeout(resolve, 200))

      setError(null)
      setIsProcessing(false)
      transcriptRef.current = ''
      finalTranscriptRef.current = ''
      accumulatedTranscriptsRef.current = []
      diarizedSegmentsRef.current = [] // Session 20: Clear diarized segments
      setSegmentCount(0)
      isRecordingRef.current = true
      console.log('🎙️ [START] Starting new recording session...')

      // Start MediaRecorder for audio blob capture
      const stream = await requestMicrophoneAccess()
      if (!stream) {
        isRecordingRef.current = false
        return
      }

      streamRef.current = stream

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      audioChunksRef.current = []
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setRecording(prev => ({ ...prev, audioBlob }))

        // Session 18b: If stop-without-process was requested, just accumulate the segment
        if (skipProcessOnStopRef.current) {
          if (finalTranscriptRef.current.trim()) {
            accumulatedTranscriptsRef.current.push(finalTranscriptRef.current.trim())
            console.log('📝 [STOP-NO-PROCESS] Segment accumulated. Total segments:', accumulatedTranscriptsRef.current.length)
          }
          finalTranscriptRef.current = ''
          skipProcessOnStopRef.current = false
          // Update transcript display to show all accumulated segments
          const fullText = accumulatedTranscriptsRef.current.join(' ')
          transcriptRef.current = fullText
          setRecording(prev => ({ ...prev, transcript: fullText }))
          return
        }

        // Merge all accumulated segments + current transcript
        const allSegments = [...accumulatedTranscriptsRef.current]
        if (finalTranscriptRef.current.trim()) {
          allSegments.push(finalTranscriptRef.current.trim())
        }
        const mergedTranscript = allSegments.join(' ')

        console.log('🎤 [STOP] Processing merged transcript from', allSegments.length, 'segments, total length:', mergedTranscript.length)
        await processRecording(audioBlob, mergedTranscript)
      }

      mediaRecorderRef.current.start(1000)

      // Start STT: try Deepgram first, fall back to browser
      setSttMode('deepgram')
      const deepgramStarted = await startDeepgramSTT()
      if (!deepgramStarted) {
        console.log('🔄 [GLOBAL VOICE] Deepgram unavailable, using browser STT')
        setSttMode('browser')
        startBrowserSTT()
      }

      const sessionId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      setRecording({
        isRecording: true,
        isPaused: false,
        startTime: new Date(),
        duration: 0,
        transcript: '',
        audioBlob: null,
        sessionId
      })

      intervalRef.current = setInterval(() => {
        setRecording(prev => ({
          ...prev,
          duration: prev.startTime ? Date.now() - prev.startTime.getTime() : 0
        }))
      }, 1000)

      // Session 12: Notify sidebar rail that recording started
      window.dispatchEvent(new CustomEvent('endoflow:recording_started'))

      if (consultationId) {
        await startVoiceSession(consultationId, sessionId)
      }

    } catch (error) {
      console.error('Error starting recording:', error)
      setError('Failed to start recording. Please try again.')
      isRecordingRef.current = false
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recording.isRecording && !recording.isPaused) {
      mediaRecorderRef.current.pause()

      // Pause Deepgram or browser STT
      if (sttMode === 'deepgram' && deepgramServiceRef.current) {
        // Deepgram: disconnect but save segment
        if (finalTranscriptRef.current.trim()) {
          accumulatedTranscriptsRef.current.push(finalTranscriptRef.current.trim())
          setSegmentCount(prev => prev + 1)
          finalTranscriptRef.current = ''
        }
        deepgramServiceRef.current.disconnect()
        deepgramServiceRef.current = null
      } else if (browserRecognitionRef.current) {
        try { browserRecognitionRef.current.stop() } catch (e) { /* ignore */ }
      }

      setRecording(prev => ({ ...prev, isPaused: true }))
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  const resumeRecording = async () => {
    if (mediaRecorderRef.current && recording.isRecording && recording.isPaused) {
      mediaRecorderRef.current.resume()

      // Resume STT
      if (sttMode === 'deepgram') {
        await startDeepgramSTT()
      } else {
        startBrowserSTT()
      }

      setRecording(prev => ({ ...prev, isPaused: false }))
      intervalRef.current = setInterval(() => {
        setRecording(prev => ({
          ...prev,
          duration: prev.startTime ? Date.now() - prev.startTime.getTime() : 0
        }))
      }, 1000)
    }
  }

  const stopRecording = async () => {
    if (!isRecordingRef.current && !recording.isRecording) return

    isRecordingRef.current = false

    // Unregister from voice manager
    voiceManager.unregisterMicUsage('global-voice-recorder')
    console.log('🛑 [GLOBAL VOICE] Unregistered from voice manager')

    // Stop Deepgram
    if (deepgramServiceRef.current) {
      deepgramServiceRef.current.disconnect()
      deepgramServiceRef.current = null
      deepgramConnectedRef.current = false
    }

    // Stop browser STT
    if (browserRecognitionRef.current) {
      try { browserRecognitionRef.current.stop() } catch (e) { /* ignore */ }
      browserRecognitionRef.current = null
    }

    // Stop MediaRecorder (triggers onstop → processRecording)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    setRecording(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false
    }))

    // Session 12: Notify sidebar rail that recording stopped
    window.dispatchEvent(new CustomEvent('endoflow:recording_stopped'))

    setDeepgramStatus('idle')
    cleanup()
  }

  // Session 18b: Stop recording WITHOUT triggering AI processing
  // Accumulates the current segment into accumulatedTranscriptsRef for later batch processing
  // Used when dentist wants to stop, record more for another tooth, then process all together
  const stopRecordingNoProcess = async () => {
    if (!isRecordingRef.current && !recording.isRecording) return
    console.log('⏹️ [GLOBAL VOICE] Stopping recording WITHOUT processing (accumulate mode)')
    skipProcessOnStopRef.current = true // onstop handler will see this and skip processRecording

    isRecordingRef.current = false

    // Unregister from voice manager
    voiceManager.unregisterMicUsage('global-voice-recorder')

    // Stop Deepgram
    if (deepgramServiceRef.current) {
      deepgramServiceRef.current.disconnect()
      deepgramServiceRef.current = null
      deepgramConnectedRef.current = false
    }

    // Stop browser STT
    if (browserRecognitionRef.current) {
      try { browserRecognitionRef.current.stop() } catch (e) { /* ignore */ }
      browserRecognitionRef.current = null
    }

    // Stop MediaRecorder — triggers onstop which will see skipProcessOnStopRef=true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    setRecording(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false
    }))

    // Notify sidebar that recording stopped (copilot stays open for review/more recording)
    window.dispatchEvent(new CustomEvent('endoflow:recording_stopped'))

    setDeepgramStatus('idle')
    // NOTE: Do NOT call cleanup() here — we keep the stream alive for potential resume/restart
  }

  const cleanup = () => {
    // Session 20: Comprehensive cleanup — stops ALL audio sources to prevent mic leak
    // Previously only stopped the media stream and interval, leaving Deepgram and browser STT active
    if (deepgramServiceRef.current) {
      try { deepgramServiceRef.current.disconnect() } catch (e) { /* ignore */ }
      deepgramServiceRef.current = null
      deepgramConnectedRef.current = false
    }
    if (browserRecognitionRef.current) {
      try { browserRecognitionRef.current.stop() } catch (e) { /* ignore */ }
      browserRecognitionRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // ─── SESSION 12: Custom event bridge for Master AI voice commands ──────
  // Allows "Hey EndoFlow, start recording" and "stop recording" to control this recorder.
  useEffect(() => {
    const handleStartEvent = async () => {
      console.log('🎤 [GLOBAL RECORDER] Received endoflow:start_recording event')
      if (isRecordingRef.current) {
        console.log('🎤 [GLOBAL RECORDER] Already recording, ignoring start event')
        return
      }
      // Session 16+17: Wait for consultationId/isEnabled to become true (draft creation may be in progress)
      // Increased timeout to 10 seconds (50 × 200ms) to handle slow draft creation
      if (!isEnabledRef.current) {
        console.log('⏳ [GLOBAL RECORDER] Waiting for consultation draft to be created...')
        for (let i = 0; i < 50; i++) { // up to 10 seconds (50 × 200ms)
          await new Promise(r => setTimeout(r, 200))
          if (isEnabledRef.current) break
          if (i % 10 === 9) console.log(`⏳ [GLOBAL RECORDER] Still waiting... (${(i + 1) * 200}ms)`)
        }
        if (!isEnabledRef.current) {
          console.warn('⚠️ [GLOBAL RECORDER] Timed out waiting for consultationId (10s) — force-starting without consultationId')
          // Session 17: Force-start recording even without consultationId — transcript still captured
          // The consultationId will be set later when the draft is created
          startRecording(true) // force=true bypasses isEnabled guard
          return
        } else {
          console.log('✅ [GLOBAL RECORDER] Consultation draft ready — starting recording')
        }
      }
      startRecording()
    }

    const handleStopEvent = () => {
      console.log('🎤 [GLOBAL RECORDER] Received endoflow:stop_recording event')
      if (isRecordingRef.current) {
        stopRecording()
      } else {
        console.log('🎤 [GLOBAL RECORDER] Not recording, ignoring stop event')
      }
    }

    // Session 13: Pause, resume, process, and read-back events
    const handlePauseEvent = () => {
      console.log('⏸️ [GLOBAL RECORDER] Received endoflow:pause_recording event')
      if (isRecordingRef.current && !recording.isPaused) {
        pauseRecording()
      }
    }

    const handleResumeEvent = () => {
      console.log('▶️ [GLOBAL RECORDER] Received endoflow:resume_recording event')
      if (isRecordingRef.current && recording.isPaused) {
        resumeRecording()
      }
    }

    const handleProcessEvent = () => {
      console.log('🧠 [GLOBAL RECORDER] Received endoflow:process_recording event')
      if (isRecordingRef.current) {
        // Process = stop recording AND run the AI pipeline (same as stopRecording which triggers processRecording in onstop)
        stopRecording()
      } else if (accumulatedTranscriptsRef.current.length > 0) {
        // Session 18b: Recording already stopped but segments accumulated — process them now
        console.log('🧠 [GLOBAL RECORDER] Processing', accumulatedTranscriptsRef.current.length, 'accumulated segments')
        const mergedTranscript = accumulatedTranscriptsRef.current.join(' ')
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        processRecording(audioBlob, mergedTranscript)
      }
    }

    // Session 18b: Stop recording without processing (accumulate segment for later)
    const handleStopNoProcessEvent = () => {
      console.log('⏹️ [GLOBAL RECORDER] Received endoflow:stop_recording_no_process event')
      if (isRecordingRef.current) {
        stopRecordingNoProcess()
      }
    }

    const handleReadBackEvent = async () => {
      console.log('🔊 [GLOBAL RECORDER] Received endoflow:read_back event')
      // Assemble all segments + current transcript
      const allSegments = [...accumulatedTranscriptsRef.current]
      if (finalTranscriptRef.current.trim()) {
        allSegments.push(finalTranscriptRef.current.trim())
      }
      const mergedTranscript = allSegments.join(' ')
      if (mergedTranscript.trim()) {
        try {
          const { speakWithTTS } = await import('@/lib/services/tts-service')
          speakWithTTS(`Here's what we have so far: ${mergedTranscript.substring(0, 500)}`)
        } catch (e) {
          console.error('TTS read-back failed:', e)
        }
      } else {
        try {
          const { speakWithTTS } = await import('@/lib/services/tts-service')
          speakWithTTS('No transcript recorded yet.')
        } catch (e) { /* swallow */ }
      }
    }

    window.addEventListener('endoflow:start_recording', handleStartEvent)
    window.addEventListener('endoflow:stop_recording', handleStopEvent)
    window.addEventListener('endoflow:stop_recording_no_process', handleStopNoProcessEvent)
    window.addEventListener('endoflow:pause_recording', handlePauseEvent)
    window.addEventListener('endoflow:resume_recording', handleResumeEvent)
    window.addEventListener('endoflow:process_recording', handleProcessEvent)
    window.addEventListener('endoflow:read_back', handleReadBackEvent)

    return () => {
      window.removeEventListener('endoflow:start_recording', handleStartEvent)
      window.removeEventListener('endoflow:stop_recording', handleStopEvent)
      window.removeEventListener('endoflow:stop_recording_no_process', handleStopNoProcessEvent)
      window.removeEventListener('endoflow:pause_recording', handlePauseEvent)
      window.removeEventListener('endoflow:resume_recording', handleResumeEvent)
      window.removeEventListener('endoflow:process_recording', handleProcessEvent)
      window.removeEventListener('endoflow:read_back', handleReadBackEvent)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startVoiceSession = async (consultationId: string, sessionId: string) => {
    try {
      const response = await fetch('/api/voice/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId,
          sessionId,
          sectionId: 'global_recording'
        })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.warn('⚠️ Voice session start failed (non-critical):', errorData)
        return
      }
      console.log('✅ Voice session started successfully')
    } catch (error) {
      console.warn('⚠️ Error starting voice session (non-critical):', error)
    }
  }

  const processRecording = async (audioBlob: Blob, transcript: string) => {
    // Session 16: Use ref for up-to-date consultationId (prop may have changed since closure capture)
    const activeConsultationId = consultationIdRef.current || consultationId
    console.log('🎤 [PROCESS] Called with:', {
      consultationId: activeConsultationId,
      transcriptLength: transcript.length,
      transcriptPreview: transcript.substring(0, 100),
      audioBlobSize: audioBlob.size,
      totalSegments: accumulatedTranscriptsRef.current.length
    })

    if (!activeConsultationId) {
      console.error('❌ [PROCESS] No consultationId provided!')
      setError('Cannot process recording: No consultation ID')
      return
    }

    if (!transcript.trim()) {
      console.error('❌ [PROCESS] Empty transcript!')
      setError('Cannot process recording: No transcript captured')
      return
    }

    try {
      setIsProcessing(true)
      console.log('🚀 [PROCESS] Sending to AI processing endpoint...')

      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('transcript', transcript)
      formData.append('consultationId', activeConsultationId)
      formData.append('sessionId', recording.sessionId || '')
      formData.append('language', selectedLanguage)
      console.log('🌐 [PROCESS] Sending transcript with language:', selectedLanguage)

      const response = await fetch('/api/voice/process-global-transcript', {
        method: 'POST',
        body: formData
      })

      console.log('📡 [PROCESS] Response status:', response.status)

      if (!response.ok) {
        throw new Error('Failed to process recording')
      }

      const result = await response.json()

      if (result.success && result.processedContent) {
        onContentProcessed?.(result.processedContent)
        // Session 17: Dispatch event for sidebar copilot tabs
        window.dispatchEvent(new CustomEvent('endoflow:ai_results_ready', {
          detail: {
            processedContent: result.processedContent,
            toothDiagnoses: result.toothDiagnoses || [],
            consultationId: activeConsultationId,
          }
        }))
      }

      if (result.success && result.toothDiagnoses && result.toothDiagnoses.length > 0) {
        console.log(`✅ [VOICE] ${result.toothDiagnoses.length} tooth diagnoses extracted from voice`)
        onToothDiagnosesExtracted?.(result.toothDiagnoses)
      }

    } catch (error) {
      console.error('Error processing recording:', error)
      setError('Failed to process recording. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getRecordingStatus = () => {
    if (isProcessing) return 'Processing...'
    if (recording.isRecording && recording.isPaused) return 'Paused'
    if (recording.isRecording) return 'Recording...'
    return 'Ready'
  }

  const getStatusColor = () => {
    if (isProcessing) return 'bg-blue-500/15 text-blue-400'
    if (recording.isRecording && recording.isPaused) return 'bg-yellow-500/15 text-yellow-400'
    if (recording.isRecording) return 'bg-red-500/100/15 text-red-400'
    return 'bg-green-500/15 text-green-400'
  }

  // Session 17: Headless mode — logic runs, UI hidden (controls in sidebar)
  if (headless) return null

  if (permissionStatus === 'denied') {
    return (
      <Card className="border-red-200 bg-red-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-800">Microphone Access Required</p>
              <p className="text-xs text-red-400">Please allow microphone access in your browser settings to use voice recording.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-dashed border-border bg-muted">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {recording.isRecording ? (
                <div className="flex gap-2">
                  {recording.isPaused ? (
                    <Button
                      onClick={resumeRecording}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={!isEnabled}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      onClick={pauseRecording}
                      size="sm"
                      variant="outline"
                      disabled={!isEnabled}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </Button>
                  )}

                  {/* Session 13: Process = merge + AI pipeline */}
                  <Button
                    onClick={stopRecording}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={!isEnabled}
                    title="Merge all segments and run AI diagnosis"
                  >
                    <Brain className="w-4 h-4 mr-1" />
                    Process
                  </Button>

                  {/* Session 13: Discard = cancel without processing */}
                  <Button
                    onClick={() => {
                      // Cancel recording without triggering processRecording
                      isRecordingRef.current = false
                      voiceManager.unregisterMicUsage('global-voice-recorder')
                      if (deepgramServiceRef.current) {
                        deepgramServiceRef.current.disconnect()
                        deepgramServiceRef.current = null
                      }
                      if (browserRecognitionRef.current) {
                        try { browserRecognitionRef.current.stop() } catch (e) { /* */ }
                        browserRecognitionRef.current = null
                      }
                      // Stop media recorder WITHOUT triggering onstop handler
                      if (mediaRecorderRef.current) {
                        mediaRecorderRef.current.onstop = null
                        if (mediaRecorderRef.current.state !== 'inactive') {
                          mediaRecorderRef.current.stop()
                        }
                      }
                      if (intervalRef.current) clearInterval(intervalRef.current)
                      accumulatedTranscriptsRef.current = []
                      diarizedSegmentsRef.current = [] // Session 20
                      setSegmentCount(0)
                      finalTranscriptRef.current = ''
                      transcriptRef.current = ''
                      setRecording({ isRecording: false, isPaused: false, startTime: null, duration: 0, transcript: '', audioBlob: null, sessionId: '' })
                      window.dispatchEvent(new CustomEvent('endoflow:recording_stopped'))
                      cleanup()
                    }}
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-red-400"
                    disabled={!isEnabled}
                    title="Discard recording"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => startRecording()}
                    size="lg"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={!isEnabled || isProcessing}
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Start Global Recording
                  </Button>

                  {/* Wake Word Toggle */}
                  <Button
                    onClick={() => {
                      if (isWakeWordListening) {
                        stopWakeWordListening()
                      } else {
                        startWakeWordListening()
                      }
                    }}
                    size="lg"
                    variant={isWakeWordListening ? "default" : "outline"}
                    className={cn(
                      isWakeWordListening && "bg-teal-600 hover:bg-teal-700"
                    )}
                    disabled={!isEnabled || isProcessing || recording.isRecording}
                    title='Say "Start consultation" or "Start recording" to begin hands-free'
                  >
                    {isWakeWordListening ? (
                      <>
                        <Volume2 className="w-5 h-5 mr-2 animate-pulse" />
                        Listening...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-5 h-5 mr-2" />
                        Hands-Free
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Language Selector */}
            {!recording.isRecording && (
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-foreground hover:bg-muted border-border"
                  title="Select language"
                  disabled={!isEnabled}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  <span className="text-xs">
                    {selectedLanguage === 'en-US' ? 'English (US)' : selectedLanguage === 'en-IN' ? 'English (India)' : 'हिंदी'}
                  </span>
                </Button>
                <div className="absolute left-0 top-full mt-1 bg-card rounded-lg shadow-xl border border-border py-1 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => setSelectedLanguage('en-US')}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-teal-500/10 flex items-center gap-2",
                      selectedLanguage === 'en-US' && "bg-teal-500/15 text-teal-400 font-semibold"
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    <div>
                      <div>English (US)</div>
                      <div className="text-xs text-muted-foreground">Standard American</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedLanguage('en-IN')}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-teal-500/10 flex items-center gap-2",
                      selectedLanguage === 'en-IN' && "bg-teal-500/15 text-teal-400 font-semibold"
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    <div>
                      <div>English (India)</div>
                      <div className="text-xs text-muted-foreground">Indian English accent</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedLanguage('hi-IN')}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-teal-500/10 flex items-center gap-2",
                      selectedLanguage === 'hi-IN' && "bg-teal-500/15 text-teal-400 font-semibold"
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    <div>
                      <div>हिंदी (Hindi)</div>
                      <div className="text-xs text-muted-foreground">Hindi language</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Badge variant="outline" className={getStatusColor()}>
                {getRecordingStatus()}
              </Badge>

              {recording.isRecording && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500/100 rounded-full animate-pulse"></div>
                    <span className="text-sm font-mono">
                      {formatDuration(recording.duration)}
                    </span>
                  </div>

                  {/* STT Engine Badge */}
                  <Badge variant="outline" className={cn(
                    "text-xs border",
                    sttMode === 'deepgram'
                      ? "bg-purple-500/10 text-purple-400 border-purple-300"
                      : "bg-blue-500/10 text-blue-400 border-blue-300"
                  )}>
                    {sttMode === 'deepgram' ? (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Deepgram Medical
                      </>
                    ) : (
                      <>
                        <Globe className="h-3 w-3 mr-1" />
                        Browser STT
                      </>
                    )}
                  </Badge>

                  {/* Language Badge */}
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-300">
                    <Globe className="h-3 w-3 mr-1" />
                    {selectedLanguage === 'en-US' ? 'English (US)' : selectedLanguage === 'en-IN' ? 'English (India)' : 'हिंदी (Hindi)'}
                  </Badge>

                  {/* Segment Counter */}
                  {segmentCount > 0 && (
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-300">
                      <Layers className="h-3 w-3 mr-1" />
                      {segmentCount + 1} segments
                    </Badge>
                  )}
                </>
              )}

              {/* Wake Word Indicator */}
              {isWakeWordListening && !recording.isRecording && (
                <Badge variant="outline" className="text-xs bg-teal-500/10 text-teal-400 border-teal-300 animate-pulse">
                  <Volume2 className="h-3 w-3 mr-1" />
                  Say &quot;Start consultation&quot;
                </Badge>
              )}

              {recording.transcript && (
                <div className="flex items-center gap-1">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Transcribing...
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}
        </div>

        {recording.transcript && (
          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-blue-400 font-semibold uppercase tracking-wide flex items-center gap-1">
                <Activity className="h-3 w-3" />
                AI Processing Live Transcript
              </Label>
              <Badge className="bg-gradient-to-r from-blue-600 to-teal-600 text-white text-xs border-0">
                <Sparkles className="h-3 w-3 mr-1" />
                {sttMode === 'deepgram' ? 'Deepgram + Claude AI' : 'Browser STT + Claude AI'}
              </Badge>
            </div>
            <p className="text-sm text-foreground mt-1 max-h-32 overflow-y-auto bg-card p-2 rounded border border-blue-100">
              {recording.transcript}
            </p>

            {/* Real-time AI Detection Indicators */}
            {(() => {
              const analysis = analyzeConversationCompleteness(recording.transcript)
              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.hasChiefComplaint && (
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-300">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Chief Complaint Detected
                    </Badge>
                  )}
                  {analysis.hasHOPI && (
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-300">
                      <Activity className="h-3 w-3 mr-1" />
                      HOPI Details Found
                    </Badge>
                  )}
                  {analysis.hasPainDescription && (
                    <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-300">
                      Pain Descriptors Found
                    </Badge>
                  )}
                  {analysis.estimatedConfidence > 0 && (
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-300">
                      Confidence: ~{analysis.estimatedConfidence}%
                    </Badge>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        <div className="mt-3 text-xs text-muted-foreground">
          <p><strong>Global Voice Recording:</strong> Records your entire consultation using {sttMode === 'deepgram' ? 'Deepgram Medical AI' : 'browser speech recognition'} and automatically fills tabs.</p>
          <p className="mt-1">
            {recording.isRecording
              ? '🗣️ Say "Stop recording" or "Done recording" to stop hands-free. Long pauses (10s+) are OK.'
              : '💡 Click "Hands-Free" then say "Start consultation" to begin without touching the screen.'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
