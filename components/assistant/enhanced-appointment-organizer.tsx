'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Calendar, 
  Clock, 
  User, 
  Search, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  Users,
  CalendarDays,
  Phone,
  Mail,
  X,
  Loader2
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import {
  getAppointmentRequestsAction,
  confirmAppointmentRequestAction
} from '@/lib/actions/appointments'
import ContextualAppointmentForm from '@/components/appointments/ContextualAppointmentForm'
import PatientSearch from '@/components/shared/PatientSearch'
import { format } from 'date-fns'

interface AppointmentRequest {
  id: string
  patient_id: string
  appointment_type: string
  reason_for_visit: string
  preferred_date: string
  preferred_time: string
  pain_level?: number
  additional_notes?: string
  status: string
  created_at: string
  patients?: {
    first_name: string
    last_name: string
    phone?: string
    email?: string
  }
}

interface Dentist {
  id: string
  full_name: string
  specialty?: string
}

interface AssistantAppointmentOrganizerProps {
  currentAssistantId: string
}

export function EnhancedAssistantAppointmentOrganizer({ currentAssistantId }: AssistantAppointmentOrganizerProps) {
  const [activeTab, setActiveTab] = useState('pending')
  const [pendingRequests, setPendingRequests] = useState<AppointmentRequest[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [selectedRequest, setSelectedRequest] = useState<AppointmentRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmForm, setConfirmForm] = useState({
    dentistId: '',
    scheduledDate: '',
    scheduledTime: '',
    durationMinutes: 60,
    notes: ''
  })
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmResult, setConfirmResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  
  // Contextual appointment state
  const [showContextualBooking, setShowContextualBooking] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadPendingRequests()
    loadDentists()
  }, [])

  useEffect(() => {
    // Set up real-time subscription for appointment requests
    const channel = supabase
      .channel('assistant-appointment-organizer')
      .on('postgres_changes',
        { event: '*', schema: 'api', table: 'appointment_requests' },
        () => {
          loadPendingRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadPendingRequests = async () => {
    setIsLoading(true)
    try {
      const result = await getAppointmentRequestsAction()
      if (result.success && result.data) {
        setPendingRequests(result.data)
      }
    } catch (error) {
      console.error('Error loading pending requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadDentists = async () => {
    try {
      const { data, error } = await supabase
        .schema('api')
        .from('dentists')
        .select('id, full_name, specialty')
        .order('full_name')

      if (error) {
        console.error('Error loading dentists:', error)
        return
      }

      setDentists(data || [])
    } catch (error) {
      console.error('Error loading dentists:', error)
    }
  }

  const handleConfirmRequest = async (request: AppointmentRequest) => {
    setSelectedRequest(request)
    setConfirmForm({
      dentistId: '',
      scheduledDate: request.preferred_date,
      scheduledTime: request.preferred_time,
      durationMinutes: 60,
      notes: request.additional_notes || ''
    })
    setShowConfirmDialog(true)
    setConfirmResult(null)
  }

  const submitConfirmation = async () => {
    if (!selectedRequest || !confirmForm.dentistId || !confirmForm.scheduledDate || !confirmForm.scheduledTime) {
      setConfirmResult({
        success: false,
        error: 'Please fill in all required fields'
      })
      return
    }

    setIsConfirming(true)
    setConfirmResult(null)

    try {
      const result = await confirmAppointmentRequestAction(
        selectedRequest.id,
        {
          dentistId: confirmForm.dentistId,
          assistantId: currentAssistantId,
          scheduledDate: confirmForm.scheduledDate,
          scheduledTime: confirmForm.scheduledTime,
          durationMinutes: confirmForm.durationMinutes,
          notes: confirmForm.notes
        },
        currentAssistantId
      )

      if (result.success) {
        setConfirmResult({
          success: true,
          message: 'Appointment confirmed successfully!'
        })
        
        // Refresh the pending requests
        await loadPendingRequests()
        
        // Close dialog after delay
        setTimeout(() => {
          setShowConfirmDialog(false)
          setSelectedRequest(null)
          setConfirmResult(null)
        }, 2000)
      } else {
        setConfirmResult({
          success: false,
          error: result.error || 'Failed to confirm appointment'
        })
      }
    } catch (error) {
      console.error('Error confirming appointment:', error)
      setConfirmResult({
        success: false,
        error: 'An unexpected error occurred'
      })
    } finally {
      setIsConfirming(false)
    }
  }

  const filteredRequests = pendingRequests.filter(request => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    const patientName = `${request.patients?.first_name || ''} ${request.patients?.last_name || ''}`.toLowerCase()
    return patientName.includes(searchLower) || 
           request.appointment_type.toLowerCase().includes(searchLower) ||
           request.reason_for_visit.toLowerCase().includes(searchLower)
  })

  const getPriorityColor = (painLevel?: number, createdAt?: string) => {
    if (painLevel && painLevel >= 8) return 'bg-red-100 text-red-800 border-red-200'
    if (painLevel && painLevel >= 6) return 'bg-orange-100 text-orange-800 border-orange-200'
    
    // Check if request is older than 24 hours
    if (createdAt) {
      const requestDate = new Date(createdAt)
      const hoursSince = (Date.now() - requestDate.getTime()) / (1000 * 60 * 60)
      if (hoursSince > 24) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Appointment Organizer</h2>
          <p className="text-gray-600">Schedule pending appointments from patient requests and dentist referrals</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {pendingRequests.length} pending appointments
          </Badge>
          <Dialog open={showContextualBooking} onOpenChange={setShowContextualBooking}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                  Create New Appointment
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {!selectedPatientId ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Search for Patient</h4>
                    <PatientSearch onPatientSelect={(patientId) => setSelectedPatientId(patientId)} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Create Contextual Appointment</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedPatientId('')}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Change Patient
                      </Button>
                    </div>
                    <ContextualAppointmentForm 
                      patientId={selectedPatientId}
                      onSuccess={() => {
                        setSelectedPatientId('')
                        setShowContextualBooking(false)
                      }}
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Pending Requests ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Patient Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search requests by patient or procedure..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Pending Requests List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Loading requests...</p>
                </div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card className="p-8 text-center">
                <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Requests</h3>
                <p className="text-gray-500">All appointment requests have been processed.</p>
              </Card>
            ) : (
              filteredRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {request.patients?.first_name} {request.patients?.last_name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Patient ID: {request.patient_id.substring(0, 8)}...
                            </p>
                          </div>
                          <Badge className={getPriorityColor(request.pain_level, request.created_at)}>
                            {request.pain_level && request.pain_level >= 8 ? 'Emergency' :
                             request.pain_level && request.pain_level >= 6 ? 'Urgent' : 'Routine'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <Label className="text-xs text-gray-500">Appointment Type</Label>
                            <p className="font-medium">{request.appointment_type}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Preferred Date</Label>
                            <p className="font-medium">
                              {format(new Date(request.preferred_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Preferred Time</Label>
                            <p className="font-medium">{request.preferred_time}</p>
                          </div>
                          {request.pain_level !== undefined && (
                            <div>
                              <Label className="text-xs text-gray-500">Pain Level</Label>
                              <p className="font-medium">{request.pain_level}/10</p>
                            </div>
                          )}
                        </div>

                        {request.reason_for_visit && (
                          <div className="mb-4">
                            <Label className="text-xs text-gray-500">Reason for Visit</Label>
                            <p className="text-sm text-gray-700">{request.reason_for_visit}</p>
                          </div>
                        )}

                        {request.patients?.phone && (
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {request.patients.phone}
                            </span>
                            {request.patients?.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {request.patients.email}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <Button 
                        className="bg-teal-600 hover:bg-teal-700"
                        onClick={() => handleConfirmRequest(request)}
                      >
                        Schedule Appointment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search and Schedule</CardTitle>
              <CardDescription>
                Search for any patient to schedule a new appointment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatientSearch 
                onPatientSelect={(patientId) => {
                  setSelectedPatientId(patientId)
                  setShowContextualBooking(true)
                }}
                placeholder="Search patients by name or ID..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-teal-600" />
              Schedule Appointment
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {confirmResult && (
                <Alert className={confirmResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <div className="flex items-center gap-2">
                    {confirmResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                    <AlertDescription className={confirmResult.success ? 'text-green-800' : 'text-red-800'}>
                      {confirmResult.success ? confirmResult.message : confirmResult.error}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Patient Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Patient Information</h4>
                <p className="text-sm text-gray-600">
                  <strong>{selectedRequest.patients?.first_name} {selectedRequest.patients?.last_name}</strong><br />
                  {selectedRequest.appointment_type} • {selectedRequest.reason_for_visit}
                  {selectedRequest.pain_level && (
                    <span className="ml-2 text-red-600">Pain Level: {selectedRequest.pain_level}/10</span>
                  )}
                </p>
              </div>

              {/* Scheduling Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dentist">Assign Dentist *</Label>
                  <Select value={confirmForm.dentistId} onValueChange={(value) => setConfirmForm(prev => ({ ...prev, dentistId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dentist" />
                    </SelectTrigger>
                    <SelectContent>
                      {dentists.map((dentist) => (
                        <SelectItem key={dentist.id} value={dentist.id}>
                          <div>
                            <div className="font-medium">{dentist.full_name}</div>
                            {dentist.specialty && (
                              <div className="text-xs text-gray-500">{dentist.specialty}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Select 
                    value={confirmForm.durationMinutes.toString()} 
                    onValueChange={(value) => setConfirmForm(prev => ({ ...prev, durationMinutes: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Scheduled Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={confirmForm.scheduledDate}
                    onChange={(e) => setConfirmForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Scheduled Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={confirmForm.scheduledTime}
                    onChange={(e) => setConfirmForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any special notes or instructions..."
                  value={confirmForm.notes}
                  onChange={(e) => setConfirmForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={submitConfirmation}
                  disabled={isConfirming || !confirmForm.dentistId || !confirmForm.scheduledDate || !confirmForm.scheduledTime}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Appointment
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isConfirming}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}