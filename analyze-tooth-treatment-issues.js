// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

console.log('🔬 [ANALYSIS] Analyzing Tooth Treatment Integration Issues...')

async function analyzeToothTreatmentIssues() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey) {
      console.log('❌ [ERROR] SUPABASE_SERVICE_ROLE_KEY is required')
      return false
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('\n1️⃣ Finding "final patient"...')
    
    // Find the final patient
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .or('first_name.ilike.%final%,last_name.ilike.%final%')
      .limit(1)
    
    if (patientsError || !patients || patients.length === 0) {
      console.log('❌ [ERROR] Final patient not found')
      return false
    }
    
    const finalPatient = patients[0]
    console.log(`✅ [SUCCESS] Using patient: ${finalPatient.first_name} ${finalPatient.last_name} (${finalPatient.id})`)
    
    console.log('\n2️⃣ Analyzing tooth diagnoses - focus on tooth #31...')
    
    // Get all tooth diagnoses for this patient
    const { data: toothDiagnoses, error: diagnosesError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('patient_id', finalPatient.id)
      .order('tooth_number')
    
    if (diagnosesError) {
      console.log('❌ [ERROR] Failed to get tooth diagnoses:', diagnosesError.message)
      return false
    }
    
    console.log(`📊 [DIAGNOSES] Found ${toothDiagnoses?.length || 0} tooth diagnoses:`)
    
    let tooth31Issues = []
    let healthyButDiagnosedTeeth = []
    let cariesTeeth = []
    
    toothDiagnoses?.forEach(tooth => {
      const statusIcon = {
        'healthy': '🟢',
        'caries': '🔴', 
        'filled': '🔵',
        'crown': '🟡',
        'attention': '🟠',
        'root_canal': '🟣',
        'extraction_needed': '🔺',
        'missing': '⚫'
      }[tooth.status] || '❓'
      
      console.log(`   ${statusIcon} Tooth #${tooth.tooth_number}: ${tooth.status} (${tooth.color_code || 'no color'}) - "${tooth.primary_diagnosis}"`)
      
      // Analyze tooth #31 specifically
      if (tooth.tooth_number === '31') {
        console.log(`   🔍 [TOOTH-31 DETAILS]:`)
        console.log(`       Status: ${tooth.status}`)
        console.log(`       Color Code: ${tooth.color_code || 'MISSING'}`)
        console.log(`       Primary Diagnosis: ${tooth.primary_diagnosis || 'MISSING'}`)
        console.log(`       Recommended Treatment: ${tooth.recommended_treatment || 'MISSING'}`)
        console.log(`       Created: ${tooth.created_at}`)
        console.log(`       Updated: ${tooth.updated_at}`)
        
        if (tooth.status === 'healthy' && tooth.primary_diagnosis && !tooth.primary_diagnosis.toLowerCase().includes('healthy')) {
          tooth31Issues.push('Status is healthy but diagnosis suggests otherwise')
        }
        if (!tooth.color_code || tooth.color_code === '#22c55e') {
          tooth31Issues.push('Missing proper color code (should not be default green)')
        }
      }
      
      // Check for teeth with diagnoses but marked as healthy
      if (tooth.status === 'healthy' && tooth.primary_diagnosis && !tooth.primary_diagnosis.toLowerCase().includes('healthy')) {
        healthyButDiagnosedTeeth.push({
          tooth: tooth.tooth_number,
          diagnosis: tooth.primary_diagnosis,
          status: tooth.status
        })
      }
      
      // Track caries teeth
      if (tooth.status === 'caries') {
        cariesTeeth.push(tooth.tooth_number)
      }
    })
    
    if (tooth31Issues.length > 0) {
      console.log(`\n🚨 [TOOTH-31 ISSUES]:`)
      tooth31Issues.forEach(issue => console.log(`   ❌ ${issue}`))
    }
    
    if (healthyButDiagnosedTeeth.length > 0) {
      console.log(`\n🚨 [STATUS MISMATCH ISSUES]:`)
      console.log(`   Found ${healthyButDiagnosedTeeth.length} teeth marked as "healthy" but have actual diagnoses:`)
      healthyButDiagnosedTeeth.forEach(tooth => {
        console.log(`   ❌ Tooth #${tooth.tooth}: "${tooth.diagnosis}" but status is "${tooth.status}"`)
      })
    }
    
    console.log(`\n🔴 [CARIES TEETH]: ${cariesTeeth.join(', ')} (${cariesTeeth.length} total)`)
    
    console.log('\n3️⃣ Checking appointments and treatments...')
    
    // Get appointments for this patient
    const { data: appointments, error: appointmentsError } = await supabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('patient_id', finalPatient.id)
      .order('scheduled_date', { ascending: false })
    
    if (!appointmentsError && appointments) {
      console.log(`📅 [APPOINTMENTS] Found ${appointments.length} appointments:`)
      appointments.forEach(appt => {
        const statusIcon = {
          'scheduled': '📋',
          'confirmed': '✅',
          'in_progress': '⏳',
          'completed': '🏁',
          'cancelled': '❌',
          'no_show': '👻'
        }[appt.status] || '❓'
        
        console.log(`   ${statusIcon} ${appt.appointment_type} - ${appt.status} (${appt.scheduled_date})`)
      })
    }
    
    // Get treatments for this patient
    const { data: treatments, error: treatmentsError } = await supabase
      .schema('api')
      .from('treatments')
      .select('*')
      .eq('patient_id', finalPatient.id)
      .order('created_at', { ascending: false })
    
    if (!treatmentsError && treatments) {
      console.log(`\n🔧 [TREATMENTS] Found ${treatments.length} treatments:`)
      treatments.forEach(treatment => {
        const statusIcon = {
          'pending': '⏸️',
          'in_progress': '⏳',
          'completed': '✅',
          'cancelled': '❌'
        }[treatment.status] || '❓'
        
        console.log(`   ${statusIcon} ${treatment.treatment_type} - ${treatment.status} (tooth #${treatment.tooth_number || 'N/A'})`)
        console.log(`       Appointment ID: ${treatment.appointment_id || 'Not linked'}`)
        console.log(`       Tooth Diagnosis ID: ${treatment.tooth_diagnosis_id || 'Not linked'}`)
        
        // Check if completed treatments are properly reflected in tooth status
        if (treatment.status === 'completed' && treatment.tooth_number) {
          const toothDiag = toothDiagnoses?.find(td => td.tooth_number === treatment.tooth_number)
          if (toothDiag && toothDiag.status === 'caries') {
            console.log(`   ⚠️  [ISSUE] Tooth #${treatment.tooth_number} treatment completed but still shows as caries`)
          }
        }
      })
    }
    
    console.log('\n4️⃣ Checking appointment-teeth linkages...')
    
    // Check appointment_teeth table for proper linkages
    if (appointments && appointments.length > 0) {
      const { data: appointmentTeeth, error: appointmentTeethError } = await supabase
        .schema('api')
        .from('appointment_teeth')
        .select('*')
        .in('appointment_id', appointments.map(a => a.id))
      
      if (!appointmentTeethError) {
        console.log(`🔗 [APPOINTMENT-TEETH] Found ${appointmentTeeth?.length || 0} linkages:`)
        appointmentTeeth?.forEach(link => {
          console.log(`   🔗 Appointment ${link.appointment_id} ↔ Tooth #${link.tooth_number}`)
          console.log(`       Diagnosis ID: ${link.tooth_diagnosis_id || 'Not linked'}`)
        })
      }
    }
    
    console.log('\n5️⃣ Recommendations to fix issues:')
    
    if (tooth31Issues.length > 0) {
      console.log('\n🎯 [FIX TOOTH #31]:')
      console.log('   1. Update tooth #31 status from "healthy" to proper status (e.g., "attention", "root_canal")')
      console.log('   2. Set proper color_code based on the diagnosis')
      console.log('   3. Ensure the diagnosis matches the intended treatment')
    }
    
    if (healthyButDiagnosedTeeth.length > 0) {
      console.log('\n🎯 [FIX STATUS MISMATCHES]:')
      console.log('   1. Update tooth statuses to match their actual diagnoses')
      console.log('   2. Set appropriate color codes for each status')
      console.log('   3. Ensure the status reflects the current condition, not "healthy"')
    }
    
    console.log('\n🎯 [TREATMENT-APPOINTMENT INTEGRATION]:')
    console.log('   1. Verify completed treatments update tooth status automatically')
    console.log('   2. Check that appointment status changes trigger tooth color updates')
    console.log('   3. Ensure proper linkage between appointments, treatments, and tooth diagnoses')
    
    console.log('\n📋 [TESTING STEPS]:')
    console.log('   1. Create a new appointment for a caries tooth')
    console.log('   2. Change appointment status: scheduled → in_progress → completed')
    console.log('   3. Verify tooth color changes from red → orange → blue/filled')
    console.log('   4. Check real-time updates in multiple browser tabs')
    
    return true
    
  } catch (error) {
    console.error('❌ [FATAL] Analysis failed:', error.message)
    return false
  }
}

// Run the analysis
analyzeToothTreatmentIssues()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] Tooth Treatment Analysis Completed!')
    } else {
      console.log('\n💥 [RESULT] Tooth Treatment Analysis Failed')
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
  })