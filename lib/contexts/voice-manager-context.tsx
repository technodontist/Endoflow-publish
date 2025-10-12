'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

interface VoiceManagerContextType {
  // Register/unregister microphone usage
  registerMicUsage: (componentId: string) => void
  unregisterMicUsage: (componentId: string) => void
  
  // Check if any component is using the microphone
  isAnyMicActive: () => boolean
  
  // Get current active component
  getActiveComponent: () => string | null
  
  // Get active mic count (reactive state for hooks)
  activeMicCount: number
  
  // Wake word specific controls
  shouldWakeWordBeActive: () => boolean
  notifyWakeWordStatus: (isActive: boolean) => void
}

const VoiceManagerContext = createContext<VoiceManagerContextType | undefined>(undefined)

export function VoiceManagerProvider({ children }: { children: React.ReactNode }) {
  // Track which components are currently using the microphone
  const [activeMics, setActiveMics] = useState<Set<string>>(new Set())
  const [wakeWordActive, setWakeWordActive] = useState(false)
  // Reactive state for active mic count (so components can subscribe to changes)
  const [activeMicCount, setActiveMicCount] = useState(0)
  
  // Use ref to avoid stale closures
  const activeMicsRef = useRef<Set<string>>(new Set())
  
  // Sync state with ref and update count
  useEffect(() => {
    activeMicsRef.current = activeMics
    setActiveMicCount(activeMics.size)
  }, [activeMics])

  const registerMicUsage = useCallback((componentId: string) => {
    console.log(`🎤 [VOICE MANAGER] Registering mic usage: ${componentId}`)
    setActiveMics(prev => {
      const newSet = new Set(prev)
      newSet.add(componentId)
      console.log(`🎤 [VOICE MANAGER] Active mics:`, Array.from(newSet))
      return newSet
    })
  }, [])

  const unregisterMicUsage = useCallback((componentId: string) => {
    console.log(`🎤 [VOICE MANAGER] Unregistering mic usage: ${componentId}`)
    setActiveMics(prev => {
      const newSet = new Set(prev)
      newSet.delete(componentId)
      console.log(`🎤 [VOICE MANAGER] Active mics:`, Array.from(newSet))
      return newSet
    })
  }, [])

  const isAnyMicActive = useCallback(() => {
    return activeMicsRef.current.size > 0
  }, [])

  const getActiveComponent = useCallback(() => {
    if (activeMicsRef.current.size === 0) return null
    return Array.from(activeMicsRef.current)[0]
  }, [])

  const shouldWakeWordBeActive = useCallback(() => {
    // Wake word should only be active if:
    // 1. No other component is using the microphone
    // 2. Wake word was previously enabled
    const anyMicActive = activeMicsRef.current.size > 0
    const shouldBeActive = !anyMicActive && wakeWordActive
    
    console.log(`🎤 [VOICE MANAGER] Should wake word be active? ${shouldBeActive} (anyMicActive: ${anyMicActive}, wakeWordActive: ${wakeWordActive})`)
    
    return shouldBeActive
  }, [wakeWordActive])

  const notifyWakeWordStatus = useCallback((isActive: boolean) => {
    console.log(`🎤 [VOICE MANAGER] Wake word status changed: ${isActive}`)
    setWakeWordActive(isActive)
  }, [])

  const value: VoiceManagerContextType = {
    registerMicUsage,
    unregisterMicUsage,
    isAnyMicActive,
    getActiveComponent,
    activeMicCount,
    shouldWakeWordBeActive,
    notifyWakeWordStatus,
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

// Custom hook for components that use microphone
export function useMicrophoneRegistration(componentId: string) {
  const { registerMicUsage, unregisterMicUsage } = useVoiceManager()
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(false)

  // Sync state with ref
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
