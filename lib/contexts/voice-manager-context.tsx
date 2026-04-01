'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

// =====================================================
// WAKE WORD ROUTE SYSTEM
// =====================================================

export interface WakeWordRoute {
  id: string
  patterns: string[]
  handler: (transcript: string) => void
  priority: number // higher = takes precedence when matched
}

// =====================================================
// MIC PRIORITY LEVELS
// =====================================================

/** Standard mic priority levels (higher = takes precedence) */
export const MIC_PRIORITY = {
  WAKE_WORD: 10,        // Background wake word listener
  CONSULTATION: 50,     // Consultation recording
  GAP_DIALOG: 70,       // Gap dialog voice input
  MASTER_AI: 90,        // EndoFlow Master AI active query
} as const

interface MicRegistration {
  componentId: string
  priority: number
}

// =====================================================
// CONTEXT TYPE
// =====================================================

interface VoiceManagerContextType {
  // Legacy API (backward compatible)
  registerMicUsage: (componentId: string) => void
  unregisterMicUsage: (componentId: string) => void
  isAnyMicActive: () => boolean
  getActiveComponent: () => string | null
  activeMicCount: number
  shouldWakeWordBeActive: () => boolean
  notifyWakeWordStatus: (isActive: boolean) => void

  // Priority-based API (Session 7)
  requestMic: (componentId: string, priority: number) => boolean
  releaseMic: (componentId: string) => void
  getCurrentMicOwner: () => MicRegistration | null
  getMicPriority: (componentId: string) => number | null

  // Wake word route registry (Session 7)
  registerWakeWordRoute: (route: WakeWordRoute) => void
  unregisterWakeWordRoute: (routeId: string) => void
  getRegisteredRoutes: () => WakeWordRoute[]
  matchWakeWord: (transcript: string) => WakeWordRoute | null
}

const VoiceManagerContext = createContext<VoiceManagerContextType | undefined>(undefined)

export function VoiceManagerProvider({ children }: { children: React.ReactNode }) {
  const [activeMics, setActiveMics] = useState<Map<string, number>>(new Map()) // componentId → priority
  const [wakeWordActive, setWakeWordActive] = useState(false)
  const [activeMicCount, setActiveMicCount] = useState(0)
  const [wakeWordRoutes, setWakeWordRoutes] = useState<Map<string, WakeWordRoute>>(new Map())

  const activeMicsRef = useRef<Map<string, number>>(new Map())
  const wakeWordRoutesRef = useRef<Map<string, WakeWordRoute>>(new Map())

  useEffect(() => {
    activeMicsRef.current = activeMics
    setActiveMicCount(activeMics.size)
  }, [activeMics])

  useEffect(() => {
    wakeWordRoutesRef.current = wakeWordRoutes
  }, [wakeWordRoutes])

  // ── Legacy API (backward compatible) ──

  const registerMicUsage = useCallback((componentId: string) => {
    console.log(`🎤 [VOICE MANAGER] Registering mic usage: ${componentId}`)
    setActiveMics(prev => {
      const newMap = new Map(prev)
      newMap.set(componentId, MIC_PRIORITY.CONSULTATION) // default priority
      console.log(`🎤 [VOICE MANAGER] Active mics:`, Array.from(newMap.keys()))
      return newMap
    })
  }, [])

  const unregisterMicUsage = useCallback((componentId: string) => {
    console.log(`🎤 [VOICE MANAGER] Unregistering mic usage: ${componentId}`)
    setActiveMics(prev => {
      const newMap = new Map(prev)
      newMap.delete(componentId)
      console.log(`🎤 [VOICE MANAGER] Active mics:`, Array.from(newMap.keys()))
      return newMap
    })
  }, [])

  const isAnyMicActive = useCallback(() => {
    return activeMicsRef.current.size > 0
  }, [])

  const getActiveComponent = useCallback(() => {
    if (activeMicsRef.current.size === 0) return null
    // Return highest-priority component
    let highest: string | null = null
    let highestPriority = -1
    for (const [id, priority] of activeMicsRef.current) {
      if (priority > highestPriority) {
        highest = id
        highestPriority = priority
      }
    }
    return highest
  }, [])

  const shouldWakeWordBeActive = useCallback(() => {
    const anyMicActive = activeMicsRef.current.size > 0
    const shouldBeActive = !anyMicActive && wakeWordActive
    return shouldBeActive
  }, [wakeWordActive])

  const notifyWakeWordStatus = useCallback((isActive: boolean) => {
    console.log(`🎤 [VOICE MANAGER] Wake word status changed: ${isActive}`)
    setWakeWordActive(isActive)
  }, [])

  // ── Priority-based API (Session 7) ──

  const requestMic = useCallback((componentId: string, priority: number): boolean => {
    const current = activeMicsRef.current

    // Check if a higher-priority component holds the mic
    for (const [existingId, existingPriority] of current) {
      if (existingId !== componentId && existingPriority > priority) {
        console.log(`🎤 [VOICE MANAGER] Mic request DENIED for ${componentId} (priority ${priority}), held by ${existingId} (priority ${existingPriority})`)
        return false
      }
    }

    console.log(`🎤 [VOICE MANAGER] Mic request GRANTED for ${componentId} (priority ${priority})`)
    setActiveMics(prev => {
      const newMap = new Map(prev)
      newMap.set(componentId, priority)
      return newMap
    })
    return true
  }, [])

  const releaseMic = useCallback((componentId: string) => {
    console.log(`🎤 [VOICE MANAGER] Releasing mic: ${componentId}`)
    setActiveMics(prev => {
      const newMap = new Map(prev)
      newMap.delete(componentId)
      return newMap
    })
  }, [])

  const getCurrentMicOwner = useCallback((): MicRegistration | null => {
    if (activeMicsRef.current.size === 0) return null
    let highest: MicRegistration | null = null
    for (const [componentId, priority] of activeMicsRef.current) {
      if (!highest || priority > highest.priority) {
        highest = { componentId, priority }
      }
    }
    return highest
  }, [])

  const getMicPriority = useCallback((componentId: string): number | null => {
    return activeMicsRef.current.get(componentId) ?? null
  }, [])

  // ── Wake Word Route Registry (Session 7) ──

  const registerWakeWordRoute = useCallback((route: WakeWordRoute) => {
    console.log(`🎯 [VOICE MANAGER] Registering wake word route: ${route.id} (${route.patterns.length} patterns, priority ${route.priority})`)
    setWakeWordRoutes(prev => {
      const newMap = new Map(prev)
      newMap.set(route.id, route)
      return newMap
    })
  }, [])

  const unregisterWakeWordRoute = useCallback((routeId: string) => {
    console.log(`🎯 [VOICE MANAGER] Unregistering wake word route: ${routeId}`)
    setWakeWordRoutes(prev => {
      const newMap = new Map(prev)
      newMap.delete(routeId)
      return newMap
    })
  }, [])

  const getRegisteredRoutes = useCallback((): WakeWordRoute[] => {
    return Array.from(wakeWordRoutesRef.current.values())
  }, [])

  const matchWakeWord = useCallback((transcript: string): WakeWordRoute | null => {
    const lower = transcript.toLowerCase().trim()
    if (!lower) return null

    // Session 20: Normalize common Deepgram misrecognitions of "EndoFlow"
    // Deepgram often transcribes it as: "endo flow", "endo flu", "end of low",
    // "end a flow", "endo flo", "indo flow", "endow flow"
    const normalized = lower
      .replace(/\bendo\s*flo\w?\b/g, 'endoflow')
      .replace(/\bend\s*of?\s*low\b/g, 'endoflow')
      .replace(/\bend\s*a\s*flow\b/g, 'endoflow')
      .replace(/\bindo\s*flow\b/g, 'endoflow')
      .replace(/\bendow?\s*flow\b/g, 'endoflow')
      .replace(/\bendo\s*flu\b/g, 'endoflow')

    // Check all registered routes, return highest-priority match
    let bestMatch: WakeWordRoute | null = null

    for (const route of wakeWordRoutesRef.current.values()) {
      for (const pattern of route.patterns) {
        const patternLower = pattern.toLowerCase()
        if (lower.includes(patternLower) || normalized.includes(patternLower)) {
          if (!bestMatch || route.priority > bestMatch.priority) {
            bestMatch = route
          }
          break // Found a match for this route, check next route
        }
      }
    }

    if (bestMatch) {
      console.log(`🎯 [VOICE MANAGER] Wake word matched: "${lower}" → route "${bestMatch.id}"`)
    }

    return bestMatch
  }, [])

  const value: VoiceManagerContextType = {
    // Legacy
    registerMicUsage,
    unregisterMicUsage,
    isAnyMicActive,
    getActiveComponent,
    activeMicCount,
    shouldWakeWordBeActive,
    notifyWakeWordStatus,
    // Priority-based
    requestMic,
    releaseMic,
    getCurrentMicOwner,
    getMicPriority,
    // Wake word routes
    registerWakeWordRoute,
    unregisterWakeWordRoute,
    getRegisteredRoutes,
    matchWakeWord,
  }

  return (
    <VoiceManagerContext.Provider value={value}>
      {children}
    </VoiceManagerContext.Provider>
  )
}

