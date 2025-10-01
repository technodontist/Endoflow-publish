const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧪 [TEST] Testing updated pending requests query...')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testUpdatedQuery() {
  try {
    // Test the updated query logic
    const { data: requests, error } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Error fetching requests:', error.message)
      return
    }

    console.log(`📋 Found ${requests.length} pending requests`)

    if (requests.length > 0) {
      // Test fetching patient data for each request
      const requestsWithPatients = await Promise.all(
        requests.map(async (request) => {
          const { data: patient, error: patientError } = await supabase
            .schema('api')
            .from('patients')
            .select('id, first_name, last_name')
            .eq('id', request.patient_id)
            .single()

          if (patientError) {
            console.log(`❌ Error fetching patient ${request.patient_id}: ${patientError.message}`)
            return request
          }

          return {
            ...request,
            patients: patient
          }
        })
      )

      console.log('✅ [SUCCESS] Updated query results:')
      requestsWithPatients.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req.patients?.first_name || 'Unknown'} ${req.patients?.last_name || 'Patient'}`)
        console.log(`     Type: ${req.appointment_type}`)
        console.log(`     Date: ${req.preferred_date}`)
        console.log(`     Has patient data: ${req.patients ? 'YES' : 'NO'}`)
        console.log('')
      })

      // Test that the UI component would be able to access the data correctly
      console.log('🎯 [UI TEST] Testing UI component data access:')
      const firstRequest = requestsWithPatients[0]
      if (firstRequest && firstRequest.patients) {
        console.log(`✅ request.patients.first_name: ${firstRequest.patients.first_name}`)
        console.log(`✅ request.patients.last_name: ${firstRequest.patients.last_name}`)
        console.log(`✅ Avatar initials: ${firstRequest.patients.first_name[0]}${firstRequest.patients.last_name[0]}`)
      } else {
        console.log('❌ No patient data available for UI testing')
      }
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message)
  }
}

testUpdatedQuery()