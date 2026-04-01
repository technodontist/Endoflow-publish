'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { DeepgramSTTService, type DeepgramSTTConfig, type DeepgramTranscriptEvent } from '@/lib/services/deepgram-stt'

interface UseDeepgramRecognitionOptions {
  language?: string // 'en' | 'hi' | 'multi' | 'en-US' | 'en-IN' | 'hi-IN'
  onResult?: (transcript: string) => void
  onEnd?: () => void
  onError?: (error: string) => void
  onUtteranceEnd?: () => void
}

interface DeepgramRecognitionHook {
  isListening: boolean
  isConnecting: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  isSupported: boolean // always true for Deepgram (only needs getUserMedia)
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

/** Map full locale codes to Deepgram language codes */
function mapLanguage(lang: string): string {
  const map: Record<string, string> = {
    'en-US': 'en',
    'en-IN': 'en',
    'hi-IN': 'hi',
    'en': 'en',
    'hi': 'hi',
    'multi': 'multi',
  }
  return map[lang] || 'en'
}

export function useDeepgramRecognition(options: UseDeepgramRecognitionOptions = {}): DeepgramRecognitionHook {
  const {
    language = 'en',
    onResult,
    onEnd,
    onError,
    onUtteranceEnd,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const serviceRef = useRef<DeepgramSTTService | null>(null)
  const finalTranscriptRef = useRef('')
  const isListeningRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.disconnect()
    }
  }, [])

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return

    setError(null)
    setIsConnecting(true)

    try {
      const deepgramLang = mapLanguage(language)

      const service = new DeepgramSTTService({
        language: deepgramLang,
        model: 'nova-2-medical',
        interimResults: true,
        smartFormat: true,
        utteranceEndMs: 1500,
        vadEvents: true,
      })

      // Handle transcripts
      service.on('transcript', (event: DeepgramTranscriptEvent) => {
        if (event.isFinal) {
          // Accumulate final transcript
          finalTranscriptRef.current += event.text + ' '
          setTranscript(finalTranscriptRef.current.trim())
          setInterimTranscript('')
          onResult?.(finalTranscriptRef.current.trim())
        } else {
          // Show interim (partial) result
          setInterimTranscript(event.text)
        }
      })

      // Handle silence (utterance end)
      service.on('utteranceEnd', () => {
        console.log('🔇 [DEEPGRAM HOOK] Utterance end')
        onUtteranceEnd?.()
      })

      // Handle errors
      service.on('error', (err: Error) => {
        console.error('❌ [DEEPGRAM HOOK] Error:', err.message)
        setError(err.message)
        onError?.(err.message)
      })

      // Handle status changes
      service.on('status', (status: string) => {
        if (status === 'connected') {
          setIsConnecting(false)
          setIsListening(true)
          isListeningRef.current = true
          console.log('✅ [DEEPGRAM HOOK] Listening started')
        } else if (status === 'disconnected') {
          setIsListening(false)
          setIsConnecting(false)
          isListeningRef.current = false
          onEnd?.()
        } else if (status === 'error') {
          setIsListening(false)
          setIsConnecting(false)
          isListeningRef.current = false
        }
      })

      serviceRef.current = service
      await service.connect()

    } catch (err) {
      console.error('❌ [DEEPGRAM HOOK] Failed to start:', err)
      setIsConnecting(false)
      setIsListening(false)
      isListeningRef.current = false

      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to Deepgram'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }, [language, onResult, onEnd, onError, onUtteranceEnd])

  const stopListening = useCallback(() => {
    console.log('🛑 [DEEPGRAM HOOK] Stopping...')
    serviceRef.current?.disconnect()
    serviceRef.current = null
    setIsListening(false)
    setIsConnecting(false)
    isListeningRef.current = false
    setInterimTranscript('')
  }, [])

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')
  }, [])

  return {
    isListening,
    isConnecting,
    transcript,
    interimTranscript,
    error,
    isSupported: typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext,
    startListening,
    stopListening,
    resetTranscript,
  }
}
