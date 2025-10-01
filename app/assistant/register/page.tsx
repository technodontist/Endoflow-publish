export const dynamic = 'force-dynamic'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, UserPlus } from "lucide-react"
import Link from "next/link"
import { PatientRegistrationForm } from "@/components/patient-registration-form"

export default function RegisterPatientPage() {
  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/assistant" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Register New Patient</h1>
            <p className="text-muted-foreground">Add a new patient to the system manually</p>
          </div>
        </div>

        {/* Registration Form */}
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Patient Information</h2>
                  <p className="text-sm text-muted-foreground">Fill in the patient details below</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PatientRegistrationForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}