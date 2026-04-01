'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDays } from 'lucide-react'

interface NextVisitPlanTabProps {
  plan: string
  suggestedDate: string
  onChange: (data: { plan: string; suggestedDate: string }) => void
  readOnly?: boolean
}

export function NextVisitPlanTab({ plan, suggestedDate, onChange, readOnly }: NextVisitPlanTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-medium text-foreground">Next Visit Plan</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">
              What needs to be done next visit?
            </Label>
            <Textarea
              placeholder="Describe the planned procedures, preparations, or assessments for the next visit..."
              value={plan}
              onChange={(e) => onChange({ plan: e.target.value, suggestedDate })}
              rows={4}
              readOnly={readOnly}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">
              Suggested Date for Next Visit
            </Label>
            <Input
              type="date"
              value={suggestedDate}
              onChange={(e) => onChange({ plan, suggestedDate: e.target.value })}
              readOnly={readOnly}
              className="bg-input border-border text-foreground w-52"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
