"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Clock, MapPin, CalendarIcon } from "lucide-react"
import { format } from "date-fns"

const allAppointments = {
  "2024-12-09": [
    {
      id: 1,
      patient: "Sarah Johnson",
      time: "9:00 AM",
      treatment: "Root Canal",
      status: "confirmed",
      room: "Room 1",
    },
    {
      id: 2,
      patient: "Michael Chen",
      time: "10:30 AM",
      treatment: "Cleaning",
      status: "in-progress",
      room: "Room 2",
    },
    {
      id: 3,
      patient: "Emily Davis",
      time: "2:00 PM",
      treatment: "Crown Fitting",
      status: "pending",
      room: "Room 3",
    },
    {
      id: 4,
      patient: "James Wilson",
      time: "3:30 PM",
      treatment: "Consultation",
      status: "confirmed",
      room: "Room 1",
    },
  ],
  "2024-12-08": [
    {
      id: 5,
      patient: "Anna Martinez",
      time: "11:00 AM",
      treatment: "Filling",
      status: "completed",
      room: "Room 2",
    },
    {
      id: 6,
      patient: "David Brown",
      time: "3:00 PM",
      treatment: "Extraction",
      status: "completed",
      room: "Room 1",
    },
  ],
  "2024-12-12": [
    {
      id: 7,
      patient: "Lisa Thompson",
      time: "10:00 AM",
      treatment: "Checkup",
      status: "confirmed",
      room: "Room 3",
    },
  ],
}

const statusColors = {
  confirmed: "bg-green-100 text-green-800",
  "in-progress": "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-800",
}

export function RecentAppointments() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const getAppointmentsForDate = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd")
    return allAppointments[dateKey as keyof typeof allAppointments] || []
  }

  const getDateStatus = (date: Date) => {
    const today = new Date()
    const selectedDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    if (selectedDateOnly < todayOnly) return "past"
    if (selectedDateOnly > todayOnly) return "future"
    return "today"
  }

  const appointments = getAppointmentsForDate(selectedDate)
  const dateStatus = getDateStatus(selectedDate)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {dateStatus === "today" ? "Today's Appointments" : `Appointments - ${format(selectedDate, "MMM dd, yyyy")}`}
          </div>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-transparent">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date)
                    setIsCalendarOpen(false)
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {dateStatus === "future"
              ? "No appointments scheduled for this date"
              : dateStatus === "past"
                ? "No appointments found for this date"
                : "No appointments scheduled for today"}
          </div>
        ) : (
          appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {appointment.patient
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{appointment.patient}</p>
                  <p className="text-sm text-muted-foreground">{appointment.treatment}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3" />
                    {appointment.time}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {appointment.room}
                  </div>
                </div>
                <Badge className={statusColors[appointment.status as keyof typeof statusColors]}>
                  {appointment.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
