"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, UserPlus, CheckSquare, AlertCircle, Circle } from "lucide-react"
import { Header } from "@/components/header"
import { useState } from "react"

const patientsToCheckIn = [
  { id: 1, name: "Sarah Johnson", time: "9:00 AM", status: "confirmed" },
  { id: 2, name: "Michael Chen", time: "9:30 AM", status: "pending" },
  { id: 3, name: "Emily Davis", time: "10:15 AM", status: "confirmed" },
  { id: 4, name: "Robert Wilson", time: "11:00 AM", status: "pending" },
  { id: 5, name: "Lisa Anderson", time: "2:00 PM", status: "confirmed" },
  { id: 6, name: "James Parker", time: "3:30 PM", status: "confirmed" },
]

const initialTasks = {
  todo: [
    { id: 1, description: "Review patient X-rays", patient: "Sarah Johnson", priority: "high" },
    { id: 2, description: "Prepare treatment plan", patient: "Michael Chen", priority: "medium" },
    { id: 3, description: "Follow up on lab results", patient: "Emily Davis", priority: "low" },
  ],
  inProgress: [
    { id: 4, description: "Insurance verification", patient: "Robert Wilson", priority: "high" },
    { id: 5, description: "Schedule follow-up", patient: "Lisa Anderson", priority: "medium" },
  ],
  completed: [
    { id: 6, description: "Patient consultation notes", patient: "James Parker", priority: "low" },
    { id: 7, description: "Update medical history", patient: "Sarah Johnson", priority: "medium" },
  ],
}

const newRegistrations = [
  { id: 1, name: "Kevin Rodriguez", registeredAt: "2 hours ago" },
  { id: 2, name: "Michelle White", registeredAt: "4 hours ago" },
  { id: 3, name: "Daniel Garcia", registeredAt: "6 hours ago" },
  { id: 4, name: "Jessica Thompson", registeredAt: "1 day ago" },
  { id: 5, name: "Alex Morgan", registeredAt: "2 days ago" },
]

const StatusBadge = ({ status }: { status: string }) => {
  const confirmedStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "500",
    backgroundColor: "#16a34a",
    color: "#ffffff",
    border: "none",
    textTransform: "none" as const,
  }

  const pendingStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "500",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    border: "none",
    textTransform: "none" as const,
  }

  return <div style={status === "confirmed" ? confirmedStyle : pendingStyle}>{status}</div>
}

export default function DailyTasksPage() {
  const [tasks, setTasks] = useState(initialTasks)
  const [taskFilter, setTaskFilter] = useState("today")

  const handleTaskComplete = (taskId: number, currentColumn: string) => {
    setTasks((prev) => {
      const newTasks = { ...prev }
      const task = newTasks[currentColumn as keyof typeof newTasks].find((t) => t.id === taskId)
      if (task && currentColumn !== "completed") {
        newTasks[currentColumn as keyof typeof newTasks] = newTasks[currentColumn as keyof typeof newTasks].filter(
          (t) => t.id !== taskId,
        )
        newTasks.completed = [...newTasks.completed, task]
      }
      return newTasks
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Header />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#005A9C] mb-2">Daily Task Hub</h1>
            <p className="text-gray-600">Manage your daily clinic operations efficiently</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: Patients to Check-in Today */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-[#005A9C] text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Patients to Check-in Today
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {patientsToCheckIn.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{patient.name}</p>
                        <p className="text-sm text-gray-500">{patient.time}</p>
                      </div>
                      <StatusBadge status={patient.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Today's Task Board (Kanban View) */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-[#005A9C] text-white rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    Today's Task Board
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="mb-4">
                  <Select value={taskFilter} onValueChange={setTaskFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="all">All Tasks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 max-h-80 overflow-y-auto">
                  {/* To Do Column */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Circle className="h-4 w-4 text-blue-500" />
                      To Do ({tasks.todo.length})
                    </h4>
                    <div className="space-y-2">
                      {tasks.todo.map((task) => (
                        <Card key={task.id} className="p-3 bg-white border shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{task.description}</p>
                              <p className="text-xs text-gray-500 mt-1">{task.patient}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                                <span className="text-xs text-gray-500 capitalize">{task.priority}</span>
                              </div>
                            </div>
                            <Checkbox onCheckedChange={() => handleTaskComplete(task.id, "todo")} className="mt-1" />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* In Progress Column */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      In Progress ({tasks.inProgress.length})
                    </h4>
                    <div className="space-y-2">
                      {tasks.inProgress.map((task) => (
                        <Card key={task.id} className="p-3 bg-white border shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{task.description}</p>
                              <p className="text-xs text-gray-500 mt-1">{task.patient}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                                <span className="text-xs text-gray-500 capitalize">{task.priority}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTaskComplete(task.id, "inProgress")}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              Complete
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Completed Column */}
                  <div className="bg-green-50 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-green-600" />
                      Completed ({tasks.completed.length})
                    </h4>
                    <div className="space-y-2">
                      {tasks.completed.map((task) => (
                        <Card key={task.id} className="p-3 bg-white border shadow-sm opacity-75">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 line-through">{task.description}</p>
                              <p className="text-xs text-gray-500 mt-1">{task.patient}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                                <span className="text-xs text-gray-500 capitalize">{task.priority}</span>
                              </div>
                            </div>
                            <CheckSquare className="h-4 w-4 text-green-600 mt-1" />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: New Self-Registrations */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-[#005A9C] text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  New Self-Registrations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {newRegistrations.map((registration) => (
                    <div
                      key={registration.id}
                      className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{registration.name}</p>
                        <p className="text-sm text-gray-500">Registered {registration.registeredAt}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent"
                        >
                          Review
                        </Button>
                        <Button size="sm" className="bg-[#009688] hover:bg-[#009688]/90 text-white">
                          Verify
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
