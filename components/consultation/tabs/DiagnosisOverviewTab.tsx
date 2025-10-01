'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Eye, AlertTriangle, Calendar, FileText } from "lucide-react"

interface DiagnosisRecord {
  toothNumber: string
  diagnoses: string[]
  treatments: string[]
  priority: 'low' | 'medium' | 'high' | 'urgent'
  diagnosisDate: string
  clinicianName: string
  diagnosisDetails: string
  symptoms: string[]
  status: 'active' | 'resolved' | 'monitoring' | 'referred'
  lastUpdated: string
}

interface DiagnosisOverviewTabProps {
  data: {
    [toothNumber: string]: {
      selectedDiagnoses: string[]
      diagnosisDetails: string
      examinationDate: string
      symptoms: string[]
      diagnosticNotes: string
      priority: string
      currentStatus: string
      selectedTreatments?: string[]
    }
  }
  consultationData?: {
    clinicianName?: string
    patientName?: string
    consultationDate?: string
  }
  history?: Array<{
    toothNumber: string
    diagnoses: string[]
    treatments: string[]
    diagnosisDate: string
    clinicianName?: string
    status?: string
  }>
  // Optional: show consultation-level diagnosis inputs
  extraDefaults?: {
    provisional?: string
    differential?: string
    final?: string
  }
  onChange?: (data: any) => void
  isReadOnly?: boolean
  showHistory?: boolean
}

export function DiagnosisOverviewTab({ data, consultationData, history = [], extraDefaults, onChange, isReadOnly = false, showHistory = true }: DiagnosisOverviewTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'tooth' | 'date' | 'priority'>('tooth')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

// Transform consultation data into diagnosis records (current session)
  const currentRecords: DiagnosisRecord[] = useMemo(() => {
    return Object.entries(data || {})
      .filter(([_, toothData]: any) => {
        const selected = (toothData?.selectedDiagnoses ?? toothData?.diagnoses ?? [])
        if (Array.isArray(selected)) return selected.length > 0
        if (typeof selected === 'string') return selected.trim().length > 0
        return false
      })
      .map(([toothNumber, toothData]: any) => {
        // Normalize selected diagnoses array safely
        let diagnoses: string[] = []
        const raw = toothData?.selectedDiagnoses ?? toothData?.diagnoses ?? []
        if (Array.isArray(raw)) diagnoses = raw
        else if (typeof raw === 'string') diagnoses = raw.split(',').map((s: string) => s.trim()).filter(Boolean)

        const treatments: string[] = Array.isArray(toothData?.selectedTreatments)
          ? toothData.selectedTreatments
          : (typeof toothData?.treatments === 'string'
              ? toothData.treatments.split(',').map((s: string) => s.trim()).filter(Boolean)
              : (toothData?.treatments || []))

        return ({
          toothNumber,
          diagnoses,
          treatments,
          priority: (toothData?.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
          diagnosisDate: toothData?.examinationDate || new Date().toISOString().split('T')[0],
          clinicianName: consultationData?.clinicianName || 'Dr. Current',
          diagnosisDetails: toothData?.diagnosisDetails || '',
          symptoms: toothData?.symptoms || [],
          status: (() => {
            const cs = (toothData?.currentStatus || 'healthy') as string
            const resolvedSet = new Set(['filled','crown','root_canal','implant','missing'])
            if (cs === 'healthy') return 'resolved'
            if (resolvedSet.has(cs)) return 'resolved'
            return 'active'
          })(),
          lastUpdated: new Date().toISOString().split('T')[0]
        })
      })
  }, [data, consultationData])

  // Transform historical records
  const historicalRecords: DiagnosisRecord[] = useMemo(() => {
    if (!showHistory) return []
    return (history || []).map((h) => ({
      toothNumber: h.toothNumber,
      diagnoses: h.diagnoses || [],
      treatments: h.treatments || [],
      priority: 'medium',
      diagnosisDate: h.diagnosisDate,
      clinicianName: h.clinicianName || 'Dr. (past)',
      diagnosisDetails: '',
      symptoms: [],
      status: (h.status && h.status !== 'healthy') ? 'active' : 'resolved',
      lastUpdated: h.diagnosisDate
    }))
  }, [history, showHistory])

  const diagnosisRecords: DiagnosisRecord[] = useMemo(() => {
    return [...historicalRecords, ...currentRecords]
  }, [historicalRecords, currentRecords])

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = diagnosisRecords.filter(record => {
      const matchesSearch =
        record.toothNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.diagnoses.some(diagnosis => diagnosis.toLowerCase().includes(searchTerm.toLowerCase())) ||
        record.symptoms.some(symptom => symptom.toLowerCase().includes(searchTerm.toLowerCase()))

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
          comparison = new Date(a.diagnosisDate).getTime() - new Date(b.diagnosisDate).getTime()
          break
        case 'priority':
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [diagnosisRecords, searchTerm, filterStatus, filterPriority, sortBy, sortOrder])

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

  const exportData = () => {
const csvContent = [
      ['Tooth', 'Diagnoses', 'Treatments', 'Priority', 'Status', 'Date', 'Symptoms', 'Clinician', 'Notes'],
      ...filteredAndSortedRecords.map(record => [
        record.toothNumber,
        record.diagnoses.join('; '),
        (record.treatments || []).join('; '),
        record.priority,
        record.status,
        record.diagnosisDate,
        record.symptoms.join('; '),
        record.clinicianName,
        record.diagnosisDetails
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


  return (
    <div className="space-y-6">
      {/* Header with Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Diagnosis Overview - Tabular View
          </CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{diagnosisRecords.length}</div>
              <div className="text-sm text-gray-600">Total Teeth with Diagnoses</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {diagnosisRecords.filter(r => r.priority === 'urgent' || r.priority === 'high').length}
              </div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {diagnosisRecords.filter(r => r.status === 'resolved').length}
              </div>
              <div className="text-sm text-gray-600">Resolved</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {diagnosisRecords.filter(r => r.status === 'active').length}
              </div>
              <div className="text-sm text-gray-600">Active</div>
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
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Clinician</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRecords.length > 0 ? (
                  filteredAndSortedRecords.map((record, index) => (
                    <TableRow key={`${record.toothNumber}-${index}`} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          #{record.toothNumber}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {record.diagnoses.map((diagnosis, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs mr-1 mb-1">
                              {diagnosis}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {(record.treatments || []).map((treat, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs mr-1 mb-1">
                              {treat}
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
                        <Badge className={getStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-32">
                          {record.symptoms.length > 0 ? (
                            <div className="space-y-1">
                              {record.symptoms.slice(0, 2).map((symptom, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs mr-1">
                                  {symptom}
                                </Badge>
                              ))}
                              {record.symptoms.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{record.symptoms.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No symptoms</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(record.diagnosisDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.clinicianName}
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
                    <TableCell colSpan={8} className="text-center py-8">
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
      {filteredAndSortedRecords.length > 0 && (
        <div className="text-sm text-gray-600 text-center py-2">
          Showing {filteredAndSortedRecords.length} of {diagnosisRecords.length} diagnosis records
        </div>
      )}
    </div>
  )
}