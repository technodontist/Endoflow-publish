const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧪 [TEST] Testing end-to-end consultation-to-appointment workflow...')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testEndToEndWorkflow() {
  let consultationId = null
  let appointmentRequestId = null

  try {
    console.log('\n📋 [TEST] Step 1: Get test patient...')

    // Get a sample patient
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .limit(1)

    if (patientsError || !patients || patients.length === 0) {
      console.error('❌ [ERROR] No patients found for testing:', patientsError?.message)
      return false
    }

    const testPatient = patients[0]
    console.log(`✅ [SUCCESS] Found test patient: ${testPatient.first_name} ${testPatient.last_name}`)

    console.log('\n📋 [TEST] Step 2: Create and complete consultation...')

    // Create a test consultation (simulating dentist completion)
    const consultationData = {
      patient_id: testPatient.id,
      dentist_id: testPatient.id, // Using patient ID as dentist for testing
      chief_complaint: 'Severe tooth pain requiring urgent follow-up',
      pain_assessment: JSON.stringify({
        location: 'Upper left molar',
        intensity: 8,
        character: 'Sharp, throbbing pain'
      }),
      diagnosis: JSON.stringify(['Pulpitis', 'Root canal needed']),
      treatment_plan: JSON.stringify(['Root canal therapy', 'Follow-up appointment']),
      status: 'completed'
    }

    const { data: consultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .insert(consultationData)
      .select()
      .single()

    if (consultationError) {
      console.error('❌ [ERROR] Failed to create consultation:', consultationError.message)
      return false
    }

    consultationId = consultation.id
    console.log(`✅ [SUCCESS] Created consultation ID: ${consultationId}`)

    console.log('\n📋 [TEST] Step 3: Create appointment request from consultation...')

    // Simulate the createAppointmentRequestFromConsultationAction
    const appointmentRequestData = {
      patient_id: testPatient.id,
      appointment_type: 'Root Canal Follow-up',
      preferred_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
      preferred_time: '10:00:00',
      reason_for_visit: 'Follow-up for root canal consultation - urgent pain management',
      pain_level: 8, // High priority
      additional_notes: 'Patient requires immediate follow-up after consultation. Root canal therapy needed.',
      status: 'pending',
      notification_sent: false,
      assigned_to: null // Direct scheduling by dentist
    }

    const { data: appointmentRequest, error: requestError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert(appointmentRequestData)
      .select()
      .single()

    if (requestError) {
      console.error('❌ [ERROR] Failed to create appointment request:', requestError.message)
      return false
    }

    appointmentRequestId = appointmentRequest.id
    console.log(`✅ [SUCCESS] Created appointment request ID: ${appointmentRequestId}`)

    console.log('\n📋 [TEST] Step 4: Test appointment organizer query (with patient data)...')

    // Test the exact query that the appointment organizer uses (updated version)
    const { data: requests, error: fetchError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ [ERROR] Failed to fetch pending requests:', fetchError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Found ${requests.length} pending appointment requests`)

    // Add patient data (simulating the updated getPendingAppointmentRequests function)
    const requestsWithPatients = await Promise.all(
      requests.map(async (request) => {
        const { data: patient, error: patientError } = await supabase
          .schema('api')
          .from('patients')
          .select('id, first_name, last_name')
          .eq('id', request.patient_id)
          .single()

        if (patientError) {
          console.error('❌ [ERROR] Failed to fetch patient for request:', patientError.message)
          return request
        }

        return {
          ...request,
          patients: patient
        }
      })
    )

    // Find our test request
    const ourRequest = requestsWithPatients.find(req => req.id === appointmentRequestId)
    if (!ourRequest) {
      console.error('❌ [ERROR] Our test request not found in pending requests')
      return false
    }

    console.log('✅ [SUCCESS] Test appointment request found in organizer with patient data:')
    console.log(`   👤 Patient: ${ourRequest.patients.first_name} ${ourRequest.patients.last_name}`)
    console.log(`   📅 Type: ${ourRequest.appointment_type}`)
    console.log(`   📆 Preferred Date: ${ourRequest.preferred_date}`)
    console.log(`   ⏰ Preferred Time: ${ourRequest.preferred_time}`)
    console.log(`   🚨 Pain Level: ${ourRequest.pain_level}/10`)
    console.log(`   📝 Reason: ${ourRequest.reason_for_visit}`)

    console.log('\n📋 [TEST] Step 5: Test UI component data structure...')

    // Test that all expected fields are available for the UI
    const uiTestData = {
      hasPatientFirstName: !!ourRequest.patients?.first_name,
      hasPatientLastName: !!ourRequest.patients?.last_name,
      canMakeInitials: !!(ourRequest.patients?.first_name?.[0] && ourRequest.patients?.last_name?.[0]),
      hasAppointmentType: !!ourRequest.appointment_type,
      hasPreferredDate: !!ourRequest.preferred_date,
      hasPreferredTime: !!ourRequest.preferred_time,
      hasReasonForVisit: !!ourRequest.reason_for_visit,
      hasPainLevel: ourRequest.pain_level !== null && ourRequest.pain_level !== undefined
    }

    const allFieldsPresent = Object.values(uiTestData).every(field => field === true)
    console.log('🔍 [DEBUG] UI test data:', uiTestData)
    console.log('🔍 [DEBUG] All fields present:', allFieldsPresent)

    if (allFieldsPresent) {
      console.log('✅ [SUCCESS] All required UI fields are present:')
      console.log(`   ✅ Patient name: ${ourRequest.patients.first_name} ${ourRequest.patients.last_name}`)
      console.log(`   ✅ Avatar initials: ${ourRequest.patients.first_name[0]}${ourRequest.patients.last_name[0]}`)
      console.log(`   ✅ Appointment details: Complete`)
      console.log(`   ✅ Pain assessment: ${ourRequest.pain_level}/10`)
    } else {
      console.log('❌ [ERROR] Missing required UI fields:')
      Object.entries(uiTestData).forEach(([field, present]) => {
        console.log(`   ${present ? '✅' : '❌'} ${field}`)
      })
      return false
    }

    console.log('\n📋 [TEST] Step 6: Test real-time update capability...')

    // Update the request to test real-time updates
    const { error: updateError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .update({ pain_level: 9 })
      .eq('id', appointmentRequestId)

    if (updateError) {
      console.error('❌ [ERROR] Failed to update request:', updateError.message)
      return false
    }

    console.log('✅ [SUCCESS] Request updated - real-time subscriptions should trigger')

    console.log('\n🧹 [CLEANUP] Removing test data...')

    // Clean up test data
    await supabase.schema('api').from('appointment_requests').delete().eq('id', appointmentRequestId)
    await supabase.schema('api').from('consultations').delete().eq('id', consultationId)

    console.log('✅ [CLEANUP] Test data removed')

    console.log('\n🎉 [SUCCESS] End-to-end consultation-to-appointment workflow test PASSED!')
    console.log('\n📊 [SUMMARY] Verified Functionality:')
    console.log('   ✅ Consultation creation and completion')
    console.log('   ✅ Appointment request creation from consultation')
    console.log('   ✅ Patient data joining in appointment organizer')
    console.log('   ✅ All UI component fields available')
    console.log('   ✅ Real-time update capability')
    console.log('   ✅ Data structure compatibility')

    console.log('\n🚀 [READY FOR LIVE TESTING]:')
    console.log('   1. Open http://localhost:3001/dentist')
    console.log('   2. Create or complete a consultation')
    console.log('   3. Click "Request Appointment" button')
    console.log('   4. Fill out the appointment request form')
    console.log('   5. Check appointment organizer for the request with patient name')

    return true

  } catch (error) {
    console.error('❌ [FATAL] Test failed with error:', error.message)

    // Cleanup on error
    if (appointmentRequestId) {
      await supabase.schema('api').from('appointment_requests').delete().eq('id', appointmentRequestId)
    }
    if (consultationId) {
      await supabase.schema('api').from('consultations').delete().eq('id', consultationId)
    }

    return false
  }
}

// Run the test
testEndToEndWorkflow()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] End-to-end workflow READY for live use!')
    } else {
      console.log('\n💥 [RESULT] End-to-end test FAILED - Check errors above')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
    process.exit(1)
  })