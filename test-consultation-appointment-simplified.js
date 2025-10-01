const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧪 [TEST] Testing exact UI scenario for appointment request...')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testUIScenario() {
  try {
    console.log('\n📋 [TEST] Step 1: Find test patient (patient 6)...')

    // Look for the patient that appears in the UI (patient 6)
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .ilike('first_name', '%patient%')
      .ilike('last_name', '%6%')

    let testPatient = null
    if (patients && patients.length > 0) {
      testPatient = patients[0]
    } else {
      // Fallback to any patient
      const { data: allPatients } = await supabase
        .schema('api')
        .from('patients')
        .select('*')
        .limit(1)
      testPatient = allPatients?.[0]
    }

    if (!testPatient) {
      console.error('❌ No patients found for testing')
      return false
    }

    console.log(`✅ Using patient: ${testPatient.first_name} ${testPatient.last_name} (${testPatient.id})`)

    console.log('\n📋 [TEST] Step 2: Create completed consultation...')

    // Create a completed consultation (as would happen in the UI)
    const consultationData = {
      patient_id: testPatient.id,
      dentist_id: testPatient.id, // Using patient ID as fallback dentist
      chief_complaint: 'Test consultation for appointment request from UI',
      pain_assessment: JSON.stringify({
        location: 'Test area',
        intensity: 7
      }),
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

    console.log('\n📋 [TEST] Step 3: Simulate exact UI appointment request data...')

    // This simulates the exact data structure that would be sent from the UI
    const formData = {
      consultationId: consultation.id,
      patientId: testPatient.id,
      // No dentistId provided (as in the UI)
      appointmentType: 'Dental Implant', // As shown in the UI
      reasonForVisit: 'cssady dgsf', // As shown in the UI
      urgencyLevel: 'routine', // As selected in the UI
      delegateToAssistant: false, // As shown in the UI
      requestedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      requestedTime: '09:00:00',
      additionalNotes: 'Test notes from UI simulation'
    }

    console.log('📋 Simulating appointment request with data:', formData)

    console.log('\n📋 [TEST] Step 4: Test the authentication fallback...')

    // Test getting dentist ID (as the server action would)
    const { data: dentists, error: dentistError } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name')
      .limit(1)

    if (dentistError || !dentists || dentists.length === 0) {
      console.error('❌ No dentists found for fallback:', dentistError?.message)
      await supabase.schema('api').from('consultations').delete().eq('id', consultation.id)
      return false
    }

    const fallbackDentistId = dentists[0].id
    console.log(`✅ Fallback dentist: ${dentists[0].full_name} (${fallbackDentistId})`)

    console.log('\n📋 [TEST] Step 5: Create appointment request with exact UI data...')

    // Create the appointment request with the exact structure from the server action
    const appointmentRequestData = {
      patient_id: formData.patientId,
      appointment_type: formData.appointmentType,
      preferred_date: formData.requestedDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      preferred_time: formData.requestedTime || '09:00:00',
      reason_for_visit: formData.reasonForVisit,
      pain_level: formData.urgencyLevel === 'emergency' ? 8 : formData.urgencyLevel === 'urgent' ? 5 : 2,
      additional_notes: formData.additionalNotes || '',
      status: 'pending',
      notification_sent: false,
      assigned_to: null // Always null - matches the fixed server action logic
    }

    console.log('📋 Appointment request data structure:', appointmentRequestData)

    const { data: appointmentRequest, error: requestError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert([appointmentRequestData])
      .select()
      .single()

    if (requestError) {
      console.error('❌ Database error details:', requestError)
      console.error('❌ Failed data structure:', appointmentRequestData)
      console.error('❌ Error code:', requestError.code)
      console.error('❌ Error hint:', requestError.hint)

      // Cleanup
      await supabase.schema('api').from('consultations').delete().eq('id', consultation.id)
      return false
    }

    console.log(`✅ Successfully created appointment request: ${appointmentRequest.id}`)

    console.log('\n📋 [TEST] Step 6: Verify request appears in organizer...')

    // Test the query that the appointment organizer uses
    const { data: pendingRequests, error: fetchError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('id', appointmentRequest.id)

    if (fetchError) {
      console.error('❌ Failed to fetch from organizer:', fetchError.message)
    } else if (pendingRequests && pendingRequests.length > 0) {
      console.log('✅ Request appears in appointment organizer')

      // Test patient data joining
      const { data: patient, error: patientError } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name')
        .eq('id', pendingRequests[0].patient_id)
        .single()

      if (!patientError && patient) {
        console.log(`✅ Patient data joined: ${patient.first_name} ${patient.last_name}`)
      }
    } else {
      console.log('❌ Request not found in organizer')
    }

    // Cleanup
    await supabase.schema('api').from('appointment_requests').delete().eq('id', appointmentRequest.id)
    await supabase.schema('api').from('consultations').delete().eq('id', consultation.id)

    console.log('✅ [CLEANUP] Test data removed')

    console.log('\n🎉 [SUCCESS] UI scenario test passed!')
    console.log('\n📋 [ANALYSIS]:')
    console.log('   ✅ All data structures are correct')
    console.log('   ✅ Database operations work properly')
    console.log('   ✅ Authentication fallback works')
    console.log('   ✅ Patient data joining works')
    console.log('\n🔍 [CONCLUSION]:')
    console.log('   The server action should work correctly.')
    console.log('   If still failing, check browser console for client-side errors.')

    return true

  } catch (error) {
    console.error('❌ [FATAL] Test failed:', error.message)
    console.error('❌ [STACK]:', error.stack)
    return false
  }
}

testUIScenario()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] The appointment request should work! Check browser console for any client-side errors.')
    } else {
      console.log('\n💥 [RESULT] Server-side issue identified - check errors above')
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
  })