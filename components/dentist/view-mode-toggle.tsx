"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Monitor, Smartphone } from 'lucide-react'

interface ViewModeToggleProps {
    viewMode: 'desktop' | 'mobile'
    onToggle: () => void
}

export function ViewModeToggle({ viewMode, onToggle }: ViewModeToggleProps) {
    const isMobile = viewMode === 'mobile'

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="flex items-center gap-2 hover:bg-teal-500/10"
            title={`Switch to ${isMobile ? 'Desktop' : 'Mobile'} View`}
        >
            {isMobile ? (
                <>
                    <Smartphone className="w-4 h-4 text-teal-400" />
                    <span className="text-xs text-teal-400 hidden sm:inline">Mobile View</span>
                </>
            ) : (
                <>
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground hidden sm:inline">Desktop View</span>
                </>
            )}
        </Button>
    )
}
