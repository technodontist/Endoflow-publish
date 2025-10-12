'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageCircle, User, Clock, Wifi } from 'lucide-react'
import { sendMessageAction, markMessagesAsReadAction } from '@/lib/actions/simple-messaging'
import { useRealtimeConversations, useRealtimeMessages } from '@/lib/hooks/use-realtime-messaging'
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

export default function SimpleMessagingInterface() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Use real-time hooks
  const { conversations, loading: conversationsLoading, error: conversationsError, refreshConversations } = useRealtimeConversations()
  const { messages, loading: messagesLoading, error: messagesError, refreshMessages } = useRealtimeMessages(selectedPatientId)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPatientId || sending) return

    const messageText = newMessage.trim()
    setSending(true)
    setNewMessage('') // Clear input immediately for better UX
    
    try {
      const result = await sendMessageAction({
        patientId: selectedPatientId,
        message: messageText
      })

      if (result.success) {
        // Message sent successfully
        console.log('✅ Message sent successfully')
        
        // Manually refresh messages as fallback (real-time should also trigger)
        setTimeout(() => {
          refreshMessages()
          refreshConversations()
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

  const selectConversation = async (patientId: string) => {
    setSelectedPatientId(patientId)
    // Mark messages as read when conversation is selected
    try {
      await markMessagesAsReadAction(patientId)
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const selectedConversation = conversations.find(c => c.patient_id === selectedPatientId)

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden">
      {/* Conversations List */}
      <div className="w-1/3 border-r bg-gray-50">
        <div className="p-4 border-b bg-white">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Patient Conversations
            <Wifi className="h-4 w-4 text-green-500" title="Real-time updates active" />
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {conversationsLoading ? 'Loading...' : `${conversations.length} active conversations`}
          </p>
          {conversationsError && (
            <p className="text-sm text-red-600 mt-1">⚠️ {conversationsError}</p>
          )}
        </div>

        <ScrollArea className="h-[500px]">
          <div className="p-2 space-y-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <Card
                  key={conversation.patient_id}
                  className={`cursor-pointer transition-colors hover:bg-blue-50 ${
                    selectedPatientId === conversation.patient_id ? 'bg-blue-100 border-blue-300' : ''
                  }`}
                  onClick={() => selectConversation(conversation.patient_id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {conversation.patient.full_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{conversation.patient.full_name}</p>
                            <p className="text-xs text-gray-500">{conversation.patient.uhid}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {conversation.is_from_patient ? '💬 ' : '📝 '}
                          {conversation.last_message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {(() => {
                              try {
                                const date = new Date(conversation.last_message_at)
                                return isNaN(date.getTime()) ? 'just now' : formatDistanceToNow(date, { addSuffix: true })
                              } catch (e) {
                                return 'just now'
                              }
                            })()}
                          </span>
                          {conversation.unread_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {conversation.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {selectedConversation.patient.full_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold">{selectedConversation.patient.full_name}</h4>
                  <p className="text-sm text-gray-600">{selectedConversation.patient.uhid}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Loading messages...
                </div>
              ) : messagesError ? (
                <div className="text-center py-8 text-red-500">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Error loading messages: {messagesError}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.is_from_patient ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.is_from_patient
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {message.sender_name || (message.is_from_patient ? 'Patient' : 'Staff')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {message.sender_role || message.sender_type}
                          </Badge>
                        </div>
                        <p className="text-sm">{message.message}</p>
                        <p className={`text-xs mt-1 ${
                          message.is_from_patient ? 'text-gray-500' : 'text-blue-100'
                        }`}>
                          {(() => {
                            try {
                              const date = new Date(message.created_at)
                              return isNaN(date.getTime()) ? 'just now' : formatDistanceToNow(date, { addSuffix: true })
                            } catch (e) {
                              console.error('Error formatting timestamp:', e, message.created_at)
                              return 'just now'
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={sending}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4"
                >
                  {sending ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">Select a Conversation</h3>
              <p className="text-sm">Choose a patient from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}