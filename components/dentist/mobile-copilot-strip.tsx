'use client'

/**
 * Mobile Copilot Status Strip — Session 20
 *
 * A persistent, collapsible bar that sits below the sub-tab navigation on mobile
 * when the AI copilot is active (recording, processing, or has results).
 *
 * Collapsed: Single thin bar showing status + duration + expand button
 * Expanded: Shows live transcript, recording controls, and AI status
 *
 * This component does NOT own any pipeline state — it reads from CustomEvents
 * and sessionStorage, and dispatches events to control the existing pipeline.
 * Zero pipeline modifications.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic, MicOff, Square, Pause, Play, Brain, ChevronUp, ChevronDown,
  Sparkles, X as XIcon, Stethoscope, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileCopilotStripProps {
  /** Whether to show the strip at all */
  isVisible: boolean
  /** Callback to open the full AI Sheet for detailed view */
  onOpenAISheet: () => void
}

// Format seconds to MM:SS
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function MobileCopilotStrip({ isVisible, onOpenAISheet }: MobileCopilotStripProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [duration, setDuration] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [patientName, setPatientName] = useState('')
  const [statusText, setStatusText] = useState('')

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const durationStartRef = useRef(0)

  // Listen for pipeline events — same events that desktop sidebar uses
  useEffect(() => {
    const handleRecStarted = () => {
      setIsRecording(true)
      setIsPaused(false)
      setIsProcessing(false)
      setHasResults(false)
      setStatusText('Recording...')
      setIsExpanded(true) // Auto-expand when recording starts
      // Start timer
      durationStartRef.current = Date.now()
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
      durationTimerRef.current = setInterval(() => {
        setDuration(Date.now() - durationStartRef.current)
      }, 1000)
    }

    const handleRecStopped = () => {
      setIsRecording(false)
      setIsPaused(true)
      setStatusText('Recording stopped')
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
        durationTimerRef.current = null
      }
    }

    const handleAiResults = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) {
        setHasResults(true)
        setIsProcessing(false)
        setStatusText('AI results ready')
      }
    }

    const handleProcessing = () => {
      setIsProcessing(true)
      setStatusText('Processing...')
    }

    // Live transcript from Deepgram via GlobalVoiceRecorder
    const handleTranscript = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.text) {
        setLiveTranscript(prev => {
          if (detail.isFinal) {
            return (prev + ' ' + detail.text).trim().slice(-200) // Keep last 200 chars
          }
          // Interim — show at end
          const base = prev.split('...')[0] // Remove previous interim
          return base + '... ' + detail.text
        })
      }
    }

    // Patient context
    const checkPatient = () => {
      try {
        const raw = sessionStorage.getItem('endoflow_consultation_command')
        if (raw) {
          const cmd = JSON.parse(raw)
          if (cmd.patientName) setPatientName(cmd.patientName)
        }
      } catch {}
    }
    checkPatient()

    window.addEventListener('endoflow:recording_started', handleRecStarted)
    window.addEventListener('endoflow:recording_stopped', handleRecStopped)
    window.addEventListener('endoflow:ai_results_ready', handleAiResults)
    window.addEventListener('endoflow:process_recording', handleProcessing)
    window.addEventListener('endoflow:mic_transcript', handleTranscript)

    return () => {
      window.removeEventListener('endoflow:recording_started', handleRecStarted)
      window.removeEventListener('endoflow:recording_stopped', handleRecStopped)
      window.removeEventListener('endoflow:ai_results_ready', handleAiResults)
      window.removeEventListener('endoflow:process_recording', handleProcessing)
      window.removeEventListener('endoflow:mic_transcript', handleTranscript)
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    }
  }, [])

  // Reset when hidden
  useEffect(() => {
    if (!isVisible) {
      setIsRecording(false)
      setIsPaused(false)
      setIsProcessing(false)
      setHasResults(false)
      setDuration(0)
      setLiveTranscript('')
      setStatusText('')
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
        durationTimerRef.current = null
      }
    }
  }, [isVisible])

  // Determine if there's any active state to show
  const hasActiveState = isRecording || isPaused || isProcessing || hasResults

  if (!isVisible || !hasActiveState) return null

  return (
    <div className={cn(
      'bg-card/95 backdrop-blur-xl border-b border-border transition-all duration-300 z-30',
      isRecording && 'border-red-500/30 bg-red-500/[0.03]',
      hasResults && 'border-teal-500/30 bg-teal-500/[0.03]',
    )}>
      {/* Collapsed bar — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 min-h-[40px]"
      >
        {/* Status indicator */}
        <div className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          isRecording && 'bg-red-500 animate-pulse',
          isPaused && !isProcessing && 'bg-amber-500',
          isProcessing && 'bg-blue-500 animate-pulse',
          hasResults && !isRecording && !isProcessing && 'bg-teal-500',
        )} />

        {/* Mode label */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Stethoscope className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-red-400 truncate">Co-Pilot</span>
        </div>

        {/* Patient name */}
        {patientName && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
            {patientName}
          </span>
        )}

        {/* Duration */}
        {(isRecording || isPaused) && (
          <span className="text-[11px] font-mono text-red-400/70 tabular-nums ml-auto mr-2">
            {formatDuration(duration)}
          </span>
        )}

        {/* Status text */}
        <span className={cn(
          'text-[10px] font-medium',
          isRecording && 'text-red-400',
          isProcessing && 'text-blue-400',
          hasResults && !isRecording && 'text-teal-400',
          isPaused && !isProcessing && !hasResults && 'text-amber-400',
        )}>
          {statusText}
        </span>

        {/* Expand/collapse */}
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-auto" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-auto" />
        )}
      </button>

      {/* Expanded section */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {/* Live transcript */}
          {liveTranscript && (
            <div className="bg-muted/30 rounded-lg px-3 py-2 max-h-[60px] overflow-y-auto">
              <p className="text-[11px] text-muted-foreground italic leading-relaxed line-clamp-3">
                {liveTranscript}
              </p>
            </div>
          )}

          {/* Quick controls */}
          <div className="flex items-center gap-2">
            {/* Recording controls */}
            {isRecording && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('endoflow:pause_recording'))
                    setIsPaused(true)
                    setIsRecording(false)
                    setStatusText('Paused')
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/10 text-amber-400 text-[11px] font-medium min-h-[36px]"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('endoflow:stop_recording_no_process'))
                    setStatusText('Stopped')
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] font-medium min-h-[36px]"
                >
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('endoflow:process_recording'))
                    setIsProcessing(true)
                    setStatusText('Processing...')
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-teal-500/10 text-teal-400 text-[11px] font-medium min-h-[36px]"
                >
                  <Brain className="w-3.5 h-3.5" /> Process
                </button>
              </>
            )}

            {/* Paused controls */}
            {isPaused && !isProcessing && !hasResults && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('endoflow:resume_recording'))
                    setIsRecording(true)
                    setIsPaused(false)
                    setStatusText('Recording...')
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-500/10 text-green-400 text-[11px] font-medium min-h-[36px]"
                >
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('endoflow:process_recording'))
                    setIsProcessing(true)
                    setStatusText('Processing...')
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-teal-500/10 text-teal-400 text-[11px] font-medium min-h-[36px]"
                >
                  <Brain className="w-3.5 h-3.5" /> Process All
                </button>
              </>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-blue-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI analyzing transcript...
              </div>
            )}

            {/* Results available */}
            {hasResults && !isRecording && !isProcessing && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenAISheet()
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-500/10 text-teal-400 text-[11px] font-medium min-h-[36px]"
              >
                <Sparkles className="w-3.5 h-3.5" /> View AI Results
              </button>
            )}

            {/* Always show "Open Full AI" */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenAISheet()
              }}
              className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-md text-muted-foreground text-[10px] hover:text-foreground min-h-[36px]"
            >
              <Sparkles className="w-3 h-3" /> Full AI
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
