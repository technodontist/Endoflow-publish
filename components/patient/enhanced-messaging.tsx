"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  MessageCircle,
  Send,
  Phone,
  Bell,
  User,
  Plus,
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  X
} from "lucide-react"
import {
  getPatientMessageThreadsAction,
  getThreadMessagesAction,
  sendThreadMessageAction,
  createMessageThreadAction,
  getAvailableDentistsAction
} from "@/lib/actions/patient-dashboard-features"
import { createClient } from "@/lib/supabase/client"
import { requestUrgentAssistance } from "@/lib/actions/patient"

interface EnhancedMessagingProps {
  patientId: string
}

interface MessageThread {
  id: string
  subject: string
  last_message_at: string
  last_message_preview: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  is_urgent: boolean
  patient_unread_count: number
  status: 'active' | 'resolved' | 'archived'
  dentist: { full_name: string }
}

interface ThreadMessage {
  id: string
  content: string
  sender_type: 'patient' | 'dentist'
  message_type: 'text' | 'system'
  is_read: boolean
  created_at: string
}

interface Dentist {
  id: string
  full_name: string
  specialty?: string
}

export function EnhancedMessaging({ patientId }: EnhancedMessagingProps) {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showNewThread, setShowNewThread] = useState(false)
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [newThreadForm, setNewThreadForm] = useState({
    dentistId: "",
    subject: "",
    message: "",
    priority: "normal" as 'urgent' | 'high' | 'normal' | 'low',
    isUrgent: false
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadThreads()
    loadDentists()
  }, [])

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread)
    }
  }, [selectedThread])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Realtime updates for patient side
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('patient_messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'thread_messages'
      }, (payload: any) => {
        // Refresh thread list and, if relevant, the open thread messages
        loadThreads()
        if (selectedThread) {
          const newRow = payload?.new
          if (!newRow || newRow.thread_id === selectedThread) {
            loadMessages(selectedThread)
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'message_threads'
      }, (_payload: any) => {
        loadThreads()
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [selectedThread])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadThreads = async () => {
    try {
      const result = await getPatientMessageThreadsAction()
      if (result.success) {
        setThreads(result.data || [])
      }
    } catch (error) {
      console.error('Error loading threads:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async (threadId: string) => {
    try {
      const result = await getThreadMessagesAction(threadId)
      if (result.success) {
        setMessages(result.data || [])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadDentists = async () => {
    try {
      const result = await getAvailableDentistsAction()
      if (result.success) {
        setDentists(result.data || [])
      }
    } catch (error) {
      console.error('Error loading dentists:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedThread || isSending) return

    setIsSending(true)
    try {
      const result = await sendThreadMessageAction({
        threadId: selectedThread,
        content: newMessage.trim()
      })

      if (result.success) {
        setNewMessage("")
        await loadMessages(selectedThread)
        await loadThreads() // Refresh thread list to update last message
      } else {
        alert(result.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleCreateThread = async () => {
    if (!newThreadForm.dentistId || !newThreadForm.subject || !newThreadForm.message) {
      alert('Please fill in all fields')
      return
    }

    try {
      const result = await createMessageThreadAction({
        dentistId: newThreadForm.dentistId,
        subject: newThreadForm.subject,
        initialMessage: newThreadForm.message,
        priority: newThreadForm.priority,
        isUrgent: newThreadForm.isUrgent
      })

      if (result.success) {
        setShowNewThread(false)
        setNewThreadForm({
          dentistId: "",
          subject: "",
          message: "",
          priority: "normal",
          isUrgent: false
        })
        await loadThreads()
        setSelectedThread(result.data.id)
      } else {
        alert(result.error || 'Failed to create conversation')
      }
    } catch (error) {
      console.error('Error creating thread:', error)
      alert('Failed to create conversation')
    }
  }

  const handleUrgentAssistance = async () => {
    try {
      const result = await requestUrgentAssistance()
      if (result.success) {
        alert('Urgent assistance request sent successfully!')
        await loadThreads()
      } else {
        alert(result.error || 'Failed to send urgent assistance request')
      }
    } catch (error) {
      console.error("Error requesting urgent assistance:", error)
      alert('Failed to send urgent assistance request')
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getPriorityColor = (priority: string, isUrgent: boolean) => {
    if (isUrgent) return 'bg-red-100 text-red-800 border-red-200'
    switch (priority) {
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  if (showNewThread) {
    return (
      <div className="space-y-4 pb-20">
        <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewThread(false)}
                className="hover:bg-teal-50"
              >
                <ArrowLeft className="w-4 h-4 text-teal-600" />
              </Button>
              <CardTitle className="text-sm font-medium text-teal-700">
                Start New Conversation
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-teal-700 mb-2 block">
                Choose Dentist
              </Label>
              <select
                value={newThreadForm.dentistId}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, dentistId: e.target.value })}
                className="w-full px-3 py-2 border border-teal-200 rounded-md text-sm text-teal-700 focus:border-teal-400"
              >
                <option value="">Select a dentist...</option>
                {dentists.map((dentist) => (
                  <option key={dentist.id} value={dentist.id}>
                    Dr. {dentist.full_name}
                    {dentist.specialty && ` (${dentist.specialty})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium text-teal-700 mb-2 block">
                Subject
              </Label>
              <Input
                value={newThreadForm.subject}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, subject: e.target.value })}
                placeholder="What is this about?"
                className="border-teal-200 focus:border-teal-400"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-teal-700 mb-2 block">
                Priority
              </Label>
              <select
                value={newThreadForm.priority}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-teal-200 rounded-md text-sm text-teal-700 focus:border-teal-400"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isUrgent"
                checked={newThreadForm.isUrgent}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, isUrgent: e.target.checked })}
                className="w-4 h-4 text-teal-600 border-teal-300 rounded focus:ring-teal-500"
              />
              <Label htmlFor="isUrgent" className="text-sm text-teal-700">
                This is an urgent matter
              </Label>
            </div>

            <div>
              <Label className="text-sm font-medium text-teal-700 mb-2 block">
                Message
              </Label>
              <Textarea
                value={newThreadForm.message}
                onChange={(e) => setNewThreadForm({ ...newThreadForm, message: e.target.value })}
                placeholder="Type your message here..."
                rows={4}
                className="border-teal-200 focus:border-teal-400"
              />
            </div>

            <Button
              onClick={handleCreateThread}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Start Conversation
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (selectedThread) {
    const thread = threads.find(t => t.id === selectedThread)

    return (
      <div className="space-y-4 pb-20">
        {/* Thread Header */}
        <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedThread(null)}
                className="hover:bg-teal-50"
              >
                <ArrowLeft className="w-4 h-4 text-teal-600" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-teal-800">{thread?.subject}</h3>
                  {thread?.is_urgent && (
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Urgent
                    </Badge>
                  )}
                  <Badge className={`${getPriorityColor(thread?.priority || 'normal', false)} text-xs`}>
                    {thread?.priority}
                  </Badge>
                </div>
                <p className="text-sm text-teal-600">
                  with Dr. {thread?.dentist.full_name}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
        <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_type === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.sender_type === 'patient'
                        ? "bg-teal-600 text-white"
                        : message.message_type === 'system'
                        ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                        : "bg-teal-50 text-teal-800 border border-teal-100"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-xs ${
                        message.sender_type === 'patient' ? "text-teal-100" : "text-teal-600"
                      }`}>
                        {formatTime(message.created_at)}
                      </p>
                      {message.sender_type === 'patient' && (
                        <div className="flex items-center">
                          {message.is_read ? (
                            <CheckCircle2 className="w-3 h-3 text-teal-200" />
                          ) : (
                            <Circle className="w-3 h-3 text-teal-200" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t border-teal-100 p-4">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 border-teal-200 focus:border-teal-400"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isSending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header with Actions */}
      <div className="flex gap-3 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = 'tel:+1234567890'}
          className="flex-1 flex items-center gap-2 border-teal-200 text-teal-700 hover:bg-teal-50"
        >
          <Phone className="w-4 h-4" />
          Call Clinic
        </Button>
        <Button
          onClick={() => setShowNewThread(true)}
          size="sm"
          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Message
        </Button>
      </div>

      {/* Urgent Assistance */}
      <Button
        onClick={handleUrgentAssistance}
        className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 py-3 mb-4"
      >
        <Bell className="w-5 h-5" />
        Urgent Assistance 🛎️
      </Button>

      {/* Message Threads */}
      <Card className="bg-white/80 backdrop-blur-sm border border-teal-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-teal-700 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-teal-600" />
            Your Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-3 border border-teal-100 rounded-lg">
                    <div className="h-4 bg-teal-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-teal-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : threads.length > 0 ? (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThread(thread.id)}
                  className="p-3 border border-teal-100 rounded-lg hover:bg-teal-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-teal-800 text-sm">{thread.subject}</h4>
                        {thread.is_urgent && (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                        {thread.patient_unread_count > 0 && (
                          <Badge className="bg-red-500 text-white text-xs">
                            {thread.patient_unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-teal-600 mb-1">
                        Dr. {thread.dentist.full_name}
                      </p>
                      <p className="text-xs text-teal-500 line-clamp-1">
                        {thread.last_message_preview}
                      </p>
                    </div>
                    <div className="text-xs text-teal-400">
                      {formatTime(thread.last_message_at)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-teal-300" />
                <p className="text-sm text-teal-500">No conversations yet</p>
                <p className="text-xs text-teal-400 mt-1">Start a conversation with your dentist</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}