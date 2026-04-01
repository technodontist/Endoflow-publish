'use client'

/**
 * EndoFlow MicPod — Floating Mic Bubble
 *
 * Session 14: Stripped from 2,025-line full AI chat to a pure mic capture
 * component (~200 lines). All conversation UI, TTS, and agent orchestration
 * has moved to sidebar-chat-panel.tsx.
 *
 * This component:
 * - Owns Deepgram mic connection via useMicManager
 * - Renders a 60px floating mic bubble
 * - Listens for endoflow:mic_activate / endoflow:mic_deactivate
 * - Dispatches endoflow:mic_transcript / endoflow:mic_started / endoflow:mic_stopped
 * - Pauses Deepgram during TTS (handled inside useMicManager)
 *
 * On mobile: rendered inside a bottom sheet (keeps same interface).
 */

import { memo } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useMicManager } from '@/lib/hooks/use-mic-manager'
import { cn } from '@/lib/utils'

// ─── Re-export ActionCommand for backward compat ──────────────────────────────
// Callers in page.tsx still import ActionCommand from this module.
export interface ActionCommand {
  action: string
  targetMode?: string
  targetTab?: string
  patientId?: string
  patientName?: string
  consultationMode?: string
  startRecording?: boolean
  triggerAIPipeline?: boolean
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EndoFlowVoiceControllerProps {
  isFloating?: boolean
  defaultExpanded?: boolean
  onActionCommand?: (command: ActionCommand) => void
  clinicalMode?: boolean
}

// ─── MicPod Component ─────────────────────────────────────────────────────────

export const EndoFlowVoiceController = memo(function EndoFlowVoiceController({
  clinicalMode = false,
}: EndoFlowVoiceControllerProps) {
  const { isActive, isConnecting, toggleMic } = useMicManager({
    clinicalMode,
  })

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'flex flex-col items-center gap-2',
      )}
    >
      {/* ── Listening label ── */}
      {isActive && (
        <span className="text-[10px] font-medium text-red-400 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-red-500/30 shadow-sm">
          Listening
        </span>
      )}

      {/* ── Mic bubble ── */}
      <button
        onClick={toggleMic}
        disabled={isConnecting}
        title={isActive ? 'Stop mic (EndoFlow AI)' : 'Activate mic (EndoFlow AI)'}
        className={cn(
          'w-[60px] h-[60px] rounded-full',
          'flex items-center justify-center',
          'shadow-lg transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2',
          isActive
            ? 'bg-red-500 text-white shadow-red-500/30 animate-pulse'
            : isConnecting
              ? 'bg-teal-500/50 text-white cursor-wait'
              : 'bg-teal-500 text-white hover:bg-teal-600 hover:shadow-teal-500/30',
        )}
      >
        {isActive ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
    </div>
  )
})
