'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Eye, Calendar, Clock, DollarSign, Wrench, CheckCircle, AlertCircle, RefreshCw, Plus, Loader2 } from "lucide-react"
import { getPatientTreatmentOverviewAction, getPatientTreatmentStatsAction, type TreatmentWithAppointment } from '@/lib/actions/treatment-overview'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TreatmentOverviewTabLiveProps {
  patientId: string
  consultationId?: string
  data?: any // Current consultation's treatment data
  isReadOnly?: boolean
  onChange?: (data: any) => void
}

export function TreatmentOverviewTabLive({ 
  patientId, 
  consultationId, 
  data, 
  isReadOnly = false,
  onChange 
}: TreatmentOverviewTabLiveProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [treatments, setTreatments] = useState<TreatmentWithAppointment[]>([])
  const [stats, setStats] = useState<any>(null)
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'tooth' | 'date' | 'priority' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Load treatments from database
  const loadTreatments = async () => {
    try {
      setRefreshing(true)
      const [treatmentsResult, statsResult] = await Promise.all([
        getPatientTreatmentOverviewAction(patientId),
        getPatientTreatmentStatsAction(patientId)
      ])

      if (treatmentsResult.success) {
        setTreatments(treatmentsResult.data || [])
      }
      if (statsResult.success) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('Error loading treatments:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (patientId) {
      loadTreatments()
    }
  }, [patientId])

  // Set up real-time subscription
  useEffect(() => {
    if (!patientId) return

    const supabase = createClient()
    
    // Subscribe to treatment changes
    const treatmentsChannel = supabase
      .channel(`treatments-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'treatments',
          filter: `patient_id=eq.${patientId}`
        },
        () => {
          console.log('Treatment update detected, refreshing...')
          loadTreatments()
        }
      )
      .subscribe()

    // Subscribe to appointment changes
    const appointmentsChannel = supabase
      .channel(`appointments-treatments-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'appointments',
          filter: `patient_id=eq.${patientId}`
        },
        () => {
          console.log('Appointment update detected, refreshing...')
          loadTreatments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(treatmentsChannel)
      supabase.removeChannel(appointmentsChannel)
    }
  }, [patientId])

  // Filter and sort treatments
  const filteredAndSortedTreatments = useMemo(() => {
    let filtered = treatments.filter(treatment => {
      // Search filter
      const matchesSearch = 
        treatment.treatment_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        treatment.tooth_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        treatment.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        treatment.tooth_diagnosis?.primary_diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())

      // Status filter
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'pending' && treatment.status === 'pending') ||
        (filterStatus === 'in_progress' && treatment.status === 'in_progress') ||
        (filterStatus === 'completed' && treatment.status === 'completed') ||
        (filterStatus === 'cancelled' && treatment.status === 'cancelled')

      // Priority filter
      const priority = treatment.tooth_diagnosis?.priority || 'medium'
      const matchesPriority = filterPriority === 'all' || priority === filterPriority

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
          const dateA = a.appointment?.scheduled_date 
            ? new Date(`${a.appointment.scheduled_date} ${a.appointment.scheduled_time || '00:00'}`)
            : new Date(a.created_at)
          const dateB = b.appointment?.scheduled_date 
            ? new Date(`${b.appointment.scheduled_date} ${b.appointment.scheduled_time || '00:00'}`)
            : new Date(b.created_at)
          comparison = dateA.getTime() - dateB.getTime()
          break
        case 'priority':
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 }
          const priorityA = priorityOrder[a.tooth_diagnosis?.priority as keyof typeof priorityOrder] || 2
          const priorityB = priorityOrder[b.tooth_diagnosis?.priority as keyof typeof priorityOrder] || 2
          comparison = priorityA - priorityB
          break
        case 'status':
          const statusOrder = { 'completed': 4, 'in_progress': 3, 'pending': 2, 'cancelled': 1 }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [treatments, searchTerm, filterStatus, filterPriority, sortBy, sortOrder])

  const getPriorityColor = (priority?: string) => {
    switch (priority || 'medium') {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-green-100 text-green-800 border-green-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Calendar className="w-3 h-3" />
      case 'in_progress': return <Clock className="w-3 h-3" />
      case 'completed': return <CheckCircle className="w-3 h-3" />
      case 'cancelled': return <AlertCircle className="w-3 h-3" />
      default: return null
    }
  }

  const exportData = () => {
    const csvContent = [
      ['Tooth', 'Treatment', 'Diagnosis', 'Priority', 'Status', 'Scheduled Date', 'Scheduled Time', 'Duration', 'Dentist', 'Notes'],
      ...filteredAndSortedTreatments.map(treatment => [
        treatment.tooth_number || 'General',
        treatment.treatment_type,
        treatment.tooth_diagnosis?.primary_diagnosis || '',
        treatment.tooth_diagnosis?.priority || 'medium',
        treatment.status,
        treatment.appointment?.scheduled_date || 'Not scheduled',
        treatment.appointment?.scheduled_time || '',
        `${treatment.appointment?.duration || 0} minutes`,
        treatment.appointment?.dentist_name || 'Unknown',
        treatment.notes || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `treatment-overview-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const scheduleAppointment = (treatment: TreatmentWithAppointment) => {
    // Navigate to contextual appointment creation with pre-filled data
    const params = new URLSearchParams({
      patientId,
      treatmentId: treatment.id,
      treatmentType: treatment.treatment_type,
      toothNumber: treatment.tooth_number || '',
      consultationId: treatment.consultation_id || ''
    })
    router.push(`/dentist/contextual-appointment?${params.toString()}`)
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
              <Wrench className="w-5 h-5 text-teal-600" />
              Live Treatment Overview
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTreatments()}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              <div className="text-center p-3 bg-teal-50 rounded-lg">
                <div className="text-2xl font-bold text-teal-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Treatments</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.planned}</div>
                <div className="text-sm text-gray-600">Planned</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.totalDuration}</div>
                <div className="text-sm text-gray-600">Total Minutes</div>
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
                  placeholder="Search treatments, teeth, diagnoses..."
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
                    <SelectItem value="pending">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    <SelectItem value="status">Status</SelectItem>
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

      {/* Treatment Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Tooth #</TableHead>
                  <TableHead className="font-semibold">Treatment</TableHead>
                  <TableHead className="font-semibold">Diagnosis</TableHead>
                  <TableHead className="font-semibold">Priority</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Schedule</TableHead>
                  <TableHead className="font-semibold">Duration</TableHead>
                  <TableHead className="font-semibold">Dentist</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTreatments.length > 0 ? (
                  filteredAndSortedTreatments.map((treatment) => (
                    <TableRow key={treatment.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {treatment.tooth_number ? (
                          <Badge variant="outline" className="text-teal-700 border-teal-300">
                            #{treatment.tooth_number}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">General</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                          {treatment.treatment_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {treatment.tooth_diagnosis?.primary_diagnosis || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(treatment.tooth_diagnosis?.priority)}>
                          {(treatment.tooth_diagnosis?.priority || 'medium').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(treatment.status)} flex items-center gap-1 w-fit`}>
                          {getStatusIcon(treatment.status)}
                          {treatment.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {treatment.appointment ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              {new Date(treatment.appointment.scheduled_date).toLocaleDateString()}
                            </div>
                            {treatment.appointment.scheduled_time && (
                              <div className="text-xs text-gray-500">
                                {treatment.appointment.scheduled_time}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {treatment.appointment?.duration || 0} min
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {treatment.appointment?.dentist_name || 'Not assigned'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!treatment.appointment && treatment.status === 'pending' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => scheduleAppointment(treatment)}
                              title="Schedule appointment"
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              if (treatment.appointment_id) {
                                router.push(`/dentist?appointmentId=${treatment.appointment_id}`)
                              }
                            }}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <Wrench className="w-12 h-12 opacity-50" />
                        <div>
                          <p className="font-medium">No treatments found</p>
                          <p className="text-sm">
                            {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                              ? 'Try adjusting your search or filters'
                              : 'No treatment plans have been created yet'}
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
      {filteredAndSortedTreatments.length > 0 && (
        <div className="text-sm text-gray-600 text-center py-2">
          Showing {filteredAndSortedTreatments.length} of {treatments.length} treatment records
        </div>
      )}
    </div>
  )
}