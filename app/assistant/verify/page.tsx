export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getPendingPatients } from "@/lib/db/queries"
import { ArrowLeft, User, UserCheck, AlertCircle } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { ResizablePatientLayout } from "@/components/resizable-patient-layout"

export default async function VerifyPage() {
  // Only get pending patients from profiles table - this is our unified approach
  const pendingPatients = await getPendingPatients()
  
  console.log(`✅ [VERIFY PAGE] Found ${pendingPatients.length} pending patient(s) for verification`)
  
  // Handle data from either unified view or fallback profiles table
  const allPendingPatients = pendingPatients.map(patient => ({
    id: patient.user_id || patient.id, // unified view uses user_id, fallback uses id
    registrationId: patient.registration_id, // only from unified view
    fullName: patient.full_name || patient.first_name + ' ' + patient.last_name || 'Unknown User',
    firstName: patient.first_name,
    lastName: patient.last_name,
    role: patient.role || 'patient',
    createdAt: patient.submitted_at || patient.created_at || patient.createdAt,
    email: patient.email,
    phone: patient.phone,
    status: patient.profile_status || patient.status,
    registrationStatus: patient.registration_status,
    isFromUnifiedView: !!patient.registration_id // flag to know data source
  }))

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
            <h1 className="text-3xl font-bold">Patient Management</h1>
            <p className="text-muted-foreground">
              Manage patient verifications and search patient records
            </p>
          </div>
        </div>

        {/* Resizable 2-Column Layout */}
        <ResizablePatientLayout pendingPatients={allPendingPatients} />
      </div>
    </div>
  )
}