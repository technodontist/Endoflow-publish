'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function FindPatientPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const findTestPatients = async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      // Get patients with tooth diagnoses
      const { data: patientsWithTooth, error } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select(`
          patient_id,
          patients!inner(first_name, last_name),
          count:patient_id.count()
        `)
        .limit(10)

      if (error) {
        console.error('Error:', error)
        return
      }

      // Group by patient and count diagnoses
      const patientCounts = new Map()
      patientsWithTooth?.forEach(item => {
        const patientId = item.patient_id
        if (!patientCounts.has(patientId)) {
          patientCounts.set(patientId, {
            id: patientId,
            name: `${item.patients?.first_name} ${item.patients?.last_name}`,
            toothCount: 0,
            appointmentCount: 0,
            treatmentCount: 0
          })
        }
        patientCounts.get(patientId).toothCount++
      })

      // Get appointment and treatment counts for each patient
      const patientIds = Array.from(patientCounts.keys())
      
      for (const patientId of patientIds.slice(0, 5)) { // Limit to first 5 for performance
        // Get appointments count
        const { data: appointments } = await supabase
          .schema('api')
          .from('appointments')
          .select('id')
          .eq('patient_id', patientId)

        // Get treatments count  
        const { data: treatments } = await supabase
          .schema('api')
          .from('treatments')
          .select('id')
          .eq('patient_id', patientId)

        const patient = patientCounts.get(patientId)
        patient.appointmentCount = appointments?.length || 0
        patient.treatmentCount = treatments?.length || 0
      }

      setPatients(Array.from(patientCounts.values()).slice(0, 5))

    } catch (error) {
      console.error('Exception:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyPatientId = (patientId: string) => {
    navigator.clipboard.writeText(patientId)
    alert('Patient ID copied to clipboard!')
  }

  const testPatient = (patientId: string) => {
    window.open(`/test/fdi-colors?patient=${patientId}`, '_blank')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Find Test Patients</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Patients with Dental Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={findTestPatients} disabled={loading} className="mb-4">
            {loading ? 'Finding Patients...' : 'Find Test Patients'}
          </Button>
          
          {patients.length > 0 && (
            <div className="space-y-3">
              {patients.map((patient) => (
                <div key={patient.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-sm text-gray-600">
                        ID: {patient.id.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-gray-500">
                        {patient.toothCount} tooth diagnoses • {patient.appointmentCount} appointments • {patient.treatmentCount} treatments
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyPatientId(patient.id)}
                    >
                      Copy ID
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => testPatient(patient.id)}
                    >
                      Test FDI Chart
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.open(`/test/db-check?patient=${patient.id}`, '_blank')}
                    >
                      Test DB
                    </Button>
                  </div>
                  
                  <div className="mt-2 text-xs font-mono bg-gray-100 p-2 rounded">
                    {patient.id}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {patients.length === 0 && !loading && (
            <div className="text-gray-500 text-center py-8">
              Click "Find Test Patients" to discover patients with dental data
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}