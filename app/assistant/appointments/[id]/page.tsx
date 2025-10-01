export const dynamic = 'force-dynamic'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getAppointmentRequestDetails, getAvailableDentists } from "@/lib/db/queries"
import { Calendar, Clock, User, AlertCircle, FileText, Phone, Mail } from "lucide-react"
import Link from "next/link"
import { AppointmentBookingForm } from "@/components/appointment-booking-form"
import { notFound } from "next/navigation"

interface AppointmentRequestDetailsProps {
  params: Promise<{ id: string }>
}

export default async function AppointmentRequestDetails({ params }: AppointmentRequestDetailsProps) {
  const { id } = await params

  const [request, availableDentists] = await Promise.all([
    getAppointmentRequestDetails(id),
    getAvailableDentists()
  ])

  if (!request) {
    notFound()
  }

  const patient = (request as any).profiles
  const painLevel = request.painLevel || 0
  const painLevelColor = painLevel >= 7 ? 'text-red-600' :
                         painLevel >= 4 ? 'text-yellow-600' :
                         'text-green-600'

  const urgencyLevel = painLevel >= 7 ? 'HIGH' :
                       painLevel >= 4 ? 'MEDIUM' :
                       'LOW'

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Appointment Request Details</h1>
              <p className="text-gray-600 mt-1">Review and book appointment for patient</p>
            </div>
            <Link href="/assistant">
              <Button variant="outline">
                ← Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Patient Info & Request Details */}
          <div className="space-y-6">
            {/* Patient Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="font-semibold text-lg">
                    {patient?.full_name || 'Unknown Patient'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Patient ID: {request.patientId}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appointment Request Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Request Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-sm text-gray-700">Appointment Type</div>
                    <div className="text-sm">{request.appointmentType}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-700">Preferred Date</div>
                    <div className="text-sm">{new Date(request.preferredDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-700">Preferred Time</div>
                    <div className="text-sm">{request.preferredTime}</div>
                  </div>
                  {request.painLevel && (
                    <div>
                      <div className="font-medium text-sm text-gray-700">Pain Level</div>
                      <div className={`text-sm font-medium ${painLevelColor}`}>
                        {painLevel}/10 ({urgencyLevel} PRIORITY)
                      </div>
                    </div>
                  )}
                </div>

                {request.reasonForVisit && (
                  <div>
                    <div className="font-medium text-sm text-gray-700 mb-2">Reason for Visit</div>
                    <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                      {request.reasonForVisit}
                    </div>
                  </div>
                )}

                {request.additionalNotes && (
                  <div>
                    <div className="font-medium text-sm text-gray-700 mb-2">Additional Notes</div>
                    <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                      {request.additionalNotes}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <div className="text-xs text-gray-500">
                    Submitted: {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Priority Alert */}
            {painLevel >= 7 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <div className="font-medium">High Priority Request</div>
                      <div className="text-sm">Patient reported high pain level. Consider urgent scheduling.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Booking Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Book Appointment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AppointmentBookingForm
                  requestId={request.id}
                  availableDentists={availableDentists}
                  preferredDate={request.preferredDate}
                  preferredTime={request.preferredTime}
                  appointmentType={request.appointmentType}
                  isUrgent={painLevel >= 7}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}