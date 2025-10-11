import { useState, useEffect, useRef, useCallback } from 'react'

interface UseSpeechRecognitionOptions {
  continuous?: boolean
  interimResults?: boolean
  lang?: string
  onResult?: (transcript: string) => void
  onEnd?: () => void
  onError?: (error: string) => void
}

interface SpeechRecognitionHook {
  isListening: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): SpeechRecognitionHook {
  const {
    continuous = true,
    interimResults = true,
    lang = 'en-US',
    onResult,
    onEnd,
    onError
  } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef('')

  // Check if speech recognition is supported
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    setIsSupported(supported)

    if (supported) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()

      recognitionRef.current.continuous = continuous
      recognitionRef.current.interimResults = interimResults
      recognitionRef.current.lang = lang

      recognitionRef.current.onresult = (event: any) => {
        let interim = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript
          
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += transcriptPart + ' '
          } else {
            interim += transcriptPart
          }
        }

        const fullTranscript = finalTranscriptRef.current + interim
        setTranscript(fullTranscript)
        setInterimTranscript(interim)
        onResult?.(fullTranscript)
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return
        }
        
        const errorMessage = `Speech recognition error: ${event.error}`
        setError(errorMessage)
        onError?.(errorMessage)
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
        onEnd?.()
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [continuous, interimResults, lang])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in your browser')
      return
    }

    if (recognitionRef.current && !isListening) {
      try {
        finalTranscriptRef.current = ''
        setTranscript('')
        setInterimTranscript('')
        setError(null)
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.error('Error starting speech recognition:', err)
        setError('Failed to start speech recognition')
      }
    }
  }, [isSupported, isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.error('Error stopping speech recognition:', err)
      }
    }
  }, [isListening])

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  }
}
