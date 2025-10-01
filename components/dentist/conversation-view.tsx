"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Phone, Video, MoreVertical, Clock, User, CheckCircle2, Circle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Message {
  id: string
  sender: "patient" | "dentist"
  content: string
  timestamp: string
  created_at: string
  is_read: boolean
  message_type?: "text" | "system"
}

interface ConversationData {
  id: string
  patientName: string
  patientId: string
  patientUhid: string
  status: "new" | "urgent" | "read"
  priority: 'urgent' | 'high' | 'normal' | 'low'
  isUrgent: boolean
  messages: Message[]
}

interface ConversationViewProps {
  conversation?: ConversationData
  onSendMessage?: (message: string) => void
  isLoading?: boolean
  isSending?: boolean
}

export function ConversationView({
  conversation,
  onSendMessage,
  isLoading = false,
  isSending = false
}: ConversationViewProps) {
  const [replyMessage, setReplyMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [conversation?.messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = () => {
    if (replyMessage.trim() && !isSending) {
      onSendMessage?.(replyMessage.trim())
      setReplyMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const getStatusBadge = (conversation: ConversationData) => {
    if (conversation.isUrgent) {
      return <Badge variant="destructive">Urgent</Badge>
    }

    switch (conversation.status) {
      case "new":
        return (
          <Badge variant="default" className="bg-teal-600 text-white">
            New
          </Badge>
        )
      default:
        return null
    }
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const handlePatientProfile = () => {
    // TODO: Implement patient profile view
    console.log("View patient profile for:", conversation?.patientId)
  }

  const handleScheduleAppointment = () => {
    // TODO: Implement appointment scheduling
    console.log("Schedule appointment for:", conversation?.patientId)
  }

  const handleMarkResolved = () => {
    // TODO: Implement mark as resolved
    console.log("Mark conversation as resolved:", conversation?.id)
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <User className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium text-foreground mb-2">Select a conversation</h3>
        <p className="text-muted-foreground">Choose a patient conversation from the list to view messages and reply</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-teal-100 text-teal-600 font-medium">
              {getInitials(conversation.patientName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium text-foreground">{conversation.patientName}</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">UHID: {conversation.patientUhid}</span>
              {getStatusBadge(conversation)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => window.location.href = `tel:+1234567890`}>
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
          <Button variant="outline" size="sm">
            <Video className="h-4 w-4 mr-2" />
            Video
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePatientProfile}>
                View Patient Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleScheduleAppointment}>
                Schedule Appointment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMarkResolved}>
                Mark as Resolved
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[70%] rounded-lg p-3 bg-gray-200 h-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {conversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "dentist" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.sender === "dentist"
                      ? "bg-teal-600 text-white"
                      : message.message_type === "system"
                      ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`text-xs ${
                        message.sender === "dentist"
                          ? "text-white/70"
                          : message.message_type === "system"
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatMessageTime(message.created_at)}
                    </span>
                    {message.sender === "dentist" && (
                      <div className="flex items-center ml-2">
                        {message.is_read ? (
                          <CheckCircle2 className="h-3 w-3 text-white/70" />
                        ) : (
                          <Circle className="h-3 w-3 text-white/70" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex space-x-2">
          <Textarea
            placeholder="Type your reply..."
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            disabled={isSending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!replyMessage.trim() || isSending}
            className="self-end bg-teal-600 hover:bg-teal-700"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Online
          </span>
        </div>
      </div>
    </div>
  )
}