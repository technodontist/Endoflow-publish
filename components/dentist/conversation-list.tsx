"use client"

import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Clock, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Conversation {
  id: string
  patientName: string
  patientUhid: string
  patientId: string
  lastMessage: string
  timestamp: string
  status: "new" | "urgent" | "read"
  unreadCount?: number
  priority: 'urgent' | 'high' | 'normal' | 'low'
  isUrgent: boolean
}

interface ConversationListProps {
  conversations: Conversation[]
  selectedConversationId?: string
  onConversationSelect?: (conversationId: string) => void
  isLoading?: boolean
}

export function ConversationList({
  conversations = [],
  selectedConversationId,
  onConversationSelect,
  isLoading = false
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredConversations = conversations.filter(
    (conversation) =>
      conversation.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.patientUhid.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getStatusBadge = (conversation: Conversation) => {
    if (conversation.isUrgent) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Urgent
        </Badge>
      )
    }

    if (conversation.unreadCount && conversation.unreadCount > 0) {
      return (
        <Badge variant="default" className="bg-teal-600 text-white">
          {conversation.unreadCount} new
        </Badge>
      )
    }

    return null
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "Now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return "Yesterday"
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            disabled
            className="pl-10"
          />
          </div>
        </div>
        <div className="flex-1 p-2 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex items-start space-x-3">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
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
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? "No conversations found" : "No patient messages"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Try adjusting your search terms" : "Patient messages will appear here when they contact you"}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredConversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={`p-4 cursor-pointer transition-all hover:bg-muted/50 ${
                  selectedConversationId === conversation.id
                    ? "bg-teal-50 border-teal-300 ring-1 ring-teal-300"
                    : ""
                }`}
                onClick={() => onConversationSelect?.(conversation.id)}
              >
                <div className="flex items-start space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-teal-100 text-teal-600 font-medium">
                      {getInitials(conversation.patientName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {conversation.patientName}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(conversation.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        UHID: {conversation.patientUhid}
                      </span>
                      {getStatusBadge(conversation)}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {conversation.lastMessage}
                    </p>
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