'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MoreVertical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ChatSession {
  id: string
  title: string
  message_count: number
  last_message_preview: string | null
  last_activity_at: string
  created_at: string
}

interface ClinicChatHistorySidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, newTitle: string) => void
  isLoading?: boolean
}

export function ClinicChatHistorySidebar({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isLoading = false
}: ClinicChatHistorySidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)

  const handleStartEdit = (session: ChatSession) => {
    setEditingSessionId(session.id)
    setEditTitle(session.title)
  }

  const handleSaveEdit = () => {
    if (editingSessionId && editTitle.trim()) {
      onRenameSession(editingSessionId, editTitle.trim())
      setEditingSessionId(null)
      setEditTitle('')
    }
  }

  const handleCancelEdit = () => {
    setEditingSessionId(null)
    setEditTitle('')
  }

  const handleDeleteConfirm = () => {
    if (deleteSessionId) {
      onDeleteSession(deleteSessionId)
      setDeleteSessionId(null)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <Button
          onClick={onNewChat}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && (
            <div className="p-4 text-center text-gray-400 text-sm">
              Loading chat history...
            </div>
          )}

          {!isLoading && sessions.length === 0 && (
            <div className="p-4 text-center text-gray-400 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No chat history yet</p>
              <p className="text-xs mt-1">Click "New Chat" to start</p>
            </div>
          )}

          {sessions.map((session) => {
            const isActive = session.id === currentSessionId
            const isEditing = editingSessionId === session.id

            return (
              <div
                key={session.id}
                className={`group relative rounded-lg transition-colors ${
                  isActive
                    ? 'bg-teal-50 border border-teal-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                {isEditing ? (
                  // Edit mode
                  <div className="p-2 flex items-center space-x-1">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="h-7 text-sm"
                      autoFocus
                      maxLength={100}
                    />
                    <Button
                      onClick={handleSaveEdit}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  // Normal mode
                  <div
                    onClick={() => onSessionSelect(session.id)}
                    className="flex items-start justify-between p-2 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                          isActive ? 'text-teal-600' : 'text-gray-400'
                        }`} />
                        <h4 className={`text-sm font-medium truncate ${
                          isActive ? 'text-teal-900' : 'text-gray-900'
                        }`}>
                          {session.title}
                        </h4>
                      </div>
                      {session.last_message_preview && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1 ml-6">
                          {session.last_message_preview}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mt-1 ml-6">
                        <span className="text-xs text-gray-400">
                          {session.message_count} {session.message_count === 1 ? 'message' : 'messages'}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(session.last_activity_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(session)
                          }}
                        >
                          <Edit2 className="w-3 h-3 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteSessionId(session.id)
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat session and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
