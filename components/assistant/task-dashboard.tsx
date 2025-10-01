"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertTriangle,
  Calendar,
  Clock,
  Search,
  User,
  CheckCircle,
  PlayCircle,
  Pause,
  Filter,
  SortDesc
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getTasksAction, updateTaskStatusAction, getTaskStatsAction } from '@/lib/actions/assistant-tasks'
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime'
import { TaskDetailsDialog } from '../dentist/task-details-dialog'

interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  patient_name?: string
  assigned_to_profile?: { full_name: string } | null
  created_by_profile?: { full_name: string } | null
  due_date?: string
  is_urgent: boolean
  category?: string
  created_at: string
  updated_at: string
}

interface TaskStats {
  total: number
  todo: number
  inProgress: number
  completed: number
  urgent: number
  overdue: number
}

const priorityColors = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
}

const statusConfig = {
  todo: { label: "To Do", color: "bg-gray-500", icon: Clock, action: "Start Task" },
  in_progress: { label: "In Progress", color: "bg-blue-500", icon: PlayCircle, action: "Complete Task" },
  completed: { label: "Completed", color: "bg-green-500", icon: CheckCircle, action: null },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: AlertTriangle, action: null },
  on_hold: { label: "On Hold", color: "bg-yellow-500", icon: Pause, action: "Resume Task" },
}

const statusColumns = [
  { id: "todo", title: "To Do", tasks: [] as Task[] },
  { id: "in_progress", title: "In Progress", tasks: [] as Task[] },
  { id: "completed", title: "Completed", tasks: [] as Task[] },
]

export function TaskDashboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    todo: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0,
    overdue: 0
  })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  // Real-time subscription
  useSupabaseRealtime({
    table: 'assistant_tasks',
    schema: 'api',
    onInsert: () => {
      loadTasks()
      loadStats()
    },
    onUpdate: () => {
      loadTasks()
      loadStats()
    },
    onDelete: () => {
      loadTasks()
      loadStats()
    }
  })

  const loadTasks = async () => {
    try {
      const result = await getTasksAction()
      if (result.success && result.tasks) {
        setTasks(result.tasks as Task[])
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getTaskStatsAction()
      if (result.success && result.stats) {
        setStats(result.stats as TaskStats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([loadTasks(), loadStats()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Filter and search tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.patient_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPriority = priorityFilter === 'all' ||
                           task.priority === priorityFilter ||
                           (priorityFilter === 'urgent_flag' && task.is_urgent)

    return matchesSearch && matchesPriority
  }).sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      case 'due_date':
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      case 'updated_at':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter(task => task.status === status)
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const result = await updateTaskStatusAction(taskId, newStatus)
      if (result.success) {
        loadTasks()
        loadStats()
      }
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    if (draggedTask && draggedTask.status !== newStatus) {
      await handleStatusChange(draggedTask.id, newStatus)
      setDraggedTask(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600">Manage your assigned tasks and track progress</p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent_flag">🔴 Urgent Flag</SelectItem>
              <SelectItem value="urgent">🔴 Urgent</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="low">🟢 Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-40">
              <SortDesc className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Created Date</SelectItem>
              <SelectItem value="updated_at">Updated Date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="due_date">Due Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.todo}</div>
            <div className="text-sm text-gray-500">To Do</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-500">Active</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-500">Done</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-sm text-gray-500">Urgent</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.overdue}</div>
            <div className="text-sm text-gray-500">Overdue</div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {statusColumns.map((column) => (
          <div
            key={column.id}
            className="bg-gray-50 rounded-lg p-4"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center">
                {React.createElement(statusConfig[column.id as keyof typeof statusConfig].icon, {
                  className: "w-5 h-5 mr-2"
                })}
                {column.title}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {getTasksByStatus(column.id).length}
              </Badge>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
              {getTasksByStatus(column.id).map((task) => (
                <Card
                  key={task.id}
                  className={cn(
                    "cursor-move hover:shadow-md transition-all duration-200",
                    draggedTask?.id === task.id && "opacity-50 rotate-1",
                    task.is_urgent && "ring-2 ring-red-200"
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => setSelectedTask(task)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={cn("w-3 h-3 rounded-full", priorityColors[task.priority])} />
                        {task.is_urgent && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            URGENT
                          </Badge>
                        )}
                        {!task.is_urgent && (
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-sm line-clamp-2">{task.title}</CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <p className="text-xs text-gray-600 mb-3 line-clamp-3">{task.description}</p>

                    <div className="space-y-2">
                      {task.patient_name && (
                        <div className="flex items-center text-xs text-gray-500">
                          <User className="w-3 h-3 mr-1" />
                          <span>{task.patient_name}</span>
                        </div>
                      )}

                      {task.created_by_profile && (
                        <div className="flex items-center text-xs text-gray-500">
                          <User className="w-3 h-3 mr-1" />
                          <span>From: {task.created_by_profile.full_name}</span>
                        </div>
                      )}

                      {task.due_date && (
                        <div className={cn(
                          "flex items-center text-xs",
                          new Date(task.due_date) < new Date() && task.status !== 'completed'
                            ? "text-red-600"
                            : "text-gray-500"
                        )}>
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>Due: {format(new Date(task.due_date), 'MMM dd')}</span>
                        </div>
                      )}

                      {task.category && (
                        <Badge variant="secondary" className="text-xs">
                          {task.category.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>

                    {/* Quick Action Button */}
                    {column.id === 'todo' && (
                      <Button
                        size="sm"
                        className="w-full mt-3 bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStatusChange(task.id, 'in_progress')
                        }}
                      >
                        <PlayCircle className="w-3 h-3 mr-1" />
                        Start Task
                      </Button>
                    )}

                    {column.id === 'in_progress' && (
                      <Button
                        size="sm"
                        className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStatusChange(task.id, 'completed')
                        }}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete Task
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}

              {getTasksByStatus(column.id).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No {column.title.toLowerCase()} tasks</p>
                  {column.id === 'todo' && (
                    <p className="text-xs mt-1">New tasks will appear here</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Details Dialog */}
      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={() => setSelectedTask(null)}
          onTaskUpdated={() => {
            loadTasks()
            loadStats()
            setSelectedTask(null)
          }}
        />
      )}
    </div>
  )
}