'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, CheckCircle, Clock, AlertTriangle, XCircle, Pause } from 'lucide-react'
import { getTreatmentEpisodesForPatientAction } from '@/lib/actions/treatment-episodes'
import { getEpisodeVisitsAction } from '@/lib/actions/episode-visits'

interface PatientEpisodesTabProps {
  patientId: string
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  planned: { label: 'Planned', icon: Clock, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  on_hold: { label: 'On Hold', icon: Pause, color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400',
  high: 'bg-orange-500/15 text-orange-400',
  medium: 'bg-blue-500/15 text-blue-400',
  low: 'bg-green-500/15 text-green-400',
}

export function PatientEpisodesTab({ patientId }: PatientEpisodesTabProps) {
  const [episodes, setEpisodes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null)
  const [episodeVisits, setEpisodeVisits] = useState<Record<string, any[]>>({})

  useEffect(() => {
    loadEpisodes()
  }, [patientId])

  const loadEpisodes = async () => {
    setIsLoading(true)
    try {
      const result = await getTreatmentEpisodesForPatientAction(patientId)
      if (result.success) {
        setEpisodes(result.episodes || [])
      }
    } catch (e) {
      console.warn('Failed to load episodes:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpand = async (episodeId: string) => {
    if (expandedEpisode === episodeId) {
      setExpandedEpisode(null)
      return
    }
    setExpandedEpisode(episodeId)

    // Load visits if not already loaded
    if (!episodeVisits[episodeId]) {
      try {
        const result = await getEpisodeVisitsAction(episodeId)
        if (result.success) {
          setEpisodeVisits(prev => ({ ...prev, [episodeId]: result.visits || [] }))
        }
      } catch (e) {
        console.warn('Failed to load visits:', e)
      }
    }
  }

  // Group episodes by status
  const activeEpisodes = episodes.filter(e => ['planned', 'in_progress'].includes(e.status))
  const completedEpisodes = episodes.filter(e => e.status === 'completed')
  const otherEpisodes = episodes.filter(e => ['on_hold', 'failed', 'cancelled'].includes(e.status))

  const renderEpisodeCard = (ep: any) => {
    const progress = ep.planned_visits > 0
      ? Math.round((ep.completed_visits / ep.planned_visits) * 100)
      : 0
    const config = statusConfig[ep.status] || statusConfig.planned
    const StatusIcon = config.icon
    const isExpanded = expandedEpisode === ep.id
    const visits = episodeVisits[ep.id] || []

    // Parse treatment sequence
    const sequenceSteps = ep.combined_treatment_sequence
      ? ep.combined_treatment_sequence.split('→').map((s: string) => s.trim())
      : null

    return (
      <Card key={ep.id} className="border-border">
        <CardContent className="p-4">
          {/* Episode Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold text-foreground">{ep.original_diagnosis}</p>
                <Badge className={config.color}>{config.label}</Badge>
                <Badge className={priorityColors[ep.priority] || priorityColors.medium}>
                  {ep.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{ep.treatment_plan}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                  {(ep.linked_teeth || []).map((tooth: string) => (
                    <Badge key={tooth} variant="outline" className="text-xs font-mono border-border px-1.5">
                      #{tooth}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  · {ep.episode_type?.replace('_', ' ')}
                </span>
                {ep.created_at && (
                  <span className="text-xs text-muted-foreground">
                    · Started {new Date(ep.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpand(ep.id)}
              className="text-muted-foreground shrink-0"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  ep.status === 'completed' ? 'bg-green-500' :
                  ep.status === 'failed' ? 'bg-red-500' : 'bg-primary'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {ep.completed_visits}/{ep.planned_visits} visits · {progress}%
            </span>
          </div>

          {/* Treatment Sequence (always visible if exists) */}
          {sequenceSteps && sequenceSteps.length > 1 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              {sequenceSteps.map((step: string, idx: number) => {
                const isCompleted = idx < ep.completed_visits
                const isCurrent = idx === ep.completed_visits && ep.status !== 'completed'
                return (
                  <React.Fragment key={idx}>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${
                      isCompleted ? 'bg-green-500/10 text-green-400' :
                      isCurrent ? 'bg-primary/10 text-primary font-medium' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted && <CheckCircle className="w-3 h-3" />}
                      {step}
                    </div>
                    {idx < sequenceSteps.length - 1 && (
                      <span className="text-muted-foreground text-xs">→</span>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          )}

          {/* Outcome (for completed/failed) */}
          {ep.outcome && (
            <div className={`mt-2 p-2 rounded text-xs ${
              ep.outcome === 'success' ? 'bg-green-500/5 text-green-400' :
              ep.outcome === 'failure' ? 'bg-red-500/5 text-red-400' :
              'bg-amber-500/5 text-amber-400'
            }`}>
              Outcome: {ep.outcome.replace('_', ' ')}
              {ep.outcome_notes && ` — ${ep.outcome_notes}`}
            </div>
          )}

          {/* Expanded Visit History */}
          {isExpanded && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Visit History</p>
              {visits.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No visits recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {visits.map((visit: any) => (
                    <div key={visit.id} className="flex items-start gap-3 p-2 rounded bg-muted/50">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {visit.visit_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            Visit {visit.visit_number}
                          </span>
                          <Badge variant="outline" className="text-[10px] border-border px-1">
                            {(visit.visit_type || '').replace('_', ' ')}
                          </Badge>
                          {visit.dentist_confirmed && (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(visit.visit_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                        {visit.procedures_done && Array.isArray(visit.procedures_done) && visit.procedures_done.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {visit.procedures_done.join(', ')}
                          </p>
                        )}
                        {visit.clinical_notes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                            {visit.clinical_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Loading episodes...</div>
  }

  if (episodes.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-40" />
        <p className="text-sm">No treatment episodes yet</p>
        <p className="text-xs mt-1">Episodes are created automatically when consultations with treatment plans are completed</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Active Episodes */}
      {activeEpisodes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Active ({activeEpisodes.length})</h4>
          <div className="space-y-3">{activeEpisodes.map(renderEpisodeCard)}</div>
        </div>
      )}

      {/* Completed Episodes */}
      {completedEpisodes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Completed ({completedEpisodes.length})</h4>
          <div className="space-y-3">{completedEpisodes.map(renderEpisodeCard)}</div>
        </div>
      )}

      {/* Other Episodes */}
      {otherEpisodes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Other ({otherEpisodes.length})</h4>
          <div className="space-y-3">{otherEpisodes.map(renderEpisodeCard)}</div>
        </div>
      )}
    </div>
  )
}
