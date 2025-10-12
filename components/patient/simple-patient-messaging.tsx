'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageCircle, User, Clock, Stethoscope, Wifi, Bell } from 'lucide-react'
import { sendMessageAction, markMessagesAsReadAction } from '@/lib/actions/simple-messaging'
import { useRealtimeMessages, useRealtimeMessageNotifications } from '@/lib/hooks/use-realtime-messaging'
import { formatDistanceToNow } from 'date-fns'

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

interface SimplePatientMessagingProps {
  patientId: string
  patientName?: string
}

export default function SimplePatientMessaging({ patientId, patientName }: SimplePatientMessagingProps) {
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Use real-time hooks
  const { messages, loading, error, refreshMessages } = useRealtimeMessages(patientId)
  const { unreadCount, hasNewMessage, clearNewMessageFlag } = useRealtimeMessageNotifications(patientId)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Clear new message notifications when component is visible
  useEffect(() => {
    if (hasNewMessage) {
      const timer = setTimeout(() => {
        clearNewMessageFlag()
        markMessagesAsReadAction(patientId)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [hasNewMessage, clearNewMessageFlag, patientId])

  // Add debugging for real-time status
  useEffect(() => {
    console.log(`📱 [PATIENT MESSAGING] Component mounted for patient ${patientId}`)
    console.log(`📊 [PATIENT MESSAGING] Current messages count: ${messages.length}`)
    console.log(`🔔 [PATIENT MESSAGING] Unread count: ${unreadCount}`)
    console.log(`🔔 [PATIENT MESSAGING] Has new message: ${hasNewMessage}`)
  }, [patientId, messages.length, unreadCount, hasNewMessage])

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      })
    }
  }

  // Enhanced scroll to bottom with force option
  const forceScrollToBottom = () => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
  }


  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    const messageText = newMessage.trim()
    setSending(true)
    setNewMessage('') // Clear input immediately for better UX
    
    try {
      const result = await sendMessageAction({
        patientId: patientId,
        message: messageText
      })

      if (result.success) {
        // Message sent successfully
        console.log('✅ [PATIENT] Message sent successfully')
        
        // Manually refresh messages as fallback (real-time should also trigger)
        setTimeout(() => {
          refreshMessages()
          forceScrollToBottom()
        }, 300)
      } else {
        console.error('Failed to send message:', result.error)
        alert('Failed to send message. Please try again.')
        setNewMessage(messageText) // Restore message on error
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Error sending message. Please try again.')
      setNewMessage(messageText) // Restore message on error
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)] min-h-[400px] bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-teal-600" />
            <span className="font-semibold text-gray-900">Chat with Your Dental Team</span>
            <Wifi className="h-4 w-4 text-green-500" title="Real-time updates active" />
            {hasNewMessage && (
              <Bell className="h-4 w-4 text-orange-500 animate-pulse" title="New message!" />
            )}
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Get quick answers from your dentist and dental assistants
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{scrollBehavior: 'smooth'}}>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Loading messages...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Error loading messages: {error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <h3 className="font-medium mb-2 text-sm">Start a Conversation</h3>
              <p className="text-xs mb-3 px-4">Ask questions about your treatment, appointments, or dental care</p>
              <div className="bg-teal-50 p-3 rounded-lg text-left max-w-xs mx-auto">
                <h4 className="font-medium text-teal-800 mb-2 text-xs">You can ask about:</h4>
                <ul className="text-xs text-teal-700 space-y-1">
                  <li>• Appointment scheduling</li>
                  <li>• Post-treatment care</li>
                  <li>• Billing questions</li>
                  <li>• General concerns</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.is_from_patient ? 'justify-end' : 'justify-start'} mb-3`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${
                      message.is_from_patient
                        ? 'bg-teal-500 text-white rounded-br-md'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    {!message.is_from_patient && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center">
                          {message.sender_role === 'dentist' ? <Stethoscope className="h-3 w-3 text-teal-600" /> : <User className="h-3 w-3 text-teal-600" />}
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {message.sender_name || (message.sender_role === 'dentist' ? 'Dr.' : 'Assistant')}
                        </span>
                        <Badge
                          variant={message.sender_role === 'dentist' ? 'default' : 'secondary'}
                          className="text-xs px-1 py-0"
                        >
                          {message.sender_role === 'dentist' ? 'Dr' : 'Asst'}
                        </Badge>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{message.message}</p>
                    <div className="flex items-center justify-end mt-1">
                      <Clock className="h-3 w-3 mr-1 opacity-70" />
                      <span className={`text-xs opacity-70 ${
                        message.is_from_patient ? 'text-teal-100' : 'text-gray-500'
                      }`}>
                        {(() => {
                          try {
                            // Handle both ISO string and timestamp formats
                            const timestamp = message.created_at
                            const date = typeof timestamp === 'string' 
                              ? new Date(timestamp) 
                              : new Date(timestamp)
                            
                            // Check if date is valid
                            if (isNaN(date.getTime())) {
                              return 'just now'
                            }
                            
                            return formatDistanceToNow(date, { addSuffix: true })
                          } catch (e) {
                            console.error('Error formatting timestamp:', e, message.created_at)
                            return 'just now'
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input - Fixed at bottom */}
        <div className="flex-shrink-0 p-3 border-t bg-white">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={sending}
                className="border-gray-300 focus:border-teal-500 focus:ring-teal-500 rounded-full px-4"
              />
            </div>
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-teal-500 hover:bg-teal-600 rounded-full w-10 h-10 p-0 flex-shrink-0"
            >
              {sending ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">
            💡 For urgent matters, please call the clinic directly
          </p>
        </div>
      </div>
    </div>
  )
}