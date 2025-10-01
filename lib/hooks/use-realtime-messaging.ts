'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getConversationAction, getPatientConversationsAction } from '@/lib/actions/simple-messaging'

interface Message {
  id: string
  patient_id: string
  sender_id: string
  sender_type: string
  message: string
  is_from_patient: boolean
  read: boolean
  created_at: string
  sender_name?: string
  sender_role?: string
}

interface Conversation {
  patient_id: string
  last_message: string
  last_message_at: string
  is_from_patient: boolean
  unread_count: number
  patient: {
    id: string
    full_name: string
    uhid: string
    first_name?: string
    last_name?: string
  }
}

// Hook for real-time conversation updates (dentist/assistant view)
export function useRealtimeConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConversations = useCallback(async () => {
    try {
      const result = await getPatientConversationsAction()
      if (result.success && result.data) {
        setConversations(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load conversations')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error loading conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial load
    loadConversations()

    // Set up real-time subscription
    const supabase = createClient()

    const channel = supabase
      .channel('messages-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'messages'
        },
        (payload) => {
          console.log('💬 [REALTIME] Message update received:', payload)
          // Reload conversations when any message changes
          loadConversations()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe()
    }
  }, [loadConversations])

  return {
    conversations,
    loading,
    error,
    refreshConversations: loadConversations
  }
}

// Hook for real-time messages in a specific conversation
export function useRealtimeMessages(patientId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMessages = useCallback(async () => {
    if (!patientId) {
      setMessages([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await getConversationAction(patientId)
      if (result.success && result.data) {
        setMessages(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load messages')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error loading messages:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    // Initial load
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!patientId) return

    console.log(`🔄 [REALTIME] Setting up subscription for patient ${patientId}`)

    // Set up real-time subscription for this specific patient's messages
    const supabase = createClient()

    const channel = supabase
      .channel(`messages-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'messages',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          console.log(`💬 [REALTIME] Message update for patient ${patientId}:`, payload)

          if (payload.eventType === 'INSERT') {
            // Add new message to the list
            const newMessage = payload.new as Message
            console.log(`➕ [REALTIME] Adding new message:`, newMessage)
            setMessages(prev => {
              // Check if message already exists to prevent duplicates
              if (prev.find(msg => msg.id === newMessage.id)) {
                console.log(`⚠️ [REALTIME] Message ${newMessage.id} already exists, skipping`)
                return prev
              }
              console.log(`✅ [REALTIME] Successfully added message ${newMessage.id}`)
              return [...prev, newMessage]
            })
          } else if (payload.eventType === 'UPDATE') {
            // Update existing message
            const updatedMessage = payload.new as Message
            console.log(`🔄 [REALTIME] Updating message:`, updatedMessage)
            setMessages(prev =>
              prev.map(msg =>
                msg.id === updatedMessage.id ? updatedMessage : msg
              )
            )
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted message
            const deletedMessage = payload.old as Message
            console.log(`🗑️ [REALTIME] Deleting message:`, deletedMessage)
            setMessages(prev =>
              prev.filter(msg => msg.id !== deletedMessage.id)
            )
          } else {
            // For any other changes, reload all messages
            console.log(`🔄 [REALTIME] Unknown event type, reloading messages:`, payload.eventType)
            loadMessages()
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [REALTIME] Subscription status for patient ${patientId}:`, status)
      })

    // Cleanup subscription on unmount or patient change
    return () => {
      console.log(`🔌 [REALTIME] Unsubscribing from patient ${patientId}`)
      channel.unsubscribe()
    }
  }, [patientId]) // Remove loadMessages dependency to avoid circular updates

  return {
    messages,
    loading,
    error,
    refreshMessages: loadMessages
  }
}

// Hook for real-time message notifications (patient view)
export function useRealtimeMessageNotifications(patientId: string) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasNewMessage, setHasNewMessage] = useState(false)

  const checkUnreadCount = useCallback(async () => {
    try {
      const result = await getConversationAction(patientId)
      if (result.success && result.data) {
        const unread = result.data.filter(msg => !msg.is_from_patient && !msg.read).length
        setUnreadCount(unread)
      }
    } catch (err) {
      console.error('Error checking unread count:', err)
    }
  }, [patientId])

  useEffect(() => {
    // Initial check
    checkUnreadCount()

    // Set up real-time subscription
    const supabase = createClient()

    const channel = supabase
      .channel(`notifications-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'api',
          table: 'messages',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          const newMessage = payload.new as Message
          console.log(`🔔 [NOTIFICATION] New message for patient ${patientId}:`, newMessage)

          // Only show notification if message is from staff to patient
          if (!newMessage.is_from_patient) {
            setHasNewMessage(true)
            setUnreadCount(prev => prev + 1)

            // Clear notification flag after 5 seconds
            setTimeout(() => setHasNewMessage(false), 5000)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'api',
          table: 'messages',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          // Recheck unread count when messages are marked as read
          checkUnreadCount()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [patientId, checkUnreadCount])

  return {
    unreadCount,
    hasNewMessage,
    clearNewMessageFlag: () => setHasNewMessage(false)
  }
}