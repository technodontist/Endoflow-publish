'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface TreatmentProgressTabProps {
  episode?: {
    id: string
    original_diagnosis: string
    treatment_plan: string
    combined_treatment_sequence?: string
    linked_teeth: string[]
    planned_visits: number
    completed_visits: number
    status: string
    priority: string
  }
  visits?: Array<{
    id: string
    visit_number: number
    visit_type: string
    visit_date: string
    procedures_done?: string[]
    clinical_notes?: string
    dentist_confirmed: boolean
  }>
  readOnly?: boolean
}

export function TreatmentProgressTab({ episode, visits = [], readOnly }: TreatmentProgressTabProps) {
  if (!episode) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No treatment episode linked</p>
        <p className="text-sm mt-1">Select an episode or start a new consultation</p>
      </div>
    )
  }

  const progress = episode.planned_visits > 0
    ? Math.round((episode.completed_visits / episode.planned_visits) * 100)
    : 0

  const statusColors: Record<string, string> = {
    planned: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    completed: 'bg-green-500/15 text-green-400 border-green-500/30',
    on_hold: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
    cancelled: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  }

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/15 text-red-400',
    high: 'bg-orange-500/15 text-orange-400',
    medium: 'bg-blue-500/15 text-blue-400',
    low: 'bg-green-500/15 text-green-400',
  }

  // Parse treatment sequence into steps
  const sequenceSteps = episode.combined_treatment_sequence
    ? episode.combined_treatment_sequence.split('→').map(s => s.trim())
    : [episode.treatment_plan]

  return (
    <div className="space-y-4">
      {/* Episode Context Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Treatment Episode</CardTitle>
            <div className="flex gap-2">
              <Badge className={statusColors[episode.status] || statusColors.planned}>
                {episode.status.replace('_', ' ')}
              </Badge>
              <Badge className={priorityColors[episode.priority] || priorityColors.medium}>
                {episode.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Teeth involved */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Teeth Involved</p>
            <div className="flex gap-1.5 flex-wrap">
              {episode.linked_teeth.map(tooth => (
                <Badge key={tooth} variant="outline" className="text-sm font-mono border-border">
                  #{tooth}
                </Badge>
              ))}
            </div>
          </div>

          {/* Diagnosis & Plan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Diagnosis</p>
              <p className="text-sm text-foreground">{episode.original_diagnosis}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Treatment Plan</p>
              <p className="text-sm text-foreground">{episode.treatment_plan}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                Visit {episode.completed_visits} of {episode.planned_visits}
              </p>
              <p className="text-sm font-bold text-primary">{progress}%</p>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Treatment Sequence Steps */}
          {sequenceSteps.length > 1 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Treatment Sequence</p>
              <div className="space-y-2">
                {sequenceSteps.map((step, idx) => {
                  const isCompleted = idx < episode.completed_visits
                  const isCurrent = idx === episode.completed_visits
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        isCurrent ? 'bg-primary/10 border border-primary/30' :
                        isCompleted ? 'bg-green-500/5' : 'bg-muted/50'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCompleted ? 'bg-green-500/20 text-green-400' :
                        isCurrent ? 'bg-primary/20 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className={`text-sm ${
                        isCompleted ? 'text-green-400 line-through' :
                        isCurrent ? 'text-primary font-medium' :
                        'text-muted-foreground'
                      }`}>
                        {step}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visit History */}
      {visits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-foreground">Previous Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visits.map(visit => (
                <div
                  key={visit.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {visit.visit_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground">
                        Visit {visit.visit_number}
                      </p>
                      <Badge variant="outline" className="text-xs border-border">
                        {visit.visit_type.replace('_', ' ')}
                      </Badge>
                      {visit.dentist_confirmed && (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(visit.visit_date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                    {visit.procedures_done && visit.procedures_done.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {(visit.procedures_done as string[]).join(', ')}
                      </p>
                    )}
                    {visit.clinical_notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {visit.clinical_notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
