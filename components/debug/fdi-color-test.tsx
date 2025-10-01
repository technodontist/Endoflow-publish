"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { updateAppointmentStatusAction } from '@/lib/actions/appointments'
import { createClient } from '@/lib/supabase/client'

interface TestAppointment {
  id: string
  patient_id: string
  status: string
  appointment_type: string
  patient_name?: string
}

export function FDIColorTest() {
  const [patientId, setPatientId] = useState('')
  const [appointments, setAppointments] = useState<TestAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [subscriptionStatus, setSubscriptionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]) // Keep last 20 logs
  }

  const loadAppointments = async () => {
    if (!patientId.trim()) {
      addLog('❌ Please enter a patient ID')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .schema('api')
        .from('appointments')
        .select(`
          id,
          patient_id,
          status,
          appointment_type,
          patients!inner(first_name, last_name)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        addLog(`❌ Error loading appointments: ${error.message}`)
        return
      }

      const formattedAppointments = (data || []).map(apt => ({
        id: apt.id,
        patient_id: apt.patient_id,
        status: apt.status,
        appointment_type: apt.appointment_type,
        patient_name: `${(apt as any).patients?.first_name} ${(apt as any).patients?.last_name}`
      }))

      setAppointments(formattedAppointments)
      addLog(`✅ Loaded ${formattedAppointments.length} appointments`)
    } catch (error) {
      addLog(`❌ Exception loading appointments: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    if (!patientId.trim()) {
      addLog('❌ Please enter a patient ID first')
      return
    }

    const supabase = createClient()
    
    // Subscribe to tooth diagnoses changes
    const toothChannel = supabase
      .channel(`test-tooth-diagnoses-${patientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'tooth_diagnoses', 
        filter: `patient_id=eq.${patientId}`
      }, (payload) => {
        addLog(`🦷 Tooth diagnosis update: ${payload.eventType} - Tooth ${(payload.new as any)?.tooth_number} -> ${(payload.new as any)?.status}`)
      })
      .subscribe((status) => {
        setSubscriptionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting')
        addLog(`🦷 Tooth diagnoses subscription: ${status}`)
      })

    // Subscribe to appointment changes
    const appointmentChannel = supabase
      .channel(`test-appointments-${patientId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'api', 
        table: 'appointments',
        filter: `patient_id=eq.${patientId}`
      }, (payload) => {
        addLog(`📅 Appointment update: ${(payload.old as any)?.status} -> ${(payload.new as any)?.status}`)
      })
      .subscribe()

    // Subscribe to treatment changes
    const treatmentChannel = supabase
      .channel(`test-treatments-${patientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'treatments',
        filter: `patient_id=eq.${patientId}`
      }, (payload) => {
        addLog(`🔧 Treatment update: ${payload.eventType} - ${(payload.new as any)?.treatment_type} -> ${(payload.new as any)?.status}`)
      })
      .subscribe()

    addLog('📡 Real-time subscriptions set up')

    // Cleanup function
    return () => {
      supabase.removeChannel(toothChannel)
      supabase.removeChannel(appointmentChannel)
      supabase.removeChannel(treatmentChannel)
      addLog('📡 Subscriptions cleaned up')
    }
  }

  const testAppointmentStatusChange = async (appointmentId: string, newStatus: string) => {
    addLog(`🧪 Testing status change: ${appointmentId} -> ${newStatus}`)
    
    try {
      const result = await updateAppointmentStatusAction(appointmentId, newStatus, 'test-user')
      
      if (result.success) {
        addLog(`✅ Status update succeeded`)
        // Refresh appointments list
        await loadAppointments()
      } else {
        addLog(`❌ Status update failed: ${result.error}`)
      }
    } catch (error) {
      addLog(`❌ Status update exception: ${error}`)
    }
  }

  useEffect(() => {
    let cleanup: (() => void) | undefined

    if (patientId.trim()) {
      cleanup = setupRealtimeSubscription()
    }

    return () => {
      cleanup?.()
    }
  }, [patientId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-orange-100 text-orange-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔬 FDI Chart Color Update Test
            <div className={`h-3 w-3 rounded-full ${
              subscriptionStatus === 'connected' ? 'bg-green-400' :
              subscriptionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
              'bg-red-400'
            }`} title={`Subscription status: ${subscriptionStatus}`} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID</Label>
              <Input
                id="patientId"
                placeholder="Enter patient UUID..."
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadAppointments} disabled={loading}>
                {loading ? 'Loading...' : 'Load Appointments'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {appointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Appointments ({appointments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{appointment.patient_name || 'Unknown Patient'}</div>
                      <div className="text-sm text-gray-600">{appointment.appointment_type}</div>
                      <div className="text-xs text-gray-500">ID: {appointment.id.substring(0, 8)}...</div>
                    </div>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    {['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={appointment.status === status ? "default" : "outline"}
                        onClick={() => testAppointmentStatusChange(appointment.id, status)}
                        disabled={appointment.status === status}
                        className="text-xs"
                      >
                        {status.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Real-time Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-600">No logs yet... Enter a patient ID and load appointments to start testing.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-medium text-blue-900 mb-2">How to Use This Test</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Enter a patient ID that has appointments and tooth diagnoses</li>
            <li>Click "Load Appointments" to fetch test data</li>
            <li>Watch the logs for real-time subscription confirmations</li>
            <li>Click different status buttons to test appointment status changes</li>
            <li>Watch for logs showing tooth diagnosis updates</li>
            <li>Check the actual FDI chart in another tab to see if colors change</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}