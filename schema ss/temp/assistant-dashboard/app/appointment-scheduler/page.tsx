"use client"

import React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { User, Calendar, CheckCircle } from "lucide-react"

// Sample data for patients requiring scheduling
const patientsRequiringScheduling = [
  {
    id: 1,
    name: "Robert Anderson",
    uhid: "UH001234",
    treatment: "Root Canal Follow-up",
    priority: "high",
    requestedDate: "2024-12-15",
  },
  {
    id: 2,
    name: "Maria Garcia",
    uhid: "UH001235",
    treatment: "Crown Preparation",
    priority: "medium",
    requestedDate: "2024-12-16",
  },
  {
    id: 3,
    name: "John Smith",
    uhid: "UH001236",
    treatment: "Routine Cleaning",
    priority: "low",
    requestedDate: "2024-12-18",
  },
  {
    id: 4,
    name: "Jennifer Lee",
    uhid: "UH001237",
    treatment: "Wisdom Tooth Extraction",
    priority: "high",
    requestedDate: "2024-12-17",
  },
  {
    id: 5,
    name: "Thomas Wilson",
    uhid: "UH001238",
    treatment: "Dental Implant Consultation",
    priority: "medium",
    requestedDate: "2024-12-19",
  },
]

// Sample weekly calendar data
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const timeSlots = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
]

// Sample booked appointments
const bookedSlots = new Set([
  "Monday-10:00 AM",
  "Monday-2:00 PM",
  "Tuesday-11:00 AM",
  "Tuesday-3:30 PM",
  "Wednesday-9:30 AM",
  "Wednesday-1:00 PM",
  "Thursday-10:30 AM",
  "Thursday-4:00 PM",
  "Friday-9:00 AM",
  "Friday-2:30 PM",
  "Saturday-11:30 AM",
])

const priorityColors = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
}

export default function AppointmentScheduler() {
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; time: string } | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<(typeof patientsRequiringScheduling)[0] | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleSlotClick = (day: string, time: string) => {
    const slotKey = `${day}-${time}`
    if (!bookedSlots.has(slotKey)) {
      setSelectedSlot({ day, time })
      if (selectedPatient) {
        setShowConfirmDialog(true)
      }
    }
  }

  const handlePatientSelect = (patient: (typeof patientsRequiringScheduling)[0]) => {
    setSelectedPatient(patient)
  }

  const handleConfirmAppointment = () => {
    if (selectedSlot && selectedPatient) {
      // Here you would typically make an API call to book the appointment
      console.log(`Booking appointment for ${selectedPatient.name} on ${selectedSlot.day} at ${selectedSlot.time}`)

      // Add the slot to booked slots
      bookedSlots.add(`${selectedSlot.day}-${selectedSlot.time}`)

      // Reset selections
      setSelectedSlot(null)
      setSelectedPatient(null)
      setShowConfirmDialog(false)
    }
  }

  const isSlotAvailable = (day: string, time: string) => {
    return !bookedSlots.has(`${day}-${time}`)
  }

  const isSlotSelected = (day: string, time: string) => {
    return selectedSlot?.day === day && selectedSlot?.time === time
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#005A9C] mb-2">Appointment Scheduler</h1>
          <p className="text-gray-600">Schedule appointments for patients requiring booking</p>
        </div>

        <ResizablePanelGroup direction="horizontal" className="min-h-[800px] rounded-lg border bg-white">
          {/* Left Panel - Patients Requiring Scheduling */}
          <ResizablePanel defaultSize={30} minSize={25}>
            <Card className="h-full border-0 rounded-none">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-[#005A9C]">
                  <User className="h-5 w-5" />
                  Patients Requiring Scheduling
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2 p-4">
                  {patientsRequiringScheduling.map((patient) => (
                    <div
                      key={patient.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        selectedPatient?.id === patient.id
                          ? "border-[#009688] bg-[#009688]/5 shadow-md"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => handlePatientSelect(patient)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-[#005A9C]/10 text-[#005A9C] text-xs">
                              {patient.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{patient.name}</p>
                            <p className="text-xs text-gray-500">{patient.uhid}</p>
                          </div>
                        </div>
                        <Badge className={priorityColors[patient.priority as keyof typeof priorityColors]}>
                          {patient.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{patient.treatment}</p>
                      <p className="text-xs text-gray-500">Requested: {patient.requestedDate}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Weekly Calendar */}
          <ResizablePanel defaultSize={70}>
            <Card className="h-full border-0 rounded-none">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-[#005A9C]">
                  <Calendar className="h-5 w-5" />
                  Weekly Schedule
                  {selectedPatient && (
                    <span className="text-sm font-normal text-gray-600 ml-4">
                      Scheduling for: <span className="font-medium text-[#009688]">{selectedPatient.name}</span>
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="overflow-auto">
                  <div className="grid grid-cols-8 gap-2 min-w-[800px]">
                    {/* Header row */}
                    <div className="p-2"></div>
                    {weekDays.map((day) => (
                      <div key={day} className="p-2 text-center font-medium text-[#005A9C] border-b">
                        {day}
                      </div>
                    ))}

                    {/* Time slots */}
                    {timeSlots.map((time) => (
                      <React.Fragment key={time}>
                        <div className="p-2 text-sm font-medium text-gray-600 border-r">{time}</div>
                        {weekDays.map((day) => {
                          const available = isSlotAvailable(day, time)
                          const selected = isSlotSelected(day, time)

                          return (
                            <div
                              key={`${day}-${time}`}
                              className={`p-2 h-12 border border-gray-200 cursor-pointer transition-all ${
                                available
                                  ? selected
                                    ? "bg-[#009688] text-white shadow-md"
                                    : "bg-green-50 hover:bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                              }`}
                              onClick={() => available && handleSlotClick(day, time)}
                            >
                              <div className="text-xs text-center">
                                {available ? (
                                  selected ? (
                                    <CheckCircle className="h-4 w-4 mx-auto" />
                                  ) : (
                                    "Available"
                                  )
                                ) : (
                                  "Booked"
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {!selectedPatient && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Instructions:</strong> Select a patient from the left panel, then click on an available
                      time slot to schedule their appointment.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Appointment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to schedule an appointment for <strong>{selectedPatient?.name}</strong> on{" "}
                <strong>{selectedSlot?.day}</strong> at <strong>{selectedSlot?.time}</strong>?
                <br />
                <br />
                Treatment: <strong>{selectedPatient?.treatment}</strong>
                <br />
                UHID: <strong>{selectedPatient?.uhid}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAppointment} className="bg-[#009688] hover:bg-[#009688]/90">
                Confirm Appointment
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
