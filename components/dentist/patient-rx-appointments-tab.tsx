'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Pill, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

interface PatientRxAppointmentsTabProps {
  appointments: any[]
  prescriptions: any[]
  followUps: any[]
}

const appointmentStatusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-amber-500/10 text-amber-400',
  completed: 'bg-green-500/10 text-green-400',
  cancelled: 'bg-gray-500/10 text-gray-400',
  no_show: 'bg-red-500/10 text-red-400',
}

export function PatientRxAppointmentsTab({
  appointments,
  prescriptions,
  followUps,
}: PatientRxAppointmentsTabProps) {
  // Combine and sort all appointments
  const allAppointments = [...appointments, ...followUps]
    .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i) // deduplicate
    .sort((a, b) => {
      const dateA = new Date(a.scheduled_date || a.scheduledDate || 0)
      const dateB = new Date(b.scheduled_date || b.scheduledDate || 0)
      return dateB.getTime() - dateA.getTime()
    })

  const upcomingAppointments = allAppointments.filter(a =>
    (a.status === 'scheduled' || a.status === 'in_progress') &&
    new Date(a.scheduled_date || a.scheduledDate) >= new Date(new Date().setHours(0, 0, 0, 0))
  )

  const pastAppointments = allAppointments.filter(a =>
    a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show' ||
    new Date(a.scheduled_date || a.scheduledDate) < new Date(new Date().setHours(0, 0, 0, 0))
  )

  // Parse prescriptions from consultation data if not standalone
  const activePrescriptions = prescriptions.filter((p: any) => p.status === 'active')
  const completedPrescriptions = prescriptions.filter((p: any) => p.status !== 'active')

  return (
    <div className="space-y-6">
      {/* Upcoming Appointments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Upcoming Appointments</h3>
          <Badge variant="outline" className="text-xs border-border">{upcomingAppointments.length}</Badge>
        </div>

        {upcomingAppointments.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-8 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {upcomingAppointments.map(appt => (
              <Card key={appt.id} className="border-border border-l-4 border-l-primary">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {appt.appointment_type || appt.appointmentType || 'Appointment'}
                        </span>
                        <Badge className={`text-[10px] border-0 ${appointmentStatusColors[appt.status] || ''}`}>
                          {appt.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(appt.scheduled_date || appt.scheduledDate), 'EEEE, MMM d, yyyy')}
                        {(appt.scheduled_time || appt.scheduledTime) && ` at ${appt.scheduled_time || appt.scheduledTime}`}
                      </p>
                      {appt.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active Medications */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Pill className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-foreground">Active Medications</h3>
          <Badge variant="outline" className="text-xs border-border">{activePrescriptions.length}</Badge>
        </div>

        {activePrescriptions.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-6 text-center">
              <Pill className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No active medications</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {activePrescriptions.map((rx: any) => (
              <Card key={rx.id} className="border-border border-l-4 border-l-green-500">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{rx.medication_name || rx.medicationName}</p>
                      <p className="text-xs text-muted-foreground">
                        {rx.dosage} — {rx.frequency}
                        {rx.duration_days && ` for ${rx.duration_days} days`}
                      </p>
                      {rx.instructions && (
                        <p className="text-xs text-muted-foreground mt-0.5">{rx.instructions}</p>
                      )}
                    </div>
                    <Badge className="bg-green-500/10 text-green-400 border-0 text-[10px]">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Past Appointments</h3>
            <Badge variant="outline" className="text-xs border-border">{pastAppointments.length}</Badge>
          </div>

          <div className="space-y-2">
            {pastAppointments.slice(0, 10).map(appt => (
              <Card key={appt.id} className="border-border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">
                          {appt.appointment_type || appt.appointmentType || 'Appointment'}
                        </span>
                        <Badge className={`text-[10px] border-0 ${appointmentStatusColors[appt.status] || ''}`}>
                          {appt.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(appt.scheduled_date || appt.scheduledDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {pastAppointments.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">
                + {pastAppointments.length - 10} more past appointments
              </p>
            )}
          </div>
        </div>
      )}

      {/* Completed Medications */}
      {completedPrescriptions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Past Medications</h3>
            <Badge variant="outline" className="text-xs border-border">{completedPrescriptions.length}</Badge>
          </div>

          <div className="space-y-2">
            {completedPrescriptions.slice(0, 5).map((rx: any) => (
              <Card key={rx.id} className="border-border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{rx.medication_name || rx.medicationName}</p>
                      <p className="text-xs text-muted-foreground">{rx.dosage} — {rx.frequency}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-border">{rx.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
