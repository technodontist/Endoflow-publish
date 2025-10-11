"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, Clock, AlertCircle, CheckCircle, Sparkles, X } from 'lucide-react'
import { CreateTaskDialog } from './create-task-dialog'
import { TaskDetailsDialog } from './task-details-dialog'
import AITaskScheduler from './ai-task-scheduler'
import { getTasksAction, getTaskStatsAction } from '@/lib/actions/assistant-tasks'
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

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
  todo: { label: "To Do", color: "bg-gray-500", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-500", icon: Clock },
  completed: { label: "Completed", color: "bg-green-500", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: AlertCircle },
  on_hold: { label: "On Hold", color: "bg-yellow-500", icon: AlertCircle },
}

export function AssistantTaskManager() {
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
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [aiSchedulerOpen, setAiSchedulerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [currentUserId, setCurrentUserId] = useState<string>('')

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

    // Get current user ID from session
    const getCurrentUser = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
        }
      } catch (error) {
        console.error('Error getting current user:', error)
      }
    }
    getCurrentUser()
  }, [])

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true
    if (filter === 'urgent') return task.is_urgent || task.priority === 'urgent'
    if (filter === 'unassigned') return !task.assigned_to_profile
    return task.status === filter
  })

  const handleTaskCreated = () => {
    loadTasks()
    loadStats()
    setCreateTaskOpen(false)
  }

  const handleAITaskCreated = (taskId: string) => {
    console.log('AI Task created:', taskId)
    loadTasks()
    loadStats()
    // Keep AI scheduler open for creating more tasks
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assistant Tasks</h1>
          <p className="text-gray-600">Manage and assign tasks to your assistants</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setAiSchedulerOpen(!aiSchedulerOpen)}
            variant={aiSchedulerOpen ? "default" : "outline"}
            className={aiSchedulerOpen ? "bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white" : "border-teal-600 text-teal-600 hover:bg-teal-50"}
          >
            {aiSchedulerOpen ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Close AI Scheduler
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Task Scheduler
              </>
            )}
          </Button>
          <Button
            onClick={() => setCreateTaskOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Tasks</div>
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
            <div className="text-sm text-gray-500">In Progress</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-500">Completed</div>
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

      {/* AI Task Scheduler Section */}
      {aiSchedulerOpen && currentUserId && (
        <div className="h-[600px]">
          <AITaskScheduler
            createdById={currentUserId}
            onTaskCreated={handleAITaskCreated}
          />
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All Tasks' },
          { key: 'todo', label: 'To Do' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'completed', label: 'Completed' },
          { key: 'urgent', label: 'Urgent' },
          { key: 'unassigned', label: 'Unassigned' }
        ].map(filterOption => (
          <Button
            key={filterOption.key}
            variant={filter === filterOption.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(filterOption.key)}
            className={filter === filterOption.key ? "bg-teal-600 hover:bg-teal-700" : ""}
          >
            {filterOption.label}
          </Button>
        ))}
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTasks.map((task) => (
          <Card
            key={task.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedTask(task)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <div className={cn("w-3 h-3 rounded-full", priorityColors[task.priority])} />
                  <Badge variant={task.is_urgent ? "destructive" : "outline"} className="text-xs">
                    {task.is_urgent ? 'URGENT' : task.priority.toUpperCase()}
                  </Badge>
                </div>
                <Badge
                  variant="secondary"
                  className={cn("text-xs text-white", statusConfig[task.status].color)}
                >
                  {statusConfig[task.status].label}
                </Badge>
              </div>
              <CardTitle className="text-lg line-clamp-2">{task.title}</CardTitle>
            </CardHeader>

            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{task.description}</p>

              <div className="space-y-2">
                {task.patient_name && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="w-4 h-4 mr-2" />
                    <span>Patient: {task.patient_name}</span>
                  </div>
                )}

                {task.assigned_to_profile && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="w-4 h-4 mr-2" />
                    <span>Assigned: {task.assigned_to_profile.full_name}</span>
                  </div>
                )}

                {!task.assigned_to_profile && (
                  <div className="flex items-center text-sm text-orange-600">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span>Unassigned</span>
                  </div>
                )}

                {task.due_date && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                  </div>
                )}

                <div className="text-xs text-gray-400">
                  Created: {format(new Date(task.created_at), 'MMM dd, yyyy')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No tasks found matching the selected filter.</p>
            <Button
              onClick={() => setCreateTaskOpen(true)}
              className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
            >
              Create Your First Task
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onTaskCreated={handleTaskCreated}
      />

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