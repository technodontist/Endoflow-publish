"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  Calendar,
  Clock,
  MessageSquare,
  User,
  Users,
  CheckCircle,
  XCircle,
  Pause,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  updateTaskStatusAction,
  assignTaskAction,
  addTaskCommentAction,
  getTaskCommentsAction,
  getAvailableAssistantsAction
} from '@/lib/actions/assistant-tasks'

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
  started_at?: string
  completed_at?: string
}

interface TaskComment {
  id: string
  comment: string
  comment_type: string
  author: { full_name: string }
  created_at: string
}

interface Assistant {
  id: string
  full_name: string
}

interface TaskDetailsDialogProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdated: () => void
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
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: XCircle },
  on_hold: { label: "On Hold", color: "bg-yellow-500", icon: Pause },
}

export function TaskDetailsDialog({ task, open, onOpenChange, onTaskUpdated }: TaskDetailsDialogProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && task) {
      loadComments()
      loadAssistants()
    }
  }, [open, task])

  const loadComments = async () => {
    try {
      const result = await getTaskCommentsAction(task.id)
      if (result.success && result.comments) {
        setComments(result.comments)
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    }
  }

  const loadAssistants = async () => {
    try {
      const result = await getAvailableAssistantsAction()
      if (result.success && result.assistants) {
        setAssistants(result.assistants)
      }
    } catch (error) {
      console.error('Error loading assistants:', error)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    setLoading(true)
    try {
      const result = await updateTaskStatusAction(task.id, newStatus)
      if (result.success) {
        onTaskUpdated()
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignmentUpdate = async (assistantId: string) => {
    setLoading(true)
    try {
      const result = await assignTaskAction(task.id, assistantId || null)
      if (result.success) {
        onTaskUpdated()
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setLoading(true)
    try {
      const result = await addTaskCommentAction(task.id, newComment.trim())
      if (result.success) {
        setNewComment('')
        loadComments()
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatusIcon = statusConfig[task.status].icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-3">
              <StatusIcon className="w-5 h-5" />
              <span>Task Details</span>
            </DialogTitle>
            <div className="flex items-center space-x-2">
              {task.is_urgent && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  URGENT
                </Badge>
              )}
              <Badge
                variant="secondary"
                className={cn("text-xs text-white", statusConfig[task.status].color)}
              >
                {statusConfig[task.status].label}
              </Badge>
            </div>
          </div>
          <DialogDescription>
            Manage task details, assignment, and track progress
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Header */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{task.title}</h3>
                <div className="flex items-center space-x-2">
                  <div className={cn("w-3 h-3 rounded-full", priorityColors[task.priority])} />
                  <Badge variant="outline" className="text-xs">
                    {task.priority.toUpperCase()}
                  </Badge>
                  {task.category && (
                    <Badge variant="secondary" className="text-xs">
                      {task.category.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <p className="text-gray-700">{task.description}</p>
          </div>

          {/* Task Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Created By
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm">{task.created_by_profile?.full_name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(task.created_at), 'MMM dd, yyyy HH:mm')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Assigned To
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Select
                  value={task.assigned_to_profile?.full_name || "unassigned"}
                  onValueChange={handleAssignmentUpdate}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select assistant..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assistants.map((assistant) => (
                      <SelectItem key={assistant.id} value={assistant.id}>
                        {assistant.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {task.patient_name && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Patient
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm">{task.patient_name}</p>
                </CardContent>
              </Card>
            )}

            {task.due_date && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Due Date
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm">
                    {format(new Date(task.due_date), 'MMM dd, yyyy')}
                  </p>
                  <p className={cn(
                    "text-xs",
                    new Date(task.due_date) < new Date() && task.status !== 'completed'
                      ? "text-red-500"
                      : "text-gray-500"
                  )}>
                    {new Date(task.due_date) < new Date() && task.status !== 'completed'
                      ? "Overdue"
                      : "Due in future"
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Status Management */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Status Management</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusConfig).map(([status, config]) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={task.status === status ? "default" : "outline"}
                    className={cn(
                      "text-xs",
                      task.status === status && config.color.replace('bg-', 'bg-')
                    )}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={loading || task.status === status}
                  >
                    <config.icon className="w-3 h-3 mr-1" />
                    {config.label}
                  </Button>
                ))}
              </div>

              {/* Progress Timestamps */}
              <div className="mt-4 space-y-2 text-xs text-gray-500">
                {task.started_at && (
                  <p>Started: {format(new Date(task.started_at), 'MMM dd, yyyy HH:mm')}</p>
                )}
                {task.completed_at && (
                  <p>Completed: {format(new Date(task.completed_at), 'MMM dd, yyyy HH:mm')}</p>
                )}
                <p>Last updated: {format(new Date(task.updated_at), 'MMM dd, yyyy HH:mm')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Add Comment */}
              <div className="space-y-2">
                <Label htmlFor="new-comment">Add Comment</Label>
                <Textarea
                  id="new-comment"
                  placeholder="Add a comment or update..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || loading}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  Add Comment
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No comments yet. Add the first comment!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {comment.author.full_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(comment.created_at), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}