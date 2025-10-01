"use client"

import { Calendar, Clock, Users, AlertTriangle, CheckCircle, DollarSign, Activity, Phone } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface Appointment {
  id: string
  time: string
  patient: string
  procedure: string
  status: "scheduled" | "in-progress" | "completed" | "cancelled"
  duration: number
}

interface DashboardStats {
  todayAppointments: number
  completedAppointments: number
  revenue: number
  newPatients: number
}

interface Alert {
  id: string
  type: "urgent" | "reminder" | "info"
  message: string
  time: string
}

interface TodaysViewDashboardProps {
  appointments?: Appointment[]
  stats?: DashboardStats
  alerts?: Alert[]
  onAppointmentClick?: (appointment: Appointment) => void
  onQuickAction?: (action: string) => void
}

export function TodaysViewDashboard({
  appointments = [
    {
      id: "1",
      time: "09:00 AM",
      patient: "John Smith",
      procedure: "Routine Cleaning",
      status: "completed",
      duration: 60,
    },
    {
      id: "2",
      time: "10:30 AM",
      patient: "Sarah Johnson",
      procedure: "Root Canal - Session 2",
      status: "in-progress",
      duration: 90,
    },
    {
      id: "3",
      time: "12:00 PM",
      patient: "Michael Brown",
      procedure: "Crown Fitting",
      status: "scheduled",
      duration: 45,
    },
    {
      id: "4",
      time: "02:00 PM",
      patient: "Emily Davis",
      procedure: "Consultation",
      status: "scheduled",
      duration: 30,
    },
    {
      id: "5",
      time: "03:30 PM",
      patient: "Robert Wilson",
      procedure: "Filling Replacement",
      status: "scheduled",
      duration: 60,
    },
  ],
  stats = {
    todayAppointments: 8,
    completedAppointments: 3,
    revenue: 2450,
    newPatients: 2,
  },
  alerts = [
    {
      id: "1",
      type: "urgent",
      message: "Patient John Smith requires follow-up call regarding post-treatment care",
      time: "30 min ago",
    },
    {
      id: "2",
      type: "reminder",
      message: "Equipment sterilization cycle completes in 15 minutes",
      time: "45 min ago",
    },
    {
      id: "3",
      type: "info",
      message: "Lab results for crown impressions have arrived",
      time: "1 hour ago",
    },
  ],
  onAppointmentClick,
  onQuickAction,
}: TodaysViewDashboardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "in-progress":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "scheduled":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "reminder":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />
    }
  }

  const completionRate = (stats.completedAppointments / stats.todayAppointments) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Today's Overview</h2>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onQuickAction?.("emergency")} variant="outline" size="sm">
            <Phone className="h-4 w-4 mr-2" />
            Emergency Contact
          </Button>
          <Button onClick={() => onQuickAction?.("new-appointment")} size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedAppointments} completed, {stats.todayAppointments - stats.completedAppointments} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(completionRate)}%</div>
            <Progress value={completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+12% from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newPatients}</div>
            <p className="text-xs text-muted-foreground">Welcome consultations</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Your appointments for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onAppointmentClick?.(appointment)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-medium text-muted-foreground min-w-[70px]">{appointment.time}</div>
                    <div>
                      <p className="font-medium">{appointment.patient}</p>
                      <p className="text-sm text-muted-foreground">{appointment.procedure}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">{appointment.duration}min</span>
                    <Badge className={getStatusColor(appointment.status)} variant="outline">
                      {appointment.status.replace("-", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Reminders */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts & Reminders</CardTitle>
            <CardDescription>Important notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-balance">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Frequently used functions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2 bg-transparent"
              onClick={() => onQuickAction?.("patient-search")}
            >
              <Users className="h-6 w-6" />
              <span className="text-sm">Find Patient</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2 bg-transparent"
              onClick={() => onQuickAction?.("schedule")}
            >
              <Calendar className="h-6 w-6" />
              <span className="text-sm">Schedule</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2 bg-transparent"
              onClick={() => onQuickAction?.("treatment-notes")}
            >
              <CheckCircle className="h-6 w-6" />
              <span className="text-sm">Treatment Notes</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2 bg-transparent"
              onClick={() => onQuickAction?.("billing")}
            >
              <DollarSign className="h-6 w-6" />
              <span className="text-sm">Billing</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
