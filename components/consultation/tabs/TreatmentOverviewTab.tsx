'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Eye, Calendar, Clock, DollarSign, Wrench, CheckCircle, AlertCircle, RefreshCw, Plus } from "lucide-react"
import { getPatientTreatmentOverviewAction, getPatientTreatmentStatsAction, type TreatmentWithAppointment } from '@/lib/actions/treatment-overview'
import { useRouter } from 'next/navigation'
import { createAppointmentRequestFromConsultationAction } from '@/lib/actions/consultation'

interface TreatmentRecord {
  toothNumber: string
  treatments: string[]
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'on-hold'
  scheduledDate: string
  estimatedCost: string
  duration: string
  clinicianName: string
  treatmentDetails: string
  followUpRequired: boolean
  lastUpdated: string
}

interface TreatmentOverviewTabProps {
  data: {
    [toothNumber: string]: {
      selectedTreatments: string[]
      treatmentDetails: string
      priority: string
      estimatedCost: string
      duration: string
      scheduledDate: string
      treatmentNotes: string
      followUpRequired: boolean
    }
  }
  consultationData?: {
    clinicianName?: string
    patientName?: string
    consultationDate?: string
  }
  // Optional: include historical treatments across consultations
  history?: Array<{
    toothNumber: string
    treatments: string[]
    diagnosisDate: string
    clinicianName?: string
    status?: string
  }>
  // Optional: prognosis capture for the consultation
  extraDefaults?: {
    prognosis?: string
  }
  onChange?: (data: any) => void
  isReadOnly?: boolean
  showHistory?: boolean
}

