'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles, Loader2, Calendar, Send, CheckCircle2, AlertCircle, Zap, MessageSquare, Mic, Square } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { scheduleAppointmentWithAI } from '@/lib/actions/ai-appointment-scheduler'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  appointmentId?: string
  confidence?: number
}

interface AIAppointmentSchedulerProps {
  dentistId: string
  onAppointmentCreated?: (appointmentId: string) => void
}

export default function AIAppointmentScheduler({ dentistId, onAppointmentCreated }: AIAppointmentSchedulerProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef<string>('')

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Setup speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        transcriptRef.current = transcript
        setVoiceTranscript(transcript)
        setChatInput(transcript)
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsRecording(false)
        }
      }

      recognitionRef.current.onend = () => {
        if (isRecording) {
          try {
            recognitionRef.current.start()
          } catch (e) {
            console.error('Failed to restart recognition:', e)
            setIsRecording(false)
          }
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isRecording])

  // Add welcome message on mount
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      role: 'system',
      content: 'Welcome to AI Appointment Scheduler! Simply type your appointment request in natural language, and I\'ll handle the rest.\n\n**Examples:**\n• "Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM" (Treatment)\n• "Book consultation for Sarah next Monday at 10 AM" (Consultation)\n• "First visit for Mike on Dec 20 at 3 PM" (First Visit)\n• "Follow-up for Jane on tooth 16 next Tuesday at 11 AM" (Follow-up)\n\n**Pro tips:**\n✓ I automatically detect appointment type based on context\n✓ Include tooth number for treatment/follow-up appointments\n✓ Specify date and time for immediate scheduling\n✓ I\'ll link to existing consultations and treatments when relevant',
      timestamp: new Date()
    }
    setChatMessages([welcomeMessage])
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    const request = chatInput
    setChatInput('')
    setIsProcessing(true)

    try {
      console.log('🤖 [AI SCHEDULER] Processing request:', request)

      // Call AI appointment scheduler
      const result = await scheduleAppointmentWithAI(request, dentistId)

      if (result.success) {
        const successMessage: ChatMessage = {
          role: 'assistant',
          content: result.message || 'Appointment scheduled successfully!',
          timestamp: new Date(),
          appointmentId: result.appointmentId,
          confidence: result.confidence
        }
        setChatMessages(prev => [...prev, successMessage])

        // Notify parent component
        if (result.appointmentId && onAppointmentCreated) {
          onAppointmentCreated(result.appointmentId)
        }
      } else {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `❌ ${result.error || 'Failed to schedule appointment.'}\n\n💡 **Tips for better results:**\n- Include patient's full name\n- Specify date and time clearly\n- Mention tooth number for treatments\n- Use keywords: "first visit", "consultation", "treatment", "follow-up"\n\n**Examples:**\n• "Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM"\n• "Book consultation for Sarah next Monday at 10 AM"\n• "First visit for new patient Mike on Friday at 3 PM"\n• "Follow-up for Jane on tooth 16 next week at 11 AM"`,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('❌ [AI SCHEDULER] Error:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an unexpected error. Please try again.',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setChatInput(example)
    setTimeout(() => {
      const form = document.querySelector('form[data-ai-scheduler]') as HTMLFormElement
      form?.requestSubmit()
    }, 100)
  }

  const startVoiceRecording = async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      transcriptRef.current = ''
      setVoiceTranscript('')
      setChatInput('')
      setIsRecording(true)
      
      if (recognitionRef.current) {
        recognitionRef.current.start()
      }
    } catch (error) {
      console.error('Error starting voice recording:', error)
      alert('Microphone access denied. Please allow microphone access to use voice input.')
    }
  }

  const stopVoiceRecording = () => {
    setIsRecording(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    
    // Keep the transcript in the input field for user to review/edit
    if (transcriptRef.current) {
      setChatInput(transcriptRef.current)
    }
  }

  return (
    <div className="flex flex-col h-full">
    <Card className="flex flex-col h-full border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader className="border-b bg-white/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              AI Appointment Scheduler
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Powered by AI
              </Badge>
            </CardTitle>
            <CardDescription className="text-sm">
              Schedule appointments using natural language - just type what you need
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
        {/* Chat Messages Area */}
        <ScrollArea className="flex-1 p-4 h-full">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-6">
              <div className="p-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full">
                <Calendar className="h-12 w-12 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Schedule Appointments with AI
                </h3>
                <p className="text-gray-600 text-sm max-w-md">
                  Type your appointment request naturally, and I'll create it automatically with all the right context.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {chatMessages.map((message, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role !== 'user' && (
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      message.role === 'system' ? "bg-blue-600" : "bg-purple-600"
                    )}>
                      {message.role === 'system' ? (
                        <MessageSquare className="h-4 w-4 text-white" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-white" />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-3 shadow-sm",
                      message.role === 'user'
                        ? "bg-purple-600 text-white"
                        : message.role === 'system'
                        ? "bg-blue-50 text-blue-900 border border-blue-200"
                        : "bg-white text-gray-900 border border-gray-200"
                    )}
                  >
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    {message.confidence && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3" />
                          Confidence: {message.confidence}%
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "text-xs mt-1",
                      message.role === 'user' ? "text-purple-100" : "text-gray-400"
                    )}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isProcessing && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Processing your request...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Example Commands (shown when empty) */}
        {chatMessages.length <= 1 && (
          <div className="px-4 pb-4 flex-shrink-0">
            <Alert className="border-purple-200 bg-purple-50">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-sm text-purple-900">
                <strong>Try these examples:</strong>
                <div className="mt-2 space-y-1">
                  {[
                    'Schedule RCT for John Doe on tooth 34 tomorrow at 2 PM',
                    'Book consultation for Sarah next Monday at 10:30 AM',
                    'First visit for Mike on Dec 15 at 3 PM',
                    'Follow-up for Jane on tooth 16 next Friday at 2 PM'
                  ].map((example, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-purple-700 hover:text-purple-900 cursor-pointer hover:underline"
                      onClick={() => handleExampleClick(example)}
                    >
                      • {example}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t bg-white p-4 flex-shrink-0">
          {/* Voice Recording Indicator */}
          {isRecording && (
            <div className="mb-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border-2 border-red-200 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-red-900">🎙️ Recording...</span>
                </div>
                <Badge className="bg-red-100 text-red-700 border-red-300">
                  <Mic className="h-3 w-3 mr-1" />
                  Listening
                </Badge>
              </div>
              {voiceTranscript && (
                <div className="mt-2 p-2 bg-white rounded border border-red-200">
                  <p className="text-xs text-gray-600 mb-1">Live transcript:</p>
                  <p className="text-sm text-gray-900">{voiceTranscript}</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} data-ai-scheduler className="flex gap-2">
            <Input
              placeholder={isRecording ? "Speaking... (click stop when done)" : "Type or speak your appointment request..."}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isProcessing || isRecording}
              className="flex-1 h-10"
            />
            
            {/* Voice Recording Button */}
            <Button
              type="button"
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={isProcessing}
              className={cn(
                "h-10 px-4",
                isRecording 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-teal-600 hover:bg-teal-700"
              )}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isProcessing || !chatInput.trim() || isRecording}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-10"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Schedule
                </>
              )}
            </Button>
          </form>
          <div className="mt-2 text-xs text-gray-500 text-center">
            {isRecording ? (
              <span className="text-red-600 font-medium">🎤 Speak clearly: "Schedule [type] for [patient] on [date] at [time]"</span>
            ) : (
              <span>💡 Type or click the microphone to speak your appointment request</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
