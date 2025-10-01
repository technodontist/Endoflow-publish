'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Eye, Calendar, Clock, AlertTriangle, CheckCircle, RefreshCw, Activity, TrendingUp, Users } from "lucide-react"
import { getPatientFollowUpOverviewAction, getPatientFollowUpStatsAction, type FollowUpWithAppointment } from '@/lib/actions/followup-overview'

interface FollowUpOverviewTabProps {
  patientId: string
  consultationData?: {
    patientName?: string
    consultationDate?: string
  }
  isReadOnly?: boolean
}

export function FollowUpOverviewTab({ patientId, consultationData, isReadOnly = false }: FollowUpOverviewTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterAssessmentStatus, setFilterAssessmentStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'tooth' | 'treatment' | 'assessment'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isLoading, setIsLoading] = useState(true)
  const [followUps, setFollowUps] = useState<FollowUpWithAppointment[]>([])
  const [stats, setStats] = useState<any>(null)

  // Load follow-up data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [followUpResult, statsResult] = await Promise.all([
          getPatientFollowUpOverviewAction(patientId),
          getPatientFollowUpStatsAction(patientId)
        ])

        if (followUpResult.success && followUpResult.data) {
          setFollowUps(followUpResult.data)
        }

        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data)
        }
      } catch (error) {
        console.error('Error loading follow-up data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [patientId])

  const getAssessmentStatus = (followUp: FollowUpWithAppointment): 'completed' | 'pending' | 'overdue' => {
    // Check if we have assessment data in notes
    if (followUp.notes && typeof followUp.notes === 'string') {
      try {
        const notesData = JSON.parse(followUp.notes)
        if (notesData.follow_up_assessment) {
          return 'completed'
        }
      } catch {}
    }

    const today = new Date().toISOString().split('T')[0]
    const scheduledDate = followUp.scheduled_date

    if (scheduledDate < today && followUp.status !== 'completed') {
      return 'overdue'
    }

    return 'pending'
  }

  // Filter and sort follow-ups
  const filteredAndSortedFollowUps = useMemo(() => {
    let filtered = followUps.filter(followUp => {
      const matchesSearch =
        (followUp.linked_teeth?.some(t => t.tooth_number.includes(searchTerm.toLowerCase())) ||
        followUp.parent_treatment?.treatment_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        followUp.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        followUp.dentist_name?.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = filterStatus === 'all' || followUp.status === filterStatus

      const assessmentStatus = getAssessmentStatus(followUp)
      const matchesAssessmentStatus = filterAssessmentStatus === 'all' || assessmentStatus === filterAssessmentStatus

      return matchesSearch && matchesStatus && matchesAssessmentStatus
    })

    // Sort follow-ups
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'date':
          const dateA = new Date(`${a.scheduled_date} ${a.scheduled_time || '00:00'}`).getTime()
          const dateB = new Date(`${b.scheduled_date} ${b.scheduled_time || '00:00'}`).getTime()
          comparison = dateA - dateB
          break
        case 'tooth':
          const teethA = a.linked_teeth?.map(t => parseInt(t.tooth_number)).sort((x, y) => x - y)[0] || 0
          const teethB = b.linked_teeth?.map(t => parseInt(t.tooth_number)).sort((x, y) => x - y)[0] || 0
          comparison = teethA - teethB
          break
        case 'treatment':
          const treatmentA = a.parent_treatment?.treatment_type || ''
          const treatmentB = b.parent_treatment?.treatment_type || ''
          comparison = treatmentA.localeCompare(treatmentB)
          break
        case 'assessment':
          const assessmentA = getAssessmentStatus(a)
          const assessmentB = getAssessmentStatus(b)
          comparison = assessmentA.localeCompare(assessmentB)
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [followUps, searchTerm, filterStatus, filterAssessmentStatus, sortBy, sortOrder])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'no_show': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getAssessmentStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="w-3 h-3" />
      case 'confirmed': return <CheckCircle className="w-3 h-3" />
      case 'in_progress': return <RefreshCw className="w-3 h-3" />
      case 'completed': return <CheckCircle className="w-3 h-3" />
      case 'cancelled': return <AlertTriangle className="w-3 h-3" />
      default: return null
    }
  }

  const getAssessmentIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-3 h-3" />
      case 'pending': return <Clock className="w-3 h-3" />
      case 'overdue': return <AlertTriangle className="w-3 h-3" />
      default: return null
    }
  }

  const formatTimelineDescription = (followUp: FollowUpWithAppointment) => {
    if (followUp.timeline_description) {
      return followUp.timeline_description
    }

    if (followUp.parent_treatment) {
      return `Follow-up for ${followUp.parent_treatment.treatment_type}`
    }

    return 'Follow-up appointment'
  }

  const exportData = () => {
    const csvContent = [
      ['Date', 'Time', 'Tooth Number', 'Treatment Type', 'Appointment Status', 'Assessment Status', 'Timeline', 'Dentist'],
      ...filteredAndSortedFollowUps.map(followUp => [
        followUp.scheduled_date,
        followUp.scheduled_time || 'Not specified',
        followUp.linked_teeth?.map(t => t.tooth_number).join(', ') || 'Multiple/General',
        followUp.parent_treatment?.treatment_type || 'General Follow-up',
        followUp.status,
        getAssessmentStatus(followUp),
        formatTimelineDescription(followUp),
        followUp.dentist_name || 'Unknown'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `follow-up-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
              <span className="ml-2">Loading follow-up history...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            Follow-up Appointment History
          </CardTitle>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              <div className="text-center p-3 bg-teal-50 rounded-lg">
                <div className="text-2xl font-bold text-teal-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Follow-ups</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
                <div className="text-sm text-gray-600">Scheduled</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <div className="text-sm text-gray-600">Overdue</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.upcoming_week}</div>
                <div className="text-sm text-gray-600">This Week</div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search tooth numbers, treatments, dentist..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-3">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Appointment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Appointments</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterAssessmentStatus} onValueChange={setFilterAssessmentStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Assessment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assessments</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="tooth">Tooth #</SelectItem>
                    <SelectItem value="treatment">Treatment</SelectItem>
                    <SelectItem value="assessment">Assessment</SelectItem>
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

      {/* Follow-up Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Tooth #</TableHead>
                  <TableHead className="font-semibold">Treatment Type</TableHead>
                  <TableHead className="font-semibold">Timeline</TableHead>
                  <TableHead className="font-semibold">Appointment Status</TableHead>
                  <TableHead className="font-semibold">Assessment Status</TableHead>
                  <TableHead className="font-semibold">Dentist</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedFollowUps.length > 0 ? (
                  filteredAndSortedFollowUps.map((followUp) => (
                    <TableRow key={followUp.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Calendar className="w-3 h-3 text-gray-500" />
                            {new Date(followUp.scheduled_date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {followUp.scheduled_time || 'Time not set'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {followUp.linked_teeth && followUp.linked_teeth.length > 0 ? (
                            followUp.linked_teeth.map((tooth, idx) => (
                              <Badge key={idx} variant="outline" className="text-teal-700 border-teal-300 text-xs">
                                #{tooth.tooth_number}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">Multiple/General</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {followUp.parent_treatment?.treatment_type ? (
                          <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                            {followUp.parent_treatment.treatment_type}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">General Follow-up</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTimelineDescription(followUp)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(followUp.status)} flex items-center gap-1 w-fit`}>
                          {getStatusIcon(followUp.status)}
                          {followUp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const assessmentStatus = getAssessmentStatus(followUp)
                          return (
                            <Badge className={`${getAssessmentStatusColor(assessmentStatus)} flex items-center gap-1 w-fit`}>
                              {getAssessmentIcon(assessmentStatus)}
                              {assessmentStatus}
                            </Badge>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-gray-500" />
                          {followUp.dentist_name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {followUp.status !== 'completed' && getAssessmentStatus(followUp) !== 'completed' && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Activity className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <Activity className="w-12 h-12 opacity-50" />
                        <div>
                          <p className="font-medium">No follow-up appointments found</p>
                          <p className="text-sm">
                            {searchTerm || filterStatus !== 'all' || filterAssessmentStatus !== 'all'
                              ? 'Try adjusting your search or filters'
                              : 'No follow-up appointments have been scheduled yet'}
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

      {/* Footer with Record Count and Summary */}
      {filteredAndSortedFollowUps.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>
                Showing {filteredAndSortedFollowUps.length} of {followUps.length} follow-up appointments
              </div>
              {stats && (
                <div className="flex gap-6">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Completed: {stats.completed}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Overdue: {stats.overdue}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}