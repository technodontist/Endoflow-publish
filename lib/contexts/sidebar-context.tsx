'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  expandSidebar: () => void
  collapseSidebar: () => void
  activePanel: 'chat' | null
  setActivePanel: (panel: 'chat' | null) => void
  /** Expanded sidebar width in pixels (280..600). Drag handle adjusts this. */
  sidebarWidth: number
  setSidebarWidth: (w: number) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true) // Default collapsed, hydrate from localStorage
  const [activePanel, setActivePanel] = useState<'chat' | null>(null)
  const [sidebarWidth, setSidebarWidthState] = useState(280) // default expanded width
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem('endoflow-sidebar-state')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.isCollapsed === 'boolean') {
          setIsCollapsed(parsed.isCollapsed)
        }
        if (typeof parsed.sidebarWidth === 'number') {
          setSidebarWidthState(Math.max(280, Math.min(800, parsed.sidebarWidth)))
        }
      }
    } catch {}
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem('endoflow-sidebar-state', JSON.stringify({ isCollapsed, sidebarWidth }))
    } catch {}
  }, [isCollapsed, sidebarWidth, mounted])

  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev
      if (next) setActivePanel(null) // Clear panel on collapse
      return next
    })
  }, [])

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false)
  }, [])

  const collapseSidebar = useCallback(() => {
    setIsCollapsed(true)
    setActivePanel(null)
  }, [])

  const setSidebarWidth = useCallback((w: number) => {
    setSidebarWidthState(Math.max(280, Math.min(800, w)))
  }, [])

  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      toggleSidebar,
      expandSidebar,
      collapseSidebar,
      activePanel,
      setActivePanel,
      sidebarWidth,
      setSidebarWidth,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
