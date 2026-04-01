'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClinicalNotesTabProps {
  notes: string
  complications: string
  onChange: (data: { notes: string; complications: string }) => void
  readOnly?: boolean
}

export function ClinicalNotesTab({ notes, complications, onChange, readOnly }: ClinicalNotesTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-foreground">Clinical Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">
              Notes & Observations
            </Label>
            <Textarea
              placeholder="Record clinical observations, findings, and notes for this visit..."
              value={notes}
              onChange={(e) => onChange({ notes: e.target.value, complications })}
              rows={6}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">
              Complications (if any)
            </Label>
            <Textarea
              placeholder="Record any complications encountered during the procedure..."
              value={complications}
              onChange={(e) => onChange({ notes, complications: e.target.value })}
              rows={3}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
            {complications && (
              <p className="text-xs text-amber-400 mt-1">
                Complications recorded — will be flagged in the episode history
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