export function TreatmentOverviewTab({ data, consultationData, history = [], extraDefaults, onChange, isReadOnly = false, showHistory = true }: TreatmentOverviewTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'tooth' | 'date' | 'priority' | 'cost'>('tooth')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

// Transform consultation data into treatment records
  const currentRecords: TreatmentRecord[] = useMemo(() => {
    return Object.entries(data)
      .filter(([_, toothData]) => (toothData.selectedTreatments || []).length > 0)
      .map(([toothNumber, toothData]) => ({
        toothNumber,
        treatments: toothData.selectedTreatments,
        priority: (toothData.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
        status: toothData.scheduledDate ? 'planned' : 'planned',
        scheduledDate: toothData.scheduledDate || '',
        estimatedCost: toothData.estimatedCost || '0',
        duration: toothData.duration || '60',
        clinicianName: consultationData?.clinicianName || 'Dr. Current',
        treatmentDetails: toothData.treatmentDetails || '',
        followUpRequired: toothData.followUpRequired || false,
        lastUpdated: new Date().toISOString().split('T')[0]
      }))
  }, [data, consultationData])

  // Historical records derived from history prop
  const historicalRecords: TreatmentRecord[] = useMemo(() => {
    if (!showHistory) return []
    return (history || []).map(h => ({
      toothNumber: h.toothNumber,
      treatments: h.treatments || [],
      priority: 'medium',
      status: 'completed',
      scheduledDate: '',
      estimatedCost: '0',
      duration: '0',
      clinicianName: h.clinicianName || 'Dr. (past)',
      treatmentDetails: '',
      followUpRequired: false,
      lastUpdated: h.diagnosisDate
    }))
  }, [history, showHistory])

  const treatmentRecords: TreatmentRecord[] = useMemo(() => {
    return [...historicalRecords, ...currentRecords]
  }, [historicalRecords, currentRecords])

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = treatmentRecords.filter(record => {
      const matchesSearch =
        record.toothNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.treatments.some(treatment => treatment.toLowerCase().includes(searchTerm.toLowerCase())) ||
        record.treatmentDetails.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = filterStatus === 'all' || record.status === filterStatus
      const matchesPriority = filterPriority === 'all' || record.priority === filterPriority

      return matchesSearch && matchesStatus && matchesPriority
    })

    // Sort records
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'tooth':
          comparison = parseInt(a.toothNumber) - parseInt(b.toothNumber)
          break
        case 'date':
          const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0
          const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0
          comparison = dateA - dateB
          break
        case 'priority':
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'cost':
          const costA = parseFloat(a.estimatedCost) || 0
          const costB = parseFloat(b.estimatedCost) || 0
          comparison = costA - costB
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [treatmentRecords, searchTerm, filterStatus, filterPriority, sortBy, sortOrder])

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
      case 'planned': return 'bg-blue-100 text-blue-800'
      case 'in-progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'on-hold': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Calendar className="w-3 h-3" />
      case 'in-progress': return <Clock className="w-3 h-3" />
      case 'completed': return <CheckCircle className="w-3 h-3" />
      case 'cancelled': return <AlertCircle className="w-3 h-3" />
      case 'on-hold': return <Clock className="w-3 h-3" />
      default: return null
    }
  }

  const getTotalCost = () => {
    return filteredAndSortedRecords.reduce((total, record) => {
      return total + (parseFloat(record.estimatedCost) || 0)
    }, 0)
  }

  const getTotalDuration = () => {
    return filteredAndSortedRecords.reduce((total, record) => {
      return total + (parseInt(record.duration) || 0)
    }, 0)
  }

  const exportData = () => {
    const csvContent = [
      ['Tooth', 'Treatments', 'Priority', 'Status', 'Scheduled Date', 'Duration', 'Cost', 'Clinician', 'Follow-up Required', 'Notes'],
      ...filteredAndSortedRecords.map(record => [
        record.toothNumber,
        record.treatments.join('; '),
        record.priority,
        record.status,
        record.scheduledDate || 'Not scheduled',
        `${record.duration} minutes`,
        `$${record.estimatedCost}`,
        record.clinicianName,
        record.followUpRequired ? 'Yes' : 'No',
        record.treatmentDetails
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `treatment-plan-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Prognosis input (optional)
  const [prognosis, setPrognosis] = useState(extraDefaults?.prognosis || '')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consultation-level Prognosis (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="e.g., Good/Fair/Poor with rationale"
            value={prognosis}
            disabled={isReadOnly}
            onChange={(e) => {
              setPrognosis(e.target.value)
              onChange?.({ prognosis: e.target.value })
            }}
          />
        </CardContent>
      </Card>
      {/* Header with Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-teal-600" />
            Treatment Plan Overview - Tabular View
          </CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="text-center p-3 bg-teal-50 rounded-lg">
              <div className="text-2xl font-bold text-teal-600">{treatmentRecords.length}</div>
              <div className="text-sm text-gray-600">Total Treatments</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {treatmentRecords.filter(r => r.status === 'planned').length}
              </div>
              <div className="text-sm text-gray-600">Planned</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {treatmentRecords.filter(r => r.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">${getTotalCost().toFixed(2)}</div>
              <div className="text-sm text-gray-600">Total Cost</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{getTotalDuration()}</div>
              <div className="text-sm text-gray-600">Total Minutes</div>
            </div>
          </div>
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
                  placeholder="Search treatments, teeth, notes..."
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
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
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
                    <SelectItem value="cost">Cost</SelectItem>
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
                  <TableHead className="font-semibold">Treatments</TableHead>
                  <TableHead className="font-semibold">Priority</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Schedule</TableHead>
                  <TableHead className="font-semibold">Duration</TableHead>
                  <TableHead className="font-semibold">Cost</TableHead>
                  <TableHead className="font-semibold">Follow-up</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRecords.length > 0 ? (
                  filteredAndSortedRecords.map((record, index) => (
                    <TableRow key={`${record.toothNumber}-${index}`} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="text-teal-700 border-teal-300">
                          #{record.toothNumber}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {record.treatments.map((treatment, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs mr-1 mb-1 bg-teal-100 text-teal-800">
                              {treatment}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(record.priority)}>
                          {record.priority.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(record.status)} flex items-center gap-1 w-fit`}>
                          {getStatusIcon(record.status)}
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.scheduledDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-500" />
                            {new Date(record.scheduledDate).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-gray-400">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {record.duration} min
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-gray-500" />
                          {record.estimatedCost || '0'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.followUpRequired ? (
                          <Badge variant="outline" className="text-blue-700 border-blue-300">
                            Required
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Calendar className="w-4 h-4" />
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
                          <p className="font-medium">No treatments planned</p>
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

      {/* Footer with Record Count and Summary */}
      {filteredAndSortedRecords.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>
                Showing {filteredAndSortedRecords.length} of {treatmentRecords.length} treatment records
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium">Total: ${getTotalCost().toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Duration: {Math.floor(getTotalDuration() / 60)}h {getTotalDuration() % 60}m</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}