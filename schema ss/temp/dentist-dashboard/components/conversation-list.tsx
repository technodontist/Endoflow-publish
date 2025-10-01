"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Clock, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Conversation {
  id: string
  patientName: string
  patientUhid: string
  lastMessage: string
  timestamp: string
  status: "new" | "urgent" | "read"
  unreadCount?: number
}

interface ConversationListProps {
  conversations?: Conversation[]
  selectedConversationId?: string
  onConversationSelect?: (conversationId: string) => void
}

export function ConversationList({
  conversations = [
    {
      id: "1",
      patientName: "Sarah Johnson",
      patientUhid: "UH001234",
      lastMessage: "I'm experiencing severe pain in my upper left molar...",
      timestamp: "2 min ago",
      status: "urgent",
      unreadCount: 3,
    },
    {
      id: "2",
      patientName: "Michael Chen",
      patientUhid: "UH001235",
      lastMessage: "Thank you for the treatment yesterday. The pain has reduced significantly.",
      timestamp: "1 hour ago",
      status: "new",
      unreadCount: 1,
    },
    {
      id: "3",
      patientName: "Emily Davis",
      patientUhid: "UH001236",
      lastMessage: "Can I reschedule my appointment for next week?",
      timestamp: "3 hours ago",
      status: "read",
    },
    {
      id: "4",
      patientName: "Robert Wilson",
      patientUhid: "UH001237",
      lastMessage: "The prescription you gave me is working well. Should I continue?",
      timestamp: "Yesterday",
      status: "read",
    },
    {
      id: "5",
      patientName: "Lisa Anderson",
      patientUhid: "UH001238",
      lastMessage: "I have some questions about the post-operative care instructions...",
      timestamp: "2 days ago",
      status: "new",
      unreadCount: 2,
    },
  ],
  selectedConversationId,
  onConversationSelect,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredConversations = conversations.filter(
    (conversation) =>
      conversation.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.patientUhid.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getStatusBadge = (status: string, unreadCount?: number) => {
    switch (status) {
      case "urgent":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Urgent
          </Badge>
        )
      case "new":
        return (
          <Badge variant="default" className="bg-accent text-accent-foreground">
            New {unreadCount && `(${unreadCount})`}
          </Badge>
        )
      default:
        return null
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No conversations found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Try adjusting your search terms" : "Patient messages will appear here"}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredConversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={`p-4 cursor-pointer transition-all hover:bg-muted/50 ${
                  selectedConversationId === conversation.id ? "bg-primary/10 border-primary ring-1 ring-primary" : ""
                }`}
                onClick={() => onConversationSelect?.(conversation.id)}
              >
                <div className="flex items-start space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(conversation.patientName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-foreground truncate">{conversation.patientName}</h4>
                      <span className="text-xs text-muted-foreground">{conversation.timestamp}</span>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{conversation.patientUhid}</span>
                      {getStatusBadge(conversation.status, conversation.unreadCount)}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">{conversation.lastMessage}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
