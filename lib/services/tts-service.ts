/**
 * EndoFlow Text-to-Speech Service
 *
 * Provides natural-sounding voice output for the Master AI.
 * Uses browser SpeechSynthesis API with:
 * - Smart voice selection (prefers natural/premium voices)
 * - Markdown → speech-friendly text conversion
 * - Response formatting for natural spoken delivery
 * - Chunked speaking for long responses (prevents browser cutoff)
 * - Language-aware voice matching (English, Hindi)
 */

// ─── Types ──────────────────────────────────────────

export interface TTSOptions {
  rate?: number       // 0.5 - 2.0, default 1.0
  pitch?: number      // 0 - 2, default 1.0
  volume?: number     // 0 - 1, default 1.0
  language?: 'en-US' | 'en-IN' | 'hi-IN'
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: any) => void
}

interface VoicePreference {
  name: string
  priority: number // lower = better
}

// ─── Voice Selection ────────────────────────────────

// Preferred voices ranked by quality (platform-specific)
const PREFERRED_VOICES: Record<string, VoicePreference[]> = {
  'en-US': [
    { name: 'Google US English', priority: 1 },
    { name: 'Samantha', priority: 2 },           // macOS
    { name: 'Alex', priority: 3 },                // macOS
    { name: 'Microsoft Zira', priority: 4 },       // Windows
    { name: 'Microsoft David', priority: 5 },      // Windows
    { name: 'Google UK English Female', priority: 6 },
  ],
  'en-IN': [
    { name: 'Google हिन्दी', priority: 1 },
    { name: 'Microsoft Hemant', priority: 2 },
    { name: 'Rishi', priority: 3 },               // macOS
    { name: 'Google US English', priority: 10 },   // fallback
  ],
  'hi-IN': [
    { name: 'Google हिन्दी', priority: 1 },
    { name: 'Microsoft Hemant', priority: 2 },
    { name: 'Lekha', priority: 3 },               // macOS
  ],
}

// Session 13: Cache the selected voice so ALL agents use the SAME voice profile
// This prevents different agents from sounding different
let cachedVoice: SpeechSynthesisVoice | null = null
let cachedVoiceLang: string = ''

/**
 * Find the best available voice for the given language.
 * Caches the result so the same voice is used consistently across all agents.
 */
export function selectBestVoice(language: string = 'en-US'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

  // Return cached voice if language matches
  if (cachedVoice && cachedVoiceLang === language) return cachedVoice

  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const preferences = PREFERRED_VOICES[language] || PREFERRED_VOICES['en-US']

  // Try preferred voices first
  for (const pref of preferences.sort((a, b) => a.priority - b.priority)) {
    const match = voices.find(v => v.name.includes(pref.name))
    if (match) {
      cachedVoice = match
      cachedVoiceLang = language
      console.log(`🔊 [TTS] Selected voice: "${match.name}" (${match.lang}) — will use for all agents`)
      return match
    }
  }

  // Fallback: find any voice matching the language
  const langMatch = voices.find(v => v.lang.startsWith(language.split('-')[0]))
  if (langMatch) {
    cachedVoice = langMatch
    cachedVoiceLang = language
    console.log(`🔊 [TTS] Fallback voice: "${langMatch.name}" (${langMatch.lang})`)
    return langMatch
  }

  // Last resort: default voice
  const fallback = voices.find(v => v.default) || voices[0] || null
  if (fallback) {
    cachedVoice = fallback
    cachedVoiceLang = language
    console.log(`🔊 [TTS] Last-resort voice: "${fallback.name}" (${fallback.lang})`)
  }
  return fallback
}

// ─── Text Formatting for Speech ─────────────────────

/**
 * Convert AI response text into natural-sounding speech text.
 * Handles markdown, bullet lists, statistics, and dental terminology.
 */
