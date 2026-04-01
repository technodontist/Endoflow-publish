"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
    Activity,
    Users,
    CalendarDays,
    MoreHorizontal,
    Stethoscope,
    Beaker,
    Settings,
    Sparkles,
    Mic,
    MicOff,
} from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'

type DentistMode = 'home' | 'clinical' | 'pms' | 'research' | 'management'

interface MobileDentistNavigationProps {
    activeMode: DentistMode
    onModeChange: (mode: DentistMode) => void
    onAIPress?: () => void
    isWakeWordActive?: boolean
    isMicActive?: boolean
    /** Session 19: Direct mic toggle without opening AI Sheet */
    onMicToggle?: () => void
}

const modeBlocks = [
    { id: 'clinical' as const, label: 'Clinical', icon: Stethoscope, color: 'text-red-400', bg: 'bg-red-500/10', desc: 'Voice consultation, AI scribe' },
    { id: 'pms' as const, label: 'Patients', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Records, messaging, templates' },
    { id: 'research' as const, label: 'Research', icon: Beaker, color: 'text-purple-400', bg: 'bg-purple-500/10', desc: 'Analytics, projects, knowledge' },
    { id: 'management' as const, label: 'Manage', icon: Settings, color: 'text-amber-400', bg: 'bg-amber-500/10', desc: 'Tasks, appointments, operations' },
]

export function MobileDentistNavigation({ activeMode, onModeChange, onAIPress, isWakeWordActive, isMicActive, onMicToggle }: MobileDentistNavigationProps) {
    const [showMoreMenu, setShowMoreMenu] = useState(false)
    const [micRecording, setMicRecording] = useState(false)

    // Session 19: Long-press detection for FAB mic toggle
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isLongPressRef = useRef(false)

    const handleFABTouchStart = useCallback(() => {
        isLongPressRef.current = false
        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true
            // Haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(50)
            // Toggle mic directly
            if (onMicToggle) {
                onMicToggle()
            } else {
                // Fallback: dispatch mic toggle event
                if ((window as any).__endoflow_mic_active) {
                    window.dispatchEvent(new CustomEvent('endoflow:mic_deactivate'))
                } else {
                    window.dispatchEvent(new CustomEvent('endoflow:mic_activate'))
                }
            }
        }, 500)
    }, [onMicToggle])

    const handleFABTouchEnd = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
        // If it was NOT a long press, treat as normal tap → open AI Sheet
        if (!isLongPressRef.current) {
            onAIPress?.()
        }
        isLongPressRef.current = false
    }, [onAIPress])

    const handleFABTouchCancel = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
        isLongPressRef.current = false
    }, [])

    // Session 18: Track mic state for FAB visual feedback
    useEffect(() => {
        const handleMicStarted = () => setMicRecording(true)
        const handleMicStopped = () => setMicRecording(false)
        window.addEventListener('endoflow:mic_started', handleMicStarted)
        window.addEventListener('endoflow:mic_stopped', handleMicStopped)
        // Also check singleton state on mount
        if ((window as any).__endoflow_mic_active) setMicRecording(true)
        return () => {
            window.removeEventListener('endoflow:mic_started', handleMicStarted)
            window.removeEventListener('endoflow:mic_stopped', handleMicStopped)
        }
    }, [])

    const handleModeSelect = (mode: DentistMode) => {
        onModeChange(mode)
        setShowMoreMenu(false)
    }

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0f1a]/95 backdrop-blur-xl border-t border-white/[0.06] px-1 pb-safe pt-1 shadow-lg z-40" style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom, 4px))' }}>
                <div className="flex items-end justify-around max-w-lg mx-auto">
                    {/* Home */}
                    <button
                        onClick={() => onModeChange('home')}
                        className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                            activeMode === 'home'
                                ? 'text-teal-400 bg-teal-500/10'
                                : 'text-slate-500 active:text-teal-400'
                        }`}
                    >
                        <Activity className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[10px] font-medium">Home</span>
                    </button>

                    {/* Patients */}
                    <button
                        onClick={() => onModeChange('pms')}
                        className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                            activeMode === 'pms'
                                ? 'text-teal-400 bg-teal-500/10'
                                : 'text-slate-500 active:text-teal-400'
                        }`}
                    >
                        <Users className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[10px] font-medium">Patients</span>
                    </button>

                    {/* Center AI FAB — Session 19: Tap=AI Sheet, Long-press=toggle mic */}
                    <div className="flex flex-col items-center -mt-5 px-1 flex-1">
                        <button
                            onTouchStart={handleFABTouchStart}
                            onTouchEnd={handleFABTouchEnd}
                            onTouchCancel={handleFABTouchCancel}
                            onClick={(e) => {
                                // Desktop fallback (no touch events)
                                if (!('ontouchstart' in window)) onAIPress?.()
                            }}
                            className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center border-[3px] border-[#0a0f1a] active:scale-95 transition-all duration-200 ${
                                micRecording || isMicActive
                                    ? 'bg-red-500 shadow-red-500/30 animate-pulse'
                                    : 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/20'
                            }`}
                        >
                            {micRecording || isMicActive ? (
                                <Mic className="w-7 h-7 text-white" />
                            ) : (
                                <Sparkles className="w-7 h-7 text-white" />
                            )}
                            {isWakeWordActive && !micRecording && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border border-[#0a0f1a]"></span>
                                </span>
                            )}
                        </button>
                        <span className={`text-[9px] font-medium mt-0.5 ${micRecording || isMicActive ? 'text-red-400' : 'text-teal-400'}`}>
                            {micRecording || isMicActive ? 'Recording' : 'EndoFlow'}
                        </span>
                    </div>

                    {/* Schedule */}
                    <button
                        onClick={() => onModeChange('management')}
                        className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                            activeMode === 'management'
                                ? 'text-teal-400 bg-teal-500/10'
                                : 'text-slate-500 active:text-teal-400'
                        }`}
                    >
                        <CalendarDays className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[10px] font-medium">Schedule</span>
                    </button>

                    {/* More */}
                    <button
                        onClick={() => setShowMoreMenu(true)}
                        className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                            activeMode === 'clinical' || activeMode === 'research'
                                ? 'text-teal-400 bg-teal-500/10'
                                : 'text-slate-500 active:text-teal-400'
                        }`}
                    >
                        <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[10px] font-medium">More</span>
                    </button>
                </div>
            </nav>

            {/* More Menu Sheet — Dark themed */}
            <Sheet open={showMoreMenu} onOpenChange={setShowMoreMenu}>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[50vh] bg-[#111827] border-white/[0.06]">
                    <SheetHeader className="pb-2">
                        <SheetTitle className="text-left text-lg text-foreground">Workspaces</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-2 gap-3 py-4">
                        {modeBlocks.map((mode) => {
                            const Icon = mode.icon
                            const isActive = activeMode === mode.id
                            return (
                                <button
                                    key={mode.id}
                                    onClick={() => handleModeSelect(mode.id)}
                                    className={`flex flex-col items-start gap-2 p-4 rounded-xl transition-all duration-200 text-left ${
                                        isActive
                                            ? `${mode.color} bg-teal-500/10 ring-1 ring-teal-500/30`
                                            : 'text-slate-300 bg-white/[0.03] active:bg-white/[0.06]'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-lg ${mode.bg} flex items-center justify-center`}>
                                        <Icon className={`w-5 h-5 ${mode.color}`} />
                                    </div>
                                    <div>
                                        <span className="text-sm font-semibold block">{mode.label}</span>
                                        <span className="text-[11px] text-muted-foreground">{mode.desc}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    )
}
