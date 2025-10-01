'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Square, Play, Pause, Volume2, AlertCircle } from "lucide-react"

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

interface GlobalVoiceRecorderProps {
  consultationId?: string
  onContentProcessed?: (content: ProcessedContent) => void
  isEnabled?: boolean
}

export function GlobalVoiceRecorder({
  consultationId,
  onContentProcessed,
  isEnabled = true
}: GlobalVoiceRecorderProps) {
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    checkMicrophonePermissions()
    setupSpeechRecognition()

    return () => {
      stopRecording()
      cleanup()
    }
  }, [])

  const checkMicrophonePermissions = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setPermissionStatus(result.state)

      result.onchange = () => {
        setPermissionStatus(result.state)
      }
    } catch (error) {
      console.error('Error checking microphone permissions:', error)
    }
  }

  const setupSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()

      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        setRecording(prev => ({
          ...prev,
          transcript: prev.transcript + finalTranscript + interimTranscript
        }))
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setError(`Speech recognition error: ${event.error}`)
      }
    }
  }

  const requestMicrophoneAccess = async (): Promise<MediaStream | null> => {
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

  const startRecording = async () => {
    if (!isEnabled) return

    try {
      setError(null)
      setIsProcessing(false)

      const stream = await requestMicrophoneAccess()
      if (!stream) return

      streamRef.current = stream

      // Initialize media recorder
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

        // Process the recording
        await processRecording(audioBlob, recording.transcript)
      }

      // Start recording
      mediaRecorderRef.current.start(1000) // Collect data every 1000ms

      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start()
      }

      // Generate session ID
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

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecording(prev => ({
          ...prev,
          duration: prev.startTime ? Date.now() - prev.startTime.getTime() : 0
        }))
      }, 1000)

      // Send start signal to N8N
      if (consultationId) {
        await startVoiceSession(consultationId, sessionId)
      }

    } catch (error) {
      console.error('Error starting recording:', error)
      setError('Failed to start recording. Please try again.')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recording.isRecording && !recording.isPaused) {
      mediaRecorderRef.current.pause()

      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }

      setRecording(prev => ({ ...prev, isPaused: true }))

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recording.isRecording && recording.isPaused) {
      mediaRecorderRef.current.resume()

      if (recognitionRef.current) {
        recognitionRef.current.start()
      }

      setRecording(prev => ({ ...prev, isPaused: false }))

      // Resume duration timer
      intervalRef.current = setInterval(() => {
        setRecording(prev => ({
          ...prev,
          duration: prev.startTime ? Date.now() - prev.startTime.getTime() : 0
        }))
      }, 1000)
    }
  }

  const stopRecording = async () => {
    if (mediaRecorderRef.current && recording.isRecording) {
      mediaRecorderRef.current.stop()

      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      setRecording(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false
      }))

      cleanup()
    }
  }

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

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
        throw new Error('Failed to start voice session')
      }

      console.log('✅ Voice session started successfully')
    } catch (error) {
      console.error('❌ Error starting voice session:', error)
    }
  }

  const processRecording = async (audioBlob: Blob, transcript: string) => {
    if (!consultationId || !transcript.trim()) return

    try {
      setIsProcessing(true)

      // Send to N8N for AI processing
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('transcript', transcript)
      formData.append('consultationId', consultationId)
      formData.append('sessionId', recording.sessionId || '')

      const response = await fetch('/api/voice/process-global-transcript', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to process recording')
      }

      const result = await response.json()

      if (result.success && result.processedContent) {
        onContentProcessed?.(result.processedContent)
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
    if (isProcessing) return 'bg-blue-100 text-blue-800'
    if (recording.isRecording && recording.isPaused) return 'bg-yellow-100 text-yellow-800'
    if (recording.isRecording) return 'bg-red-100 text-red-800'
    return 'bg-green-100 text-green-800'
  }

  if (permissionStatus === 'denied') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Microphone Access Required</p>
              <p className="text-xs text-red-600">Please allow microphone access in your browser settings to use voice recording.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
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

                  <Button
                    onClick={stopRecording}
                    size="sm"
                    variant="destructive"
                    disabled={!isEnabled}
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!isEnabled || isProcessing}
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Start Global Recording
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className={getStatusColor()}>
                {getRecordingStatus()}
              </Badge>

              {recording.isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-mono">
                    {formatDuration(recording.duration)}
                  </span>
                </div>
              )}

              {recording.transcript && (
                <div className="flex items-center gap-1">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-600">
                    Transcribing...
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-600">{error}</span>
            </div>
          )}
        </div>

        {recording.transcript && (
          <div className="mt-3 p-3 bg-white rounded border">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Live Transcript</Label>
            <p className="text-sm text-gray-700 mt-1 max-h-20 overflow-y-auto">
              {recording.transcript}
            </p>
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500">
          <p>🎤 <strong>Global Voice Recording:</strong> This will record your entire consultation and automatically fill appropriate tabs based on the conversation content.</p>
          <p className="mt-1">💡 <strong>Tip:</strong> Speak clearly and mention specific sections like "Chief complaint", "Medical history", "Clinical examination" for better AI processing.</p>
        </div>
      </CardContent>
    </Card>
  )
}