export function formatForSpeech(text: string): string {
  let speech = text

  // Remove markdown bold/italic
  speech = speech.replace(/\*\*([^*]+)\*\*/g, '$1')
  speech = speech.replace(/\*([^*]+)\*/g, '$1')

  // Convert bullet points to natural speech
  speech = speech.replace(/^[•\-\*]\s+/gm, '')
  speech = speech.replace(/^\d+\.\s+/gm, '')

  // Remove markdown headers
  speech = speech.replace(/^#{1,6}\s+/gm, '')

  // Convert colons in labels to natural pauses
  speech = speech.replace(/([A-Za-z]+):\s/g, '$1, ')

  // Handle common dental abbreviations for speech
  speech = speech.replace(/\bRCT\b/g, 'root canal treatment')
  speech = speech.replace(/\bVPT\b/g, 'vital pulp therapy')
  speech = speech.replace(/\bMTA\b/g, 'M T A')
  speech = speech.replace(/\bOPG\b/g, 'O P G')
  speech = speech.replace(/\bIOPA\b/g, 'I O P A')
  speech = speech.replace(/\bFDI\b/g, 'F D I')
  speech = speech.replace(/\bTx\b/g, 'treatment')
  speech = speech.replace(/\bDx\b/g, 'diagnosis')
  speech = speech.replace(/\bRx\b/g, 'prescription')
  speech = speech.replace(/\bHx\b/g, 'history')
  speech = speech.replace(/\bF\/U\b/g, 'follow up')

  // Convert fraction-like patterns
  speech = speech.replace(/(\d+)\/(\d+)\s*visits/g, '$1 of $2 visits')

  // Remove emoji
  speech = speech.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')

  // Remove special characters that sound bad
  speech = speech.replace(/[#|_~`]/g, '')
  speech = speech.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links

  // Collapse multiple newlines/spaces into natural pauses
  speech = speech.replace(/\n{2,}/g, '. ')
  speech = speech.replace(/\n/g, '. ')
  speech = speech.replace(/\.\s*\./g, '.')
  speech = speech.replace(/\s{2,}/g, ' ')

  return speech.trim()
}

/**
 * Format specific response types for natural speech delivery
 */
export function formatScheduleForSpeech(appointments: any[]): string {
  if (!appointments || appointments.length === 0) {
    return 'You have no appointments scheduled.'
  }

  const count = appointments.length
  const parts: string[] = []

  parts.push(`You have ${count} ${count === 1 ? 'appointment' : 'appointments'} today.`)

  // Only speak the first 3 in detail
  const toSpeak = appointments.slice(0, 3)
  toSpeak.forEach((appt, i) => {
    const time = appt.scheduled_time?.slice(0, 5) || 'time not set'
    const name = appt.patient_name || 'a patient'
    const type = appt.appointment_type || 'appointment'
    parts.push(`${i === 0 ? 'First' : i === 1 ? 'Next' : 'Then'}, ${name} at ${time} for ${type}.`)
  })

  if (appointments.length > 3) {
    parts.push(`And ${appointments.length - 3} more after that.`)
  }

  return parts.join(' ')
}

export function formatPatientStatusForSpeech(statusMessage: string): string {
  // The Master AI already formats patient status — just clean for speech
  return formatForSpeech(statusMessage)
}

// ─── Chunked Speaking ───────────────────────────────

/**
 * Browser SpeechSynthesis has a ~15 second limit on some browsers.
 * This splits long text into sentence-based chunks and queues them.
 */
export function splitIntoChunks(text: string, maxChunkLength: number = 200): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxChunkLength && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

// ─── Deepgram Aura TTS ────────────────────────────────

let activeAudioElement: HTMLAudioElement | null = null

/**
 * Speak text using Deepgram Aura TTS (high quality, natural voice).
 * Falls back to browser SpeechSynthesis if Deepgram fails.
 */
async function speakWithDeepgramAura(
  text: string,
  options: TTSOptions = {}
): Promise<{ cancel: () => void } | null> {
  const { onStart, onEnd, onError } = options

  try {
    const speechText = formatForSpeech(text)

    // Truncate very long text (Deepgram has limits)
    const truncated = speechText.length > 2000 ? speechText.substring(0, 2000) + '...' : speechText

    const response = await fetch('/api/deepgram/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: truncated }),
    })

    if (!response.ok) {
      console.warn('🔊 [TTS] Deepgram Aura failed:', response.status, '— falling back to browser TTS')
      return null // Signal to use fallback
    }

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    // Clean up previous audio
    if (activeAudioElement) {
      activeAudioElement.pause()
      activeAudioElement = null
    }
    activeAudioElement = audio

    window.dispatchEvent(new CustomEvent('endoflow:tts_start'))
    onStart?.()

    audio.onended = () => {
      window.dispatchEvent(new CustomEvent('endoflow:tts_end'))
      URL.revokeObjectURL(audioUrl)
      activeAudioElement = null
      onEnd?.()
    }

    audio.onerror = () => {
      window.dispatchEvent(new CustomEvent('endoflow:tts_end'))
      URL.revokeObjectURL(audioUrl)
      activeAudioElement = null
      onError?.('Audio playback failed')
    }

    await audio.play()
    console.log('🔊 [TTS] Playing Deepgram Aura audio')

    return {
      cancel: () => {
        audio.pause()
        audio.currentTime = 0
        URL.revokeObjectURL(audioUrl)
        window.dispatchEvent(new CustomEvent('endoflow:tts_end'))
        activeAudioElement = null
        onEnd?.()
      }
    }
  } catch (err) {
    console.warn('🔊 [TTS] Deepgram Aura error:', err, '— falling back to browser TTS')
    return null
  }
}

/**
 * Speak text — tries Deepgram Aura first, falls back to browser SpeechSynthesis.
 */
export function speakWithTTS(
  text: string,
  options: TTSOptions = {}
): { cancel: () => void } {
  const {
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    language = 'en-US',
    onStart,
    onEnd,
    onError,
  } = options

  if (typeof window === 'undefined') {
    onError?.('Not in browser')
    return { cancel: () => {} }
  }

  // Try Deepgram Aura first (async — starts browser fallback if it fails)
  let cancelFn: (() => void) | null = null
  let usedFallback = false

  speakWithDeepgramAura(text, options).then((result) => {
    if (result) {
      cancelFn = result.cancel
    } else {
      // Deepgram failed — use browser SpeechSynthesis fallback
      usedFallback = true
      const fallback = speakWithBrowserTTS(text, options)
      cancelFn = fallback.cancel
    }
  }).catch(() => {
    usedFallback = true
    const fallback = speakWithBrowserTTS(text, options)
    cancelFn = fallback.cancel
  })

  return {
    cancel: () => {
      if (cancelFn) {
        cancelFn()
      } else {
        // Deepgram hasn't resolved yet — cancel any browser TTS and audio
        if ('speechSynthesis' in window) window.speechSynthesis.cancel()
        if (activeAudioElement) {
          activeAudioElement.pause()
          activeAudioElement = null
        }
        window.dispatchEvent(new CustomEvent('endoflow:tts_end'))
        onEnd?.()
      }
    }
  }
}

/**
 * Browser SpeechSynthesis fallback — used when Deepgram Aura is unavailable.
 */
function speakWithBrowserTTS(
  text: string,
  options: TTSOptions = {}
): { cancel: () => void } {
  const {
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    language = 'en-US',
    onStart,
    onEnd,
    onError,
  } = options

  if (!('speechSynthesis' in window)) {
    onError?.('SpeechSynthesis not available')
    return { cancel: () => {} }
  }

  const synth = window.speechSynthesis
  synth.cancel()

  const speechText = formatForSpeech(text)
  const chunks = splitIntoChunks(speechText)
  const voice = selectBestVoice(language)

  let cancelled = false
  let currentChunk = 0

  window.dispatchEvent(new CustomEvent('endoflow:tts_start'))

  const speakNext = () => {
    if (cancelled || currentChunk >= chunks.length) {
      window.dispatchEvent(new CustomEvent('endoflow:tts_end'))
      onEnd?.()
      return
    }

    const utterance = new SpeechSynthesisUtterance(chunks[currentChunk])
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume

    if (voice) {
      utterance.voice = voice
    }

    utterance.onstart = () => {
      if (currentChunk === 0) onStart?.()
    }

    utterance.onend = () => {
      currentChunk++
      speakNext()
    }

    utterance.onerror = (e) => {
      if (!cancelled) onError?.(e)
    }

    synth.speak(utterance)
  }

  speakNext()

  return {
    cancel: () => {
      cancelled = true
      synth.cancel()
      window.dispatchEvent(new CustomEvent('endoflow:tts_end'))
      onEnd?.()
    }
  }
}
