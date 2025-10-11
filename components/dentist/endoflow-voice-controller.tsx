'use client'

import { useState, useEffect, useRef, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Mic,
  MicOff,
  Sparkles,
  Send,
  Loader2,
  Volume2,
  VolumeX,
  Trash2,
  MessageSquare,
  Brain,
  Zap,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react'
import { processEndoFlowQuery } from '@/lib/actions/endoflow-master'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  agentName?: string
  intent?: string
}

interface EndoFlowVoiceControllerProps {
  isFloating?: boolean
  defaultExpanded?: boolean
}

export const EndoFlowVoiceController = memo(function EndoFlowVoiceController({
  isFloating = false,
  defaultExpanded = false
}: EndoFlowVoiceControllerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [isWakeWordActive, setIsWakeWordActive] = useState(true) // Enable wake word by default
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false)
  const [autoMode, setAutoMode] = useState(true) // Automated conversation mode
  const [silenceTimeout, setSilenceTimeout] = useState<number | null>(null)
  
  // Sync autoMode state with ref for closure access
  useEffect(() => {
    autoModeRef.current = autoMode
    console.log('🔄 [AUTO MODE] Mode changed to:', autoMode)
  }, [autoMode])
  
  // Sync isListening state with ref for closure access
  useEffect(() => {
    isListeningRef.current = isListening
    console.log('🎤 [LISTENING STATE] Changed to:', isListening)
  }, [isListening])
  
  // Fallback: Auto-submit if we have text but user stopped speaking
  useEffect(() => {
    console.log('🔍 [FALLBACK CHECK] autoMode:', autoMode, 'isListening:', isListening, 'isProcessing:', isProcessing, 'inputLength:', inputValue.trim().length, 'autoSubmit:', autoSubmitRef.current)
    
    if (autoMode && !isListening && !isProcessing && inputValue.trim().length > 0 && !autoSubmitRef.current) {
      console.log('⏰ [FALLBACK] Text present but not listening - setting 3s auto-submit timer')
      const fallbackTimer = setTimeout(() => {
        console.log('🔍 [FALLBACK TIMER] Checking again...')
        if (autoMode && !isListening && !isProcessing && inputValue.trim().length > 0 && !autoSubmitRef.current) {
          console.log('🔥 [FALLBACK] Auto-submitting after 3s...')
          autoSubmitRef.current = true
          
          // Stop recording first
          if (isListeningRef.current) {
            stopVoiceRecording()
          }
          
          // Then submit
          setTimeout(() => {
            handleAutoSubmit()
          }, 300)
        } else {
          console.log('❌ [FALLBACK] Conditions changed, not submitting')
        }
      }, 3000)
      
      return () => {
        console.log('🧹 [FALLBACK] Clearing timer')
        clearTimeout(fallbackTimer)
      }
    } else {
      console.log('⏸️ [FALLBACK] Conditions not met for timer')
    }
  }, [autoMode, isListening, isProcessing, inputValue])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const transcriptRef = useRef<string>('')
  const shouldContinueListeningRef = useRef(false) // Fix auto-restart bug
  const wakeWordRecognitionRef = useRef<any>(null) // Wake word detection
  const isWakeWordListeningRef = useRef(false) // Track wake word listening state
  const wakeWordStartingRef = useRef(false) // Prevent multiple simultaneous starts
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null) // Silence detection timer
  const lastSpeechTimeRef = useRef<number>(Date.now()) // Track last speech time
  const autoSubmitRef = useRef(false) // Track if auto-submit is pending
  const autoModeRef = useRef(true) // Track auto mode with ref for closure
  const isListeningRef = useRef(false) // Track listening state with ref for closure

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  // Setup speech recognition
  useEffect(() => {
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
          const transcriptText = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText + ' '
          } else {
            interimTranscript += transcriptText
          }
        }

        if (finalTranscript) {
          transcriptRef.current += finalTranscript
          setTranscript(transcriptRef.current + interimTranscript)
          setInputValue(transcriptRef.current + interimTranscript)
          
          // Update last speech time for silence detection
          lastSpeechTimeRef.current = Date.now()
          console.log('📝 [TRANSCRIPT] Final:', finalTranscript, 'Auto mode:', autoModeRef.current)
          
          // Check for command phrases in automated mode
          if (autoModeRef.current) {
            const fullText = (transcriptRef.current + interimTranscript).toLowerCase()
            console.log('🔍 [AUTO MODE] Checking text:', fullText)
            
            // Command phrases that trigger immediate submission
            const commandPhrases = [
              'do it',
              'search it',
              'send it',
              'go ahead',
              'execute',
              'submit',
              'find it',
              'show me',
              'that\'s it',
              'done',
              'okay go',
              'ok go'
            ]
            
            const hasCommandPhrase = commandPhrases.some(phrase => {
              const regex = new RegExp(`\\b${phrase}\\b`, 'i')
              const found = regex.test(fullText)
              if (found) {
                console.log('✅ [AUTO MODE] Found command phrase:', phrase)
              }
              return found
            })
            
            if (hasCommandPhrase && !autoSubmitRef.current) {
              console.log('✨ [AUTO MODE] Command phrase detected! Submitting in 500ms...')
              autoSubmitRef.current = true
              // Small delay to allow any remaining speech
              setTimeout(() => {
                handleAutoSubmit()
              }, 500)
            }
          }
        } else {
          setTranscript(transcriptRef.current + interimTranscript)
          setInputValue(transcriptRef.current + interimTranscript)
          
          // Reset timer for interim results too (Fix for deployed silence detection)
          if (interimTranscript && autoModeRef.current && !autoSubmitRef.current) {
            lastSpeechTimeRef.current = Date.now()
            console.log('⏱️ [AUTO MODE] Resetting silence timer (interim)')
            resetSilenceTimer()
          }
        }
        
        // Reset silence timer when speech is detected (final results)
        if (finalTranscript && autoModeRef.current && !autoSubmitRef.current) {
          console.log('⏱️ [AUTO MODE] Resetting silence timer (final)')
          resetSilenceTimer()
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        // Don't log or show errors for normal user actions
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return // Silent - this is normal
        }
        console.error('Speech recognition error:', event.error)
        setError(`Speech recognition error: ${event.error}`)
        shouldContinueListeningRef.current = false
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        console.log('🎤 [MAIN MIC] Recognition ended. shouldContinue:', shouldContinueListeningRef.current, 'autoMode:', autoModeRef.current)
        
        // In auto mode, if we have transcript and recognition ended naturally, auto-submit
        if (autoModeRef.current && !shouldContinueListeningRef.current && transcriptRef.current.trim().length > 0 && !autoSubmitRef.current) {
          console.log('🤖 [AUTO MODE] Recognition ended with transcript - auto-submitting...')
          autoSubmitRef.current = true
          setTimeout(() => {
            handleAutoSubmit()
          }, 500)
          return
        }
        
        if (shouldContinueListeningRef.current && isListening) {
          try {
            setTimeout(() => {
              if (shouldContinueListeningRef.current && recognitionRef.current) {
                console.log('🔄 [MAIN MIC] Restarting recognition...')
                recognitionRef.current.start()
              }
            }, 100)
          } catch (e) {
            console.error('Failed to restart recognition:', e)
            shouldContinueListeningRef.current = false
            setIsListening(false)
          }
        } else {
          setIsListening(false)
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Already stopped
        }
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  // Add welcome message on mount
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'system',
      content: '👋 **Welcome to EndoFlow AI!**\n\nI\'m your intelligent assistant powered by specialized AI agents. I can help you with:\n\n🔬 **Clinical Research** - "Find patients with RCT on tooth 36 last month"\n📅 **Scheduling** - "What\'s my schedule today?" or "Book appointment for John"\n💊 **Treatment Planning** - "Suggest treatment for pulpitis on tooth 46"\n👤 **Patient Information** - "Tell me about patient Sarah\'s history"\n\nYou can type your questions or click the microphone button to speak naturally. How can I help you today?',
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
  }, [])

  // Wake word detection - continuous background listening
  useEffect(() => {
    console.log('🔄 [WAKE WORD EFFECT] Triggered. Active:', isWakeWordActive, 'Expanded:', isExpanded, 'Listening:', isListening)
    
    const startWakeWordListening = async () => {
      // Should we stop wake word detection?
      if (!isWakeWordActive || isExpanded || isListening) {
        console.log('🛑 [WAKE WORD] Should stop. Active:', isWakeWordActive, 'Expanded:', isExpanded, 'Listening:', isListening)
        
        // Stop wake word detection if disabled, chat is expanded, or user is actively speaking
        if (wakeWordRecognitionRef.current && isWakeWordListeningRef.current) {
          try {
            wakeWordRecognitionRef.current.stop()
            isWakeWordListeningRef.current = false
            setIsListeningForWakeWord(false)
            wakeWordStartingRef.current = false
            console.log('✅ [WAKE WORD] Stopped wake word detection')
          } catch (e) {
            // Already stopped
            isWakeWordListeningRef.current = false
            setIsListeningForWakeWord(false)
            wakeWordStartingRef.current = false
          }
        }
        return
      }
      
      console.log('✅ [WAKE WORD] Should start. Checking if already listening...')

      // Don't start if already listening or currently starting
      if (isWakeWordListeningRef.current || wakeWordStartingRef.current) {
        console.log('⚠️ [WAKE WORD] Already listening or starting, skipping')
        return
      }

      // Set starting flag to prevent concurrent starts
      wakeWordStartingRef.current = true

      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        
        // Create new recognition instance
        wakeWordRecognitionRef.current = new SpeechRecognition()
        wakeWordRecognitionRef.current.continuous = true
        wakeWordRecognitionRef.current.interimResults = true
        wakeWordRecognitionRef.current.lang = 'en-US'

        wakeWordRecognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript.toLowerCase())
            .join(' ')

          console.log('🎤 [WAKE WORD] Detected:', transcript)

          // Check for wake word with variations (be more flexible)
          const hasHey = transcript.includes('hey') || transcript.includes('hi') || transcript.includes('a');
          const hasEndoFlow = transcript.includes('endo') || transcript.includes('indo') || 
                             transcript.includes('end o') || transcript.includes('end of') ||
                             transcript.includes('endoc');
          const hasFlow = transcript.includes('flow') || transcript.includes('low') || transcript.includes('flo');
          
          if ((hasHey && hasEndoFlow) || (hasEndoFlow && hasFlow) || 
              transcript.includes('hey endoflow') || 
              transcript.includes('endoflow') ||
              transcript.match(/\b(hey|hi|a)?\s*(endo|indo|end\s*o|end\s*of)\s*(flow|low|flo)\b/i)) {
            console.log('✅ [WAKE WORD] Wake word detected! Activating EndoFlow...')
            
            // Stop wake word detection
            if (wakeWordRecognitionRef.current) {
              try {
                wakeWordRecognitionRef.current.stop()
                isWakeWordListeningRef.current = false
                setIsListeningForWakeWord(false)
              } catch (e) {
                // Already stopped
              }
            }
            
            // Activate the chat
            setIsExpanded(true)
            
            // Start voice recording after a brief delay
            setTimeout(() => {
              startVoiceRecording()
            }, 500)
          }
        }

        wakeWordRecognitionRef.current.onerror = (event: any) => {
          // Silent for normal errors, only log critical ones
          if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'audio-capture') {
            console.error('❌ [WAKE WORD] Error:', event.error)
          }
          // Don't restart on error - let onend handle it
        }

        wakeWordRecognitionRef.current.onend = () => {
          console.log('🔄 [WAKE WORD] Recognition ended. Active:', isWakeWordActive, 'Expanded:', isExpanded, 'Listening:', isListening)
          
          // Always update state on end
          const wasListening = isWakeWordListeningRef.current
          isWakeWordListeningRef.current = false
          setIsListeningForWakeWord(false)
          
          // Auto-restart wake word detection if still active and not expanded
          if (wasListening && isWakeWordActive && !isExpanded && !isListening) {
            setTimeout(() => {
              // Double-check conditions before restart
              if (isWakeWordActive && !isExpanded && !isListening && !isWakeWordListeningRef.current) {
                console.log('♻️ [WAKE WORD] Restarting wake word detection...')
                startWakeWordListening()
              } else {
                console.log('⏸️ [WAKE WORD] Skipping restart - conditions not met')
              }
            }, 500)
          } else {
            console.log('⏹️ [WAKE WORD] Not restarting - wasListening:', wasListening, 'conditions not met')
          }
        }

        try {
          console.log('🎤 [WAKE WORD] Requesting microphone permission...')
          // Request microphone permission first
          await navigator.mediaDevices.getUserMedia({ audio: true })
          console.log('✅ [WAKE WORD] Microphone permission granted')
          
          // Double-check we're not already running before starting
          if (!isWakeWordListeningRef.current) {
            console.log('🚀 [WAKE WORD] Starting recognition...')
            wakeWordRecognitionRef.current.start()
            isWakeWordListeningRef.current = true
            setIsListeningForWakeWord(true)
            console.log('✅ [WAKE WORD] Started listening for "Hey EndoFlow"...')
          } else {
            console.log('⚠️ [WAKE WORD] Already listening, skipping start')
          }
        } catch (error: any) {
          // Handle "already started" error gracefully
          if (error?.message?.includes('already started')) {
            console.log('⚠️ [WAKE WORD] Already started (caught error), updating state')
            isWakeWordListeningRef.current = true
            setIsListeningForWakeWord(true)
          } else if (error?.name === 'NotAllowedError') {
            console.error('❌ [WAKE WORD] Microphone permission denied:', error)
            isWakeWordListeningRef.current = false
            setIsListeningForWakeWord(false)
            setError('Microphone permission denied. Please allow microphone access to use wake word detection.')
          } else {
            console.error('❌ [WAKE WORD] Failed to start:', error)
            isWakeWordListeningRef.current = false
            setIsListeningForWakeWord(false)
          }
        } finally {
          // Always clear starting flag
          wakeWordStartingRef.current = false
          console.log('🏁 [WAKE WORD] Start attempt complete')
        }
      }
    }

    // Start wake word listening
    startWakeWordListening()

    return () => {
      console.log('🧹 [WAKE WORD] Cleanup called')
      if (wakeWordRecognitionRef.current && isWakeWordListeningRef.current) {
        try {
          wakeWordRecognitionRef.current.stop()
          isWakeWordListeningRef.current = false
          setIsListeningForWakeWord(false)
          wakeWordStartingRef.current = false
          console.log('✅ [WAKE WORD] Cleaned up')
        } catch (e) {
          // Already stopped
          isWakeWordListeningRef.current = false
          setIsListeningForWakeWord(false)
          wakeWordStartingRef.current = false
        }
      }
    }
  }, [isWakeWordActive, isExpanded, isListening])

  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 [STATE] isWakeWordActive:', isWakeWordActive, 'isExpanded:', isExpanded, 'isListening:', isListening, 'isListeningForWakeWord:', isListeningForWakeWord)
  }, [isWakeWordActive, isExpanded, isListening, isListeningForWakeWord])

  const stopWakeWordDetection = () => {
    if (wakeWordRecognitionRef.current && isWakeWordListeningRef.current) {
      try {
        wakeWordRecognitionRef.current.stop()
        isWakeWordListeningRef.current = false
        setIsListeningForWakeWord(false)
        console.log('🛑 [WAKE WORD] Manually stopped')
      } catch (e) {
        // Already stopped
      }
    }
  }

  const startVoiceRecording = async () => {
    try {
      // Stop wake word detection first
      stopWakeWordDetection()
      
      // Stop any existing recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Already stopped
        }
      }
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Reset transcript
      transcriptRef.current = ''
      setTranscript('')
      setInputValue('')
      setError(null)
      
      // Set flag to continue listening
      shouldContinueListeningRef.current = true
      setIsListening(true)
      
      console.log('🎤 [MAIN MIC] Starting voice recording...')

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
          console.log('✅ [MAIN MIC] Voice recording started')
        } catch (e: any) {
          if (e.message && e.message.includes('already started')) {
            console.log('⚠️ [MAIN MIC] Recognition already running')
          } else {
            throw e
          }
        }
      }
    } catch (error) {
      console.error('Error starting voice recording:', error)
      setError('Microphone access denied. Please allow microphone access.')
      shouldContinueListeningRef.current = false
      setIsListening(false)
    }
  }

  const stopVoiceRecording = () => {
    console.log('🛑 [MAIN MIC] Stopping voice recording...')
    shouldContinueListeningRef.current = false
    setIsListening(false)
    
    // Clear silence timer
    clearSilenceTimer()
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        console.log('✅ [MAIN MIC] Voice recording stopped')
      } catch (e) {
        // Already stopped
      }
    }

    // Keep the transcript in the input field for review
    if (transcriptRef.current) {
      setInputValue(transcriptRef.current.trim())
      
      // In auto mode, stopping the mic should trigger auto-submit
      if (autoModeRef.current && transcriptRef.current.trim().length > 0 && !autoSubmitRef.current) {
        console.log('✨ [AUTO MODE] Mic stopped with text - auto-submitting in 500ms...')
        autoSubmitRef.current = true
        setTimeout(() => {
          handleAutoSubmit()
        }, 500)
      }
    }
  }

  // Handle automated submission
  const handleAutoSubmit = async () => {
    // Check if already submitting
    if (autoSubmitRef.current) {
      console.log('⚠️ [AUTO MODE] Already submitting, skipping')
      return
    }
    
    const query = transcriptRef.current.trim()
    if (!query || isProcessing) {
      console.log('⚠️ [AUTO MODE] Cannot submit - query empty or processing')
      return
    }
    
    // Set flag immediately to prevent duplicates
    autoSubmitRef.current = true
    console.log('🤖 [AUTO MODE] Auto-submitting query:', query)
    
    // Stop listening before submitting
    if (isListeningRef.current) {
      stopVoiceRecording()
      // Wait a bit for stop to complete
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    // Submit the message
    console.log('🚀 [AUTO MODE] Calling handleSendMessage...')
    try {
      await handleSendMessage()
      console.log('✅ [AUTO MODE] handleSendMessage completed')
    } catch (error) {
      console.error('❌ [AUTO MODE] Error in handleSendMessage:', error)
    }
    
    // Reset auto-submit flag after submission completes
    autoSubmitRef.current = false
    console.log('✅ [AUTO MODE] Auto-submit complete')
    
    // If still in auto mode, restart listening after AI responds
    if (autoModeRef.current && voiceEnabled) {
      // Wait for AI response to finish speaking before restarting
      console.log('⏳ [AUTO MODE] Waiting for AI response...')
    }
  }

  // Silence detection timer management
  const resetSilenceTimer = () => {
    clearSilenceTimer()
    
    console.log('🔄 [SILENCE TIMER] Checking conditions - autoMode:', autoModeRef.current, 'isListening:', isListeningRef.current, 'isProcessing:', isProcessing)
    
    if (autoModeRef.current && isListeningRef.current && !isProcessing) {
      console.log('⏰ [SILENCE TIMER] Setting 2-second timer')
      silenceTimerRef.current = setTimeout(() => {
        const silenceDuration = Date.now() - lastSpeechTimeRef.current
        const transcript = transcriptRef.current.trim()
        
        console.log('⏱️ [SILENCE TIMER] Triggered - Duration:', silenceDuration, 'ms, Transcript length:', transcript.length, 'autoSubmit pending:', autoSubmitRef.current)
        
        // If 2 seconds of silence and we have content, auto-submit
        if (silenceDuration >= 2000 && transcript.length > 0 && !autoSubmitRef.current) {
          console.log('🔇 [AUTO MODE] 2s silence detected, auto-submitting...')
          handleAutoSubmit()
        } else {
          console.log('⏸️ [SILENCE TIMER] Conditions not met - silenceDuration:', silenceDuration, 'transcriptLength:', transcript.length, 'autoSubmit:', autoSubmitRef.current)
        }
      }, 2000) // Check after 2 seconds
    } else {
      console.log('⏹️ [SILENCE TIMER] Not setting timer - conditions not met')
    }
  }

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  const speak = (text: string) => {
    if (!voiceEnabled || !synthRef.current) return

    // Cancel any ongoing speech
    synthRef.current.cancel()

    // Clean markdown from text for speech
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\n+/g, '. ')
      .replace(/[#•]/g, '')

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synthRef.current.speak(utterance)
  }

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }
  }

  const handleSendMessage = async () => {
    console.log('📨 [SEND MESSAGE] Called. inputValue:', inputValue, 'transcriptRef:', transcriptRef.current, 'isProcessing:', isProcessing)
    
    // Use transcriptRef if inputValue is empty (for auto-submit)
    const query = (inputValue.trim() || transcriptRef.current.trim())
    
    if (!query || isProcessing) {
      console.log('⚠️ [SEND MESSAGE] Aborted - query empty or processing. Query:', query)
      return
    }
    
    console.log('✅ [SEND MESSAGE] Proceeding with query:', query)

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setTranscript('')
    transcriptRef.current = ''
    setError(null)
    setIsProcessing(true)

    try {
      console.log('📤 [ENDOFLOW] Sending query:', query)
      
      // Add timeout to prevent indefinite waiting
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout - server took too long to respond')), 30000)
      )
      
      const resultPromise = processEndoFlowQuery({
        query,
        conversationId
      })
      
      const result = await Promise.race([resultPromise, timeoutPromise]) as any
      
      console.log('📥 [ENDOFLOW] Received result:', result)

      if (result.success && result.response) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          agentName: result.agentResponses?.[0]?.agentName,
          intent: result.intent?.type
        }

        setMessages(prev => [...prev, assistantMessage])

        if (result.conversationId) {
          setConversationId(result.conversationId)
        }

        // Speak the response if voice is enabled
        if (voiceEnabled) {
          speak(result.response)
          
          // In auto mode, restart listening after speech ends
          if (autoMode && synthRef.current) {
            // Wait for speech to end
            const checkSpeechEnd = setInterval(() => {
              if (!synthRef.current?.speaking) {
                clearInterval(checkSpeechEnd)
                // Restart listening after a brief pause
                setTimeout(() => {
                  if (autoMode && !isListening && !isProcessing) {
                    console.log('🔄 [AUTO MODE] Restarting listening for next query...')
                    startVoiceRecording()
                  }
                }, 1000)
              }
            }, 100)
          }
        } else if (autoMode && !isListening && !isProcessing) {
          // If voice is disabled, restart listening immediately
          setTimeout(() => {
            console.log('🔄 [AUTO MODE] Restarting listening for next query...')
            startVoiceRecording()
          }, 1000)
        }

        // Show suggestions if available
        if (result.suggestions && result.suggestions.length > 0) {
          console.log('💡 Suggestions:', result.suggestions)
        }
      } else {
        console.error('❌ [ENDOFLOW] Error in result:', result.error)
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: result.error || 'I encountered an error processing your request. Please try again.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        setError(result.error || null)
      }
    } catch (error: any) {
      console.error('❌ [ENDOFLOW] Error processing query:', error)
      
      let errorMsg = 'I\'m sorry, something went wrong. '
      
      if (error?.message?.includes('timeout')) {
        errorMsg += 'The request timed out. Please try again.'
      } else if (error?.message?.includes('fetch')) {
        errorMsg += 'Network error - please check your connection and try again.'
      } else if (error?.message) {
        errorMsg += error.message
      } else {
        errorMsg += 'Please try again.'
      }
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setError(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !autoMode) {
      e.preventDefault()
      handleSendMessage()
    } else if (e.key === 'Enter' && autoMode) {
      e.preventDefault()
      console.log('⚠️ [AUTO MODE] Enter key disabled - use voice or wait for auto-submit')
    }
  }

  const clearConversation = () => {
    setMessages([])
    setConversationId(null)
    setError(null)
    stopSpeaking()

    // Re-add welcome message
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'system',
      content: '👋 **Welcome back!**\n\nHow can I help you today?',
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  if (isFloating && !isExpanded) {
    // Floating button (collapsed state)
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={toggleExpand}
          size="lg"
          className="h-16 w-16 rounded-full bg-gradient-to-br from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 shadow-2xl transition-all hover:scale-110"
        >
          <Sparkles className="h-8 w-8 text-white" />
        </Button>
        {isListeningForWakeWord ? (
          <div className="absolute -top-14 right-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm px-4 py-2 rounded-lg animate-pulse shadow-2xl border-2 border-green-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
              <span className="font-semibold">🎤 Listening for "Hey EndoFlow"...</span>
            </div>
          </div>
        ) : (
          <div className="absolute -top-12 right-0 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap border border-gray-600">
            <span className="font-medium">Say: "Hey EndoFlow"</span>
          </div>
        )}
        {/* Wake word toggle button */}
        <Button
          onClick={() => setIsWakeWordActive(!isWakeWordActive)}
          size="sm"
          variant={isWakeWordActive ? "default" : "outline"}
          className={cn(
            "absolute -left-16 top-0 h-16 w-14 rounded-lg shadow-lg transition-all",
            isWakeWordActive ? "bg-green-600 hover:bg-green-700 text-white" : "bg-white hover:bg-gray-100"
          )}
          title={isWakeWordActive ? "Disable wake word detection" : "Enable wake word detection"}
        >
          {isWakeWordActive ? (
            <Mic className="w-5 h-5" />
          ) : (
            <MicOff className="w-5 h-5" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <Card
      className={cn(
        'border-2 border-teal-300 shadow-2xl',
        isFloating && 'fixed bottom-6 right-6 z-50 w-[450px] max-h-[600px]'
      )}
    >
      <CardHeader className="bg-gradient-to-r from-teal-600 to-blue-600 text-white border-b-2 border-teal-300 flex-shrink-0 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Hey EndoFlow
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                  <Brain className="w-3 h-3 mr-1" />
                  Master AI
                </Badge>
              </CardTitle>
              <p className="text-xs text-teal-100 mt-1">Intelligent voice & text assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant={autoMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setAutoMode(!autoMode)}
              className={cn(
                "h-8 px-2 text-white",
                autoMode ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-white/20"
              )}
              title={autoMode ? "Disable automated conversation" : "Enable automated conversation"}
            >
              {autoMode ? (
                <>
                  <Zap className="w-4 h-4 mr-1" />
                  <span className="text-xs">Auto</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-1" />
                  <span className="text-xs">Manual</span>
                </>
              )}
            </Button>
            <Button
              variant={isWakeWordActive ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsWakeWordActive(!isWakeWordActive)}
              className={cn(
                "h-8 px-2 text-white",
                isWakeWordActive ? "bg-green-600 hover:bg-green-700" : "hover:bg-white/20"
              )}
              title={isWakeWordActive ? "Disable wake word" : "Enable wake word"}
            >
              {isWakeWordActive ? (
                <>
                  <Mic className="w-4 h-4 mr-1" />
                  <span className="text-xs">Wake</span>
                </>
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              title={voiceEnabled ? 'Disable voice responses' : 'Enable voice responses'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            {isFloating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleExpand}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col p-0 h-[500px]">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role !== 'user' && (
                  <div
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                      message.role === 'system' ? 'bg-blue-600' : 'bg-teal-600'
                    )}
                  >
                    {message.role === 'system' ? (
                      <MessageSquare className="h-4 w-4 text-white" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-white" />
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-3 shadow-sm',
                    message.role === 'user'
                      ? 'bg-teal-600 text-white'
                      : message.role === 'system'
                      ? 'bg-blue-50 text-blue-900 border border-blue-200'
                      : 'bg-white text-gray-900 border border-gray-200'
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                  {message.agentName && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <Badge variant="outline" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        {message.agentName}
                      </Badge>
                    </div>
                  )}
                  <div
                    className={cn(
                      'text-xs mt-1',
                      message.role === 'user' ? 'text-teal-100' : 'text-gray-400'
                    )}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {isSpeaking && (
              <Alert className="border-green-200 bg-green-50">
                <Volume2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-900 flex items-center justify-between">
                  <span>Speaking response...</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopSpeaking}
                    className="h-6 text-xs"
                  >
                    Stop
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Voice Recording Indicator */}
        {isListening && (
          <div className="px-4 py-2 bg-gradient-to-r from-red-50 to-orange-50 border-t-2 border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-900">🎙️ Listening...</span>
              </div>
              <Badge className="bg-red-100 text-red-700 border-red-300">
                <Mic className="h-3 w-3 mr-1" />
                Recording
              </Badge>
            </div>
            {transcript && (
              <div className="mt-2 p-2 bg-white rounded border border-red-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-600">Live transcript:</p>
                  {autoMode && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                      <Zap className="w-3 h-3 mr-1" />
                      Auto mode
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-900">{transcript}</p>
                {autoMode && transcript.trim().length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    🔇 Will auto-submit after 2s silence or say "do it", "search it", "send it"
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t bg-white p-4 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isListening
                  ? 'Speaking... (click stop when done)'
                  : 'Ask me anything or click the mic to speak...'
              }
              disabled={isProcessing || isListening}
              className="flex-1 h-10 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 text-sm"
            />

            {/* Voice Button */}
            <Button
              type="button"
              onClick={isListening ? stopVoiceRecording : startVoiceRecording}
              disabled={isProcessing}
              className={cn(
                'h-10 px-4',
                isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
              )}
              title={autoMode && isListening ? 'Stop & auto-submit' : isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            {/* Send Button - Hidden in auto mode when listening */}
            {!autoMode && (
              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={isProcessing || !inputValue.trim() || isListening}
                className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 h-10 px-4"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Clear Button */}
            {messages.length > 1 && (
              <Button
                type="button"
                onClick={clearConversation}
                variant="outline"
                size="sm"
                className="h-10 px-3"
                title="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500 text-center">
            {isListening ? (
              <span className="text-red-600 font-medium">
                {autoMode ? (
                  <>
                    🤖 Auto mode: Speak naturally - I'll submit after 2s silence or command phrases
                  </>
                ) : (
                  <>
                    🎤 Speak clearly: Ask about patients, schedule, treatments, or anything else
                  </>
                )}
              </span>
            ) : (
              <span>
                {autoMode ? (
                  <>
                    🤖 <strong>Auto mode enabled</strong> - Hands-free conversation
                  </>
                ) : (
                  <>
                    💡 Type your question or press{' '}
                    <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
                      Enter
                    </kbd>{' '}
                    to send
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
