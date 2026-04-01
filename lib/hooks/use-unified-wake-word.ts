'use client'

/**
 * Unified Wake Word Hook
 *
 * A single Deepgram STT stream (or browser SpeechRecognition fallback)
 * that listens for wake words and routes them to registered handlers
 * via the VoiceManager context.
 *
 * Replaces the separate wake word listeners in:
 * - GlobalVoiceRecorder ("start consultation", "start recording")
 * - EndoFlowVoiceController ("hey endoflow", "hey endo flow")
 *
 * Uses priority 10 (lowest — background listener).
 *
 * Session 7: Wake Word Unification
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useVoiceManager, MIC_PRIORITY } from '@/lib/contexts/voice-manager-context'

interface UseUnifiedWakeWordOptions {
  enabled?: boolean
  language?: string
}

export function useUnifiedWakeWord(options: UseUnifiedWakeWordOptions = {}) {
  const { enabled = true, language = 'en-US' } = options
  const voiceManager = useVoiceManager()
  const [isListening, setIsListening] = useState(false)
  const [lastDetected, setLastDetected] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef(false)
  const enabledRef = useRef(enabled)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const micDeniedRef = useRef(false) // Prevent infinite retry when mic denied

  useEffect(() => {
    enabledRef.current = enabled
    // Reset denied flag when re-enabled (user may have changed permissions)
    if (enabled) micDeniedRef.current = false
  }, [enabled])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  const startListening = useCallback(() => {
    // Don't start if mic was denied (prevents infinite retry loop)
    if (micDeniedRef.current) {
      return
    }

    // Session 18: Guard for non-secure contexts (HTTP on mobile LAN)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      console.warn('🎯 [WAKE WORD] Non-secure context — mic unavailable. Use HTTPS.')
      return
    }

    // Don't start if another mic is active
    if (voiceManager.isAnyMicActive()) {
      console.log('🎯 [WAKE WORD] Cannot start — another mic is active')
      return
    }

    // Use browser SpeechRecognition (lightweight, no API costs)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('🎯 [WAKE WORD] SpeechRecognition not supported in this browser')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      // iOS Safari: continuous mode is unreliable — use shorter sessions with auto-restart
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      recognition.continuous = !isIOS // Disable continuous on iOS, rely on onend restart
      recognition.interimResults = true
      recognition.lang = language

      recognition.onresult = (event: any) => {
        // Accumulate recent results for matching
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }

        if (!transcript.trim()) return

        console.log(`🎯 [WAKE WORD] Heard: "${transcript}"`)

        // Check against registered wake word routes
        const match = voiceManager.matchWakeWord(transcript)
        if (match) {
          console.log(`🎯 [WAKE WORD] MATCHED: "${transcript}" → route "${match.id}"`)
          setLastDetected(match.id)

          // Stop wake word listening before invoking handler
          stopListening()

          // Session 14: Expand sidebar and activate mic via CustomEvent
          window.dispatchEvent(new CustomEvent('endoflow:wake_word_detected', {
            detail: { wakeWord: match.id, transcript }
          }))

          // Invoke the handler (which should requestMic at its own priority)
          match.handler(transcript)
        }
      }

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Normal — just restart
          return
        }
        if (event.error === 'not-allowed') {
          console.warn('🎯 [WAKE WORD] Microphone permission denied. Click the mic button to grant access first.')
          micDeniedRef.current = true // Stop retrying
          setIsListening(false)
          return
        }
        console.warn(`🎯 [WAKE WORD] Error: ${event.error}`)
      }

      recognition.onend = () => {
        // Auto-restart if still enabled, no other mic active, and mic not denied
        if (enabledRef.current && !voiceManager.isAnyMicActive() && !micDeniedRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (enabledRef.current && !voiceManager.isAnyMicActive() && !micDeniedRef.current) {
              try {
                recognition.start()
              } catch {
                // Already started or mic busy
              }
            }
          }, 300)
        } else {
          setIsListening(false)
        }
      }

      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
      voiceManager.notifyWakeWordStatus(true)
      console.log('🎯 [WAKE WORD] Unified wake word listener started')
    } catch (error) {
      console.error('🎯 [WAKE WORD] Failed to start:', error)
    }
  }, [language, voiceManager])

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null // Prevent auto-restart
        recognitionRef.current.stop()
      } catch {
        // Already stopped
      }
      recognitionRef.current = null
    }
    setIsListening(false)
    voiceManager.notifyWakeWordStatus(false)
    console.log('🎯 [WAKE WORD] Unified wake word listener stopped')
  }, [voiceManager])

  // Auto-start when enabled and no mic active
  useEffect(() => {
    if (enabled && !isListeningRef.current && !voiceManager.isAnyMicActive()) {
      startListening()
    } else if (!enabled && isListeningRef.current) {
      stopListening()
    }
  }, [enabled, voiceManager.activeMicCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-start when other mics release
  useEffect(() => {
    if (enabled && voiceManager.activeMicCount === 0 && !isListeningRef.current) {
      const timeout = setTimeout(() => {
        if (enabledRef.current && !voiceManager.isAnyMicActive()) {
          startListening()
        }
      }, 500) // Small delay to let state settle
      return () => clearTimeout(timeout)
    }
  }, [voiceManager.activeMicCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isListening,
    lastDetected,
    startListening,
    stopListening,
  }
}
