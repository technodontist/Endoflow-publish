'use client'

import React from 'react'
import { Stethoscope, Wrench, HeartPulse, Siren } from 'lucide-react'
import type { ConsultationMode } from '@/lib/types/consultation-modes'
import { CONSULTATION_MODES } from '@/lib/types/consultation-modes'

interface ConsultationModeSelectorProps {
  activeMode: ConsultationMode
  onModeChange: (mode: ConsultationMode) => void
  disabled?: boolean
}

const modeIcons: Record<ConsultationMode, typeof Stethoscope> = {
  new_consultation: Stethoscope,
  treatment_visit: Wrench,
  follow_up: HeartPulse,
  emergency: Siren,
}

const modeColors: Record<ConsultationMode, { active: string; inactive: string }> = {
  new_consultation: {
    active: 'bg-primary/15 text-primary border-primary/40 ring-2 ring-primary/20',
    inactive: 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
  },
  treatment_visit: {
    active: 'bg-blue-500/15 text-blue-400 border-blue-500/40 ring-2 ring-blue-500/20',
    inactive: 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
  },
  follow_up: {
    active: 'bg-green-500/15 text-green-400 border-green-500/40 ring-2 ring-green-500/20',
    inactive: 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
  },
  emergency: {
    active: 'bg-red-500/15 text-red-400 border-red-500/40 ring-2 ring-red-500/20',
    inactive: 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
  },
}

export function ConsultationModeSelector({ activeMode, onModeChange, disabled }: ConsultationModeSelectorProps) {
  const modes = Object.values(CONSULTATION_MODES)

  return (
    <div className="flex flex-wrap gap-2">
      {modes.map(mode => {
        const Icon = modeIcons[mode.id]
        const isActive = activeMode === mode.id
        const colors = modeColors[mode.id]

        return (
          <button
            key={mode.id}
            onClick={() => !disabled && onModeChange(mode.id)}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              isActive ? colors.active : colors.inactive
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={mode.description}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}
