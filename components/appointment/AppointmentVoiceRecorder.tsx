'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Mic, MicOff, Square, Play, Pause, Volume2, AlertCircle, Sparkles, Activity, Calendar } from "lucide-react"
import { detectAppointmentKeywords } from '@/lib/services/appointment-conversation-parser'
import type { AppointmentExtraction } from '@/lib/services/appointment-conversation-parser'
import { useVoiceManager } from '@/lib/contexts/voice-manager-context'

interface VoiceRecording {
  isRecording: boolean
  isPaused: boolean
  startTime: Date | null
  duration: number
  transcript: string
  audioBlob: Blob | null
  sessionId: string | null
}

interface AppointmentVoiceRecorderProps {
  onAppointmentDataExtracted?: (data: AppointmentExtraction) => void
  isEnabled?: boolean
}

export function AppointmentVoiceRecorder({
  onAppointmentDataExtracted,
  isEnabled = true
}: AppointmentVoiceRecorderProps) {
  // Get voice manager
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef<string>('')
  const finalTranscriptRef = useRef<string>('')

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

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        const fullTranscript = finalTranscriptRef.current + interimTranscript
        transcriptRef.current = fullTranscript

        setRecording(prev => ({
          ...prev,
          transcript: fullTranscript
        }))
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return
        }
        setError(`Speech recognition error: ${event.error}`)
      }

      recognitionRef.current.onend = () => {
        console.log('🛑 [APPOINTMENT VOICE] Speech recognition ended')
        if (recording.isRecording) {
          setTimeout(() => {
            if (recording.isRecording && recognitionRef.current) {
              try {
                console.log('🔄 [APPOINTMENT VOICE] Auto-restarting speech recognition...')
                recognitionRef.current.start()
              } catch (e) {
                console.error('❌ [APPOINTMENT VOICE] Failed to restart:', e)
              }
            }
          }, 100)
        }
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
      // Register with voice manager - this will auto-disable wake word
      voiceManager.registerMicUsage('appointment-voice-recorder')
      console.log('🎙️ [APPOINTMENT VOICE] Registered with voice manager')
      
      setError(null)
      setIsProcessing(false)
      transcriptRef.current = ''
      finalTranscriptRef.current = ''
      console.log('🎙️ [START] Starting appointment voice recording...')

      const stream = await requestMicrophoneAccess()
      if (!stream) return

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

        console.log('🎤 [STOP] Processing appointment recording with transcript length:', transcriptRef.current.length)
        await processRecording(audioBlob, transcriptRef.current)
      }

      mediaRecorderRef.current.start(1000)

      if (recognitionRef.current) {
        recognitionRef.current.start()
      }

      const sessionId = `appointment_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

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
      // Unregister from voice manager - this will auto-enable wake word if needed
      voiceManager.unregisterMicUsage('appointment-voice-recorder')
      console.log('🛑 [APPOINTMENT VOICE] Unregistered from voice manager')
      
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

  const processRecording = async (audioBlob: Blob, transcript: string) => {
    console.log('🎤 [PROCESS] Processing appointment voice with transcript length:', transcript.length)

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

      const response = await fetch('/api/voice/process-appointment-transcript', {
        method: 'POST',
        body: formData
      })

      console.log('📡 [PROCESS] Response status:', response.status)

      if (!response.ok) {
        throw new Error('Failed to process recording')
      }

      const result = await response.json()

      if (result.success && result.appointmentData) {
        console.log('✅ [APPOINTMENT VOICE] Extracted appointment data:', result.appointmentData)
        onAppointmentDataExtracted?.(result.appointmentData)
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
    <Card className="border-2 border-dashed border-teal-300 bg-teal-50">
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
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={!isEnabled || isProcessing}
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Start Voice Scheduling
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
          <div className="mt-3 p-3 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border-2 border-teal-200">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-teal-700 font-semibold uppercase tracking-wide flex items-center gap-1">
                <Activity className="h-3 w-3" />
                🤖 AI Processing Appointment Request
              </Label>
              <Badge className="bg-gradient-to-r from-teal-600 to-blue-600 text-white text-xs border-0">
                <Sparkles className="h-3 w-3 mr-1" />
                Gemini AI
              </Badge>
            </div>
            <p className="text-sm text-gray-700 mt-1 max-h-20 overflow-y-auto bg-white p-2 rounded border border-teal-100">
              {recording.transcript}
            </p>

            {/* Real-time AI Detection Indicators */}
            {(() => {
              const analysis = detectAppointmentKeywords(recording.transcript)
              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.hasAppointmentType && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                      <Calendar className="h-3 w-3 mr-1" />
                      Appointment Type Detected
                    </Badge>
                  )}
                  {analysis.hasDateMention && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                      <Activity className="h-3 w-3 mr-1" />
                      Date Found
                    </Badge>
                  )}
                  {analysis.hasTimeMention && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                      ⏰ Time Found
                    </Badge>
                  )}
                  {analysis.hasUrgency && (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                      ⚡ Urgency Detected
                    </Badge>
                  )}
                  {analysis.estimatedConfidence > 0 && (
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                      📊 Confidence: ~{analysis.estimatedConfidence}%
                    </Badge>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        <div className="mt-3 text-xs text-gray-600">
          <p>🎤 <strong>Voice Scheduling:</strong> Say something like "Schedule teeth cleaning for tomorrow at 2 PM" or "Book urgent appointment for John Smith next Monday morning"</p>
          <p className="mt-1">💡 <strong>Tip:</strong> Mention appointment type, date, time, and patient name for best results. The AI will auto-fill the form fields!</p>
        </div>
      </CardContent>
    </Card>
  )
}
