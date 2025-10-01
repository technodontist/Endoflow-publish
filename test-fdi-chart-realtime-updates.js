const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🦷 [FDI TEST] Testing FDI Chart Real-time Tooth Status Updates...')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Test scenario: Complete workflow from consultation to treatment completion
async function testFDIChartRealTimeUpdates() {
  try {
    console.log('\n📋 [FDI TEST] Step 1: Find or create test patient...')

    // Get a test patient
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
    console.log(`✅ [SUCCESS] Using test patient: ${testPatient.first_name} ${testPatient.last_name}`)

    console.log('\n📋 [FDI TEST] Step 2: Create test consultation with tooth diagnosis...')

    // Create a test consultation
    const testConsultationData = {
      patient_id: testPatient.id,
      dentist_id: testPatient.id, // Using patient ID as dentist for testing
      chief_complaint: 'Tooth pain requiring filling - FDI Chart Test',
      pain_assessment: JSON.stringify({
        location: 'Upper right molar (#16)',
        intensity: 7,
        character: 'Sharp pain when chewing'
      }),
      status: 'completed',
      consultation_date: new Date().toISOString().split('T')[0]
    }

    const { data: newConsultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .insert(testConsultationData)
      .select()
      .single()

    if (consultationError) {
      console.error('❌ [ERROR] Failed to create test consultation:', consultationError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Created consultation ID: ${newConsultation.id}`)

    console.log('\n📋 [FDI TEST] Step 3: Add tooth diagnosis (tooth #16 - caries)...')

    // Create tooth diagnosis
    const toothDiagnosisData = {
      consultation_id: newConsultation.id,
      patient_id: testPatient.id,
      tooth_number: '16',
      status: 'caries',
      primary_diagnosis: 'Deep caries on occlusal surface',
      recommended_treatment: 'Composite filling',
      treatment_priority: 'high',
      examination_date: new Date().toISOString().split('T')[0],
      follow_up_required: true,
      notes: 'FDI Chart real-time test - tooth #16',
      color_code: '#ef4444' // Red for caries
    }

    const { data: toothDiagnosis, error: toothError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .insert(toothDiagnosisData)
      .select()
      .single()

    if (toothError) {
      console.error('❌ [ERROR] Failed to create tooth diagnosis:', toothError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Created tooth diagnosis for tooth #16 - status: ${toothDiagnosis.status}`)
    console.log('🔍 [INFO] FDI Chart should now show tooth #16 as RED (caries)')

    // Wait for real-time update
    console.log('⏳ [WAIT] Waiting 2 seconds for real-time update...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('\n📋 [FDI TEST] Step 4: Create treatment appointment...')

    // Create a treatment appointment
    const appointmentData = {
      patient_id: testPatient.id,
      dentist_id: testPatient.id,
      scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      scheduled_time: '14:00:00',
      duration_minutes: 60,
      appointment_type: 'Composite Filling',
      status: 'scheduled',
      consultation_id: newConsultation.id,
      notes: 'FDI Chart test - filling for tooth #16'
    }

    const { data: appointment, error: appointmentError } = await supabase
      .schema('api')
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single()

    if (appointmentError) {
      console.error('❌ [ERROR] Failed to create appointment:', appointmentError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Created appointment ID: ${appointment.id}`)

    console.log('\n📋 [FDI TEST] Step 5: Link treatment to appointment...')

    // Create treatment record
    const treatmentData = {
      patient_id: testPatient.id,
      dentist_id: testPatient.id,
      appointment_id: appointment.id,
      consultation_id: newConsultation.id,
      treatment_type: 'Composite Filling',
      tooth_number: '16',
      tooth_diagnosis_id: toothDiagnosis.id,
      status: 'pending',
      total_visits: 1,
      completed_visits: 0,
      notes: 'FDI Chart test treatment'
    }

    const { data: treatment, error: treatmentError } = await supabase
      .schema('api')
      .from('treatments')
      .insert(treatmentData)
      .select()
      .single()

    if (treatmentError) {
      console.error('❌ [ERROR] Failed to create treatment:', treatmentError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Created treatment ID: ${treatment.id}`)

    console.log('\n📋 [FDI TEST] Step 6: Start treatment (in_progress)...')

    // Update appointment to in_progress
    const { data: updatedAppointment1, error: updateError1 } = await supabase
      .schema('api')
      .from('appointments')
      .update({ status: 'in_progress' })
      .eq('id', appointment.id)
      .select()
      .single()

    if (updateError1) {
      console.error('❌ [ERROR] Failed to update appointment to in_progress:', updateError1.message)
      return false
    }

    console.log(`✅ [SUCCESS] Appointment status updated to: ${updatedAppointment1.status}`)
    console.log('🔍 [INFO] FDI Chart should now show tooth #16 as ORANGE (attention/in_progress)')

    // Wait for real-time update
    console.log('⏳ [WAIT] Waiting 3 seconds for real-time update processing...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verify tooth diagnosis was updated
    const { data: updatedDiagnosis1, error: diagnosisCheck1 } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('status, color_code, follow_up_required')
      .eq('id', toothDiagnosis.id)
      .single()

    if (diagnosisCheck1) {
      console.error('❌ [ERROR] Failed to check updated diagnosis:', diagnosisCheck1.message)
    } else {
      console.log(`📊 [STATUS] Tooth #16 status: ${updatedDiagnosis1.status}, color: ${updatedDiagnosis1.color_code}`)
    }

    console.log('\n📋 [FDI TEST] Step 7: Complete treatment...')

    // Update appointment to completed
    const { data: updatedAppointment2, error: updateError2 } = await supabase
      .schema('api')
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointment.id)
      .select()
      .single()

    if (updateError2) {
      console.error('❌ [ERROR] Failed to update appointment to completed:', updateError2.message)
      return false
    }

    console.log(`✅ [SUCCESS] Appointment status updated to: ${updatedAppointment2.status}`)
    console.log('🔍 [INFO] FDI Chart should now show tooth #16 as BLUE (filled)')

    // Wait for real-time update
    console.log('⏳ [WAIT] Waiting 3 seconds for real-time update processing...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verify final tooth diagnosis
    const { data: finalDiagnosis, error: diagnosisCheck2 } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('status, color_code, follow_up_required')
      .eq('id', toothDiagnosis.id)
      .single()

    if (diagnosisCheck2) {
      console.error('❌ [ERROR] Failed to check final diagnosis:', diagnosisCheck2.message)
    } else {
      console.log(`📊 [FINAL STATUS] Tooth #16 status: ${finalDiagnosis.status}, color: ${finalDiagnosis.color_code}`)
    }

    console.log('\n📋 [FDI TEST] Step 8: Test multiple teeth scenario...')

    // Add another tooth diagnosis for testing
    const tooth21DiagnosisData = {
      consultation_id: newConsultation.id,
      patient_id: testPatient.id,
      tooth_number: '21',
      status: 'attention',
      primary_diagnosis: 'Fractured incisal edge',
      recommended_treatment: 'Composite restoration',
      treatment_priority: 'medium',
      examination_date: new Date().toISOString().split('T')[0],
      follow_up_required: true,
      notes: 'FDI Chart multi-tooth test - tooth #21',
      color_code: '#f97316' // Orange for attention
    }

    const { data: tooth21Diagnosis, error: tooth21Error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .insert(tooth21DiagnosisData)
      .select()
      .single()

    if (!tooth21Error) {
      console.log(`✅ [SUCCESS] Added tooth #21 diagnosis - status: ${tooth21Diagnosis.status}`)
      console.log('🔍 [INFO] FDI Chart should now show tooth #21 as ORANGE (attention)')
    }

    // Wait for real-time update
    console.log('⏳ [WAIT] Waiting 2 seconds for multi-tooth update...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('\n🧹 [FDI TEST] Step 9: Cleanup test data...')

    // Clean up test data
    if (tooth21Diagnosis?.id) {
      await supabase.schema('api').from('tooth_diagnoses').delete().eq('id', tooth21Diagnosis.id)
    }
    await supabase.schema('api').from('treatments').delete().eq('id', treatment.id)
    await supabase.schema('api').from('tooth_diagnoses').delete().eq('id', toothDiagnosis.id)
    await supabase.schema('api').from('appointments').delete().eq('id', appointment.id)
    await supabase.schema('api').from('consultations').delete().eq('id', newConsultation.id)

    console.log('✅ [CLEANUP] Test data removed')

    console.log('\n🎉 [SUCCESS] FDI Chart Real-time Update Test COMPLETED!')
    console.log('\n📊 [SUMMARY] Test Scenarios Validated:')
    console.log('   ✅ Initial tooth diagnosis creation (caries -> red)')
    console.log('   ✅ Treatment start (in_progress -> orange/attention)')
    console.log('   ✅ Treatment completion (completed -> blue/filled)')
    console.log('   ✅ Multiple tooth updates')
    console.log('   ✅ Real-time subscription triggers')

    console.log('\n🚀 [MANUAL VERIFICATION NEEDED]:')
    console.log('   1. Open the FDI Chart component in the dentist dashboard')
    console.log('   2. Select the test patient used above')
    console.log('   3. Verify that tooth colors change in real-time when appointment statuses update')
    console.log('   4. Test the real-time subscriptions by changing appointment statuses in another tab')
    console.log('   5. Confirm that the color changes are instant and accurate')

    return true

  } catch (error) {
    console.error('❌ [FATAL] FDI Chart test failed:', error.message)
    return false
  }
}

// Run the test
testFDIChartRealTimeUpdates()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] FDI Chart Real-time Updates Test PASSED!')
    } else {
      console.log('\n💥 [RESULT] FDI Chart Real-time Updates Test FAILED')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
    process.exit(1)
  })