export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getPendingPatients, getActivePatients, getPendingRegistrations, getPendingAppointmentRequests } from "@/lib/db/queries"
import { Users, Calendar, Clock, TrendingUp, UserCheck, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { RealtimeAssistantDashboard } from "@/components/assistant-dashboard-realtime"
import { RealtimeAppointmentRequests } from "@/components/realtime-appointment-requests"
import { TaskDashboard } from "@/components/assistant/task-dashboard"
import { format } from "date-fns"
import { PatientSearchPanel } from "@/components/patient-search-panel"

interface AssistantDashboardProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AssistantDashboard({ searchParams }: AssistantDashboardProps) {
  const params = await searchParams
  const [pendingPatients, activePatients, pendingRegistrations, appointmentRequests] = await Promise.all([
    getPendingPatients(),
    getActivePatients(),
    getPendingRegistrations(),
    getPendingAppointmentRequests()
  ])

  // Transform pending registrations to match expected format
  const transformedPendingRegistrations = pendingRegistrations.map(reg => {
    let formData
    try {
      formData = reg.formData ? JSON.parse(reg.formData) : {}
    } catch (error) {
      console.error('Failed to parse formData for registration:', reg.id, error)
      formData = {}
    }
    return {
      id: reg.userId, // Use userId for approval actions, not registration id
      fullName: `${formData.firstName || 'Unknown'} ${formData.lastName || 'User'}`,
      createdAt: reg.submittedAt
    }
  })

  // Combine both pending sources
  const allPendingPatients = [...pendingPatients, ...transformedPendingRegistrations]

  return (
    <div className="min-h-screen">
      {/* Main Content with V0 Styling */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title - Left Aligned */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Daily Task Hub
          </h1>
          <p className="text-gray-600">
            Manage patient registrations, schedule appointments, and coordinate with the dental team
          </p>
        </div>
      {/* Success/Error Messages */}
      {params.verified === 'success' && (
        <div className="mb-6">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <p className="font-medium">Patient verified successfully! They can now log in to their account.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {params.rejected === 'success' && (
        <div className="mb-6">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-800">
                <XCircle className="h-5 w-5" />
                <p className="font-medium">Patient registration has been rejected and removed from the system.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {params.confirmed === 'success' && (
        <div className="mb-6">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <p className="font-medium">Appointment confirmed successfully! Patient and dentist have been notified.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="flex gap-4 justify-center">
          <Link href="/assistant/follow-up">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Follow-ups
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats - V0 Design */}
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-teal-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-600 uppercase tracking-wide">Pending Patients</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{allPendingPatients.length}</p>
                </div>
                <div className="h-12 w-12 bg-teal-100 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-teal-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">+12%</span>
                <span className="text-gray-500 ml-1">from last week</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Appointments Today</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{appointmentRequests.length}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <Clock className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-gray-600">Next at 10:30 AM</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 uppercase tracking-wide">Tasks Completed</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">18</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">85%</span>
                <span className="text-gray-500 ml-1">efficiency rate</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Three Row Layout - Stacked for better task management */}
      <div className="space-y-6">
        {/* Row 1: Live Task Dashboard - Full Width */}
        <div className="w-full">
          <TaskDashboard />
        </div>

        {/* Row 2: Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Real-time Appointment Requests */}
          <RealtimeAppointmentRequests
            initialRequests={appointmentRequests as any}
            viewType="assistant"
          />

          {/* Column 2: New Self-Registrations - Real-time */}
          <RealtimeAssistantDashboard
            initialPendingPatients={pendingPatients}
            initialPendingRegistrations={pendingRegistrations}
          />
        </div>

        {/* Row 3: Patient Search & History (assistants can find patients) */}
        <div className="w-full">
          <PatientSearchPanel />
        </div>
      </div>
      </div>
    </div>
  )
}