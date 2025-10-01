'use client'

import { useState, useEffect } from 'react'
import { InteractiveDentalChart } from '@/components/dentist/interactive-dental-chart'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateAppointmentStatusAction } from '@/lib/actions/appointments'
import { createClient } from '@/lib/supabase/client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function FDIColorsTestPage() {
  const [patientId, setPatientId] = useState('')
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  
  // Auto-load patient from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlPatientId = urlParams.get('patient')
    if (urlPatientId) {
      setPatientId(urlPatientId)
      // Auto-load data after setting patient ID
      setTimeout(() => {
        loadTestData(urlPatientId)
      }, 100)
    }
  }, [])

  const log = (message: string) => {
    const time = new Date().toLocaleTimeString()
    console.log(`[${time}] ${message}`)
    setLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 15)])
  }

  const loadTestData = async (testPatientId?: string) => {
    const usePatientId = testPatientId || patientId
    if (!usePatientId.trim()) {
      log('❌ Please enter a patient ID')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // Get patient appointments
      const { data: apptData, error: apptError } = await supabase
        .schema('api')
        .from('appointments')
        .select('*, treatments(*)')
        .eq('patient_id', usePatientId)
        .limit(5)

      if (apptError) {
        log(`❌ Error loading appointments: ${apptError.message}`)
        return
      }

      setAppointments(apptData || [])
      log(`✅ Loaded ${(apptData || []).length} appointments`)

      // Check tooth diagnoses
      const { data: toothData, error: toothError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select('tooth_number, status, color_code')
        .eq('patient_id', usePatientId)
        .limit(5)

      if (toothError) {
        log(`❌ Error loading tooth diagnoses: ${toothError.message}`)
      } else {
        log(`✅ Found ${(toothData || []).length} tooth diagnoses`)
        toothData?.forEach(tooth => {
          log(`   Tooth ${tooth.tooth_number}: ${tooth.status} (${tooth.color_code})`)
        })
      }
    } catch (error) {
      log(`❌ Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const testStatusChange = async (appointmentId: string, newStatus: string) => {
    log(`🧪 Testing appointment status change: ${appointmentId.substring(0, 8)}... -> ${newStatus}`)
    
    try {
      const result = await updateAppointmentStatusAction(appointmentId, newStatus, 'test-user')
      
      if (result.success) {
        log(`✅ Appointment status updated successfully`)
        // Reload data to see changes
        setTimeout(loadTestData, 500)
      } else {
        log(`❌ Status update failed: ${result.error}`)
      }
    } catch (error) {
      log(`❌ Status update error: ${error}`)
    }
  }

  // Set up real-time monitoring
  useEffect(() => {
    if (!patientId.trim()) return

    const supabase = createClient()
    
    // Monitor tooth diagnosis changes
    const toothChannel = supabase
      .channel(`test-tooth-${patientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'api',
        table: 'tooth_diagnoses',
        filter: `patient_id=eq.${patientId}`
      }, (payload) => {
        log(`🦷 TOOTH UPDATE: ${payload.eventType} - Tooth ${(payload.new as any)?.tooth_number} -> ${(payload.new as any)?.status}`)
      })
      .subscribe((status) => {
        log(`🦷 Tooth diagnoses subscription: ${status}`)
      })

    // Monitor appointment changes
    const apptChannel = supabase
      .channel(`test-appointments-${patientId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'api',
        table: 'appointments',
        filter: `patient_id=eq.${patientId}`
      }, (payload) => {
        log(`📅 APPOINTMENT UPDATE: ${(payload.old as any)?.status} -> ${(payload.new as any)?.status}`)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(toothChannel)
      supabase.removeChannel(apptChannel)
      log('📡 Cleaned up subscriptions')
    }
  }, [patientId])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">FDI Chart Color Update Test</h1>
      
      {/* Patient ID Input */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Enter patient ID (UUID)"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={loadTestData} disabled={loading}>
              {loading ? 'Loading...' : 'Load Test Data'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Appointments */}
      {appointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{appointment.appointment_type}</div>
                      <div className="text-sm text-gray-600">
                        Status: {appointment.status} | ID: {appointment.id.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-gray-500">
                        Treatments linked: {appointment.treatments?.length || 0}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {['scheduled', 'in_progress', 'completed', 'cancelled'].map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={appointment.status === status ? "default" : "outline"}
                        onClick={() => testStatusChange(appointment.id, status)}
                        disabled={appointment.status === status}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interactive Dental Chart */}
      {patientId && (
        <Card>
          <CardHeader>
            <CardTitle>Interactive Dental Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <InteractiveDentalChart
              patientId={patientId}
              subscribeRealtime={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}