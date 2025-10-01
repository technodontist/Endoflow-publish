"use client"

import { useState } from "react"
import { ArrowLeft, Search, Users, Calendar, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Patient {
  id: string
  name: string
  uhid: string
  procedure: string
  requestedDate: string
  triage: "high" | "medium" | "low"
}

interface TimeSlot {
  time: string
  status: "available" | "booked" | "cancelled"
}

interface FullScreenAppointmentSchedulerProps {
  onClose: () => void
  onScheduleAppointment?: (patientId: string, day: string, time: string) => void
}

export function FullScreenAppointmentScheduler({
  onClose,
  onScheduleAppointment,
}: FullScreenAppointmentSchedulerProps) {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ day: string; time: string } | null>(null)
  const [patientSearch, setPatientSearch] = useState("")
  const [showBookingSuccess, setShowBookingSuccess] = useState(false)

  // Mock data for patients requiring scheduling
  const patientsRequiringScheduling: Patient[] = [
    {
      id: "1",
      name: "Robert Anderson",
      uhid: "UH00234",
      procedure: "Root Canal Follow-up",
      requestedDate: "2024-12-15",
      triage: "high",
    },
    {
      id: "2",
      name: "Maria Garcia",
      uhid: "UH00235",
      procedure: "Crown Preparation",
      requestedDate: "2024-12-16",
      triage: "medium",
    },
    {
      id: "3",
      name: "John Smith",
      uhid: "UH00236",
      procedure: "Routine Cleaning",
      requestedDate: "2024-12-18",
      triage: "low",
    },
    {
      id: "4",
      name: "Jennifer Lee",
      uhid: "UH00237",
      procedure: "Wisdom Tooth Extraction",
      requestedDate: "2024-12-17",
      triage: "high",
    },
    {
      id: "5",
      name: "Thomas Wilson",
      uhid: "UH00238",
      procedure: "Dental Implant Consultation",
      requestedDate: "2024-12-19",
      triage: "medium",
    },
  ]

  // Mock weekly schedule data
  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const timeSlots: TimeSlot[] = [
    { time: "9:00 AM", status: "available" },
    { time: "9:30 AM", status: "available" },
    { time: "10:00 AM", status: "booked" },
    { time: "10:30 AM", status: "available" },
    { time: "11:00 AM", status: "booked" },
    { time: "11:30 AM", status: "available" },
    { time: "12:00 PM", status: "available" },
    { time: "12:30 PM", status: "available" },
    { time: "1:00 PM", status: "available" },
    { time: "1:30 PM", status: "available" },
    { time: "2:00 PM", status: "booked" },
    { time: "2:30 PM", status: "available" },
    { time: "3:00 PM", status: "available" },
    { time: "3:30 PM", status: "booked" },
    { time: "4:00 PM", status: "available" },
    { time: "4:30 PM", status: "available" },
    { time: "5:00 PM", status: "available" },
    { time: "5:30 PM", status: "available" },
  ]

  const getTriageColor = (triage: string) => {
    switch (triage) {
      case "high":
        return "border-l-4 border-l-red-500"
      case "medium":
        return "border-l-4 border-l-yellow-500"
      case "low":
        return "border-l-4 border-l-green-500"
      default:
        return "border-l-4 border-l-gray-300"
    }
  }

  const getTriageBadgeColor = (triage: string) => {
    switch (triage) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTimeSlotColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-teal-100 text-teal-800 hover:bg-teal-200 cursor-pointer"
      case "booked":
        return "bg-gray-200 text-gray-600 cursor-not-allowed"
      case "cancelled":
        return "bg-red-100 text-red-800 cursor-not-allowed"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const filteredPatients = patientsRequiringScheduling.filter(
    (patient) =>
      patient.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      patient.uhid.toLowerCase().includes(patientSearch.toLowerCase()),
  )

  const handleTimeSlotClick = (day: string, time: string, status: string) => {
    if (status === "available") {
      setSelectedTimeSlot({ day, time })
    }
  }

  const handleScheduleAppointment = () => {
    if (selectedPatient && selectedTimeSlot) {
      onScheduleAppointment?.(selectedPatient, selectedTimeSlot.day, selectedTimeSlot.time)
      setShowBookingSuccess(true)
      // Auto-hide after 3 seconds and close
      setTimeout(() => {
        setShowBookingSuccess(false)
        onClose()
      }, 3000)
    }
  }

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Appointments
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">New Appointment</h1>
              <p className="text-sm text-muted-foreground">Schedule appointments for patients requiring booking</p>
            </div>
          </div>
        </div>
      </div>

      {showBookingSuccess && (
        <div className="container mx-auto px-6 pt-4">
          <Alert className="bg-green-50 border-green-200 animate-in slide-in-from-top-2 duration-300">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 font-medium">
              Appointment is booked successfully! Redirecting back to appointments...
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Left Column - Patients Requiring Scheduling (30%) */}
          <div className="col-span-4 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Users className="h-5 w-5" />
              Patients Requiring Scheduling
            </div>

            {/* Patient Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by patient name or UHID..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Patient Queue */}
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-350px)]">
              {filteredPatients.map((patient) => (
                <Card
                  key={patient.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${getTriageColor(patient.triage)} ${
                    selectedPatient === patient.id ? "ring-2 ring-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedPatient(patient.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                          {patient.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.uhid}</p>
                        </div>
                      </div>
                      <Badge className={getTriageBadgeColor(patient.triage)} variant="outline">
                        {patient.triage}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{patient.procedure}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested: {new Date(patient.requestedDate).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Column - Weekly Schedule (70%) */}
          <div className="col-span-8 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Calendar className="h-5 w-5" />
              Weekly Schedule
            </div>

            {/* Calendar Grid */}
            <div className="border rounded-lg overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-8 bg-muted/50">
                <div className="p-3 border-r font-medium text-sm">Time</div>
                {weekDays.map((day) => (
                  <div key={day} className="p-3 border-r font-medium text-sm text-center">
                    {day}
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                {timeSlots.map((slot) => (
                  <div key={slot.time} className="grid grid-cols-8 border-t">
                    <div className="p-3 border-r text-sm font-medium bg-muted/30">{slot.time}</div>
                    {weekDays.map((day) => (
                      <div
                        key={`${day}-${slot.time}`}
                        className={`p-3 border-r text-center text-sm transition-colors ${getTimeSlotColor(
                          slot.status,
                        )} ${
                          selectedTimeSlot?.day === day && selectedTimeSlot?.time === slot.time
                            ? "ring-2 ring-primary ring-inset"
                            : ""
                        }`}
                        onClick={() => handleTimeSlotClick(day, slot.time, slot.status)}
                      >
                        {slot.status === "available" ? "Available" : slot.status === "booked" ? "Booked" : "Cancelled"}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Instructions:</strong> Select a patient from the left panel, then click on an available time
                slot to schedule their appointment.
              </p>
            </div>

            {/* Action Button */}
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={handleScheduleAppointment}
                disabled={!selectedPatient || !selectedTimeSlot || showBookingSuccess}
                className="bg-teal-600 hover:bg-teal-700 text-white px-8"
              >
                {showBookingSuccess ? "Booking..." : "Select Patient & Time Slot"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
