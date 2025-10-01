const { createClient } = require('@supabase/supabase-js')

// Create a simple debug script to test the FDI chart color update flow
async function debugFDIColorUpdates() {
  console.log('🔍 [DEBUG] Starting FDI Chart Color Update Debug...')
  
  // Check if we have any test data in the database
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key'
  )

  try {
    // 1. Check if we have patients
    console.log('\n1. Checking patients...')
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(3)
    
    if (patientsError) {
      console.log('❌ Patients query failed:', patientsError.message)
      return
    }
    
    console.log(`✅ Found ${patients?.length || 0} patients`)
    if (patients && patients.length > 0) {
      const testPatient = patients[0]
      console.log(`   Using test patient: ${testPatient.first_name} ${testPatient.last_name} (${testPatient.id})`)
      
      // 2. Check tooth_diagnoses for this patient
      console.log('\n2. Checking tooth diagnoses...')
      const { data: diagnoses, error: diagnosesError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select('*')
        .eq('patient_id', testPatient.id)
        .limit(5)
      
      if (diagnosesError) {
        console.log('❌ Tooth diagnoses query failed:', diagnosesError.message)
      } else {
        console.log(`✅ Found ${diagnoses?.length || 0} tooth diagnoses`)
        diagnoses?.forEach(d => {
          console.log(`   Tooth ${d.tooth_number}: ${d.status} (${d.color_code})`)
        })
      }
      
      // 3. Check appointments for this patient
      console.log('\n3. Checking appointments...')
      const { data: appointments, error: appointmentsError } = await supabase
        .schema('api')
        .from('appointments')
        .select('*')
        .eq('patient_id', testPatient.id)
        .limit(5)
      
      if (appointmentsError) {
        console.log('❌ Appointments query failed:', appointmentsError.message)
      } else {
        console.log(`✅ Found ${appointments?.length || 0} appointments`)
        appointments?.forEach(a => {
          console.log(`   ${a.id}: ${a.appointment_type} - ${a.status} (${a.scheduled_date})`)
        })
      }
      
      // 4. Check treatments for this patient
      console.log('\n4. Checking treatments...')
      const { data: treatments, error: treatmentsError } = await supabase
        .schema('api')
        .from('treatments')
        .select('*')
        .eq('patient_id', testPatient.id)
        .limit(5)
      
      if (treatmentsError) {
        console.log('❌ Treatments query failed:', treatmentsError.message)
      } else {
        console.log(`✅ Found ${treatments?.length || 0} treatments`)
        treatments?.forEach(t => {
          console.log(`   ${t.id}: ${t.treatment_type} - ${t.status} (tooth: ${t.tooth_number})`)
        })
      }
      
      // 5. Check appointment_teeth linkage
      console.log('\n5. Checking appointment_teeth...')
      if (appointments && appointments.length > 0) {
        const { data: appointmentTeeth, error: appointmentTeethError } = await supabase
          .schema('api')
          .from('appointment_teeth')
          .select('*')
          .in('appointment_id', appointments.map(a => a.id))
        
        if (appointmentTeethError) {
          console.log('❌ Appointment teeth query failed:', appointmentTeethError.message)
        } else {
          console.log(`✅ Found ${appointmentTeeth?.length || 0} appointment-teeth links`)
          appointmentTeeth?.forEach(at => {
            console.log(`   Appointment ${at.appointment_id} -> Tooth ${at.tooth_number}`)
          })
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Debug script error:', error.message)
  }
  
  console.log('\n🔍 [DEBUG] Debug complete. Check the above output for data availability.')
  console.log('\n💡 [HINTS] For FDI chart colors to update:')
  console.log('   1. There must be tooth_diagnoses records for the patient')
  console.log('   2. Appointments must be linked to treatments (via appointment_id)')
  console.log('   3. Treatments must be linked to tooth_diagnoses (via tooth_diagnosis_id or tooth_number)')
  console.log('   4. The chart must have patientId prop set and subscribeRealtime=true')
  console.log('   5. Check browser console for real-time subscription logs')
}

// Run the debug
debugFDIColorUpdates().catch(console.error)