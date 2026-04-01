'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Activity, Calendar, Stethoscope, HeartPulse, AlertTriangle,
  CheckCircle, Search, Filter, ChevronDown,
} from 'lucide-react'
import { getPatientFullTimelineAction } from '@/lib/actions/tooth-timeline'

interface PatientEnhancedTimelineProps {
  patientId: string
}

const eventTypeConfig: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  diagnosis: { icon: Stethoscope, color: 'text-blue-400 bg-blue-500/10', label: 'Diagnosis' },
  treatment_start: { icon: Activity, color: 'text-primary bg-primary/10', label: 'Treatment Started' },
  treatment_visit: { icon: Activity, color: 'text-amber-400 bg-amber-500/10', label: 'Treatment Visit' },
  treatment_complete: { icon: CheckCircle, color: 'text-green-400 bg-green-500/10', label: 'Treatment Complete' },
  follow_up: { icon: HeartPulse, color: 'text-purple-400 bg-purple-500/10', label: 'Follow-Up' },
  new_finding: { icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/10', label: 'New Finding' },
  status_change: { icon: Activity, color: 'text-gray-400 bg-gray-500/10', label: 'Status Change' },
  // For unified timeline entries from consultations and appointments
  consultation: { icon: Stethoscope, color: 'text-blue-400 bg-blue-500/10', label: 'Consultation' },
  new_consultation: { icon: Stethoscope, color: 'text-blue-400 bg-blue-500/10', label: 'New Consultation' },
  treatment_visit_mode: { icon: Activity, color: 'text-amber-400 bg-amber-500/10', label: 'Treatment Visit' },
  follow_up_mode: { icon: HeartPulse, color: 'text-purple-400 bg-purple-500/10', label: 'Follow-Up' },
  emergency: { icon: AlertTriangle, color: 'text-red-400 bg-red-500/10', label: 'Emergency' },
  appointment: { icon: Calendar, color: 'text-primary bg-primary/10', label: 'Appointment' },
}

export function PatientEnhancedTimeline({ patientId }: PatientEnhancedTimelineProps) {
  const [timeline, setTimeline] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterTooth, setFilterTooth] = useState<string>('')

  useEffect(() => {
    loadTimeline()
  }, [patientId])

  const loadTimeline = async () => {
    setIsLoading(true)
    try {
      const result = await getPatientFullTimelineAction(patientId)
      if (result.success) {
        setTimeline(result.timeline || [])
      }
    } catch (e) {
      console.warn('Failed to load timeline:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter timeline
  const filteredTimeline = timeline.filter(entry => {
    if (filterType !== 'all' && entry.type !== filterType && entry.eventType !== filterType) return false
    if (filterTooth && entry.toothNumber !== filterTooth) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const desc = (entry.description || '').toLowerCase()
      const tooth = (entry.toothNumber || '').toLowerCase()
      if (!desc.includes(term) && !tooth.includes(term)) return false
    }
    return true
  })

  // Group by date
  const groupedTimeline: Record<string, any[]> = {}
  filteredTimeline.forEach(entry => {
    const date = new Date(entry.date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    if (!groupedTimeline[date]) groupedTimeline[date] = []
    groupedTimeline[date].push(entry)
  })

  // Get unique tooth numbers for filter
  const uniqueTeeth = [...new Set(timeline.filter(e => e.toothNumber).map(e => e.toothNumber))].sort()

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Loading timeline...</div>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search timeline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm"
        >
          <option value="all">All Events</option>
          <option value="tooth_event">Tooth Events</option>
          <option value="consultation">Consultations</option>
          <option value="appointment">Appointments</option>
        </select>

        {uniqueTeeth.length > 0 && (
          <select
            value={filterTooth}
            onChange={(e) => setFilterTooth(e.target.value)}
            className="px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm"
          >
            <option value="">All Teeth</option>
            {uniqueTeeth.map(tooth => (
              <option key={tooth} value={tooth}>Tooth #{tooth}</option>
            ))}
          </select>
        )}
      </div>

      {/* Timeline */}
      {filteredTimeline.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm">No timeline events found</p>
          {timeline.length > 0 && (
            <p className="text-xs mt-1">Try adjusting your filters</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTimeline).map(([date, events]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{date}</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2 ml-4 border-l-2 border-border pl-4">
                {events.map((entry: any, idx: number) => {
                  const config = eventTypeConfig[entry.eventType] || eventTypeConfig[entry.type] || eventTypeConfig.consultation
                  const Icon = config.icon

                  return (
                    <div key={`${entry.type}-${idx}`} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-background ${
                        config.color.split(' ')[1] || 'bg-muted'
                      }`} />

                      <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <Badge variant="outline" className="text-[10px] border-border">
                                {config.label}
                              </Badge>
                              {entry.toothNumber && (
                                <Badge variant="outline" className="text-[10px] font-mono border-border">
                                  #{entry.toothNumber}
                                </Badge>
                              )}
                              {entry.status && (
                                <Badge variant="outline" className="text-[10px] border-border">
                                  {entry.status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground">{entry.description}</p>
                            {entry.previousStatus && entry.newStatus && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {entry.previousStatus} → {entry.newStatus}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {new Date(entry.date).toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
