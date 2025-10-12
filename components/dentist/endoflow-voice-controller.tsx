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
  X,
  Globe
} from 'lucide-react'
import { processEndoFlowQuery } from '@/lib/actions/endoflow-master'
import { cn } from '@/lib/utils'
import { useVoiceManager } from '@/lib/contexts/voice-manager-context'

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
  // Get voice manager
  const voiceManager = useVoiceManager()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  // Initialize conversationId from localStorage immediately to prevent race conditions
  const getInitialConversationId = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('endoflow_current_conversation_id')
      if (stored) {
        console.log('💾 [PERSISTENCE] Initializing with conversation ID from localStorage:', stored)
        return stored
      }
    }
    console.log('🆕 [PERSISTENCE] No existing conversation ID found - will create new')
    return null
  }
  
  const [conversationId, setConversationId] = useState<string | null>(getInitialConversationId)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [isWakeWordActive, setIsWakeWordActive] = useState(true) // Enable wake word by default
  const [selectedLanguage, setSelectedLanguage] = useState<'en-US' | 'en-IN' | 'hi-IN'>('en-US') // Language selection
  
  // Save conversationId to localStorage whenever it changes
  useEffect(() => {
    if (conversationId) {
      console.log('💾 [PERSISTENCE] Saving conversation ID to localStorage:', conversationId)
      localStorage.setItem('endoflow_current_conversation_id', conversationId)
    }
  }, [conversationId])
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false)
  const [autoMode, setAutoMode] = useState(true) // Automated conversation mode
  const [silenceTimeout, setSilenceTimeout] = useState<number | null>(null)
  
  // Refs for wake word state checks (prevent stale closure issues)
  const isExpandedRef = useRef(false)
  const isWakeWordActiveRef = useRef(true)
  
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
  
  // Sync isExpanded state with ref for closure access
  useEffect(() => {
    isExpandedRef.current = isExpanded
  }, [isExpanded])
  
  // Sync isWakeWordActive state with ref for closure access
  useEffect(() => {
    isWakeWordActiveRef.current = isWakeWordActive
  }, [isWakeWordActive])
  
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
  const transcriptRef = useRef<string>('') // Track latest transcript value (final + interim)
  const finalTranscriptRef = useRef<string>('') // Track only final confirmed results
  const shouldContinueListeningRef = useRef(false) // Fix auto-restart bug
  const wakeWordRecognitionRef = useRef<any>(null) // Wake word detection
  const isWakeWordListeningRef = useRef(false) // Track wake word listening state
  const wakeWordStartingRef = useRef(false) // Prevent multiple simultaneous starts
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null) // Silence detection timer
  const lastSpeechTimeRef = useRef<number>(Date.now()) // Track last speech time
  const autoSubmitRef = useRef(false) // Track if auto-submit is pending
  const autoModeRef = useRef(true) // Track auto mode with ref for closure
  const isListeningRef = useRef(false) // Track listening state with ref for closure
  const lastWakeWordRestartRef = useRef<number>(0) // Track last wake word restart time to prevent infinite loops
  const isMountedRef = useRef(false) // Track if component has fully mounted to prevent React StrictMode double-mount issues
  const justDetectedWakeWordRef = useRef(false) // Track if we just detected wake word to skip filtering briefly

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
      recognitionRef.current.lang = selectedLanguage // Use selected language
      console.log('🌐 [MAIN MIC] Language set to:', selectedLanguage)

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = ''
        
        // Wake word phrases to filter out
        const wakeWordPhrases = [
          'hey endoflow', 'hey endo flow', 'hey end flow',
          'hi endoflow', 'hi endo flow', 'hey indo flow',
          'he end of low', 'hey end of low', 'he endo flow',
          'hey and flow', 'hey endo', 'hey end', 'he endo',
          'endoflow', 'endo flow', 'hey endoc', 'hey endoclo'
        ]

        // Process only the new results (starting from resultIndex)
        for (let i = event.resultIndex; i < event.results.length; i++) {
          let transcriptText = event.results[i][0].transcript
          const transcriptLower = transcriptText.toLowerCase().trim()
          
          // SKIP FILTERING if we just detected wake word (grace period)
          let shouldFilter = false
          if (!justDetectedWakeWordRef.current) {
            // Check if this segment is primarily a wake word phrase
            for (const phrase of wakeWordPhrases) {
              // Filter if transcript IS the wake word or starts/ends with it
              if (transcriptLower === phrase || 
                  transcriptLower.startsWith(phrase + ' ') || 
                  transcriptLower.endsWith(' ' + phrase) ||
                  (transcriptLower.length <= phrase.length + 3 && transcriptLower.includes(phrase))) {
                console.log('🧹 [MAIN MIC] Filtering wake word phrase:', transcriptLower)
                shouldFilter = true
                break
              }
            }
          } else {
            console.log('⏭️ [MAIN MIC] Skipping wake word filter (grace period active)')
          }
          
          // If this is a wake word, skip it entirely
          if (shouldFilter) {
            continue
          }
          
          if (event.results[i].isFinal) {
            // Add final result to our permanent transcript
            finalTranscriptRef.current += transcriptText + ' '
            console.log('✅ [MAIN MIC] Final transcript:', transcriptText)
          } else {
            // Interim results are temporary - they replace previous interim
            interimTranscript += transcriptText
            console.log('⏳ [MAIN MIC] Interim transcript:', transcriptText)
          }
        }

        // Combine final (permanent) + interim (temporary)
        const fullTranscript = finalTranscriptRef.current + interimTranscript
        transcriptRef.current = fullTranscript
        
        setTranscript(fullTranscript)
        setInputValue(fullTranscript)
        
        // Update last speech time for silence detection
        lastSpeechTimeRef.current = Date.now()
        
        // Check for command phrases in automated mode
        if (autoModeRef.current) {
          const fullText = fullTranscript.toLowerCase()
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
        
        // Reset silence timer when any speech is detected (both final and interim)
        if ((interimTranscript || finalTranscriptRef.current) && autoModeRef.current && !autoSubmitRef.current && isListeningRef.current) {
          console.log('⏱️ [AUTO MODE] Resetting silence timer')
          resetSilenceTimer()
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        // Don't log or show errors for normal user actions
        if (event.error === 'no-speech' || event.error === 'aborted') {
          console.log('ℹ️ [MAIN MIC] Non-critical error:', event.error, '(ignoring)')
          return // Silent - this is normal
        }
        console.error('❌ [MAIN MIC] Speech recognition error:', event.error)
        setError(`Speech recognition error: ${event.error}`)
        shouldContinueListeningRef.current = false
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        console.log('🎤 [MAIN MIC] Recognition ended. shouldContinue:', shouldContinueListeningRef.current, 'autoMode:', autoModeRef.current)

        // In auto mode, if we have transcript and recognition ended naturally, auto-submit
        if (autoModeRef.current && !shouldContinueListeningRef.current && finalTranscriptRef.current.trim().length > 0 && !autoSubmitRef.current) {
          console.log('🤖 [AUTO MODE] Recognition ended with transcript - auto-submitting...')
          autoSubmitRef.current = true
          // CRITICAL: Update listening state to allow fallback timer to work
          setIsListening(false)
          setTimeout(() => {
            handleAutoSubmit()
          }, 500)
          // CRITICAL: Unregister from voice manager since we're done
          console.log('🧹 [MAIN MIC] Unregistering from voice manager (auto-submit path)')
          voiceManager.unregisterMicUsage('endoflow-master-ai')
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
            // CRITICAL: Unregister from voice manager on error
            console.log('🧹 [MAIN MIC] Unregistering from voice manager (error path)')
            voiceManager.unregisterMicUsage('endoflow-master-ai')
          }
        } else {
          // CRITICAL: Unregister from voice manager when not continuing
          console.log('🧹 [MAIN MIC] Unregistering from voice manager (stopped path)')
          voiceManager.unregisterMicUsage('endoflow-master-ai')
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
    console.log('🔄 [WAKE WORD EFFECT] Triggered. Active:', isWakeWordActive, 'Expanded:', isExpanded, 'Listening:', isListening, 'Mounted:', isMountedRef.current, 'Currently listening:', isWakeWordListeningRef.current, 'Starting:', wakeWordStartingRef.current)

    // Notify voice manager about wake word status first
    voiceManager.notifyWakeWordStatus(isWakeWordActive)

    // CRITICAL: Skip if wake word is already running or starting - prevents restart loops
    if (isWakeWordActive && (isWakeWordListeningRef.current || wakeWordStartingRef.current)) {
      console.log('⏭️ [WAKE WORD] Already running/starting, skipping restart')
      return
    }

    // Mark as mounted after first render
    isMountedRef.current = true

    const startWakeWordListening = async () => {
      // CRITICAL: Check voice manager FIRST before any other checks
      const anyOtherMicActive = voiceManager.isAnyMicActive()
      
      // Should we stop wake word detection?
      // Check both local conditions AND if any other component is using the mic
      if (!isWakeWordActive || isExpanded || isListening || anyOtherMicActive) {
        console.log('🛑 [WAKE WORD] Should stop. Active:', isWakeWordActive, 'Expanded:', isExpanded, 'Listening:', isListening, 'OtherMics:', anyOtherMicActive)
        
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
      
      // CRITICAL: Double-check voice manager right before starting
      const stillAnyOtherMicActive = voiceManager.isAnyMicActive()
      if (stillAnyOtherMicActive) {
        console.log('⚠️ [WAKE WORD] Other mics became active, aborting start')
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
        // Wake word detection always uses en-US (as "Hey EndoFlow" is English)
        wakeWordRecognitionRef.current.lang = 'en-US'
        wakeWordRecognitionRef.current.maxAlternatives = 3 // Check more alternatives

        // Track accumulated transcript for better wake word detection
        let accumulatedTranscript = ''
        let lastResultTime = Date.now()
        
        wakeWordRecognitionRef.current.onresult = (event: any) => {
          // SAFETY: Don't process if we're speaking (AI response)
          if (isSpeaking) {
            console.log('🔇 [WAKE WORD] Ignoring results while AI is speaking')
            return
          }
          
          // Build the complete transcript from all results
          let currentTranscript = ''
          for (let i = 0; i < event.results.length; i++) {
            // Check multiple alternatives for better recognition
            for (let j = 0; j < event.results[i].length && j < 3; j++) {
              const altTranscript = event.results[i][j].transcript.toLowerCase()
              if (j === 0) {
                currentTranscript += altTranscript + ' '
              }
              // Check alternatives immediately for wake word
              if (altTranscript.includes('endoflow') || altTranscript.includes('endo flow')) {
                currentTranscript = altTranscript + ' '
                break
              }
            }
          }
          
          // Update accumulated transcript
          accumulatedTranscript = currentTranscript.trim()
          lastResultTime = Date.now()
          
          console.log('🎤 [WAKE WORD] Detected:', accumulatedTranscript)

          // More robust wake word detection
          // Check if the accumulated transcript contains wake word patterns
          const normalizedTranscript = accumulatedTranscript.replace(/\s+/g, ' ').trim()
          
          // Check for various wake word patterns
          const wakeWordPatterns = [
            'hey endoflow',
            'hey endo flow',
            'hey end flow',
            'hi endoflow',
            'hi endo flow',
            'endoflow',
            'endo flow',
            'hey indo flow',
            'a endoflow',
            'he end of low', // Common misheard variant
            'hey end of low', // Another variant
            'he endo flow',
            'hey and flow'
          ]
          
          // Check if transcript contains any wake word pattern
          const hasWakeWord = wakeWordPatterns.some(pattern => 
            normalizedTranscript.includes(pattern)
          )
          
          // Also check for partial matches that strongly indicate wake word
          const hasStrongPartialMatch = 
            // "hey/hi/he" + "endo/end"
            ((normalizedTranscript.includes('hey') || normalizedTranscript.includes('hi') || normalizedTranscript.includes('he ')) && 
             (normalizedTranscript.includes('endo') || normalizedTranscript.includes('end o') || normalizedTranscript.includes('and o') || normalizedTranscript.includes('end '))) ||
            // "hey/hi/he" + "flow/low"
            ((normalizedTranscript.includes('hey') || normalizedTranscript.includes('hi') || normalizedTranscript.includes('he ')) && 
             (normalizedTranscript.includes('flow') || normalizedTranscript.includes(' low'))) ||
            // "endo" + "flow"
            (normalizedTranscript.includes('endo') && normalizedTranscript.includes('flow')) ||
            // "end" + "of" + "low" (common misheard)
            (normalizedTranscript.includes('end') && normalizedTranscript.includes('of') && normalizedTranscript.includes('low')) ||
            // Regex patterns for common variations
            (normalizedTranscript.match(/\b(hey|hi|he)\s+(end|endo|and)\s+(of\s+)?(flow|low)\b/i) && normalizedTranscript.length > 5)
          
          if (hasWakeWord || hasStrongPartialMatch) {
            console.log('✅ [WAKE WORD] Wake word detected! Transcript:', normalizedTranscript)
            console.log('✨ [WAKE WORD] Activating EndoFlow...')
            
            // Reset accumulated transcript
            accumulatedTranscript = ''
            
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
            
            // CRITICAL: Force expand the chat box
            console.log('🔼 [WAKE WORD] Forcing chat expansion...')
            setIsExpanded(true)
            isExpandedRef.current = true
            
            // Set flag to skip wake word filtering for next 2 seconds
            justDetectedWakeWordRef.current = true
            console.log('⏱️ [WAKE WORD] Setting grace period to skip filtering')
            setTimeout(() => {
              justDetectedWakeWordRef.current = false
              console.log('✅ [WAKE WORD] Grace period ended')
            }, 2000)
            
            // Start voice recording after a longer delay to ensure wake word phrase has fully ended
            setTimeout(() => {
              console.log('🎙️ [WAKE WORD] Starting voice recording after expansion...')
              startVoiceRecording()
            }, 1200)
          }
          
          // Clear accumulated transcript after 3 seconds to avoid false positives from old speech
          if (accumulatedTranscript.length > 0) {
            setTimeout(() => {
              if (accumulatedTranscript === currentTranscript.trim()) {
                console.log('🧹 [WAKE WORD] Clearing accumulated transcript after timeout')
                accumulatedTranscript = ''
              }
            }, 3000)
          }
        }

        wakeWordRecognitionRef.current.onerror = (event: any) => {
          // Silent for normal errors, only log critical ones
          if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'audio-capture') {
            console.error('❌ [WAKE WORD] Error:', event.error)
          }
          // For no-speech error, just continue listening
          if (event.error === 'no-speech') {
            console.log('🔇 [WAKE WORD] No speech detected, continuing...')
            // Don't set listening to false, just continue
            // Keep accumulated transcript if we have something
            if (accumulatedTranscript && Date.now() - lastResultTime < 2000) {
              console.log('📝 [WAKE WORD] Keeping partial transcript:', accumulatedTranscript)
            }
          }
          // Don't restart on error - let onend handle it
        }

        wakeWordRecognitionRef.current.onend = () => {
          console.log('🔄 [WAKE WORD] Recognition ended. Active:', isWakeWordActiveRef.current, 'Expanded:', isExpandedRef.current, 'Listening:', isListeningRef.current)

          // Update state on end
          isWakeWordListeningRef.current = false
          setIsListeningForWakeWord(false)
          wakeWordStartingRef.current = false
          
          console.log('⏹️ [WAKE WORD] Stopped - will restart via effect if conditions met')
          // DO NOT AUTO-RESTART HERE - let the effect handle it to prevent infinite loops
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
          // Always clear starting flag - CRITICAL: Must clear in all exit paths
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
          wakeWordStartingRef.current = false // CRITICAL: Clear starting flag
          console.log('✅ [WAKE WORD] Cleaned up')
        } catch (e) {
          // Already stopped - CRITICAL: Clear starting flag even on error
          isWakeWordListeningRef.current = false
          setIsListeningForWakeWord(false)
          wakeWordStartingRef.current = false
        }
      } else {
        // CRITICAL: Clear starting flag even if not actively listening
        wakeWordStartingRef.current = false
      }
    }
  }, [isWakeWordActive, isExpanded, isListening]) // Note: voiceManager accessed but not in deps - it's a stable context object

  // Monitor voice manager state changes to auto-restart wake word
  // This effect handles the case when other mics stop and wake word should resume
  // CRITICAL: Uses activeMicCount from voice manager to reactively detect mic releases
  useEffect(() => {
    // Function to check and restart wake word if conditions are met
    const checkAndRestartWakeWord = () => {
      const anyMicActive = voiceManager.isAnyMicActive()
      const activeMicCount = voiceManager.activeMicCount
      
      console.log('🔍 [WAKE WORD MONITOR] Checking restart conditions...')
      console.log('  - Active mic count:', activeMicCount)
      console.log('  - Any mic active:', anyMicActive)
      console.log('  - Wake word active:', isWakeWordActiveRef.current)
      console.log('  - Expanded:', isExpandedRef.current)
      console.log('  - Listening (main):', isListeningRef.current)
      console.log('  - Wake word listening:', isWakeWordListeningRef.current)
      console.log('  - Wake word starting:', wakeWordStartingRef.current)
      
      // If no other mic is active AND wake word should be running but isn't, restart it
      if (activeMicCount === 0 && 
          !anyMicActive && 
          isWakeWordActiveRef.current && 
          !isExpandedRef.current && 
          !isListeningRef.current && 
          !isWakeWordListeningRef.current && 
          !wakeWordStartingRef.current) {
        
        console.log('🔄 [WAKE WORD MONITOR] Conditions met! Restarting wake word...')
        
        // Use a small delay to ensure cleanup is complete
        setTimeout(() => {
          // Double-check conditions one more time before restart
          const stillAnyMicActive = voiceManager.isAnyMicActive()
          if (!stillAnyMicActive && 
              isWakeWordActiveRef.current && 
              !isExpandedRef.current && 
              !isListeningRef.current && 
              !isWakeWordListeningRef.current && 
              !wakeWordStartingRef.current) {
            
            console.log('✅ [WAKE WORD MONITOR] Final check passed, initiating restart...')
            
            // Start wake word listening
            const startWakeWord = async () => {
              wakeWordStartingRef.current = true
              
              if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
                
                // Create new recognition instance
                wakeWordRecognitionRef.current = new SpeechRecognition()
                wakeWordRecognitionRef.current.continuous = true
                wakeWordRecognitionRef.current.interimResults = true
                // Wake word detection always uses en-US (as "Hey EndoFlow" is English)
                wakeWordRecognitionRef.current.lang = 'en-US'
                wakeWordRecognitionRef.current.maxAlternatives = 3 // Check more alternatives

                // Track accumulated transcript for better wake word detection
                let accumulatedTranscript = ''
                let lastResultTime = Date.now()
                
                // Set up handlers (same as main wake word effect)
                wakeWordRecognitionRef.current.onresult = (event: any) => {
                  // Build the complete transcript from all results
                  let currentTranscript = ''
                  for (let i = 0; i < event.results.length; i++) {
                    // Check multiple alternatives for better recognition
                    for (let j = 0; j < event.results[i].length && j < 3; j++) {
                      const altTranscript = event.results[i][j].transcript.toLowerCase()
                      if (j === 0) {
                        currentTranscript += altTranscript + ' '
                      }
                      // Check alternatives immediately for wake word
                      if (altTranscript.includes('endoflow') || altTranscript.includes('endo flow')) {
                        currentTranscript = altTranscript + ' '
                        break
                      }
                    }
                  }
                  
                  // Update accumulated transcript
                  accumulatedTranscript = currentTranscript.trim()
                  lastResultTime = Date.now()
                  
                  console.log('🎤 [WAKE WORD MONITOR] Detected:', accumulatedTranscript)

                  // More robust wake word detection
                  const normalizedTranscript = accumulatedTranscript.replace(/\s+/g, ' ').trim()
                  
                  // Check for various wake word patterns
                  const wakeWordPatterns = [
                    'hey endoflow',
                    'hey endo flow',
                    'hey end flow',
                    'hi endoflow',
                    'hi endo flow',
                    'endoflow',
                    'endo flow',
                    'hey indo flow',
                    'a endoflow',
                    'he end of low', // Common misheard variant
                    'hey end of low', // Another variant
                    'he endo flow',
                    'hey and flow'
                  ]
                  
                  // Check if transcript contains any wake word pattern
                  const hasWakeWord = wakeWordPatterns.some(pattern => 
                    normalizedTranscript.includes(pattern)
                  )
                  
                  // Also check for partial matches that strongly indicate wake word
                  const hasStrongPartialMatch = 
                    // "hey/hi/he" + "endo/end"
                    ((normalizedTranscript.includes('hey') || normalizedTranscript.includes('hi') || normalizedTranscript.includes('he ')) && 
                     (normalizedTranscript.includes('endo') || normalizedTranscript.includes('end o') || normalizedTranscript.includes('and o') || normalizedTranscript.includes('end '))) ||
                    // "hey/hi/he" + "flow/low"
                    ((normalizedTranscript.includes('hey') || normalizedTranscript.includes('hi') || normalizedTranscript.includes('he ')) && 
                     (normalizedTranscript.includes('flow') || normalizedTranscript.includes(' low'))) ||
                    // "endo" + "flow"
                    (normalizedTranscript.includes('endo') && normalizedTranscript.includes('flow')) ||
                    // "end" + "of" + "low" (common misheard)
                    (normalizedTranscript.includes('end') && normalizedTranscript.includes('of') && normalizedTranscript.includes('low')) ||
                    // Regex patterns for common variations
                    (normalizedTranscript.match(/\b(hey|hi|he)\s+(end|endo|and)\s+(of\s+)?(flow|low)\b/i) && normalizedTranscript.length > 5)
                  
                  if (hasWakeWord || hasStrongPartialMatch) {
                    console.log('✅ [WAKE WORD MONITOR] Wake word detected! Transcript:', normalizedTranscript)
                    console.log('✨ [WAKE WORD MONITOR] Activating EndoFlow...')
                    
                    // Reset accumulated transcript
                    accumulatedTranscript = ''
                    
                    if (wakeWordRecognitionRef.current) {
                      try {
                        wakeWordRecognitionRef.current.stop()
                        isWakeWordListeningRef.current = false
                        setIsListeningForWakeWord(false)
                      } catch (e) {
                        // Already stopped
                      }
                    }
                    
                    setIsExpanded(true)
                    setTimeout(() => {
                      startVoiceRecording()
                    }, 500)
                  }
                  
                  // Clear accumulated transcript after 3 seconds
                  if (accumulatedTranscript.length > 0) {
                    setTimeout(() => {
                      if (accumulatedTranscript === currentTranscript.trim()) {
                        console.log('🧹 [WAKE WORD MONITOR] Clearing accumulated transcript after timeout')
                        accumulatedTranscript = ''
                      }
                    }, 3000)
                  }
                }

                wakeWordRecognitionRef.current.onerror = (event: any) => {
                  if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'audio-capture') {
                    console.error('❌ [WAKE WORD] Error:', event.error)
                  }
                }

                wakeWordRecognitionRef.current.onend = () => {
                  console.log('🔄 [WAKE WORD MONITOR] Recognition ended. Active:', isWakeWordActiveRef.current, 'Expanded:', isExpandedRef.current, 'Listening:', isListeningRef.current)

                  // Update state on end
                  isWakeWordListeningRef.current = false
                  setIsListeningForWakeWord(false)
                  wakeWordStartingRef.current = false
                  
                  console.log('⏹️ [WAKE WORD MONITOR] Stopped - will restart via effect if conditions met')
                  // DO NOT AUTO-RESTART HERE - let the effect handle it to prevent infinite loops
                }

                try {
                  console.log('🎤 [WAKE WORD MONITOR] Requesting microphone permission...')
                  await navigator.mediaDevices.getUserMedia({ audio: true })
                  console.log('✅ [WAKE WORD MONITOR] Microphone permission granted')
                  
                  if (!isWakeWordListeningRef.current) {
                    console.log('🚀 [WAKE WORD MONITOR] Starting recognition...')
                    wakeWordRecognitionRef.current.start()
                    isWakeWordListeningRef.current = true
                    setIsListeningForWakeWord(true)
                    console.log('✅ [WAKE WORD MONITOR] Started listening for "Hey EndoFlow"...')
                  }
                } catch (error: any) {
                  if (error?.message?.includes('already started')) {
                    console.log('⚠️ [WAKE WORD MONITOR] Already started (caught error), updating state')
                    isWakeWordListeningRef.current = true
                    setIsListeningForWakeWord(true)
                  } else {
                    console.error('❌ [WAKE WORD MONITOR] Failed to start:', error)
                  }
                } finally {
                  // CRITICAL: Always clear starting flag
                  wakeWordStartingRef.current = false
                  console.log('🏁 [WAKE WORD MONITOR] Start attempt complete')
                }
              }
            }
            
            startWakeWord()
          } else {
            console.log('❌ [WAKE WORD MONITOR] Final check failed, not restarting')
            console.log('  - Still any mic active:', stillAnyMicActive)
            console.log('  - Wake word active:', isWakeWordActiveRef.current)
            console.log('  - Expanded:', isExpandedRef.current)
            console.log('  - Listening:', isListeningRef.current)
            console.log('  - Already listening for wake word:', isWakeWordListeningRef.current)
          }
        }, 600) // Slightly longer delay to ensure other mics have fully released
      } else {
        console.log('⏭️ [WAKE WORD MONITOR] Conditions not met, skipping restart')
      }
    }
    
    // Run check when dependencies change
    // CRITICAL: activeMicCount changes when ANY mic (including global recorder) starts/stops
    // This ensures we catch when the global recorder stops and restart wake word
    checkAndRestartWakeWord()
  }, [voiceManager.activeMicCount, isWakeWordActive])

  // Cleanup when panel is collapsed
  useEffect(() => {
    if (!isExpanded && isListening) {
      console.log('🧹 [CLEANUP] Panel collapsed - stopping main mic')
      stopVoiceRecording()
    }
  }, [isExpanded])

  // Handle language change - restart recognition if currently listening
  useEffect(() => {
    if (isListening && recognitionRef.current) {
      console.log('🌐 [LANGUAGE CHANGE] Restarting recognition with new language:', selectedLanguage)
      
      // Stop current recognition
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Already stopped
      }
      
      // Update language and restart
      setTimeout(() => {
        if (recognitionRef.current && isListening) {
          recognitionRef.current.lang = selectedLanguage
          try {
            recognitionRef.current.start()
            console.log('✅ [LANGUAGE CHANGE] Recognition restarted with', selectedLanguage)
          } catch (e) {
            console.error('❌ [LANGUAGE CHANGE] Failed to restart:', e)
          }
        }
      }, 300)
    }
  }, [selectedLanguage])
  
  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 [STATE] isWakeWordActive:', isWakeWordActive, 'isExpanded:', isExpanded, 'isListening:', isListening, 'isListeningForWakeWord:', isListeningForWakeWord, 'language:', selectedLanguage)
  }, [isWakeWordActive, isExpanded, isListening, isListeningForWakeWord, selectedLanguage])

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
      // Register with voice manager
      voiceManager.registerMicUsage('endoflow-master-ai')
      
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
      
      // Reset transcript refs (CRITICAL: Reset both refs for clean start)
      transcriptRef.current = ''
      finalTranscriptRef.current = ''
      setTranscript('')
      setInputValue('')
      setError(null)
      console.log('🔄 [MAIN MIC] Transcript refs reset for new recording')
      
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
    
    // Unregister from voice manager
    console.log('🧹 [MAIN MIC] Unregistering mic from voice manager')
    voiceManager.unregisterMicUsage('endoflow-master-ai')
    
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

    // Keep the transcript in the input field for review (use final transcript only)
    if (finalTranscriptRef.current) {
      setInputValue(finalTranscriptRef.current.trim())
      
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
    // Use finalTranscriptRef for submission (only confirmed speech)
    const query = finalTranscriptRef.current.trim()
    if (!query || isProcessing) {
      console.log('⚠️ [AUTO MODE] Cannot submit - query empty or processing')
      autoSubmitRef.current = false // Reset flag if cannot submit
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
        const transcript = finalTranscriptRef.current.trim()
        
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

  // Effect to pause/resume wake word detection when AI is speaking
  useEffect(() => {
    if (isSpeaking && isWakeWordActive && isWakeWordListeningRef.current && wakeWordRecognitionRef.current) {
      // Pause wake word detection while AI is speaking
      console.log('🔇 [WAKE WORD] Pausing wake word detection during AI speech')
      try {
        wakeWordRecognitionRef.current.stop()
        isWakeWordListeningRef.current = false
        setIsListeningForWakeWord(false)
      } catch (e) {
        // Already stopped
      }
    } else if (!isSpeaking && isWakeWordActive && !isExpanded && !isListening && !isWakeWordListeningRef.current) {
      // Resume wake word detection after AI finishes speaking (if chat is not expanded)
      console.log('🔊 [WAKE WORD] Resuming wake word detection after AI speech')
      // Let the main effect handle restarting
    }
  }, [isSpeaking, isWakeWordActive, isExpanded, isListening])

  const handleSendMessage = async () => {
    console.log('📨 [SEND MESSAGE] Called. inputValue:', inputValue, 'finalTranscriptRef:', finalTranscriptRef.current, 'isProcessing:', isProcessing)
    
    // Use finalTranscriptRef if inputValue is empty (for auto-submit - only confirmed speech)
    const query = (inputValue.trim() || finalTranscriptRef.current.trim())
    
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
    finalTranscriptRef.current = ''
    setError(null)
    setIsProcessing(true)

    try {
      console.log('📤 [ENDOFLOW] Sending query:', query, 'conversationId:', conversationId)
      
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
    
    // Clear stored conversation ID from localStorage
    localStorage.removeItem('endoflow_current_conversation_id')
    console.log('🧹 [PERSISTENCE] Cleared conversation ID from localStorage')

    // Re-add welcome message
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'system',
      content: '👋 **Welcome back!**\\n\\nHow can I help you today?',
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
  }

  const toggleExpand = () => {
    const newExpandedState = !isExpanded
    setIsExpanded(newExpandedState)
    
    // If collapsing, make sure to stop voice recording and clean up mic registration
    if (!newExpandedState && isListening) {
      console.log('🔽 [TOGGLE] Collapsing panel - stopping voice recording')
      stopVoiceRecording()
    }
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
        isFloating && 'fixed bottom-4 right-4 z-50 w-[450px] max-h-[calc(100vh-2rem)] flex flex-col'
      )}
    >
      <CardHeader className="bg-gradient-to-r from-teal-600 to-blue-600 text-white border-b-2 border-teal-300 flex-shrink-0 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-bold flex items-center gap-1 leading-tight">
                Hey EndoFlow
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px] px-1 py-0">
                  <Brain className="w-2 h-2 mr-0.5" />
                  AI
                </Badge>
              </CardTitle>
              <p className="text-[10px] text-teal-100 mt-0.5">Voice & text assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Language Selector */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-white hover:bg-white/20"
                title="Select language"
              >
                <Globe className="w-3 h-3" />
              </Button>
              {/* Dropdown menu */}
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={() => setSelectedLanguage('en-US')}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-teal-50 flex items-center gap-2",
                    selectedLanguage === 'en-US' && "bg-teal-100 text-teal-800 font-semibold"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  <div>
                    <div>English (US)</div>
                    <div className="text-xs text-gray-500">Standard American</div>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedLanguage('en-IN')}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-teal-50 flex items-center gap-2",
                    selectedLanguage === 'en-IN' && "bg-teal-100 text-teal-800 font-semibold"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  <div>
                    <div>English (India)</div>
                    <div className="text-xs text-gray-500">Indian English accent</div>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedLanguage('hi-IN')}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-teal-50 flex items-center gap-2",
                    selectedLanguage === 'hi-IN' && "bg-teal-100 text-teal-800 font-semibold"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  <div>
                    <div>हिंदी (Hindi)</div>
                    <div className="text-xs text-gray-500">Hindi language</div>
                  </div>
                </button>
              </div>
            </div>
            
            <Button
              variant={autoMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setAutoMode(!autoMode)}
              className={cn(
                "h-7 w-7 p-0 text-white",
                autoMode ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-white/20"
              )}
              title={autoMode ? "Auto mode ON" : "Manual mode"}
            >
              {autoMode ? <Zap className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </Button>
            <Button
              variant={isWakeWordActive ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsWakeWordActive(!isWakeWordActive)}
              className={cn(
                "h-7 w-7 p-0 text-white",
                isWakeWordActive ? "bg-green-600 hover:bg-green-700" : "hover:bg-white/20"
              )}
              title={isWakeWordActive ? "Wake word ON" : "Wake word OFF"}
            >
              {isWakeWordActive ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="h-7 w-7 p-0 text-white hover:bg-white/20"
              title={voiceEnabled ? 'Voice ON' : 'Voice OFF'}
            >
              {voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            </Button>
            {isFloating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleExpand}
                className="h-7 w-7 p-0 text-white hover:bg-red-500 hover:bg-opacity-80 ml-1"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col p-0 flex-1 min-h-0 overflow-hidden">
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
                <span className="text-sm font-medium text-red-900">🎤️ Listening...</span>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                  <Globe className="h-3 w-3 mr-1" />
                  {selectedLanguage === 'en-US' ? 'English (US)' : selectedLanguage === 'en-IN' ? 'English (India)' : 'हिंदी (Hindi)'}
                </Badge>
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
