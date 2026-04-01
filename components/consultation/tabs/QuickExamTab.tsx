'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface QuickExamTabProps {
  examData: {
    vitalSigns?: string
    extraoralFindings?: string
    intraoralFindings?: string
    painScale?: number
    swelling?: boolean
    bleeding?: boolean
    mobility?: boolean
  }
  onChange: (data: QuickExamTabProps['examData']) => void
  readOnly?: boolean
}

export function QuickExamTab({ examData, onChange, readOnly }: QuickExamTabProps) {
  const update = (field: string, value: any) => {
    onChange({ ...examData, [field]: value })
  }

  const toggleFlags = [
    { key: 'swelling', label: 'Swelling' },
    { key: 'bleeding', label: 'Bleeding' },
    { key: 'mobility', label: 'Mobility' },
  ] as const

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-foreground">Quick Examination</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pain Scale */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Pain Scale (0-10)</Label>
            <div className="flex gap-1.5">
              {[...Array(11)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => !readOnly && update('painScale', i)}
                  disabled={readOnly}
                  className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                    examData.painScale === i
                      ? i <= 3 ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/30'
                        : i <= 6 ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30'
                        : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Quick flags */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Clinical Flags</Label>
            <div className="flex gap-2">
              {toggleFlags.map(flag => (
                <button
                  key={flag.key}
                  onClick={() => !readOnly && update(flag.key, !examData[flag.key])}
                  disabled={readOnly}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    examData[flag.key]
                      ? 'border-red-500/40 bg-red-500/10 text-red-400'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {flag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Extraoral */}
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Extraoral Findings</Label>
            <Textarea
              placeholder="Facial asymmetry, lymph nodes, TMJ..."
              value={examData.extraoralFindings || ''}
              onChange={(e) => update('extraoralFindings', e.target.value)}
              rows={2}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Intraoral */}
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Intraoral Findings</Label>
            <Textarea
              placeholder="Swelling location, tooth condition, soft tissue..."
              value={examData.intraoralFindings || ''}
              onChange={(e) => update('intraoralFindings', e.target.value)}
              rows={3}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
