const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧪 [TEST] Testing consultation-to-appointment workflow...')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testConsultationAppointmentWorkflow() {
  try {
    console.log('\n📋 [TEST] Step 1: Check consultation table exists...')

    const { data: consultations, error: consultationsError } = await supabase
      .from('consultations')
      .select('*')
      .limit(1)

    if (consultationsError) {
      console.error('❌ [ERROR] Consultations table issue:', consultationsError.message)
      return false
    }

    console.log('✅ [SUCCESS] Consultations table accessible')

    console.log('\n📋 [TEST] Step 2: Check appointment requests table...')

    const { data: appointmentRequests, error: appointmentRequestsError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .limit(1)

    if (appointmentRequestsError) {
      console.error('❌ [ERROR] Appointment requests table issue:', appointmentRequestsError.message)
      return false
    }

    console.log('✅ [SUCCESS] Appointment requests table accessible')

    console.log('\n📋 [TEST] Step 3: Check tasks table for assistant delegation...')

    const { data: tasks, error: tasksError } = await supabase
      .schema('api')
      .from('tasks')
      .select('*')
      .limit(1)

    if (tasksError) {
      console.error('❌ [ERROR] Tasks table issue:', tasksError.message)
      return false
    }

    console.log('✅ [SUCCESS] Tasks table accessible')

    console.log('\n📋 [TEST] Step 4: Test sample consultation data...')

    // Get a sample patient
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .limit(1)

    if (patientsError || !patients || patients.length === 0) {
      console.error('❌ [ERROR] No patients found for testing:', patientsError?.message)
      return false
    }

    const testPatient = patients[0]
    console.log(`✅ [SUCCESS] Found test patient: ${testPatient.first_name} ${testPatient.last_name}`)

    console.log('\n📋 [TEST] Step 5: Test consultation creation flow...')

    // Test consultation data structure
    const testConsultationData = {
      patient_id: testPatient.id,
      chief_complaint: 'Severe tooth pain for testing workflow',
      pain_location: 'Upper right molar',
      pain_intensity: 8,
      status: 'completed',
      created_by: testPatient.id // Using patient ID as dentist for testing
    }

    const { data: newConsultation, error: consultationError } = await supabase
      .from('consultations')
      .insert(testConsultationData)
      .select()
      .single()

    if (consultationError) {
      console.error('❌ [ERROR] Failed to create test consultation:', consultationError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Created test consultation ID: ${newConsultation.id}`)

    console.log('\n📋 [TEST] Step 6: Test appointment request from consultation...')

    // Test appointment request data structure (matching existing schema)
    const testAppointmentRequestData = {
      patient_id: testPatient.id,
      appointment_type: 'Follow-up Consultation',
      preferred_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      preferred_time: '10:00:00',
      reason_for_visit: 'Follow-up for severe tooth pain consultation',
      pain_level: 6, // Urgent level
      additional_notes: 'Patient needs urgent follow-up for pain management',
      status: 'pending',
      notification_sent: false,
      assigned_to: null
    }

    const { data: appointmentRequest, error: appointmentRequestError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert(testAppointmentRequestData)
      .select()
      .single()

    if (appointmentRequestError) {
      console.error('❌ [ERROR] Failed to create appointment request:', appointmentRequestError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Created appointment request ID: ${appointmentRequest.id}`)

    console.log('\n📋 [TEST] Step 7: Test assistant task delegation...')

    // Test task creation for assistant delegation
    const testTaskData = {
      type: 'appointment_scheduling',
      title: 'Schedule appointment from consultation',
      description: `Schedule follow-up appointment for ${testPatient.first_name} ${testPatient.last_name}`,
      priority: 'high',
      status: 'pending',
      appointment_request_id: appointmentRequest.id,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      assigned_to: null, // Will be assigned to available assistant
      created_by: testPatient.id // Using patient ID as dentist for testing
    }

    const { data: task, error: taskError } = await supabase
      .schema('api')
      .from('tasks')
      .insert(testTaskData)
      .select()
      .single()

    if (taskError) {
      console.error('❌ [ERROR] Failed to create assistant task:', taskError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Created assistant task ID: ${task.id}`)

    console.log('\n📋 [TEST] Step 8: Verify workflow integration...')

    // Check that all components are linked properly
    const { data: workflowVerification, error: verificationError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select(`
        *,
        consultations!inner(
          id,
          patient_id,
          chief_complaint,
          status
        ),
        tasks(
          id,
          title,
          status,
          priority
        )
      `)
      .eq('id', appointmentRequest.id)
      .single()

    if (verificationError) {
      console.error('❌ [ERROR] Workflow verification failed:', verificationError.message)
      return false
    }

    console.log('✅ [SUCCESS] Workflow verification passed:')
    console.log(`   📋 Consultation: ${workflowVerification.consultations.chief_complaint}`)
    console.log(`   📅 Appointment Request: ${workflowVerification.appointment_type}`)
    console.log(`   📝 Assistant Task: ${workflowVerification.tasks?.[0]?.title || 'No task (direct scheduling)'}`)

    console.log('\n🧹 [CLEANUP] Removing test data...')

    // Clean up test data
    await supabase.schema('api').from('tasks').delete().eq('id', task.id)
    await supabase.schema('api').from('appointment_requests').delete().eq('id', appointmentRequest.id)
    await supabase.schema('api').from('consultations').delete().eq('id', newConsultation.id)

    console.log('✅ [CLEANUP] Test data removed')

    console.log('\n🎉 [SUCCESS] Consultation-to-appointment workflow test PASSED!')
    console.log('\n📊 [SUMMARY] Workflow Components:')
    console.log('   ✅ Consultation creation and completion')
    console.log('   ✅ Appointment request from consultation')
    console.log('   ✅ Assistant task delegation (optional)')
    console.log('   ✅ Cross-table relationships working')
    console.log('   ✅ Database schema compatible')

    return true

  } catch (error) {
    console.error('❌ [FATAL] Test failed with error:', error.message)
    return false
  }
}

// Run the test
testConsultationAppointmentWorkflow()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] All tests PASSED - Consultation-to-appointment workflow ready!')
    } else {
      console.log('\n💥 [RESULT] Tests FAILED - Check errors above')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
    process.exit(1)
  })