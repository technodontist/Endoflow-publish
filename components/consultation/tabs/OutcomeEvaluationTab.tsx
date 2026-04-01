'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

type OutcomeValue = 'success' | 'partial_success' | 'failure' | ''

interface OutcomeEvaluationTabProps {
  outcome: OutcomeValue
  outcomeNotes: string
  onChange: (data: { outcome: OutcomeValue; outcomeNotes: string }) => void
  readOnly?: boolean
}

const outcomeOptions: Array<{
  value: OutcomeValue
  label: string
  description: string
  icon: typeof CheckCircle
  colorClass: string
  selectedColor: string
}> = [
  {
    value: 'success',
    label: 'Successful',
    description: 'Treatment achieved intended clinical outcome',
    icon: CheckCircle,
    colorClass: 'border-green-500/30 hover:bg-green-500/10',
    selectedColor: 'border-green-500/50 bg-green-500/10 ring-2 ring-green-500/30 ring-offset-1 ring-offset-background',
  },
  {
    value: 'partial_success',
    label: 'Partial Success',
    description: 'Some objectives met, further intervention may be needed',
    icon: AlertTriangle,
    colorClass: 'border-amber-500/30 hover:bg-amber-500/10',
    selectedColor: 'border-amber-500/50 bg-amber-500/10 ring-2 ring-amber-500/30 ring-offset-1 ring-offset-background',
  },
  {
    value: 'failure',
    label: 'Failed',
    description: 'Treatment did not achieve intended outcome — retreatment or alternative needed',
    icon: XCircle,
    colorClass: 'border-red-500/30 hover:bg-red-500/10',
    selectedColor: 'border-red-500/50 bg-red-500/10 ring-2 ring-red-500/30 ring-offset-1 ring-offset-background',
  },
]

export function OutcomeEvaluationTab({ outcome, outcomeNotes, onChange, readOnly }: OutcomeEvaluationTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-foreground">Treatment Outcome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {outcomeOptions.map(option => {
              const Icon = option.icon
              const isSelected = outcome === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => !readOnly && onChange({ outcome: option.value, outcomeNotes })}
                  disabled={readOnly}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected ? option.selectedColor : `${option.colorClass} bg-card`
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <Icon className={`w-6 h-6 mb-2 ${
                    isSelected
                      ? option.value === 'success' ? 'text-green-400'
                        : option.value === 'partial_success' ? 'text-amber-400'
                        : 'text-red-400'
                      : 'text-muted-foreground'
                  }`} />
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                </button>
              )
            })}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">
              Outcome Notes
            </Label>
            <Textarea
              placeholder="Document the treatment outcome, clinical observations, and any recommendations..."
              value={outcomeNotes}
              onChange={(e) => onChange({ outcome, outcomeNotes: e.target.value })}
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
