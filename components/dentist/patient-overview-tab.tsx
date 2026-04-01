'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Calendar, Pill, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import { getActiveEpisodesForPatientAction } from '@/lib/actions/treatment-episodes'

interface PatientOverviewTabProps {
  patientId: string
  treatments: any[]
  consultations: any[]
  followUps: any[]
}

export function PatientOverviewTab({ patientId, treatments, consultations, followUps }: PatientOverviewTabProps) {
  const [activeEpisodes, setActiveEpisodes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadEpisodes()
  }, [patientId])

  const loadEpisodes = async () => {
    setIsLoading(true)
    try {
      const result = await getActiveEpisodesForPatientAction(patientId)
      if (result.success) {
        setActiveEpisodes(result.episodes || [])
      }
    } catch (e) {
      console.warn('Failed to load episodes:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Derive stats
  const activeTreatments = treatments.filter(t => t.status === 'in_progress').length
  const completedTreatments = treatments.filter(t => t.status === 'completed').length
  const upcomingFollowUps = followUps.filter(f => {
    const fDate = new Date(f.date || f.scheduled_date)
    return fDate >= new Date()
  }).length
  const overdueFollowUps = followUps.filter(f => {
    const fDate = new Date(f.date || f.scheduled_date)
    return fDate < new Date() && f.status !== 'completed'
  }).length

  // Get latest prescriptions from most recent consultation
  const latestConsultation = consultations[0]
  let currentMeds: string[] = []
  if (latestConsultation?.prescription_data) {
    try {
      const prescriptions = typeof latestConsultation.prescription_data === 'string'
        ? JSON.parse(latestConsultation.prescription_data)
        : latestConsultation.prescription_data
      if (Array.isArray(prescriptions)) {
        currentMeds = prescriptions.map((p: any) => p.name || p.medication_name || 'Unknown').filter(Boolean)
      }
    } catch { /* ignore parse errors */ }
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeTreatments}</p>
                <p className="text-xs text-muted-foreground">Active Treatments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedTreatments}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{upcomingFollowUps}</p>
                <p className="text-xs text-muted-foreground">Upcoming Follow-ups</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                overdueFollowUps > 0 ? 'bg-red-500/10' : 'bg-muted'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${overdueFollowUps > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${overdueFollowUps > 0 ? 'text-red-400' : 'text-foreground'}`}>
                  {overdueFollowUps}
                </p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Episodes */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-foreground">Active Treatment Episodes</CardTitle>
            <Badge variant="outline" className="border-border text-muted-foreground">
              {activeEpisodes.length} active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading episodes...</div>
          ) : activeEpisodes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No active treatment episodes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeEpisodes.map(ep => {
                const progress = ep.planned_visits > 0
                  ? Math.round((ep.completed_visits / ep.planned_visits) * 100)
                  : 0
                const priorityColors: Record<string, string> = {
                  urgent: 'text-red-400 bg-red-500/10',
                  high: 'text-orange-400 bg-orange-500/10',
                  medium: 'text-blue-400 bg-blue-500/10',
                  low: 'text-green-400 bg-green-500/10',
                }
                return (
                  <div key={ep.id} className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {ep.original_diagnosis}
                          </p>
                          <Badge className={`text-xs ${priorityColors[ep.priority] || priorityColors.medium}`}>
                            {ep.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Teeth: {(ep.linked_teeth || []).map((t: string) => `#${t}`).join(', ')}</span>
                          <span>·</span>
                          <span>{ep.treatment_plan}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {ep.completed_visits}/{ep.planned_visits}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Medications */}
      {currentMeds.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary" />
              <CardTitle className="text-base text-foreground">Current Medications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {currentMeds.map((med, i) => (
                <Badge key={i} variant="outline" className="border-border text-foreground">
                  {med}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Consultations */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Visit Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-foreground">{consultations.length}</p>
              <p className="text-xs text-muted-foreground">Total Consultations</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{treatments.length}</p>
              <p className="text-xs text-muted-foreground">Total Treatments</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{followUps.length}</p>
              <p className="text-xs text-muted-foreground">Follow-ups Scheduled</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
