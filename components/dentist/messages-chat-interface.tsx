"use client"

import React, { useState, useEffect } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { ConversationList } from "@/components/dentist/conversation-list"
import { ConversationView } from "@/components/dentist/conversation-view"
import {
  getDentistMessageThreadsAction,
  getThreadMessagesAction,
  sendThreadMessageAction,
  markThreadAsReadAction
} from "@/lib/actions/dentist-messaging"
import { createClient } from '@/lib/supabase/client'

interface MessagesChatInterfaceProps {
  dentistId: string
}

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

export function MessagesChatInterface({ dentistId }: MessagesChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationData | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string>()
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    loadConversations()
    const cleanup = setupRealtimeSubscription()

    return () => {
      if (cleanup) cleanup()
    }
  }, [dentistId])

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId)
    } else {
      setSelectedConversation(null)
    }
  }, [selectedConversationId])

  const loadConversations = async () => {
    setIsLoadingConversations(true)
    try {
      const result = await getDentistMessageThreadsAction()
      if (result.success && result.data) {
        const formattedConversations: Conversation[] = result.data.map((thread: any) => ({
          id: thread.id,
          patientName: thread.patient?.full_name || 'Unknown Patient',
          patientUhid: thread.patient?.uhid || 'N/A',
          patientId: thread.patient_id,
          lastMessage: thread.last_message_preview || 'No messages yet',
          timestamp: thread.last_message_at,
          status: thread.dentist_unread_count > 0 ? "new" : "read",
          unreadCount: thread.dentist_unread_count,
          priority: thread.priority,
          isUrgent: thread.is_urgent
        }))
        setConversations(formattedConversations)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const loadMessages = async (threadId: string) => {
    setIsLoadingMessages(true)
    try {
      const result = await getThreadMessagesAction(threadId)
      if (result.success && result.data) {
        const conversation = conversations.find(c => c.id === threadId)
        if (conversation) {
          const formattedMessages: Message[] = result.data.map((msg: any) => ({
            id: msg.id,
            sender: msg.sender_type,
            content: msg.content,
            timestamp: msg.created_at,
            created_at: msg.created_at,
            is_read: msg.is_read,
            message_type: msg.message_type
          }))

          setSelectedConversation({
            id: conversation.id,
            patientName: conversation.patientName,
            patientId: conversation.patientId,
            patientUhid: conversation.patientUhid,
            status: conversation.status,
            priority: conversation.priority,
            isUrgent: conversation.isUrgent,
            messages: formattedMessages
          })

          // Mark messages as read for dentist
          await markThreadAsReadAction(threadId)

          // Update conversation list to reflect read status
          setConversations(prev =>
            prev.map(conv =>
              conv.id === threadId
                ? { ...conv, status: "read", unreadCount: 0 }
                : conv
            )
          )
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId)
  }

  const handleSendMessage = async (message: string) => {
    if (!selectedConversationId || isSending) return

    setIsSending(true)
    try {
      const result = await sendThreadMessageAction({
        threadId: selectedConversationId,
        content: message
      })

      if (result.success) {
        // Reload messages to get the updated conversation
        await loadMessages(selectedConversationId)
        // Refresh conversations to update last message
        await loadConversations()
      } else {
        console.error('Failed to send message:', result.error)
        alert('Failed to send message. Please try again.')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const supabase = createClient()

    // Subscribe to new messages in threads where this dentist is involved
    const subscription = supabase
      .channel('dentist_messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'thread_messages'
      }, async (payload) => {
        console.log('Real-time message update:', payload)

        // Refresh conversations and current thread
        await loadConversations()
        if (selectedConversationId) {
          await loadMessages(selectedConversationId)
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'message_threads'
      }, async (payload) => {
        console.log('Real-time thread update:', payload)

        // Refresh conversations
        await loadConversations()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  return (
    <div className="h-[calc(100vh-200px)] bg-background border border-gray-200 rounded-lg overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <div className="h-full border-r border-border">
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onConversationSelect={handleConversationSelect}
              isLoading={isLoadingConversations}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={65} minSize={50}>
          <ConversationView
            conversation={selectedConversation || undefined}
            onSendMessage={handleSendMessage}
            isLoading={isLoadingMessages}
            isSending={isSending}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}