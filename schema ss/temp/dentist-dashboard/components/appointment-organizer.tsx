"use client"

import { Input } from "@/components/ui/input"

import { useState } from "react"
import { Calendar, Clock, Plus, Users, Search } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FullScreenAppointmentScheduler } from "@/components/full-screen-appointment-scheduler"
import { AppointmentCalendar } from "@/components/appointment-calendar"

interface Appointment {
  id: string
  patientId: string
  patientName: string
  procedure: string
  date: string
  startTime: string
  endTime: string
  duration: number
  status: "scheduled" | "confirmed" | "in-progress" | "completed" | "cancelled" | "no-show"
  dentist: string
  room: string
  notes?: string
  phone: string
  email: string
}

interface AppointmentOrganizerProps {
  appointments?: Appointment[]
  onScheduleAppointment?: (appointment: Partial<Appointment>) => void
  onUpdateAppointment?: (appointment: Appointment) => void
  onCancelAppointment?: (appointmentId: string) => void
}

export function AppointmentOrganizer({
  appointments = [
    {
      id: "1",
      patientId: "p1",
      patientName: "John Smith",
      procedure: "Routine Cleaning",
      date: "2024-01-15",
      startTime: "09:00",
      endTime: "10:00",
      duration: 60,
      status: "confirmed",
      dentist: "Dr. Johnson",
      room: "Room 1",
      phone: "(555) 123-4567",
      email: "john.smith@email.com",
    },
    {
      id: "2",
      patientId: "p2",
      patientName: "Sarah Johnson",
      procedure: "Root Canal - Session 2",
      date: "2024-01-15",
      startTime: "10:30",
      endTime: "12:00",
      duration: 90,
      status: "in-progress",
      dentist: "Dr. Smith",
      room: "Room 2",
      phone: "(555) 234-5678",
      email: "sarah.johnson@email.com",
    },
    {
      id: "3",
      patientId: "p3",
      patientName: "Michael Brown",
      procedure: "Crown Fitting",
      date: "2024-01-15",
      startTime: "14:00",
      endTime: "14:45",
      duration: 45,
      status: "scheduled",
      dentist: "Dr. Johnson",
      room: "Room 1",
      phone: "(555) 345-6789",
      email: "michael.brown@email.com",
    },
    {
      id: "4",
      patientId: "p4",
      patientName: "Emily Davis",
      procedure: "Consultation",
      date: "2024-01-16",
      startTime: "09:00",
      endTime: "09:30",
      duration: 30,
      status: "scheduled",
      dentist: "Dr. Smith",
      room: "Room 3",
      phone: "(555) 456-7890",
      email: "emily.davis@email.com",
    },
    {
      id: "5",
      patientId: "p5",
      patientName: "Robert Wilson",
      procedure: "Filling Replacement",
      date: "2024-01-16",
      startTime: "11:00",
      endTime: "12:00",
      duration: 60,
      status: "confirmed",
      dentist: "Dr. Johnson",
      room: "Room 1",
      phone: "(555) 567-8901",
      email: "robert.wilson@email.com",
    },
  ],
  onScheduleAppointment,
  onUpdateAppointment,
  onCancelAppointment,
}: AppointmentOrganizerProps) {
  const [view, setView] = useState<"day" | "week" | "month">("day")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dentistFilter, setDentistFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFullScreenScheduler, setShowFullScreenScheduler] = useState(false)

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesSearch =
      appointment.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.procedure.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter
    const matchesDentist = dentistFilter === "all" || appointment.dentist === dentistFilter

    return matchesSearch && matchesStatus && matchesDentist
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      case "no-show":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTodayAppointments = () => {
    const today = new Date().toISOString().split("T")[0]
    return filteredAppointments.filter((apt) => apt.date === today)
  }

  const getUpcomingAppointments = () => {
    const today = new Date().toISOString().split("T")[0]
    return filteredAppointments
      .filter((apt) => apt.date > today)
      .sort((a, b) => new Date(a.date + " " + a.startTime).getTime() - new Date(b.date + " " + b.startTime).getTime())
      .slice(0, 5)
  }

  const handleScheduleAppointment = (appointmentData: Partial<Appointment>) => {
    onScheduleAppointment?.(appointmentData)
    setShowFullScreenScheduler(false)
  }

  const handleFullScreenScheduleAppointment = (patientId: string, day: string, time: string) => {
    const appointmentData = {
      patientId,
      date: day,
      startTime: time,
    }
    onScheduleAppointment?.(appointmentData)
    setShowFullScreenScheduler(false)
  }

  const uniqueDentists = [...new Set(appointments.map((apt) => apt.dentist))]

  return (
    <>
      {showFullScreenScheduler && (
        <FullScreenAppointmentScheduler
          onClose={() => setShowFullScreenScheduler(false)}
          onScheduleAppointment={handleFullScreenScheduleAppointment}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Appointment Organizer</h2>
            <p className="text-muted-foreground">Manage and schedule patient appointments</p>
          </div>
          <Button onClick={() => setShowFullScreenScheduler(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Appointment
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search appointments by patient or procedure..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dentistFilter} onValueChange={setDentistFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Filter by dentist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dentists</SelectItem>
                  {uniqueDentists.map((dentist) => (
                    <SelectItem key={dentist} value={dentist}>
                      {dentist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AppointmentCalendar
              appointments={filteredAppointments}
              view={view}
              selectedDate={selectedDate}
              onViewChange={setView}
              onDateChange={setSelectedDate}
              onAppointmentClick={onUpdateAppointment}
            />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Today's Appointments
                </CardTitle>
                <CardDescription>{getTodayAppointments().length} appointments scheduled</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {getTodayAppointments().map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onUpdateAppointment?.(appointment)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm truncate">{appointment.patientName}</p>
                          <Badge className={getStatusColor(appointment.status)} variant="outline">
                            {appointment.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{appointment.procedure}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {appointment.startTime} - {appointment.endTime}
                        </div>
                      </div>
                    </div>
                  ))}
                  {getTodayAppointments().length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No appointments today</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Upcoming Appointments
                </CardTitle>
                <CardDescription>Next 5 scheduled appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {getUpcomingAppointments().map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onUpdateAppointment?.(appointment)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm truncate">{appointment.patientName}</p>
                          <Badge className={getStatusColor(appointment.status)} variant="outline">
                            {appointment.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{appointment.procedure}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(appointment.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {appointment.startTime} - {appointment.endTime}
                        </div>
                      </div>
                    </div>
                  ))}
                  {getUpcomingAppointments().length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No upcoming appointments</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Appointments</span>
                    <span className="font-medium">{filteredAppointments.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Today</span>
                    <span className="font-medium">{getTodayAppointments().length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Confirmed</span>
                    <span className="font-medium text-green-600">
                      {filteredAppointments.filter((apt) => apt.status === "confirmed").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="font-medium text-blue-600">
                      {filteredAppointments.filter((apt) => apt.status === "scheduled").length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
