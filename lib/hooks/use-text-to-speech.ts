import { useState, useEffect, useRef, useCallback } from 'react'

interface UseTextToSpeechOptions {
  lang?: string
  rate?: number
  pitch?: number
  volume?: number
  onEnd?: () => void
  onError?: (error: string) => void
}

interface TextToSpeechHook {
  isSpeaking: boolean
  isPaused: boolean
  isSupported: boolean
  speak: (text: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}): TextToSpeechHook {
  const {
    lang = 'en-US',
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    onEnd,
    onError
  } = options

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Check if speech synthesis is supported
  useEffect(() => {
    const supported = 'speechSynthesis' in window
    setIsSupported(supported)

    return () => {
      if (supported && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!isSupported) {
      onError?.('Text-to-speech is not supported in your browser')
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    // Clean up text - remove markdown formatting
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold **text**
      .replace(/\*([^*]+)\*/g, '$1')     // Remove italic *text*
      .replace(/#+\s/g, '')               // Remove headings #
      .replace(/`([^`]+)`/g, '$1')        // Remove code `text`
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links [text](url)
      .replace(/^[-*+]\s/gm, '')          // Remove bullet points
      .replace(/^\d+\.\s/gm, '')          // Remove numbered lists
      .trim()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = lang
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume

    utterance.onstart = () => {
      setIsSpeaking(true)
      setIsPaused(false)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      setIsPaused(false)
      onEnd?.()
    }

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event)
      setIsSpeaking(false)
      setIsPaused(false)
      onError?.(`Speech error: ${event.error}`)
    }

    utterance.onpause = () => {
      setIsPaused(true)
    }

    utterance.onresume = () => {
      setIsPaused(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [isSupported, lang, rate, pitch, volume, onEnd, onError])

  const pause = useCallback(() => {
    if (isSupported && isSpeaking && !isPaused) {
      window.speechSynthesis.pause()
    }
  }, [isSupported, isSpeaking, isPaused])

  const resume = useCallback(() => {
    if (isSupported && isSpeaking && isPaused) {
      window.speechSynthesis.resume()
    }
  }, [isSupported, isSpeaking, isPaused])

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setIsPaused(false)
    }
  }, [isSupported])

  return {
    isSpeaking,
    isPaused,
    isSupported,
    speak,
    pause,
    resume,
    stop
  }
}
