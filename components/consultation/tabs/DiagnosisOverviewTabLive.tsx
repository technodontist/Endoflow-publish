'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Eye, AlertTriangle, Calendar, FileText, RefreshCw, Loader2, Stethoscope, Clock } from "lucide-react"
import { getPatientDiagnosisOverviewAction, getPatientDiagnosisStatsAction, type DiagnosisWithAppointment } from '@/lib/actions/diagnosis-overview'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DiagnosisOverviewTabLiveProps {
  patientId: string
  consultationId?: string
  data?: any // Current consultation's diagnosis data
  extraDefaults?: {
    provisional?: string
    differential?: string
    final?: string
  }
  isReadOnly?: boolean
  onChange?: (data: any) => void
}

export function DiagnosisOverviewTabLive({ 
  patientId, 
  consultationId,
  data,
  extraDefaults,
  isReadOnly = false,
  onChange
}: DiagnosisOverviewTabLiveProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [diagnoses, setDiagnoses] = useState<DiagnosisWithAppointment[]>([])
  const [stats, setStats] = useState<any>(null)
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'tooth' | 'date' | 'priority'>('tooth')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Local state for optional consultation-level fields
  const [provText, setProvText] = useState(extraDefaults?.provisional || '')
  const [diffText, setDiffText] = useState(extraDefaults?.differential || '')
  const [finalText, setFinalText] = useState(extraDefaults?.final || '')

  // Load diagnoses from database
  const loadDiagnoses = async () => {
    try {
      setRefreshing(true)
      const [diagnosesResult, statsResult] = await Promise.all([
        getPatientDiagnosisOverviewAction(patientId),
        getPatientDiagnosisStatsAction(patientId)
      ])

      if (diagnosesResult.success) {
        setDiagnoses(diagnosesResult.data || [])
      }
      if (statsResult.success) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('Error loading diagnoses:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (patientId) {
      loadDiagnoses()
    }
  }, [patientId])

  // Set up real-time subscription
  useEffect(() => {
    if (!patientId) return

    const supabase = createClient()
    
    // Subscribe to tooth diagnoses changes
    const diagnosisChannel = supabase
      .channel(`diagnoses-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'tooth_diagnoses',
          filter: `patient_id=eq.${patientId}`
        },
        () => {
          console.log('Diagnosis update detected, refreshing...')
          loadDiagnoses()
        }
      )
      .subscribe()

    // Subscribe to treatment changes (affects linked appointments)
    const treatmentsChannel = supabase
      .channel(`diagnoses-treatments-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'treatments',
          filter: `patient_id=eq.${patientId}`
        },
        () => {
          console.log('Treatment update detected, refreshing diagnoses...')
          loadDiagnoses()
        }
      )
      .subscribe()

    // Subscribe to appointment changes that could reflect on the overview
    const appointmentsChannel = supabase
      .channel(`diagnoses-appointments-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'appointments',
          filter: `patient_id=eq.${patientId}`
        },
        () => {
          console.log('Appointment update detected, refreshing diagnoses...')
          loadDiagnoses()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(diagnosisChannel)
      supabase.removeChannel(treatmentsChannel)
      supabase.removeChannel(appointmentsChannel)
    }
  }, [patientId])

  // Filter and sort diagnoses
  const filteredAndSortedDiagnoses = useMemo(() => {
    let filtered = diagnoses.filter(diagnosis => {
      // Search filter
      const matchesSearch = 
        diagnosis.tooth_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        diagnosis.diagnoses.some(d => d.toLowerCase().includes(searchTerm.toLowerCase())) ||
        diagnosis.symptoms.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
        diagnosis.primary_diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())

      // Status filter
      const matchesStatus = filterStatus === 'all' || diagnosis.status === filterStatus

      // Priority filter
      const matchesPriority = filterPriority === 'all' || diagnosis.priority === filterPriority

      return matchesSearch && matchesStatus && matchesPriority
    })

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'tooth':
          const toothA = parseInt(a.tooth_number || '0')
          const toothB = parseInt(b.tooth_number || '0')
          comparison = toothA - toothB
          break
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'priority':
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 }
          const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] || 2
          const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] || 2
          comparison = priorityA - priorityB
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [diagnoses, searchTerm, filterStatus, filterPriority, sortBy, sortOrder])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-green-100 text-green-800 border-green-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'monitoring': return 'bg-blue-100 text-blue-800'
      case 'referred': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <AlertTriangle className="w-3 h-3" />
      case 'resolved': return <Stethoscope className="w-3 h-3" />
      case 'monitoring': return <Eye className="w-3 h-3" />
      case 'referred': return <Calendar className="w-3 h-3" />
      default: return null
    }
  }

  const exportData = () => {
    const csvContent = [
      ['Tooth', 'Diagnoses', 'Treatments', 'Priority', 'Status', 'Symptoms', 'Appointment Date', 'Appointment Status', 'Dentist', 'Created Date'],
      ...filteredAndSortedDiagnoses.map(diagnosis => [
        diagnosis.tooth_number || 'General',
        diagnosis.diagnoses.join('; '),
        (diagnosis.treatments || []).map(t => t.treatment_type).join('; '),
        diagnosis.priority,
        diagnosis.status,
        diagnosis.symptoms.join('; '),
        diagnosis.appointment?.scheduled_date || 'Not scheduled',
        diagnosis.appointment?.status || '-',
        diagnosis.appointment?.dentist_name || '-',
        new Date(diagnosis.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diagnosis-overview-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const emitExtra = (p: string, d: string, f: string) => {
    if (!onChange) return
    const toArray = (s: string) => s.split(/[\n,]/).map(x => x.trim()).filter(Boolean)
    onChange({
      provisional_diagnoses: toArray(p),
      differential_diagnoses: toArray(d),
      final_diagnoses: toArray(f)
    })
  }

  const scheduleAppointment = (diagnosis: DiagnosisWithAppointment) => {
    // Navigate to appointment creation with pre-filled data
    const treatment = diagnosis.treatments?.find(t => !t.appointment_id && t.status === 'pending')
    if (treatment) {
      const params = new URLSearchParams({
        patientId,
        treatmentId: treatment.id,
        treatmentType: treatment.treatment_type,
        toothNumber: diagnosis.tooth_number || '',
        consultationId: diagnosis.consultation_id || ''
      })
      router.push(`/dentist/contextual-appointment?${params.toString()}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary Stats */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Live Diagnosis Overview
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDiagnoses()}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Diagnoses</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.active}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
                <div className="text-sm text-gray-600">Resolved</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.monitoring}</div>
                <div className="text-sm text-gray-600">Monitoring</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.referred}</div>
                <div className="text-sm text-gray-600">Referred</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.highPriority}</div>
                <div className="text-sm text-gray-600">High Priority</div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Optional consultation-level diagnoses */}
      {onChange && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultation-level Diagnoses (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Provisional Diagnoses</Label>
              <Input
                placeholder="Comma or newline separated"
                value={provText}
                disabled={isReadOnly}
                onChange={(e) => { setProvText(e.target.value); emitExtra(e.target.value, diffText, finalText) }}
              />
            </div>
            <div>
              <Label>Differential Diagnoses</Label>
              <Input
                placeholder="Comma or newline separated"
                value={diffText}
                disabled={isReadOnly}
                onChange={(e) => { setDiffText(e.target.value); emitExtra(provText, e.target.value, finalText) }}
              />
            </div>
            <div>
              <Label>Final Diagnoses</Label>
              <Input
                placeholder="Comma or newline separated"
                value={finalText}
                disabled={isReadOnly}
                onChange={(e) => { setFinalText(e.target.value); emitExtra(provText, diffText, e.target.value) }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search diagnoses, teeth, symptoms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-3">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                    <SelectItem value="referred">Referred</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tooth">Tooth #</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </div>
            </div>

            <Button onClick={exportData} size="sm" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Diagnosis Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Tooth #</TableHead>
                  <TableHead className="font-semibold">Diagnoses</TableHead>
                  <TableHead className="font-semibold">Treatments</TableHead>
                  <TableHead className="font-semibold">Priority</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Symptoms</TableHead>
                  <TableHead className="font-semibold">Appointment</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedDiagnoses.length > 0 ? (
                  filteredAndSortedDiagnoses.map((diagnosis) => (
                    <TableRow key={diagnosis.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {diagnosis.tooth_number ? (
                          <Badge variant="outline" className="text-blue-700 border-blue-300">
                            #{diagnosis.tooth_number}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">General</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {diagnosis.diagnoses.map((diag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs mr-1 mb-1">
                              {diag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {(diagnosis.treatments || []).map((treat, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className={`text-xs mr-1 mb-1 ${
                                treat.status === 'completed' ? 'bg-green-50 text-green-700 border-green-300' :
                                treat.status === 'in_progress' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                                'bg-gray-50 text-gray-700 border-gray-300'
                              }`}
                            >
                              {treat.treatment_type}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(diagnosis.priority)}>
                          {diagnosis.priority.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(diagnosis.status)} flex items-center gap-1 w-fit`}>
                          {getStatusIcon(diagnosis.status)}
                          {diagnosis.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-32">
                          {diagnosis.symptoms.length > 0 ? (
                            <div className="space-y-1">
                              {diagnosis.symptoms.slice(0, 2).map((symptom, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs mr-1">
                                  {symptom}
                                </Badge>
                              ))}
                              {diagnosis.symptoms.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{diagnosis.symptoms.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No symptoms</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {diagnosis.appointment ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              {new Date(diagnosis.appointment.scheduled_date).toLocaleDateString()}
                            </div>
                            {diagnosis.appointment.scheduled_time && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-500" />
                                <span className="text-xs">{diagnosis.appointment.scheduled_time}</span>
                              </div>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {diagnosis.appointment.status}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(diagnosis.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {diagnosis.treatments?.some(t => !t.appointment_id && t.status === 'pending') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => scheduleAppointment(diagnosis)}
                              title="Schedule appointment"
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                          )}
                          {diagnosis.appointment && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                router.push(`/dentist?appointmentId=${diagnosis.appointment.id}`)
                              }}
                              title="View appointment"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <AlertTriangle className="w-12 h-12 opacity-50" />
                        <div>
                          <p className="font-medium">No diagnoses found</p>
                          <p className="text-sm">
                            {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                              ? 'Try adjusting your search or filters'
                              : 'No teeth have diagnoses recorded yet'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Footer with Record Count */}
      {filteredAndSortedDiagnoses.length > 0 && (
        <div className="text-sm text-gray-600 text-center py-2">
          Showing {filteredAndSortedDiagnoses.length} of {diagnoses.length} diagnosis records
        </div>
      )}
    </div>
  )
}