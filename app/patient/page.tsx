"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, User } from "lucide-react"
import { getCurrentPatient } from "@/lib/actions/patient"
import { V0PatientDashboard } from "@/components/patient/v0-patient-dashboard"

interface PatientData {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  nextAppointment?: {
    date: string
    time: string
    doctor: string
    type: string
  }
  recentActivity: Array<{
    id: string
    type: string
    description: string
    date: string
  }>
  notifications: number
}

export default function PatientDashboard() {
  const [patientData, setPatientData] = useState<PatientData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load patient data on component mount
  useEffect(() => {
    loadPatientData()
  }, [])

  const loadPatientData = async () => {
    try {
      setIsLoading(true)

      // Get current patient data
      const patientInfo = await getCurrentPatient()

      if (!patientInfo) {
        setError("Please log in to access your dashboard")
        return
      }

      // Create patient data object with mock appointment data for now
      const patientData: PatientData = {
        id: patientInfo.id || "patient-1",
        name: patientInfo.name,
        email: patientInfo.email,
        phone: patientInfo.phone,
        nextAppointment: {
          date: "December 15, 2024",
          time: "2:30 PM",
          doctor: "Sarah Johnson",
          type: "Root Canal Follow-up"
        },
        recentActivity: [
          {
            id: "1",
            type: "appointment",
            description: "Appointment scheduled with Dr. Johnson",
            date: "2 days ago"
          },
          {
            id: "2",
            type: "message",
            description: "New message from your care team",
            date: "3 days ago"
          }
        ],
        notifications: 2
      }

      setPatientData(patientData)
    } catch (err) {
      setError("Failed to load dashboard data")
      console.error("Error loading patient data:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col h-screen">
          <header className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-32 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
              <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
            </div>
          </header>

          <main className="flex-1 p-4 space-y-4">
            <div className="w-48 h-6 bg-gray-200 rounded animate-pulse" />
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </main>

          <nav className="bg-white border-t border-gray-200 p-2">
            <div className="flex justify-around">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1 p-2">
                  <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
                  <div className="w-12 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </nav>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Connection Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!patientData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-gray-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Patient Data</h3>
            <p className="text-gray-600 mb-4">Please log in to access your patient dashboard.</p>
            <Button>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Use the v0 design that matches the exact UI from schema ss
  return <V0PatientDashboard patientData={patientData} />
}