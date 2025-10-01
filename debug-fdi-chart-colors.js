// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

console.log('🔍 [FDI-DEBUG] Debugging FDI Chart Color Issues...')
console.log('🔧 [ENV] Loaded environment from .env.local')

async function debugFDIChartColors() {
  try {
    // Test with environment variables or defaults
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('🌐 [ENV] Supabase URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET')
    console.log('🔑 [ENV] Service Key:', supabaseServiceKey ? 'SET (' + supabaseServiceKey.length + ' chars)' : 'NOT SET')
    
    if (!supabaseServiceKey) {
      console.log('⚠️  [SKIP] No SUPABASE_SERVICE_ROLE_KEY found, cannot test database')
      console.log('💡 [INFO] This is likely why colors aren\'t updating - database access issue')
      return false
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('\n1️⃣ Testing database connection...')
    
    // Get a test patient
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1)
    
    if (patientsError) {
      console.log('❌ [ERROR] Cannot connect to patients table:', patientsError.message)
      return false
    }
    
    if (!patients || patients.length === 0) {
      console.log('❌ [ERROR] No patients found in database')
      return false
    }
    
    const testPatient = patients[0]
    console.log(`✅ [SUCCESS] Connected to database, using patient: ${testPatient.first_name} ${testPatient.last_name}`)
    
    console.log('\n2️⃣ Checking tooth_diagnoses table...')
    
    // Check tooth diagnoses for this patient
    const { data: toothDiagnoses, error: diagnosesError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('id, tooth_number, status, color_code, primary_diagnosis, updated_at')
      .eq('patient_id', testPatient.id)
      .order('updated_at', { ascending: false })
    
    if (diagnosesError) {
      console.log('❌ [ERROR] Cannot query tooth_diagnoses:', diagnosesError.message)
      return false
    }
    
    console.log(`📊 [INFO] Found ${toothDiagnoses?.length || 0} tooth diagnoses for this patient`)
    
    if (!toothDiagnoses || toothDiagnoses.length === 0) {
      console.log('🚨 [ROOT CAUSE] No tooth diagnoses found! This is why all teeth are showing as healthy/green')
      console.log('💡 [SOLUTION] You need to:')
      console.log('   1. Click on teeth in the FDI chart to create diagnoses')
      console.log('   2. Set tooth status (caries, filled, etc.) via right-click menu')
      console.log('   3. Or create consultations with tooth diagnoses')
      return false
    }
    
    // Analyze the tooth diagnoses
    console.log('\n3️⃣ Analyzing existing tooth diagnoses...')
    
    const statusCounts = {}
    const colorCodeCounts = {}
    
    toothDiagnoses.forEach(tooth => {
      statusCounts[tooth.status] = (statusCounts[tooth.status] || 0) + 1
      
      if (tooth.color_code) {
        colorCodeCounts[tooth.color_code] = (colorCodeCounts[tooth.color_code] || 0) + 1
      } else {
        colorCodeCounts['null'] = (colorCodeCounts['null'] || 0) + 1
      }
      
      console.log(`   Tooth #${tooth.tooth_number}: ${tooth.status} (${tooth.color_code || 'no color'}) - ${tooth.primary_diagnosis || 'no diagnosis'}`)
    })
    
    console.log('\n📈 [STATISTICS]')
    console.log('   Status distribution:', statusCounts)
    console.log('   Color code distribution:', colorCodeCounts)
    
    // Check for problematic data
    const teethWithoutColors = toothDiagnoses.filter(t => !t.color_code).length
    const healthyCount = statusCounts['healthy'] || 0
    
    if (teethWithoutColors > 0) {
      console.log(`🚨 [ISSUE] ${teethWithoutColors} teeth have no color_code - they will appear as default colors`)
    }
    
    if (healthyCount === toothDiagnoses.length) {
      console.log('🚨 [ISSUE] All teeth are marked as "healthy" - they will all be green')
      console.log('💡 [SOLUTION] Update tooth statuses to caries, filled, etc. to see different colors')
    }
    
    console.log('\n4️⃣ Testing appointment/treatment integration...')
    
    // Check appointments that might affect tooth colors
    const { data: appointments, error: appointmentsError } = await supabase
      .schema('api')
      .from('appointments')
      .select('id, status, appointment_type, scheduled_date')
      .eq('patient_id', testPatient.id)
      .limit(5)
    
    if (!appointmentsError && appointments) {
      console.log(`📅 [INFO] Found ${appointments.length} appointments`)
      appointments.forEach(appt => {
        console.log(`   Appointment: ${appt.appointment_type} - ${appt.status} (${appt.scheduled_date})`)
      })
    }
    
    // Check treatments
    const { data: treatments, error: treatmentsError } = await supabase
      .schema('api')
      .from('treatments')
      .select('id, status, treatment_type, tooth_number')
      .eq('patient_id', testPatient.id)
      .limit(5)
    
    if (!treatmentsError && treatments) {
      console.log(`🔧 [INFO] Found ${treatments.length} treatments`)
      treatments.forEach(treatment => {
        console.log(`   Treatment: ${treatment.treatment_type} - ${treatment.status} (tooth #${treatment.tooth_number || 'N/A'})`)
      })
    }
    
    console.log('\n5️⃣ Recommendations:')
    
    if (toothDiagnoses.length === 0) {
      console.log('🎯 [ACTION NEEDED] Create some tooth diagnoses first:')
      console.log('   1. Right-click on teeth in the FDI chart')
      console.log('   2. Select a status like "Caries" or "Filled"')
      console.log('   3. Save the diagnosis')
      console.log('   4. The tooth should change color immediately')
    } else if (teethWithoutColors > 0) {
      console.log('🎯 [ACTION NEEDED] Fix missing color codes:')
      console.log('   1. Update existing tooth diagnoses with proper color codes')
      console.log('   2. Or re-save the diagnoses to trigger color code generation')
    } else if (healthyCount === toothDiagnoses.length) {
      console.log('🎯 [ACTION NEEDED] Change tooth statuses:')
      console.log('   1. Update some teeth to have caries, filled, etc.')
      console.log('   2. This will give them different colors')
    } else {
      console.log('🎯 [ACTION NEEDED] Check real-time subscriptions:')
      console.log('   1. Open browser console while using FDI chart')
      console.log('   2. Look for "🦷 Real-time tooth diagnosis update:" logs')
      console.log('   3. Verify real-time subscriptions are working')
    }
    
    return true
    
  } catch (error) {
    console.error('❌ [FATAL] Debug failed:', error.message)
    return false
  }
}

// Run the debug
debugFDIChartColors()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] FDI Chart Debug Completed!')
    } else {
      console.log('\n💥 [RESULT] FDI Chart Debug Found Issues')
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
  })