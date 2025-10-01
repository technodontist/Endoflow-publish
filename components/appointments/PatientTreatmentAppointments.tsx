'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Calendar, 
  Clock, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Activity, 
  ArrowRight,
  Stethoscope,
  ClipboardList,
  MessageSquare
} from "lucide-react"
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { FollowUpAppointmentForm } from './FollowUpAppointmentForm'

interface Treatment {
  id: string
  treatment_type: string
  tooth_number?: number
  status: string
  completed_date?: string
  follow_up_required: boolean
  follow_up_status?: string
  tooth_diagnoses?: {
    tooth_number: number
    primary_diagnosis: string
  }
}

interface Appointment {
  id: string
  patient_id: string
  dentist_id: string
  consultation_id?: string
  treatment_id?: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  appointment_type: string
  status: string
  notes?: string
  dentists?: {
    full_name: string
    specialty?: string
  }
  treatments?: Treatment
}

interface PatientTreatmentAppointmentsProps {
  patientId: string
}

export function PatientTreatmentAppointments({ patientId }: PatientTreatmentAppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)

  useEffect(() => {
    loadAppointments()
  }, [patientId])

  const loadAppointments = async () => {
    try {
      const supabase = createClient()
      
      // Load treatment appointments that may need follow-up
      const { data, error } = await supabase
        .schema('api')
        .from('appointments')
        .select(`
          *,
          dentists!inner (
            full_name,
            specialty
          ),
          treatments!treatment_id (
            id,
            treatment_type,
            tooth_number,
            status,
            completed_date,
            follow_up_required,
            follow_up_status,
            tooth_diagnoses!tooth_diagnosis_id (
              tooth_number,
              primary_diagnosis
            )
          )
        `)
        .eq('patient_id', patientId)
        .eq('appointment_type', 'treatment')
        .order('scheduled_date', { ascending: false })
        .limit(20)

      if (error) throw error
      
      setAppointments(data || [])
    } catch (error) {
      console.error('Error loading appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartFollowUp = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setShowFollowUpForm(true)
  }

  const handleFollowUpComplete = () => {
    setShowFollowUpForm(false)
    setSelectedAppointment(null)
    // Reload appointments to show updated status
    loadAppointments()
  }

  const canStartFollowUp = (appointment: Appointment) => {
    // Check if appointment is completed and has treatment data
    if (appointment.status !== 'completed') return false
    if (!appointment.treatments) return false
    
    // Check if follow-up is required and not already completed
    const treatment = appointment.treatments
    if (!treatment.follow_up_required) return false
    if (treatment.follow_up_status === 'completed') return false
    
    // Check if enough time has passed (e.g., at least 1 day after treatment)
    const treatmentDate = new Date(appointment.scheduled_date)
    const today = new Date()
    const daysSinceTreatment = Math.floor((today.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return daysSinceTreatment >= 1
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getFollowUpStatusBadge = (treatment: Treatment | undefined) => {
    if (!treatment?.follow_up_required) return null
    
    if (treatment.follow_up_status === 'completed') {
      return <Badge className="bg-green-100 text-green-800">Follow-up Complete</Badge>
    } else if (treatment.follow_up_status === 'scheduled') {
      return <Badge className="bg-blue-100 text-blue-800">Follow-up Scheduled</Badge>
    } else {
      return <Badge className="bg-orange-100 text-orange-800">Follow-up Pending</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            Treatment Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No treatment appointments found
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div 
                  key={appointment.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-medium text-gray-900">
                              {appointment.treatments?.treatment_type || appointment.appointment_type}
                            </h4>
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </Badge>
                            {appointment.treatments && getFollowUpStatusBadge(appointment.treatments)}
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(appointment.scheduled_date), 'MMM d, yyyy')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {appointment.scheduled_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {appointment.dentists?.full_name}
                            </span>
                          </div>

                          {appointment.treatments?.tooth_diagnoses && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">Tooth #:</span> {appointment.treatments.tooth_diagnoses.tooth_number}
                              <span className="mx-2">•</span>
                              <span className="font-medium">Diagnosis:</span> {appointment.treatments.tooth_diagnoses.primary_diagnosis}
                            </div>
                          )}

                          {appointment.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                              <MessageSquare className="w-4 h-4 inline mr-1" />
                              {appointment.notes}
                            </div>
                          )}
                        </div>

                        {canStartFollowUp(appointment) && (
                          <Button
                            onClick={() => handleStartFollowUp(appointment)}
                            className="bg-teal-600 hover:bg-teal-700"
                            size="sm"
                          >
                            <Stethoscope className="w-4 h-4 mr-2" />
                            Start Follow-up
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Form Dialog */}
      <Dialog open={showFollowUpForm} onOpenChange={setShowFollowUpForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Follow-up Assessment
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <FollowUpAppointmentForm
              appointmentId={selectedAppointment.id}
              patientId={patientId}
              treatmentId={selectedAppointment.treatment_id}
              consultationId={selectedAppointment.consultation_id}
              onComplete={handleFollowUpComplete}
              onCancel={() => setShowFollowUpForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}