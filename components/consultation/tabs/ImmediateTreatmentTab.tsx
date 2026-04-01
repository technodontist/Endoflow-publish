'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

interface ImmediateTreatmentTabProps {
  treatmentData: {
    treatmentPerformed?: string
    materialsUsed?: string
    postOpInstructions?: string
    referralNeeded?: boolean
    referralNotes?: string
    followUpRequired?: boolean
    followUpDays?: number
  }
  onChange: (data: ImmediateTreatmentTabProps['treatmentData']) => void
  readOnly?: boolean
}

export function ImmediateTreatmentTab({ treatmentData, onChange, readOnly }: ImmediateTreatmentTabProps) {
  const update = (field: string, value: any) => {
    onChange({ ...treatmentData, [field]: value })
  }

  return (
    <div className="space-y-4">
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-base font-medium text-foreground">Emergency Treatment</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Treatment Performed</Label>
            <Textarea
              placeholder="Describe the emergency treatment performed..."
              value={treatmentData.treatmentPerformed || ''}
              onChange={(e) => update('treatmentPerformed', e.target.value)}
              rows={4}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Materials Used</Label>
            <Input
              placeholder="E.g., ZOE dressing, Ibuprofen 400mg..."
              value={treatmentData.materialsUsed || ''}
              onChange={(e) => update('materialsUsed', e.target.value)}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Post-Op Instructions</Label>
            <Textarea
              placeholder="Instructions given to the patient..."
              value={treatmentData.postOpInstructions || ''}
              onChange={(e) => update('postOpInstructions', e.target.value)}
              rows={3}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Referral */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => !readOnly && update('referralNeeded', !treatmentData.referralNeeded)}
              disabled={readOnly}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                treatmentData.referralNeeded
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              Referral Needed
            </button>

            <button
              onClick={() => !readOnly && update('followUpRequired', !treatmentData.followUpRequired)}
              disabled={readOnly}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                treatmentData.followUpRequired
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              Follow-Up Required
            </button>

            {treatmentData.followUpRequired && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">in</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={treatmentData.followUpDays || 7}
                  onChange={(e) => update('followUpDays', parseInt(e.target.value) || 7)}
                  readOnly={readOnly}
                  className="w-20 bg-input border-border text-foreground"
                />
                <Label className="text-sm text-muted-foreground">days</Label>
              </div>
            )}
          </div>

          {treatmentData.referralNeeded && (
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">Referral Notes</Label>
              <Input
                placeholder="Specialist type, reason for referral..."
                value={treatmentData.referralNotes || ''}
                onChange={(e) => update('referralNotes', e.target.value)}
                readOnly={readOnly}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
