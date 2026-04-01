'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Activity, Calendar, Clock } from 'lucide-react'
import { InteractiveDentalChart } from './interactive-dental-chart'
import { getToothTimelineAction } from '@/lib/actions/tooth-timeline'
import { getEpisodesForToothAction } from '@/lib/actions/treatment-episodes'

interface EnhancedDentalChartTabProps {
  patientId: string
}

export function EnhancedDentalChartTab({ patientId }: EnhancedDentalChartTabProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [toothHistory, setToothHistory] = useState<any[]>([])
  const [toothEpisodes, setToothEpisodes] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const handleToothSelect = async (toothNumber: string) => {
    setSelectedTooth(toothNumber)
    setIsLoadingHistory(true)

    try {
      const [timelineResult, episodesResult] = await Promise.all([
        getToothTimelineAction(patientId, toothNumber),
        getEpisodesForToothAction(patientId, toothNumber),
      ])

      setToothHistory(timelineResult.success ? timelineResult.events || [] : [])
      setToothEpisodes(episodesResult.success ? episodesResult.episodes || [] : [])
    } catch (e) {
      console.warn('Failed to load tooth history:', e)
      setToothHistory([])
      setToothEpisodes([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const closeSidePanel = () => {
    setSelectedTooth(null)
    setToothHistory([])
    setToothEpisodes([])
  }

  return (
    <div className="flex gap-4">
      {/* Dental Chart */}
      <div className={`${selectedTooth ? 'flex-1' : 'w-full'} transition-all`}>
        <InteractiveDentalChart
          patientId={patientId}
          onToothSelect={handleToothSelect}
        />
      </div>

      {/* Tooth History Side Panel */}
      {selectedTooth && (
        <div className="w-[340px] shrink-0">
          <Card className="border-border sticky top-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-foreground">
                  Tooth #{selectedTooth}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeSidePanel}
                  className="text-muted-foreground h-7 w-7 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
              {isLoadingHistory ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading history...</p>
              ) : (
                <>
                  {/* Active Episodes for this tooth */}
                  {toothEpisodes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Treatment Episodes</p>
                      <div className="space-y-2">
                        {toothEpisodes.map(ep => {
                          const progress = ep.planned_visits > 0
                            ? Math.round((ep.completed_visits / ep.planned_visits) * 100)
                            : 0
                          return (
                            <div key={ep.id} className="p-2.5 rounded-lg border border-border bg-muted/30">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={`text-[10px] ${
                                  ep.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                  ep.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400' :
                                  'bg-blue-500/10 text-blue-400'
                                }`}>
                                  {ep.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs font-medium text-foreground">{ep.original_diagnosis}</p>
                              <p className="text-[11px] text-muted-foreground">{ep.treatment_plan}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {ep.completed_visits}/{ep.planned_visits}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tooth Timeline */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      History ({toothHistory.length} events)
                    </p>
                    {toothHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">
                        No recorded history for this tooth
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {toothHistory.map((event: any) => (
                          <div
                            key={event.id}
                            className="p-2 rounded border border-border bg-card"
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Badge variant="outline" className="text-[9px] border-border px-1">
                                {(event.event_type || '').replace('_', ' ')}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(event.event_date).toLocaleDateString('en-IN', {
                                  day: 'numeric', month: 'short', year: 'numeric'
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-foreground">{event.description}</p>
                            {event.previous_status && event.new_status && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {event.previous_status} → {event.new_status}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
