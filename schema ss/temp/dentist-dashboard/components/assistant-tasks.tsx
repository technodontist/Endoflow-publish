"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, User } from "lucide-react"
import { AddTaskDialog } from "@/components/add-task-dialog"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  description: string
  patientId?: string
  patientName?: string
  dueDate?: Date
  priority: "high" | "medium" | "low"
  status: "todo" | "inprogress" | "completed"
}

const initialTasks: Task[] = [
  {
    id: "1",
    description: "Follow up with patient about post-operative care instructions",
    patientName: "Sarah Johnson",
    dueDate: new Date(2024, 11, 20),
    priority: "high",
    status: "todo",
  },
  {
    id: "2",
    description: "Review lab results for crown preparation",
    patientName: "Michael Chen",
    dueDate: new Date(2024, 11, 18),
    priority: "medium",
    status: "inprogress",
  },
  {
    id: "3",
    description: "Schedule equipment maintenance",
    priority: "low",
    status: "completed",
  },
]

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
}

const statusColumns = [
  { id: "todo", title: "To Do", tasks: [] as Task[] },
  { id: "inprogress", title: "In Progress", tasks: [] as Task[] },
  { id: "completed", title: "Completed", tasks: [] as Task[] },
]

export function AssistantTasks() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  const handleAddTask = (newTask: Omit<Task, "id" | "status">) => {
    const task: Task = {
      ...newTask,
      id: Date.now().toString(),
      status: "todo",
    }
    setTasks([...tasks, task])
  }

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, newStatus: "todo" | "inprogress" | "completed") => {
    e.preventDefault()
    if (draggedTask) {
      setTasks(tasks.map((task) => (task.id === draggedTask.id ? { ...task, status: newStatus } : task)))
      setDraggedTask(null)
    }
  }

  const getTasksByStatus = (status: "todo" | "inprogress" | "completed") => {
    return tasks.filter((task) => task.status === status)
  }

  return (
    <div className="h-full bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assistant Tasks</h1>
          <p className="text-muted-foreground">Manage and track your clinical tasks</p>
        </div>
        <Button onClick={() => setAddTaskOpen(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {statusColumns.map((column) => (
          <div
            key={column.id}
            className="bg-card rounded-lg border border-border p-4"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id as "todo" | "inprogress" | "completed")}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">{column.title}</h2>
              <Badge variant="secondary" className="text-xs">
                {getTasksByStatus(column.id as "todo" | "inprogress" | "completed").length}
              </Badge>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-full">
              {getTasksByStatus(column.id as "todo" | "inprogress" | "completed").map((task) => (
                <Card
                  key={task.id}
                  className={cn(
                    "cursor-move hover:shadow-md transition-shadow",
                    draggedTask?.id === task.id && "opacity-50",
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={cn("w-3 h-3 rounded-full", priorityColors[task.priority])} />
                        <Badge variant="outline" className="text-xs">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-foreground mb-3">{task.description}</p>

                    <div className="space-y-2">
                      {task.patientName && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <User className="w-3 h-3 mr-1" />
                          {task.patientName}
                        </div>
                      )}

                      {task.dueDate && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3 mr-1" />
                          {format(task.dueDate, "MMM dd, yyyy")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AddTaskDialog open={addTaskOpen} onOpenChange={setAddTaskOpen} onAddTask={handleAddTask} />
    </div>
  )
}
