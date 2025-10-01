"use client"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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

interface AppointmentCalendarProps {
  appointments: Appointment[]
  view: "day" | "week" | "month"
  selectedDate: Date
  onViewChange: (view: "day" | "week" | "month") => void
  onDateChange: (date: Date) => void
  onAppointmentClick?: (appointment: Appointment) => void
}

export function AppointmentCalendar({
  appointments,
  view,
  selectedDate,
  onViewChange,
  onDateChange,
  onAppointmentClick,
}: AppointmentCalendarProps) {
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

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate)

    if (view === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1))
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
    } else if (view === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1))
    }

    onDateChange(newDate)
  }

  const getDateRangeText = () => {
    if (view === "day") {
      return selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } else if (view === "week") {
      const startOfWeek = new Date(selectedDate)
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      return `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    } else {
      return selectedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    }
  }

  const getDayAppointments = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return appointments.filter((apt) => apt.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  const renderDayView = () => {
    const dayAppointments = getDayAppointments(selectedDate)
    const timeSlots = []

    // Generate time slots from 8 AM to 6 PM
    for (let hour = 8; hour < 18; hour++) {
      const timeStr = `${hour.toString().padStart(2, "0")}:00`
      const slotAppointments = dayAppointments.filter((apt) => apt.startTime <= timeStr && apt.endTime > timeStr)

      timeSlots.push(
        <div key={hour} className="flex border-b border-border">
          <div className="w-20 p-2 text-sm text-muted-foreground border-r border-border">
            {hour === 12 ? "12:00 PM" : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
          </div>
          <div className="flex-1 p-2 min-h-[60px]">
            {slotAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="mb-1 p-2 rounded border cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => onAppointmentClick?.(appointment)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{appointment.patientName}</span>
                  <Badge className={getStatusColor(appointment.status)} variant="outline">
                    {appointment.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {appointment.procedure} • {appointment.startTime} - {appointment.endTime}
                </div>
                <div className="text-xs text-muted-foreground">
                  {appointment.dentist} • {appointment.room}
                </div>
              </div>
            ))}
          </div>
        </div>,
      )
    }

    return <div className="border border-border rounded-lg">{timeSlots}</div>
  }

  const renderWeekView = () => {
    const startOfWeek = new Date(selectedDate)
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay())

    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      weekDays.push(day)
    }

    return (
      <div className="border border-border rounded-lg">
        <div className="grid grid-cols-8 border-b border-border">
          <div className="p-2 border-r border-border"></div>
          {weekDays.map((day, index) => (
            <div key={index} className="p-2 text-center border-r border-border last:border-r-0">
              <div className="text-sm font-medium">{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
              <div className="text-lg font-bold">{day.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Time slots for week view */}
        {Array.from({ length: 10 }, (_, hour) => hour + 8).map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-border last:border-b-0">
            <div className="p-2 text-sm text-muted-foreground border-r border-border">
              {hour === 12 ? "12:00 PM" : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
            </div>
            {weekDays.map((day, dayIndex) => {
              const dayAppointments = getDayAppointments(day)
              const timeStr = `${hour.toString().padStart(2, "0")}:00`
              const slotAppointments = dayAppointments.filter(
                (apt) => apt.startTime <= timeStr && apt.endTime > timeStr,
              )

              return (
                <div key={dayIndex} className="p-1 border-r border-border last:border-r-0 min-h-[50px]">
                  {slotAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="text-xs p-1 mb-1 rounded bg-primary/10 cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={() => onAppointmentClick?.(appointment)}
                    >
                      <div className="font-medium truncate">{appointment.patientName}</div>
                      <div className="text-muted-foreground truncate">{appointment.procedure}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar View
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant={view === "day" ? "default" : "outline"} size="sm" onClick={() => onViewChange("day")}>
              Day
            </Button>
            <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => onViewChange("week")}>
              Week
            </Button>
            <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => onViewChange("month")}>
              Month
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium">{getDateRangeText()}</span>
            <Button variant="outline" size="sm" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())}>
            Today
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {view === "day" && renderDayView()}
        {view === "week" && renderWeekView()}
        {view === "month" && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Month view coming soon</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
