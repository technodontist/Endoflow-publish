'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function DatabaseCheckPage() {
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const log = (message: string) => {
    console.log(message)
    setResults(prev => [...prev, message])
  }

  const runDatabaseChecks = async () => {
    setResults([])
    setLoading(true)

    try {
      const supabase = createClient()
      log('🔍 Starting database connectivity checks...')

      // Test 1: Basic connection
      log('📡 Testing basic Supabase connection...')
      try {
        const { data: connectionTest, error: connectionError } = await supabase
          .from('patients')
          .select('count')
          .limit(1)

        if (connectionError) {
          log(`❌ Connection failed: ${JSON.stringify(connectionError)}`)
          return
        } else {
          log('✅ Basic connection successful')
        }
      } catch (e) {
        log(`❌ Connection exception: ${e}`)
        return
      }

      // Test 2: Schema access
      log('🏗️ Testing schema access...')
      try {
        const { data: schemaTest, error: schemaError } = await supabase
          .schema('api')
          .from('patients')
          .select('count')
          .limit(1)

        if (schemaError) {
          log(`❌ Schema access failed: ${JSON.stringify(schemaError)}`)
          if (schemaError.message?.includes('permission denied')) {
            log('💡 This looks like a Row Level Security (RLS) issue')
            log('💡 Check if the user has permission to read the api.patients table')
          }
        } else {
          log('✅ Schema access successful')
        }
      } catch (e) {
        log(`❌ Schema exception: ${e}`)
      }

      // Test 3: tooth_diagnoses table
      log('🦷 Testing tooth_diagnoses table access...')
      try {
        const { data: toothTest, error: toothError } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('count')
          .limit(1)

        if (toothError) {
          log(`❌ tooth_diagnoses access failed: ${JSON.stringify(toothError)}`)
          if (toothError.message?.includes('relation') && toothError.message?.includes('does not exist')) {
            log('💡 The tooth_diagnoses table does not exist in the api schema')
          }
          if (toothError.message?.includes('permission denied')) {
            log('💡 Permission denied - check RLS policies on tooth_diagnoses table')
          }
        } else {
          log('✅ tooth_diagnoses table accessible')
        }
      } catch (e) {
        log(`❌ tooth_diagnoses exception: ${e}`)
      }

      // Test 4: Check available tables
      log('📋 Checking available tables in api schema...')
      try {
        const { data: tables, error: tablesError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'api')
          .limit(10)

        if (tablesError) {
          log(`❌ Could not list tables: ${JSON.stringify(tablesError)}`)
        } else {
          log(`✅ Found ${tables?.length || 0} tables in api schema:`)
          tables?.forEach(table => log(`   - ${table.table_name}`))
        }
      } catch (e) {
        log(`❌ Tables exception: ${e}`)
      }

      // Test 5: Test with a real patient ID if provided
      const urlParams = new URLSearchParams(window.location.search)
      const testPatientId = urlParams.get('patient')
      
      if (testPatientId) {
        log(`🔍 Testing with patient ID: ${testPatientId}...`)
        try {
          const { data: patientData, error: patientError } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .select('*')
            .eq('patient_id', testPatientId)
            .limit(5)

          if (patientError) {
            log(`❌ Patient tooth data failed: ${JSON.stringify(patientError)}`)
          } else {
            log(`✅ Found ${patientData?.length || 0} tooth diagnoses for patient`)
            patientData?.slice(0, 3).forEach(tooth => {
              log(`   - Tooth ${tooth.tooth_number}: ${tooth.status} (${tooth.color_code || 'no color'})`)
            })
          }
        } catch (e) {
          log(`❌ Patient test exception: ${e}`)
        }
      } else {
        log('💡 Add ?patient=UUID to URL to test with specific patient')
      }

      log('🔍 Database checks completed')

    } catch (error) {
      log(`❌ Overall test failed: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Database Connection Test</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Database Connectivity Check</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={runDatabaseChecks} disabled={loading} className="mb-4">
            {loading ? 'Running Tests...' : 'Run Database Tests'}
          </Button>
          
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="text-gray-500">Click "Run Database Tests" to start</div>
            ) : (
              results.map((result, index) => (
                <div key={index} className="mb-1">{result}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Common Issues:</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li><strong>Permission denied:</strong> RLS policies are blocking access</li>
            <li><strong>Table does not exist:</strong> Missing database tables</li>
            <li><strong>Schema not found:</strong> API schema not configured</li>
            <li><strong>Connection failed:</strong> Supabase URL/keys incorrect</li>
          </ul>
          <p className="text-sm mt-3 text-blue-700">
            <strong>Tip:</strong> Add <code>?patient=your-patient-uuid</code> to test with specific patient data
          </p>
        </CardContent>
      </Card>
    </div>
  )
}