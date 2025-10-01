"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Phone, Video, MoreVertical, Clock, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Message {
  id: string
  sender: "patient" | "dentist"
  content: string
  timestamp: string
  status?: "sent" | "delivered" | "read"
}

interface ConversationData {
  id: string
  patientName: string
  patientUhid: string
  status: "new" | "urgent" | "read"
  messages: Message[]
}

interface ConversationViewProps {
  conversation?: ConversationData
  onSendMessage?: (message: string) => void
}

export function ConversationView({
  conversation: initialConversation = {
    id: "1",
    patientName: "Sarah Johnson",
    patientUhid: "UH001234",
    status: "urgent",
    messages: [
      {
        id: "1",
        sender: "patient",
        content:
          "Hello Dr. Smith, I'm experiencing severe pain in my upper left molar. It started yesterday evening and has been getting worse.",
        timestamp: "10:30 AM",
        status: "read",
      },
      {
        id: "2",
        sender: "dentist",
        content:
          "I'm sorry to hear about your pain, Sarah. Can you describe the type of pain? Is it sharp, throbbing, or constant?",
        timestamp: "10:35 AM",
        status: "read",
      },
      {
        id: "3",
        sender: "patient",
        content:
          "It's a throbbing pain that gets worse when I bite down or drink something cold. I also notice some swelling around the gum area.",
        timestamp: "10:37 AM",
        status: "read",
      },
      {
        id: "4",
        sender: "patient",
        content: "Should I come in for an emergency appointment? The pain is really bothering me.",
        timestamp: "2 min ago",
        status: "delivered",
      },
    ],
  },
  onSendMessage,
}: ConversationViewProps) {
  const [replyMessage, setReplyMessage] = React.useState("")
  const [conversation, setConversation] = React.useState(initialConversation)

  const handleSendMessage = () => {
    if (replyMessage.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: "dentist",
        content: replyMessage.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      }

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
      }))

      onSendMessage?.(replyMessage)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>
      case "new":
        return (
          <Badge variant="default" className="bg-accent text-accent-foreground">
            New
          </Badge>
        )
      default:
        return null
    }
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
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(conversation.patientName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium text-foreground">{conversation.patientName}</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">{conversation.patientUhid}</span>
              {getStatusBadge(conversation.status)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
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
              <DropdownMenuItem>View Patient Profile</DropdownMenuItem>
              <DropdownMenuItem>Schedule Appointment</DropdownMenuItem>
              <DropdownMenuItem>Mark as Resolved</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === "dentist" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.sender === "dentist" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-xs ${
                    message.sender === "dentist" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {message.timestamp}
                </span>
                {message.sender === "dentist" && message.status && (
                  <span
                    className={`text-xs ${
                      message.status === "read" ? "text-primary-foreground/70" : "text-primary-foreground/50"
                    }`}
                  >
                    {message.status === "read" ? "Read" : "Delivered"}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
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
          />
          <Button onClick={handleSendMessage} disabled={!replyMessage.trim()} className="self-end">
            <Send className="h-4 w-4" />
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
