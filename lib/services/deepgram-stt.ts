/**
 * Deepgram Real-Time Speech-to-Text Service
 * Handles WebSocket streaming from browser microphone to Deepgram API
 * Uses nova-2-medical model with dental vocabulary boosting
 */

import { getDeepgramKeywords, selectDeepgramModel } from './deepgram-vocabulary'

export interface DeepgramSTTConfig {
  language?: string // 'en' | 'hi' | 'multi'
  model?: string // 'nova-2-medical' | 'nova-2' — auto-selected if not provided
  interimResults?: boolean
  smartFormat?: boolean
  utteranceEndMs?: number // silence detection threshold
  vadEvents?: boolean
  /** Session 14: When true, uses medical model + full dental keyword boosting */
  clinicalMode?: boolean
}

export interface DeepgramTranscriptEvent {
  text: string
  isFinal: boolean
  confidence: number
  words?: Array<{ word: string; start: number; end: number; confidence: number; speaker?: number }>
  /** Session 20: Formatted text with speaker labels (Dr: / Patient:) when diarization is active */
  diarizedText?: string
}

type TranscriptCallback = (event: DeepgramTranscriptEvent) => void
type UtteranceEndCallback = () => void
type ErrorCallback = (error: Error) => void
type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void

const DEFAULT_CONFIG: Required<DeepgramSTTConfig> = {
  language: 'en',
  model: 'nova-2', // Session 14: Default to general model, not medical
  interimResults: true,
  smartFormat: true,
  utteranceEndMs: 1500,
  vadEvents: true,
  clinicalMode: false,
}

export class DeepgramSTTService {
  private ws: WebSocket | null = null
  private mediaRecorder: MediaRecorder | null = null
  private mediaStream: MediaStream | null = null
  private config: Required<DeepgramSTTConfig>
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null

  // Callbacks
  private onTranscript: TranscriptCallback | null = null
  private onUtteranceEnd: UtteranceEndCallback | null = null
  private onError: ErrorCallback | null = null
  private onStatus: StatusCallback | null = null

  constructor(config?: DeepgramSTTConfig) {
    const merged = { ...DEFAULT_CONFIG, ...config }
    // Session 14: Auto-select model based on clinical mode if model not explicitly provided
    if (!config?.model && merged.clinicalMode) {
      const selected = selectDeepgramModel(true)
      merged.model = selected.model
      console.log(`🩺 [DEEPGRAM] Clinical mode: using ${selected.model}`)
    } else if (!config?.model) {
      const selected = selectDeepgramModel(false)
      merged.model = selected.model
      console.log(`💬 [DEEPGRAM] General mode: using ${selected.model}`)
    }
    this.config = merged
  }

  /** Register event handlers */
  on(event: 'transcript', cb: TranscriptCallback): this
  on(event: 'utteranceEnd', cb: UtteranceEndCallback): this
  on(event: 'error', cb: ErrorCallback): this
  on(event: 'status', cb: StatusCallback): this
  on(event: string, cb: (...args: any[]) => void): this {
    switch (event) {
      case 'transcript': this.onTranscript = cb as TranscriptCallback; break
      case 'utteranceEnd': this.onUtteranceEnd = cb as UtteranceEndCallback; break
      case 'error': this.onError = cb as ErrorCallback; break
      case 'status': this.onStatus = cb as StatusCallback; break
    }
    return this
  }

  /** Connect to Deepgram and start streaming audio */
  async connect(): Promise<void> {
    this.onStatus?.('connecting')
    console.log('🎙️ [DEEPGRAM] Connecting...')

    try {
      // Step 1: Get temporary token from our server
      const tokenResponse = await fetch('/api/deepgram/token')
      if (!tokenResponse.ok) {
        throw new Error(`Token fetch failed: ${tokenResponse.status}`)
      }
      const { key, url } = await tokenResponse.json()

      // Step 2: Build WebSocket URL with parameters
      // Session 14: Use context-aware keywords — fewer in general mode, full in clinical
      const keywordMode = this.config.clinicalMode ? 'clinical' : 'general'
      const keywords = getDeepgramKeywords(keywordMode)
      console.log(`🔑 [DEEPGRAM] Keyword mode: ${keywordMode} (${keywords.split(',').length} keywords)`)
      const params = new URLSearchParams({
        model: this.config.model,
        language: this.config.language,
        smart_format: String(this.config.smartFormat),
        interim_results: String(this.config.interimResults),
        utterance_end_ms: String(this.config.utteranceEndMs),
        vad_events: String(this.config.vadEvents),
        punctuate: 'true',
        diarize: String(this.config.clinicalMode), // Session 17: Enable diarization for clinical consultations (Dr. vs Patient)
        endpointing: '400', // Session 17: 400ms silence before finalizing — prevents mid-sentence cuts (default 10ms is too aggressive)
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      })

      // Add keywords individually (Deepgram expects repeated 'keywords' params)
      const keywordPairs = keywords.split(',').slice(0, 50) // Limit to 50 for URL length
      keywordPairs.forEach(kw => params.append('keywords', kw))

      const wsUrl = `${url}?${params.toString()}`

      // Step 3: Open WebSocket
      this.ws = new WebSocket(wsUrl, ['token', key])

      this.ws.onopen = () => {
        console.log('✅ [DEEPGRAM] WebSocket connected')
        this.onStatus?.('connected')
        this.startKeepAlive()
        this.startMicrophone()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (err) {
          console.warn('⚠️ [DEEPGRAM] Failed to parse message:', err)
        }
      }

      this.ws.onerror = (event) => {
        console.error('❌ [DEEPGRAM] WebSocket error:', event)
        this.onError?.(new Error('WebSocket connection error'))
        this.onStatus?.('error')
      }

      this.ws.onclose = (event) => {
        console.log(`🔌 [DEEPGRAM] WebSocket closed: ${event.code} ${event.reason}`)
        this.onStatus?.('disconnected')
        this.cleanup()
      }

    } catch (error) {
      console.error('❌ [DEEPGRAM] Connection failed:', error)
      this.onError?.(error instanceof Error ? error : new Error(String(error)))
      this.onStatus?.('error')
      throw error
    }
  }

