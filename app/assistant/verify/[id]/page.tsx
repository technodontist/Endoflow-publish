export const dynamic = 'force-dynamic'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, CheckCircle, XCircle, Mail, Calendar, Phone } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { handleApprovePatient, handleRejectPatient } from "@/lib/actions/verify-patient"
import { format } from "date-fns"

interface PatientVerifyPageProps {
  params: Promise<{ id: string }>
}

export default async function PatientVerifyPage({ params }: PatientVerifyPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Try to get patient from unified view first, fallback to profiles
  let patient = null;
  let error = null;

  // First try the unified verification view
  const { data: unifiedData, error: unifiedError } = await supabase
    .schema('public')
    .from('pending_patient_verifications')
    .select('*')
    .eq('user_id', id)
    .single();

  if (!unifiedError && unifiedData) {
    patient = {
      ...unifiedData,
      id: unifiedData.user_id,
      role: 'patient',
      full_name: unifiedData.full_name,
      status: unifiedData.profile_status,
      created_at: unifiedData.profile_created_at,
      isFromUnifiedView: true
    };
  } else {
    // Fallback to profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('role', 'patient')
      .single();

    patient = profileData;
    error = profileError;
  }

  if (error || !patient) {
    redirect('/assistant/verify')
  }

  // Create bound server actions
  const approvePatient = handleApprovePatient.bind(null, id)
  const rejectPatient = handleRejectPatient.bind(null, id)

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/assistant/verify" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Verifications
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Patient Verification</h1>
            <p className="text-muted-foreground">Review and verify patient registration</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Patient Info */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-semibold text-primary">
                      {(patient.fullName || patient.full_name || 'Unknown User')
                        .split(' ')
                        .map((name: string) => name[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{patient.fullName || patient.full_name || 'Unknown User'}</h2>
                    <Badge variant="outline" className="text-orange-600 border-orange-200">
                      <User className="h-3 w-3 mr-1" />
                      {patient.status}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Registration Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(patient.created_at || patient.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Role</p>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{patient.role}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Patient Information</h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{patient.email || 'No email available'}</span>
                      </div>
                    </div>

                    {patient.phone && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Phone</p>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{patient.phone}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Show additional registration details if from unified view */}
                  {patient.isFromUnifiedView && (
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="font-semibold text-lg">Registration Details</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {patient.first_name && patient.last_name && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Name (from registration)</p>
                            <span>{patient.first_name} {patient.last_name}</span>
                          </div>
                        )}

                        {patient.submitted_at && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Registration Submitted</p>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{format(new Date(patient.submitted_at), 'MMM d, yyyy \'at\' h:mm a')}</span>
                            </div>
                          </div>
                        )}

                        {patient.registration_status && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Registration Status</p>
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              {patient.registration_status}
                            </Badge>
                          </div>
                        )}

                        {patient.registration_id && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Registration ID</p>
                            <span className="text-xs font-mono text-muted-foreground">{patient.registration_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Verification Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Review the patient information and choose an action:
                </div>

                <div className="space-y-3">
                  <form action={approvePatient}>
                    <Button type="submit" className="w-full" size="lg">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Patient
                    </Button>
                  </form>

                  <form action={rejectPatient}>
                    <Button type="submit" variant="destructive" className="w-full" size="lg">
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Registration
                    </Button>
                  </form>
                </div>

                <div className="text-xs text-muted-foreground pt-4 border-t">
                  <strong>Note:</strong> Approving will allow the patient to log in.
                  Rejecting will mark their account as inactive.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}