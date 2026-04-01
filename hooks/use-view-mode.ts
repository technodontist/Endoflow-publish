"use client"

import { useState, useEffect } from 'react'

type ViewMode = 'desktop' | 'mobile'

export function useViewMode() {
    const [viewMode, setViewMode] = useState<ViewMode>('desktop')
    const [isAutoDetected, setIsAutoDetected] = useState(true)

    // Auto-detect screen size on mount and window resize
    useEffect(() => {
        const detectViewMode = () => {
            // Check if user has manually set a preference
            const savedPreference = localStorage.getItem('dentist_view_mode_preference')

            if (savedPreference) {
                setViewMode(savedPreference as ViewMode)
                setIsAutoDetected(false)
                return
            }

            // Auto-detect based on screen size
            // Mobile: < 768px (md breakpoint in Tailwind)
            const isMobileScreen = window.innerWidth < 768
            setViewMode(isMobileScreen ? 'mobile' : 'desktop')
            setIsAutoDetected(true)
        }

        // Initial detection
        detectViewMode()

        // Re-detect on window resize (only if auto-detecting)
        const handleResize = () => {
            const savedPreference = localStorage.getItem('dentist_view_mode_preference')
            if (!savedPreference) {
                const isMobileScreen = window.innerWidth < 768
                setViewMode(isMobileScreen ? 'mobile' : 'desktop')
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const toggleViewMode = () => {
        const newMode = viewMode === 'desktop' ? 'mobile' : 'desktop'
        setViewMode(newMode)
        setIsAutoDetected(false)
        // Save user preference
        localStorage.setItem('dentist_view_mode_preference', newMode)
    }

    const resetToAutoDetect = () => {
        localStorage.removeItem('dentist_view_mode_preference')
        const isMobileScreen = window.innerWidth < 768
        setViewMode(isMobileScreen ? 'mobile' : 'desktop')
        setIsAutoDetected(true)
    }

    return {
        viewMode,
        isAutoDetected,
        toggleViewMode,
        resetToAutoDetect,
        isMobileView: viewMode === 'mobile',
        isDesktopView: viewMode === 'desktop',
    }
}
