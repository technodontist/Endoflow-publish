export const dynamic = 'force-dynamic'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, ArrowLeft, Search, User } from "lucide-react"
import Link from "next/link"
import { FollowUpAppointmentForm } from "@/components/follow-up-appointment-form"
import { PatientSearchPanel } from "@/components/patient-search-panel"

interface SearchParams {
  patientId?: string
  consultationId?: string
}

interface FollowUpPageProps {
  searchParams: Promise<SearchParams>
}

export default async function FollowUpPage({ searchParams }: FollowUpPageProps) {
  const params = await searchParams
  const { patientId, consultationId } = params

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Schedule Follow-up Appointments</h1>
              <p className="text-gray-600 mt-1">Create follow-up appointment requests for patients</p>
            </div>
            <Link href="/assistant">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {!patientId ? (
          /* Patient Selection */
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Select Patient
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Search for and select a patient to schedule follow-up appointments.
                  </div>
                  <PatientSearchPanel
                    onPatientSelect={(patient) => {
                      // Redirect to this page with patient selected
                      window.location.href = `/assistant/follow-up?patientId=${patient.id}${consultationId ? `&consultationId=${consultationId}` : ''}`
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Follow-up Form */
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-blue-900">Patient Selected</div>
                      <div className="text-sm text-blue-700">Patient ID: {patientId}</div>
                      {consultationId && (
                        <div className="text-sm text-blue-600">Linked to Consultation: {consultationId}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <FollowUpAppointmentForm
              patientId={patientId}
              consultationId={consultationId}
              showToothSelection={true}
              onSave={(appointments) => {
                console.log('Follow-up appointments created:', appointments)
                // Could redirect back to patient dashboard or show success message
              }}
            />

            <div className="mt-6 text-center">
              <Link 
                href={`/assistant/follow-up`}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                ← Select a different patient
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}