"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, User, Send, CheckCircle, AlertCircle } from "lucide-react"
import { getDentistMessageThreadsAction, sendThreadMessageAction } from "@/lib/actions/dentist-messaging"

interface MessagingTestInterfaceProps {
  dentistId: string
}

export function MessagingTestInterface({ dentistId }: MessagingTestInterfaceProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testResults, setTestResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [threads, setThreads] = useState<any[]>([])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState("Hello! This is a test message from the dentist.")

  const runMessagingTest = async () => {
    setTestStatus('loading')
    setError(null)

    try {
      console.log('🧪 Testing messaging functionality...')

      // Test 1: Load message threads
      const threadsResult = await getDentistMessageThreadsAction()

      if (threadsResult.error) {
        throw new Error(`Threads test failed: ${threadsResult.error}`)
      }

      const results = {
        threadsLoaded: threadsResult.success,
        threadCount: threadsResult.data?.length || 0,
        sampleThread: threadsResult.data?.[0] || null
      }

      setTestResults(results)
      setThreads(threadsResult.data || [])
      setTestStatus('success')

      console.log('✅ Messaging test successful:', results)

    } catch (err: any) {
      console.error('❌ Messaging test failed:', err)
      setError(err.message)
      setTestStatus('error')
    }
  }

  const testSendMessage = async () => {
    if (!selectedThread || !testMessage.trim()) return

    try {
      console.log('📤 Testing message sending...')

      const result = await sendThreadMessageAction({
        threadId: selectedThread,
        content: testMessage
      })

      if (result.error) {
        throw new Error(`Send message failed: ${result.error}`)
      }

      console.log('✅ Message sent successfully:', result.data)
      alert('Message sent successfully!')
      setTestMessage("")

      // Refresh threads
      await runMessagingTest()

    } catch (err: any) {
      console.error('❌ Send message failed:', err)
      alert(`Failed to send message: ${err.message}`)
    }
  }

  const getStatusIcon = () => {
    switch (testStatus) {
      case 'loading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <MessageSquare className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (testStatus) {
      case 'loading':
        return 'bg-blue-50 border-blue-200'
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Test Header */}
      <Card className={`${getStatusColor()} transition-colors`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Messaging System Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Test the messaging functionality between dentist and patient dashboards
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Dentist ID: {dentistId}
                </p>
              </div>
              <Button
                onClick={runMessagingTest}
                disabled={testStatus === 'loading'}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {testStatus === 'loading' ? 'Testing...' : 'Run Test'}
              </Button>
            </div>

            {error && (
              <div className="p-3 bg-red-100 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
                <p className="text-xs text-red-600 mt-1">
                  💡 Make sure to run PATIENT_DASHBOARD_NEW_FEATURES_SCHEMA.sql in Supabase SQL Editor first
                </p>
              </div>
            )}

            {testResults && (
              <div className="p-3 bg-white border border-gray-200 rounded-md">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Test Results:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✅ Threads loaded: {testResults.threadsLoaded ? 'Yes' : 'No'}</li>
                  <li>📊 Thread count: {testResults.threadCount}</li>
                  {testResults.sampleThread && (
                    <li>🔍 Sample thread: {testResults.sampleThread.subject || 'No subject'}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thread List */}
      {threads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Message Threads ({threads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedThread === thread.id
                      ? 'border-teal-300 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedThread(thread.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium">
                          {thread.patient?.full_name || 'Unknown Patient'}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {thread.patient?.uhid || 'N/A'}
                        </Badge>
                        {thread.dentist_unread_count > 0 && (
                          <Badge variant="default" className="bg-teal-600 text-white text-xs">
                            {thread.dentist_unread_count} new
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{thread.subject || 'No subject'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {thread.last_message_preview || 'No messages yet'}
                      </p>
                    </div>
                    <Badge
                      variant={thread.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {thread.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Sending Test */}
      {selectedThread && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Test Message Sending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Test Message Content:
                </label>
                <Textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter a test message..."
                  className="mt-1"
                />
              </div>
              <Button
                onClick={testSendMessage}
                disabled={!testMessage.trim()}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Test Message
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm text-gray-600 space-y-2">
            <li>1. Run <code className="bg-gray-100 px-1 rounded">PATIENT_DASHBOARD_NEW_FEATURES_SCHEMA.sql</code> in Supabase SQL Editor</li>
            <li>2. Ensure you have at least one patient registered in the system</li>
            <li>3. Create a test message thread from the patient dashboard</li>
            <li>4. Return here to test the dentist messaging interface</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}