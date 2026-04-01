'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'

type HealingStatus = 'healing_normal' | 'delayed_healing' | 'complication' | 'failure' | 'new_issue' | ''

interface HealingStatusTabProps {
  healingStatus: HealingStatus
  healingNotes: string
  onChange: (data: { healingStatus: HealingStatus; healingNotes: string }) => void
  readOnly?: boolean
}

const healingOptions: Array<{
  value: HealingStatus
  label: string
  description: string
  icon: typeof CheckCircle
  colorClass: string
}> = [
  {
    value: 'healing_normal',
    label: 'Healing Normally',
    description: 'Recovery progressing as expected',
    icon: CheckCircle,
    colorClass: 'border-green-500/30 bg-green-500/5 text-green-400 hover:bg-green-500/10',
  },
  {
    value: 'delayed_healing',
    label: 'Delayed Healing',
    description: 'Recovery slower than expected',
    icon: Clock,
    colorClass: 'border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10',
  },
  {
    value: 'complication',
    label: 'Complication',
    description: 'Issue requiring intervention',
    icon: AlertTriangle,
    colorClass: 'border-orange-500/30 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10',
  },
  {
    value: 'failure',
    label: 'Treatment Failure',
    description: 'Treatment did not achieve intended outcome',
    icon: XCircle,
    colorClass: 'border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10',
  },
  {
    value: 'new_issue',
    label: 'New Issue Found',
    description: 'Unrelated new pathology discovered',
    icon: AlertTriangle,
    colorClass: 'border-purple-500/30 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10',
  },
]

export function HealingStatusTab({ healingStatus, healingNotes, onChange, readOnly }: HealingStatusTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-foreground">Healing Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {healingOptions.map(option => {
              const Icon = option.icon
              const isSelected = healingStatus === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => !readOnly && onChange({ healingStatus: option.value, healingNotes })}
                  disabled={readOnly}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? option.colorClass + ' ring-2 ring-offset-1 ring-offset-background'
                      : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${isSelected ? '' : 'opacity-50'}`} />
                    <div>
                      <p className={`text-sm font-medium ${isSelected ? '' : 'text-foreground'}`}>
                        {option.label}
                      </p>
                      <p className="text-xs mt-0.5 opacity-75">{option.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">
              Clinical Findings & Notes
            </Label>
            <Textarea
              placeholder="Describe healing observations, clinical findings, and any concerns..."
              value={healingNotes}
              onChange={(e) => onChange({ healingStatus, healingNotes: e.target.value })}
              rows={4}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
