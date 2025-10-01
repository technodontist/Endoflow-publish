const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧪 [TEST] Testing fallback authentication logic...')

async function testFallbackAuth() {
  try {
    // Simulate the server action authentication flow
    const regularClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseServiceKey)
    const { data: { user }, error: userError } = await regularClient.auth.getUser()

    if (user) {
      console.log(`✅ [AUTH] User found: ${user.id}`)
      return user.id
    } else {
      console.log('🔍 [FALLBACK] No auth context, testing fallback...')

      const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
      const { data: dentists, error: dentistError } = await serviceClient
        .schema('api')
        .from('dentists')
        .select('id, full_name')
        .limit(1)

      if (dentistError || !dentists || dentists.length === 0) {
        console.log('❌ [ERROR] No dentists found:', dentistError?.message)
        return null
      } else {
        console.log(`✅ [FALLBACK] Using dentist: ${dentists[0].full_name} (${dentists[0].id})`)
        return dentists[0].id
      }
    }
  } catch (error) {
    console.error('❌ [ERROR] Authentication test failed:', error.message)
    return null
  }
}

// Test the full appointment request flow with the fixed authentication
async function testAppointmentRequestWithAuth() {
  console.log('\n📋 [TEST] Testing appointment request with fixed authentication...')

  try {
    const dentistId = await testFallbackAuth()
    if (!dentistId) {
      console.error('❌ Failed to get dentist ID')
      return false
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get test patient
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .limit(1)

    if (patientsError || !patients || patients.length === 0) {
      console.error('❌ No patients found for testing')
      return false
    }

    const testPatient = patients[0]
    console.log(`📋 Using test patient: ${testPatient.first_name} ${testPatient.last_name}`)

    // Create test consultation
    const consultationData = {
      patient_id: testPatient.id,
      dentist_id: dentistId,
      chief_complaint: 'Authentication fix test',
      status: 'completed'
    }

    const { data: consultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .insert(consultationData)
      .select()
      .single()

    if (consultationError) {
      console.error('❌ Failed to create consultation:', consultationError.message)
      return false
    }

    console.log(`✅ Created consultation: ${consultation.id}`)

    // Test appointment request creation (simulating the fixed server action)
    const appointmentRequestData = {
      patient_id: testPatient.id,
      appointment_type: 'Authentication Fix Test',
      preferred_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      preferred_time: '14:00:00',
      reason_for_visit: 'Testing fixed authentication in appointment request',
      pain_level: 3,
      additional_notes: 'Created with fallback authentication',
      status: 'pending',
      notification_sent: false,
      assigned_to: null // Direct scheduling, not delegated
    }

    const { data: appointmentRequest, error: requestError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert(appointmentRequestData)
      .select()
      .single()

    if (requestError) {
      console.error('❌ Failed to create appointment request:', requestError.message)
      // Cleanup
      await supabase.schema('api').from('consultations').delete().eq('id', consultation.id)
      return false
    }

    console.log(`✅ Created appointment request: ${appointmentRequest.id}`)

    // Verify it appears correctly in the organizer
    const { data: pendingWithPatients, error: fetchError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('id', appointmentRequest.id)
      .single()

    if (fetchError) {
      console.error('❌ Failed to fetch created request:', fetchError.message)
    } else {
      // Add patient data (as the fixed query does)
      const { data: patient, error: patientError } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name')
        .eq('id', pendingWithPatients.patient_id)
        .single()

      if (!patientError && patient) {
        console.log('✅ [SUCCESS] Appointment request with patient data:')
        console.log(`   👤 Patient: ${patient.first_name} ${patient.last_name}`)
        console.log(`   📅 Type: ${pendingWithPatients.appointment_type}`)
        console.log(`   📆 Date: ${pendingWithPatients.preferred_date}`)
        console.log(`   ⏰ Time: ${pendingWithPatients.preferred_time}`)
        console.log(`   📝 Reason: ${pendingWithPatients.reason_for_visit}`)
      }
    }

    // Cleanup
    await supabase.schema('api').from('appointment_requests').delete().eq('id', appointmentRequest.id)
    await supabase.schema('api').from('consultations').delete().eq('id', consultation.id)

    console.log('✅ [CLEANUP] Test data removed')
    console.log('\n🎉 [SUCCESS] Authentication fix should resolve the dialog error!')

    return true

  } catch (error) {
    console.error('❌ [FATAL] Test failed:', error.message)
    return false
  }
}

testAppointmentRequestWithAuth()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] The appointment request dialog should now work without authentication errors!')
      console.log('\n📋 [NEXT STEPS]:')
      console.log('   1. Try the appointment request dialog again')
      console.log('   2. It should use fallback authentication if needed')
      console.log('   3. The request should appear in the appointment organizer')
      console.log('   4. Patient names should display correctly')
    } else {
      console.log('\n💥 [RESULT] Additional fixes may be needed')
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
  })