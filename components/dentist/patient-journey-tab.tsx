'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronDown, ChevronUp, CheckCircle, Clock, AlertTriangle,
  XCircle, Pause, Search, Activity, Stethoscope, Calendar,
  FileText, TrendingUp, Heart, Layers,
} from 'lucide-react'
import { getTreatmentEpisodesForPatientAction } from '@/lib/actions/treatment-episodes'
import { getEpisodeVisitsAction } from '@/lib/actions/episode-visits'
import { getPatientFullTimelineAction } from '@/lib/actions/tooth-timeline'
import { format } from 'date-fns'

interface PatientJourneyTabProps {
  patientId: string
}

// ─── Status Configs ──────────────────────────────

const episodeStatusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string; border: string }> = {
  planned: { label: 'Planned', icon: Clock, color: 'bg-blue-500/10 text-blue-400', border: 'border-l-blue-500' },
  in_progress: { label: 'In Progress', icon: Activity, color: 'bg-amber-500/10 text-amber-400', border: 'border-l-amber-500' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-500/10 text-green-400', border: 'border-l-green-500' },
  on_hold: { label: 'On Hold', icon: Pause, color: 'bg-gray-500/10 text-gray-400', border: 'border-l-gray-500' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-500/10 text-red-400', border: 'border-l-red-500' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-gray-500/10 text-gray-400', border: 'border-l-gray-500' },
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400',
  high: 'bg-orange-500/15 text-orange-400',
  medium: 'bg-blue-500/15 text-blue-400',
  low: 'bg-green-500/15 text-green-400',
}

const eventTypeConfig: Record<string, { icon: typeof CheckCircle; color: string }> = {
  diagnosis: { icon: FileText, color: 'text-blue-400' },
  treatment_start: { icon: Activity, color: 'text-amber-400' },
  treatment_visit: { icon: TrendingUp, color: 'text-teal-400' },
  treatment_complete: { icon: CheckCircle, color: 'text-green-400' },
  follow_up: { icon: Heart, color: 'text-purple-400' },
  new_finding: { icon: AlertTriangle, color: 'text-orange-400' },
  status_change: { icon: Activity, color: 'text-gray-400' },
  consultation: { icon: Stethoscope, color: 'text-teal-400' },
  appointment: { icon: Calendar, color: 'text-blue-400' },
}

// ─── Component ───────────────────────────────────

export function PatientJourneyTab({ patientId }: PatientJourneyTabProps) {
  const [episodes, setEpisodes] = useState<any[]>([])
  const [standaloneEvents, setStandaloneEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set())
  const [episodeVisits, setEpisodeVisits] = useState<Record<string, any[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTooth, setFilterTooth] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Get all unique teeth across episodes
  const allTeeth = Array.from(
    new Set(episodes.flatMap(ep => ep.linked_teeth || []))
  ).sort((a, b) => parseInt(a) - parseInt(b))

  useEffect(() => {
    loadJourneyData()
  }, [patientId])

  const loadJourneyData = async () => {
    setIsLoading(true)
    try {
      // Load episodes and timeline in parallel
      const [episodesResult, timelineResult] = await Promise.all([
        getTreatmentEpisodesForPatientAction(patientId),
        getPatientFullTimelineAction(patientId),
      ])

      if (episodesResult.success) {
        // Sort: active first, then by date
        const sorted = (episodesResult.episodes || []).sort((a: any, b: any) => {
          const statusOrder: Record<string, number> = { in_progress: 0, planned: 1, on_hold: 2, completed: 3, failed: 4, cancelled: 5 }
          const aOrder = statusOrder[a.status] ?? 3
          const bOrder = statusOrder[b.status] ?? 3
          if (aOrder !== bOrder) return aOrder - bOrder
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        setEpisodes(sorted)

        // Auto-expand active episodes
        const activeIds = new Set(
          sorted.filter((ep: any) => ep.status === 'in_progress' || ep.status === 'planned').map((ep: any) => ep.id)
        )
        setExpandedEpisodes(activeIds)

        // Pre-load visits for active episodes
        for (const ep of sorted.filter((e: any) => activeIds.has(e.id))) {
          loadVisitsForEpisode(ep.id)
        }
      }

      if (timelineResult.success) {
        // Filter out events that belong to episodes (they'll show inside episode cards)
        const episodeIds = new Set((episodesResult.episodes || []).map((e: any) => e.id))
        const standalone = (timelineResult.timeline || []).filter((event: any) => {
          // Keep events not tied to any episode
          if (event.source === 'tooth_timeline' && event.episodeId && episodeIds.has(event.episodeId)) {
            return false
          }
          return true
        })
        setStandaloneEvents(standalone)
      }
    } catch (e) {
      console.warn('Failed to load journey data:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const loadVisitsForEpisode = async (episodeId: string) => {
    try {
      const result = await getEpisodeVisitsAction(episodeId)
      if (result.success) {
        setEpisodeVisits(prev => ({ ...prev, [episodeId]: result.visits || [] }))
      }
    } catch (e) {
      console.warn('Failed to load visits:', e)
    }
  }

  const toggleEpisode = (episodeId: string) => {
    setExpandedEpisodes(prev => {
      const next = new Set(prev)
      if (next.has(episodeId)) {
        next.delete(episodeId)
      } else {
        next.add(episodeId)
        if (!episodeVisits[episodeId]) {
          loadVisitsForEpisode(episodeId)
        }
      }
      return next
    })
  }

  // ─── Filtering ─────────────────────────────────

  const filteredEpisodes = episodes.filter(ep => {
    if (filterStatus !== 'all' && ep.status !== filterStatus) return false
    if (filterTooth !== 'all' && !(ep.linked_teeth || []).includes(filterTooth)) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        (ep.original_diagnosis || '').toLowerCase().includes(q) ||
        (ep.treatment_plan || '').toLowerCase().includes(q) ||
        (ep.linked_teeth || []).some((t: string) => t.includes(q))
      )
    }
    return true
  })

  const filteredStandaloneEvents = standaloneEvents.filter(event => {
    if (filterTooth !== 'all' && event.toothNumber !== filterTooth) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (event.description || '').toLowerCase().includes(q)
    }
    return true
  })

  // Group standalone events by date
  const groupedStandalone = filteredStandaloneEvents.reduce((groups: Record<string, any[]>, event) => {
    const date = format(new Date(event.eventDate || event.date), 'yyyy-MM-dd')
    if (!groups[date]) groups[date] = []
    groups[date].push(event)
    return groups
  }, {})

  // ─── Render ────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading patient journey...</p>
        </div>
      </div>
    )
  }

  const hasNoData = episodes.length === 0 && standaloneEvents.length === 0

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search diagnoses, treatments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-card border-border">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        {allTeeth.length > 0 && (
          <Select value={filterTooth} onValueChange={setFilterTooth}>
            <SelectTrigger className="w-[130px] bg-card border-border">
              <SelectValue placeholder="All Teeth" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teeth</SelectItem>
              {allTeeth.map(tooth => (
                <SelectItem key={tooth} value={tooth}>Tooth #{tooth}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Badge variant="outline" className="border-border text-muted-foreground">
          {filteredEpisodes.length} episodes
        </Badge>
      </div>

      {/* Empty State */}
      {hasNoData && (
        <div className="text-center py-16">
          <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No clinical journey data yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Episodes are created when consultations with treatment plans are completed
          </p>
        </div>
      )}

      {/* Episode Cards */}
      {filteredEpisodes.map(episode => {
        const sc = episodeStatusConfig[episode.status] || episodeStatusConfig.planned
        const StatusIcon = sc.icon
        const isExpanded = expandedEpisodes.has(episode.id)
        const visits = episodeVisits[episode.id] || []
        const progress = episode.planned_visits > 0
          ? Math.round((episode.completed_visits / episode.planned_visits) * 100)
          : 0

        // Parse treatment sequence steps
        const sequenceSteps = (episode.combined_treatment_sequence || '')
          .split('→')
          .map((s: string) => s.replace(/^\d+\.\s*/, '').trim())
          .filter(Boolean)

        return (
          <Card
            key={episode.id}
            className={`border-l-4 ${sc.border} overflow-hidden transition-all`}
          >
            <CardContent className="p-0">
              {/* Episode Header */}
              <div
                className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleEpisode(episode.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Status + Priority + Teeth */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge className={`${sc.color} border-0 text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {sc.label}
                      </Badge>
                      <Badge className={`${priorityColors[episode.priority] || priorityColors.medium} border-0 text-xs`}>
                        {episode.priority}
                      </Badge>
                      {(episode.linked_teeth || []).map((tooth: string) => (
                        <Badge key={tooth} variant="outline" className="text-xs border-border">
                          #{tooth}
                        </Badge>
                      ))}
                      {episode.outcome && (
                        <Badge className={`text-xs border-0 ${
                          episode.outcome === 'success' ? 'bg-green-500/15 text-green-400' :
                          episode.outcome === 'failure' ? 'bg-red-500/15 text-red-400' :
                          'bg-amber-500/15 text-amber-400'
                        }`}>
                          {episode.outcome.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>

                    {/* Diagnosis & Plan */}
                    <h4 className="font-medium text-foreground text-sm">
                      {episode.original_diagnosis}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {episode.treatment_plan}
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            episode.status === 'completed' ? 'bg-green-500' :
                            episode.status === 'failed' ? 'bg-red-500' :
                            'bg-primary'
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {episode.completed_visits}/{episode.planned_visits} visits
                      </span>
                    </div>

                    {/* Treatment Sequence (compact) */}
                    {sequenceSteps.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        {sequenceSteps.map((step: string, i: number) => {
                          const isCompleted = i < episode.completed_visits
                          const isCurrent = i === episode.completed_visits && episode.status === 'in_progress'
                          return (
                            <React.Fragment key={i}>
                              {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                isCompleted ? 'bg-green-500/10 text-green-400 line-through' :
                                isCurrent ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/30' :
                                'text-muted-foreground'
                              }`}>
                                {step}
                              </span>
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Expand Toggle */}
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Expanded Visit History */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  {visits.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Loading visits...
                    </p>
                  ) : (
                    <div className="relative pl-4">
                      {/* Vertical line */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                      {visits.map((visit: any, idx: number) => {
                        const isFollowUp = visit.visit_type === 'follow_up'
                        const VisitIcon = isFollowUp ? Heart : TrendingUp
                        const visitColor = isFollowUp ? 'text-purple-400' :
                          visit.dentist_confirmed ? 'text-green-400' : 'text-muted-foreground'

                        return (
                          <div key={visit.id} className="relative mb-4 last:mb-0">
                            {/* Timeline dot */}
                            <div className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 ${
                              visit.dentist_confirmed ? 'bg-green-500 border-green-600' :
                              isFollowUp ? 'bg-purple-500 border-purple-600' :
                              'bg-muted border-border'
                            }`} />

                            <div className="ml-2">
                              {/* Visit header */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <VisitIcon className={`w-3.5 h-3.5 ${visitColor}`} />
                                <span className="text-xs font-medium text-foreground">
                                  Visit {visit.visit_number}
                                </span>
                                <Badge variant="outline" className="text-[10px] border-border">
                                  {visit.visit_type.replace('_', ' ')}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                                </span>
                                {visit.dentist_confirmed && (
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                )}
                              </div>

                              {/* Procedures */}
                              {visit.procedures_done && Array.isArray(visit.procedures_done) && visit.procedures_done.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {visit.procedures_done.map((proc: string, pi: number) => (
                                    <Badge key={pi} className="text-[10px] bg-primary/10 text-primary border-0">
                                      {proc}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {/* Clinical notes */}
                              {visit.clinical_notes && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {visit.clinical_notes}
                                </p>
                              )}

                              {/* Complications */}
                              {visit.complications && (
                                <p className="text-xs text-orange-400 mt-1">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  {visit.complications}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Outcome notes */}
                  {episode.outcome_notes && (
                    <div className="mt-3 p-3 rounded-lg bg-card border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Outcome Notes</p>
                      <p className="text-sm text-foreground">{episode.outcome_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Standalone Events (not tied to episodes) */}
      {Object.keys(groupedStandalone).length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Other Clinical Events</h3>
          </div>

          <div className="space-y-4">
            {Object.entries(groupedStandalone)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([dateKey, events]) => (
                <div key={dateKey}>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    {format(new Date(dateKey), 'EEEE, d MMMM yyyy')}
                  </p>
                  <div className="space-y-2 pl-4 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    {events.map((event: any, idx: number) => {
                      const ec = eventTypeConfig[event.eventType || event.type] || eventTypeConfig.consultation
                      const EventIcon = ec.icon

                      return (
                        <div key={event.id || idx} className="relative">
                          <div className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full bg-muted border border-border" />
                          <div className="ml-2 flex items-start gap-2">
                            <EventIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ec.color}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] border-border">
                                  {(event.eventType || event.type || '').replace('_', ' ')}
                                </Badge>
                                {event.toothNumber && (
                                  <Badge variant="outline" className="text-[10px] border-border">
                                    #{event.toothNumber}
                                  </Badge>
                                )}
                                {event.status && (
                                  <Badge variant="outline" className="text-[10px] border-border">
                                    {event.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-foreground mt-0.5">
                                {event.description || event.chiefComplaint || event.appointmentType || 'Event'}
                              </p>
                              {event.previousStatus && event.newStatus && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {event.previousStatus} → {event.newStatus}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
