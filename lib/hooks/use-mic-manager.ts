'use client'

/**
 * useMicManager — Singleton Microphone Authority
 *
 * Session 14: Solves the dual-mic ownership problem where the floating
 * controller and wake word hook fight for the mic.
 *
 * Rules:
 * 1. Only ONE consumer can hold the Deepgram mic at a time
 * 2. Wake word uses browser SpeechRecognition (separate API, no conflict)
 * 3. During TTS playback: Deepgram is paused
 * 4. After TTS ends: 250ms cooldown then Deepgram resumes
 *
 * Components interact with mic ONLY through this hook:
 * - MicPod: calls activateMic() / deactivateMic()
 * - Sidebar: reads state, triggers via CustomEvent
 * - Wake word: separate SpeechRecognition, doesn't go through this
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { DeepgramSTTService, type DeepgramTranscriptEvent } from '@/lib/services/deepgram-stt'

export interface MicManagerState {
  isActive: boolean
  isPaused: boolean
  isConnecting: boolean
  transcript: string
  finalTranscript: string
  error: string | null
}

interface MicManagerOptions {
  language?: string
  clinicalMode?: boolean
  onTranscript?: (text: string, isFinal: boolean) => void
  onUtteranceEnd?: () => void
  onError?: (error: string) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
}

// Module-level singleton state — shared across all hook instances
let _deepgram: DeepgramSTTService | null = null
let _isActive = false
let _isPaused = false
let _listeners = new Set<() => void>()

function notifyListeners() {
  _listeners.forEach(fn => fn())
}

export function useMicManager(options: MicManagerOptions = {}) {
  const [state, setState] = useState<MicManagerState>({
    isActive: _isActive,
    isPaused: _isPaused,
    isConnecting: false,
    transcript: '',
    finalTranscript: '',
    error: null,
  })

  const optionsRef = useRef(options)
  optionsRef.current = options

  // Subscribe to singleton state changes
  useEffect(() => {
    const listener = () => {
      setState(prev => ({
        ...prev,
        isActive: _isActive,
        isPaused: _isPaused,
      }))
    }
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])

  // Listen for TTS events to pause/resume mic
  useEffect(() => {
    const handleTTSStart = () => {
      if (_deepgram && _isActive) {
        console.log('🔇 [MIC MANAGER] Pausing Deepgram during TTS')
        _isPaused = true
        _deepgram.disconnect()
        _deepgram = null
        notifyListeners()
      }
    }

    const handleTTSEnd = () => {
      if (_isPaused && _isActive) {
        // 250ms cooldown to prevent echo tail
        setTimeout(() => {
          if (_isPaused && _isActive) {
            console.log('🎤 [MIC MANAGER] Resuming Deepgram after TTS cooldown')
            _isPaused = false
            notifyListeners()
            // Reconnect
            connectDeepgram(optionsRef.current)
          }
        }, 250)
      }
    }

    window.addEventListener('endoflow:tts_start', handleTTSStart)
    window.addEventListener('endoflow:tts_end', handleTTSEnd)
    return () => {
      window.removeEventListener('endoflow:tts_start', handleTTSStart)
      window.removeEventListener('endoflow:tts_end', handleTTSEnd)
    }
  }, [])

  // Listen for external mic activation (from sidebar button, wake word, etc.)
  useEffect(() => {
    const handleActivate = () => activateMic()
    const handleDeactivate = () => deactivateMic()
    window.addEventListener('endoflow:mic_activate', handleActivate)
    window.addEventListener('endoflow:mic_deactivate', handleDeactivate)
    return () => {
      window.removeEventListener('endoflow:mic_activate', handleActivate)
      window.removeEventListener('endoflow:mic_deactivate', handleDeactivate)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function connectDeepgram(opts: MicManagerOptions) {
    if (_deepgram) return // Already connected

    try {
      const langMap: Record<string, string> = { 'en-US': 'en', 'en-IN': 'en', 'hi-IN': 'hi' }
      const dgLang = langMap[opts.language || 'en-US'] || 'en'

      const service = new DeepgramSTTService({
        language: dgLang,
        clinicalMode: opts.clinicalMode || false,
        interimResults: true,
        smartFormat: true,
        utteranceEndMs: 2000,
        vadEvents: true,
      })

      service.on('transcript', (event: DeepgramTranscriptEvent) => {
        if (_isPaused) return // Ignore during TTS pause

        // Dispatch to sidebar and any other listeners
        window.dispatchEvent(new CustomEvent('endoflow:mic_transcript', {
          detail: { text: event.text, isFinal: event.isFinal, confidence: event.confidence }
        }))

        setState(prev => ({
          ...prev,
          transcript: event.isFinal ? '' : event.text,
          finalTranscript: event.isFinal ? event.text : prev.finalTranscript,
        }))

        optionsRef.current.onTranscript?.(event.text, event.isFinal)
      })

      service.on('utteranceEnd', () => {
        window.dispatchEvent(new CustomEvent('endoflow:mic_utterance_end'))
        optionsRef.current.onUtteranceEnd?.()
      })

      service.on('error', (error: Error) => {
        setState(prev => ({ ...prev, error: error.message }))
        optionsRef.current.onError?.(error.message)
      })

      service.on('status', (status) => {
        optionsRef.current.onStatusChange?.(status)
        if (status === 'connected') {
          setState(prev => ({ ...prev, isConnecting: false, error: null }))
        }
      })

      _deepgram = service
      await service.connect()

    } catch (error: any) {
      console.error('❌ [MIC MANAGER] Failed to connect Deepgram:', error)
      setState(prev => ({ ...prev, isConnecting: false, error: error.message }))
    }
  }

  const activateMic = useCallback(async () => {
    if (_isActive) return // Already active

    // Session 18: Guard for non-secure contexts (HTTP on mobile LAN)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const msg = 'Microphone requires HTTPS. Use pnpm dev:https for mobile testing.'
      console.warn('🎤 [MIC MANAGER]', msg)
      setState(prev => ({ ...prev, error: msg }))
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = 'Microphone API not available in this browser/context.'
      console.warn('🎤 [MIC MANAGER]', msg)
      setState(prev => ({ ...prev, error: msg }))
      return
    }

    console.log('🎤 [MIC MANAGER] Activating mic')
    _isActive = true
    _isPaused = false
    // Expose singleton state on window so late-mounting components can check
    ;(window as any).__endoflow_mic_active = true
    setState(prev => ({ ...prev, isActive: true, isConnecting: true, error: null }))
    notifyListeners()

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('endoflow:mic_started'))

    await connectDeepgram(optionsRef.current)
  }, [])

  const deactivateMic = useCallback(() => {
    if (!_isActive) return

    console.log('🎤 [MIC MANAGER] Deactivating mic')
    _isActive = false
    _isPaused = false
    ;(window as any).__endoflow_mic_active = false

    if (_deepgram) {
      _deepgram.disconnect()
      _deepgram = null
    }

    setState(prev => ({
      ...prev,
      isActive: false,
      isPaused: false,
      isConnecting: false,
      transcript: '',
    }))
    notifyListeners()

    window.dispatchEvent(new CustomEvent('endoflow:mic_stopped'))
  }, [])

  const toggleMic = useCallback(() => {
    if (_isActive) {
      deactivateMic()
    } else {
      activateMic()
    }
  }, [activateMic, deactivateMic])

  return {
    ...state,
    activateMic,
    deactivateMic,
    toggleMic,
  }
}
