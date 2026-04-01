'use client'

/**
 * AppSidebar — Collapsible Hybrid Left Sidebar
 *
 * Collapsed (60px rail): Logo, recording button, AI chat toggle, mode icons, avatar
 * Expanded (280px panel): AI chat, active patient context, command history, quick actions
 *
 * Replaces the floating EndoFlowVoiceController on desktop.
 * Mobile: completely hidden — bottom nav + sheet drawer remain unchanged.
 *
 * Session 12: Phase B — AI-native sidebar
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Activity, Stethoscope, Users, Beaker, Settings,
  MessageSquare, Mic, MicOff, ChevronLeft, ChevronRight,
  LogOut, Sun, Moon, Sparkles, User as UserIcon,
  Calendar, FileText, Play, Square,
} from 'lucide-react'
import { useSidebar } from '@/lib/contexts/sidebar-context'
import { useTheme } from '@/lib/contexts/theme-context'
import { EndoflowLogo } from '@/components/ui/endoflow-logo'
import { SidebarChatPanel } from './sidebar-chat-panel'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────

type DentistMode = 'home' | 'clinical' | 'pms' | 'research' | 'management'

interface DentistData {
  id: string
  name: string
  email: string
  specialty: string
  status: string
}

interface AppSidebarProps {
  activeMode: DentistMode
  onModeChange: (mode: DentistMode) => void
  dentistData: DentistData | null
  onActionCommand: (command: any) => void
  onSignOut: () => void
}

// ─── Mode definitions ────────────────────────────────────

const modeItems: { id: DentistMode; label: string; icon: typeof Activity }[] = [
  { id: 'home', label: 'Home', icon: Activity },
  { id: 'clinical', label: 'Clinical', icon: Stethoscope },
  { id: 'pms', label: 'Patients', icon: Users },
  { id: 'research', label: 'Research', icon: Beaker },
  { id: 'management', label: 'Manage', icon: Settings },
]

// ─── Quick actions for expanded panel ────────────────────

const quickActions = [
  { label: 'Start consultation', icon: Stethoscope, query: 'Start consultation' },
  { label: 'Today\'s schedule', icon: Calendar, query: 'Show today\'s schedule' },
  { label: 'Open patients', icon: Users, query: 'Open patient records' },
]

// ─── Component ───────────────────────────────────────────

export function AppSidebar({
  activeMode,
  onModeChange,
  dentistData,
  onActionCommand,
  onSignOut,
}: AppSidebarProps) {
  const { isCollapsed, toggleSidebar, expandSidebar, collapseSidebar, activePanel, setActivePanel, sidebarWidth, setSidebarWidth } = useSidebar()
  const { theme, toggleTheme } = useTheme()
  const [isRecording, setIsRecording] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [activePatient, setActivePatient] = useState<{ name: string; id: string } | null>(null)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // ─── Sidebar drag-to-resize ───────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth }
    setIsResizing(true)
  }, [sidebarWidth])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = e.clientX - resizeRef.current.startX
      setSidebarWidth(resizeRef.current.startWidth + delta)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing, setSidebarWidth])

  // ─── Recording state sync via CustomEvents ─────────────
  // Session 18b: Auto-expand sidebar when recording starts so copilot is visible
  useEffect(() => {
    const handleStarted = () => {
      setIsRecording(true)
      if (isCollapsed) {
        expandSidebar()
        setActivePanel('chat')
      }
    }
    const handleStopped = () => setIsRecording(false)
    window.addEventListener('endoflow:recording_started', handleStarted)
    window.addEventListener('endoflow:recording_stopped', handleStopped)
    return () => {
      window.removeEventListener('endoflow:recording_started', handleStarted)
      window.removeEventListener('endoflow:recording_stopped', handleStopped)
    }
  }, [isCollapsed, expandSidebar, setActivePanel])

  // ─── Session 14: Wake word → expand sidebar + activate mic ──
  useEffect(() => {
    const handleWakeWord = (e: Event) => {
      const detail = (e as CustomEvent).detail
      console.log('🎯 [SIDEBAR] Wake word detected:', detail?.wakeWord)
      expandSidebar()
      setActivePanel('chat')
      // Give sidebar time to expand, then activate mic
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('endoflow:mic_activate'))
      }, 300)
    }
    window.addEventListener('endoflow:wake_word_detected', handleWakeWord)
    return () => window.removeEventListener('endoflow:wake_word_detected', handleWakeWord)
  }, [expandSidebar, setActivePanel])

  // ─── Session 14C: Auto-expand sidebar when mic activates ──
  // MicPod dispatches mic_started → sidebar must be open so SidebarChatPanel
  // can receive transcript events. Without this, transcripts are lost.
  useEffect(() => {
    const handleMicStarted = () => {
      if (isCollapsed) {
        console.log('🎤 [SIDEBAR] Mic started — auto-expanding sidebar')
        expandSidebar()
        setActivePanel('chat')
      }
    }
    window.addEventListener('endoflow:mic_started', handleMicStarted)
    return () => window.removeEventListener('endoflow:mic_started', handleMicStarted)
  }, [isCollapsed, expandSidebar, setActivePanel])

  // ─── Active patient context from session memory ────────
  useEffect(() => {
    // Check sessionStorage for active patient (set by consultation_start command)
    const checkPatient = () => {
      try {
        const raw = sessionStorage.getItem('endoflow_consultation_command')
        if (raw) {
          const cmd = JSON.parse(raw)
          if (cmd.patientName) {
            setActivePatient({ name: cmd.patientName, id: cmd.patientId })
          }
        }
      } catch {}
    }
    checkPatient()
    // Listen for consultation start to update
    const handleConsultStart = () => setTimeout(checkPatient, 500)
    window.addEventListener('endoflow:recording_started', handleConsultStart)
    return () => window.removeEventListener('endoflow:recording_started', handleConsultStart)
  }, [])

  // ─── Recording toggle ─────────────────────────────────
  // Session 13: Dual function — consultation recording OR sidebar mic activation
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop active consultation recording
      window.dispatchEvent(new CustomEvent('endoflow:stop_recording'))
    } else if (activeMode === 'clinical') {
      // In clinical mode — start consultation recording
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('endoflow:start_recording'))
      }, 100)
    } else {
      // NOT in clinical mode — activate sidebar AI mic for voice commands
      expandSidebar()
      setActivePanel('chat')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('endoflow:activate_sidebar_mic'))
      }, 300)
    }
  }, [isRecording, activeMode, expandSidebar, setActivePanel])

  // ─── Click outside to collapse ─────────────────────────
  useEffect(() => {
    if (isCollapsed) return
    const handleClick = (e: MouseEvent) => {
      const sidebar = document.getElementById('endoflow-sidebar')
      if (sidebar && !sidebar.contains(e.target as Node)) {
        collapseSidebar()
      }
    }
    // Delay to prevent immediate close on toggle click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [isCollapsed, collapseSidebar])

  // ─── Initials ──────────────────────────────────────────
  const initials = dentistData?.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2) || 'DR'

  return (
    <aside
      id="endoflow-sidebar"
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex',
        'bg-card border-r border-border',
        isResizing ? '' : 'transition-all duration-200 ease-in-out'
      )}
      style={{ width: isCollapsed ? 60 : sidebarWidth }}
    >
      {/* ═══════════ RESIZE HANDLE (right edge, expanded only) ═══════════ */}
      {!isCollapsed && (
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            'absolute right-0 top-0 w-1.5 h-full cursor-col-resize z-50 group',
            'hover:bg-teal-500/50 active:bg-teal-500/60 transition-colors',
            isResizing && 'bg-teal-500/60'
          )}
        >
          {/* Wider invisible grab area */}
          <div className="absolute -left-2 -right-2 top-0 h-full" />
          {/* Session 16: Visible grip indicator on hover */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex flex-col gap-1 -mr-[3px]">
              <div className="w-1 h-1 rounded-full bg-teal-400" />
              <div className="w-1 h-1 rounded-full bg-teal-400" />
              <div className="w-1 h-1 rounded-full bg-teal-400" />
            </div>
          </div>
        </div>
      )}
      {/* ═══════════ COLLAPSED RAIL (always visible) ═══════════ */}
      <div className="w-[60px] h-full flex flex-col items-center py-3 shrink-0">
        {/* Logo */}
        <button
          onClick={() => onModeChange('home')}
          className="mb-3 hover:opacity-80 transition-opacity"
          title="Home"
        >
          <EndoflowLogo size="sm" showText={false} />
        </button>

        {/* Recording Button */}
        <button
          onClick={toggleRecording}
          title={isRecording ? 'Stop recording' : 'Start recording'}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-all mb-2',
            isRecording
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
              : 'bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-400'
          )}
        >
          {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4.5 h-4.5" />}
        </button>

        {/* AI Chat Toggle */}
        <button
          onClick={() => {
            if (isCollapsed) {
              expandSidebar()
              setActivePanel('chat')
            } else {
              collapseSidebar()
            }
          }}
          title="AI Chat"
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all mb-3',
            activePanel === 'chat' && !isCollapsed
              ? 'bg-teal-500/15 text-teal-400'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <MessageSquare className="w-4.5 h-4.5" />
        </button>

        <Separator className="w-8 mb-3" />

        {/* Mode Icons */}
        <div className="flex flex-col gap-1 flex-1">
          {modeItems.map((mode) => {
            const Icon = mode.icon
            const isActive = activeMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                title={mode.label}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-teal-500/15 text-teal-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-4.5 h-4.5" />
              </button>
            )
          })}
        </div>

        {/* Bottom: Theme + Avatar */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onSignOut}
            title="Sign out"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <div
            className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center cursor-default"
            title={dentistData?.name || 'Doctor'}
          >
            <span className="text-[10px] font-bold text-white">{initials}</span>
          </div>
        </div>
      </div>

      {/* ═══════════ EXPANDED PANEL — Session 18b: always mounted, CSS hidden when collapsed ═══════════ */}
      <div className={cn("flex-1 flex flex-col border-l border-border overflow-hidden", isCollapsed && "hidden")}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-foreground">EndoFlow AI</span>
            </div>
            <button
              onClick={collapseSidebar}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Active Patient Context */}
          {activePatient && (
            <div className="px-3 py-2 border-b border-border shrink-0">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-teal-500/10">
                <div className="w-7 h-7 rounded-md bg-teal-500/20 flex items-center justify-center">
                  <UserIcon className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-teal-400 truncate">{activePatient.name}</p>
                  <p className="text-[10px] text-teal-400/60">Active patient</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="px-3 py-2 border-b border-border shrink-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Quick Actions</p>
            <div className="space-y-0.5">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={() => {
                      // Directly process the query
                      if (action.query === 'Start consultation') {
                        onModeChange('clinical')
                      } else if (action.query === 'Open patient records') {
                        onModeChange('pms')
                      } else {
                        // Let the chat panel handle it
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chat Panel (takes remaining space) */}
          <div className="flex-1 min-h-0">
            <SidebarChatPanel
              onActionCommand={onActionCommand}
              dentistId={dentistData?.id}
            />
          </div>
        </div>
    </aside>
  )
}