  /** Disconnect and clean up */
  disconnect(): void {
    console.log('🛑 [DEEPGRAM] Disconnecting...')
    this.cleanup()
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /** Update language mid-session (requires reconnect) */
  setLanguage(language: string): void {
    this.config.language = language
  }

  // ─── Private Methods ─────────────────────────────────────────

  private handleMessage(data: any): void {
    const type = data.type

    if (type === 'Results') {
      const transcript = data.channel?.alternatives?.[0]
      if (transcript && transcript.transcript) {
        const event: DeepgramTranscriptEvent = {
          text: transcript.transcript,
          isFinal: data.is_final === true,
          confidence: transcript.confidence || 0,
          words: transcript.words,
        }

        // Session 20: Build diarized text with speaker labels when available
        if (data.is_final && transcript.words?.length > 0 && transcript.words[0]?.speaker !== undefined) {
          event.diarizedText = this.buildDiarizedText(transcript.words)
        }

        this.onTranscript?.(event)
      }
    } else if (type === 'UtteranceEnd') {
      this.onUtteranceEnd?.()
    }
    // SpeechStarted and Metadata events are silently consumed
  }

  /**
   * Session 20: Build text with speaker labels from Deepgram diarization.
   * Speaker 0 = first speaker detected (typically dentist), Speaker 1 = second (typically patient).
   * Falls back to raw text if speaker data is incomplete.
   */
  private buildDiarizedText(words: Array<{ word: string; speaker?: number }>): string {
    if (!words || words.length === 0) return ''

    const SPEAKER_LABELS: Record<number, string> = { 0: 'Dr', 1: 'Patient' }
    const segments: string[] = []
    let currentSpeaker: number | undefined = undefined
    let currentSegment: string[] = []

    for (const w of words) {
      const speaker = w.speaker ?? 0
      if (speaker !== currentSpeaker) {
        // Save previous segment
        if (currentSegment.length > 0 && currentSpeaker !== undefined) {
          const label = SPEAKER_LABELS[currentSpeaker] || `Speaker ${currentSpeaker}`
          segments.push(`${label}: ${currentSegment.join(' ')}`)
        }
        currentSpeaker = speaker
        currentSegment = [w.word]
      } else {
        currentSegment.push(w.word)
      }
    }
    // Flush last segment
    if (currentSegment.length > 0 && currentSpeaker !== undefined) {
      const label = SPEAKER_LABELS[currentSpeaker] || `Speaker ${currentSpeaker}`
      segments.push(`${label}: ${currentSegment.join(' ')}`)
    }

    return segments.join('\n')
  }

  private async startMicrophone(): Promise<void> {
    try {
      // Session 18: Guard — getUserMedia requires HTTPS (secure context)
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error(
          'Microphone requires a secure connection (HTTPS). ' +
          'Use pnpm dev:https or access via https:// to enable voice features.'
        )
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Microphone API not available. Ensure you are using HTTPS and a supported browser.'
        )
      }

      // Request microphone with specific constraints for medical STT
      // iOS Safari: don't force sampleRate — it silently remaps to device native rate
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
      if (!isIOS) {
        (audioConstraints as any).sampleRate = 16000
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      })

      // iOS Safari: let AudioContext use device native rate, then resample to 16kHz
      const targetSampleRate = 16000
      const audioContext = isIOS
        ? new AudioContext() // Use device native rate on iOS
        : new AudioContext({ sampleRate: targetSampleRate })
      const nativeSampleRate = audioContext.sampleRate
      const source = audioContext.createMediaStreamSource(this.mediaStream)

      // Create a ScriptProcessor to capture raw PCM data
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (event) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0)

          // Resample if native rate differs from target (common on iOS)
          let pcmData: Float32Array
          if (nativeSampleRate !== targetSampleRate) {
            const ratio = nativeSampleRate / targetSampleRate
            const newLength = Math.round(inputData.length / ratio)
            pcmData = new Float32Array(newLength)
            for (let i = 0; i < newLength; i++) {
              const srcIdx = Math.min(Math.round(i * ratio), inputData.length - 1)
              pcmData[i] = inputData[srcIdx]
            }
          } else {
            pcmData = inputData
          }

          // Convert float32 to int16
          const int16Data = new Int16Array(pcmData.length)
          for (let i = 0; i < pcmData.length; i++) {
            const s = Math.max(-1, Math.min(1, pcmData[i]))
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          this.ws.send(int16Data.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      // Store for cleanup
      ;(this as any)._audioContext = audioContext
      ;(this as any)._processor = processor
      ;(this as any)._source = source

      console.log('🎤 [DEEPGRAM] Microphone streaming started (16kHz PCM)')
    } catch (error) {
      console.error('❌ [DEEPGRAM] Microphone access failed:', error)
      this.onError?.(new Error('Microphone access denied or unavailable'))
    }
  }

  private startKeepAlive(): void {
    // Session 17: Send keep-alive every 5 seconds (Deepgram's inactivity timeout is 10s)
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
      }
    }, 5000)
  }

  private cleanup(): void {
    // Stop keep-alive
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }

    // Stop microphone
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    // Close audio context
    const ctx = (this as any)._audioContext as AudioContext | undefined
    if (ctx) {
      ctx.close().catch(() => {})
      ;(this as any)._audioContext = null
    }

    // Close WebSocket
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }

    this.mediaRecorder = null
  }
}