// Hook to use the voice manager
export function useVoiceManager() {
  const context = useContext(VoiceManagerContext)
  if (context === undefined) {
    throw new Error('useVoiceManager must be used within a VoiceManagerProvider')
  }
  return context
}

// Custom hook for components that use microphone (legacy, backward compatible)
export function useMicrophoneRegistration(componentId: string) {
  const { registerMicUsage, unregisterMicUsage } = useVoiceManager()
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(false)

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  const startRecording = useCallback(() => {
    console.log(`🎙️ [${componentId}] Starting recording`)
    setIsRecording(true)
    registerMicUsage(componentId)
  }, [componentId, registerMicUsage])

  const stopRecording = useCallback(() => {
    console.log(`🎙️ [${componentId}] Stopping recording`)
    setIsRecording(false)
    unregisterMicUsage(componentId)
  }, [componentId, unregisterMicUsage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        console.log(`🧹 [${componentId}] Cleanup: unregistering mic`)
        unregisterMicUsage(componentId)
      }
    }
  }, [componentId, unregisterMicUsage])

  return {
    isRecording,
    startRecording,
    stopRecording,
  }
}

/**
 * Priority-aware mic registration hook (Session 7).
 * Automatically handles mic request/release with priority arbitration.
 */
export function usePriorityMic(componentId: string, priority: number) {
  const { requestMic, releaseMic, getCurrentMicOwner } = useVoiceManager()
  const [isActive, setIsActive] = useState(false)
  const isActiveRef = useRef(false)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const acquire = useCallback((): boolean => {
    const granted = requestMic(componentId, priority)
    if (granted) {
      setIsActive(true)
    }
    return granted
  }, [componentId, priority, requestMic])

  const release = useCallback(() => {
    setIsActive(false)
    releaseMic(componentId)
  }, [componentId, releaseMic])

  const isBlocked = useCallback((): boolean => {
    const owner = getCurrentMicOwner()
    return owner !== null && owner.componentId !== componentId && owner.priority > priority
  }, [componentId, priority, getCurrentMicOwner])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        releaseMic(componentId)
      }
    }
  }, [componentId, releaseMic])

  return { isActive, acquire, release, isBlocked }
}
