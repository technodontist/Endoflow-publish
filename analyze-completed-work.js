require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function analyzeCompletedWork() {
  console.log('🦷 [ANALYSIS] Analyzing all completed dental work...\n')

  // Get ALL completed appointments with dental work
  const { data: completedAppts } = await supabase
    .schema('api')
    .from('appointments')
    .select(`
      id,
      appointment_type,
      patient_id,
      scheduled_date,
      notes
    `)
    .eq('status', 'completed')
    .not('appointment_type', 'ilike', '%consultation%')
    .order('scheduled_date', { ascending: false })
  
  console.log(`Found ${completedAppts?.length || 0} completed dental appointments:\n`)
  
  const dentalWork = completedAppts?.filter(appt => {
    const type = appt.appointment_type?.toLowerCase() || ''
    return type.includes('filling') || 
           type.includes('crown') || 
           type.includes('root canal') ||
           type.includes('extraction') ||
           type.includes('cleaning') ||
           type === 'treatment'
  }) || []

  console.log('📋 Completed Dental Work:')
  for (const appt of dentalWork) {
    console.log(`\n🔧 ${appt.appointment_type}`)
    console.log(`   Date: ${appt.scheduled_date}`)
    console.log(`   Patient: ${appt.patient_id.substring(0, 8)}...`)
    
    // Check appointment_teeth linkage
    const { data: linkedTeeth } = await supabase
      .schema('api')
      .from('appointment_teeth')
      .select('tooth_number')
      .eq('appointment_id', appt.id)
    
    if (linkedTeeth && linkedTeeth.length > 0) {
      console.log(`   Linked teeth: ${linkedTeeth.map(t => '#' + t.tooth_number).join(', ')}`)
    } else {
      console.log(`   ❌ No teeth linked`)
    }
    
    if (appt.notes) {
      console.log(`   Notes: ${appt.notes}`)
    }
  }

  // Now check which teeth are showing as red but shouldn't be
  console.log('\n\n📊 Current Tooth Status Summary:')
  
  const { data: allDiagnoses } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('tooth_number, status, patient_id, primary_diagnosis, recommended_treatment')
    .order('status')
  
  const statusCounts = {}
  const cariesDetails = []
  
  for (const diag of allDiagnoses || []) {
    statusCounts[diag.status] = (statusCounts[diag.status] || 0) + 1
    if (diag.status === 'caries') {
      cariesDetails.push(diag)
    }
  }
  
  console.log('\nStatus distribution:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} teeth`)
  })
  
  console.log('\n\n🔍 Teeth currently showing as CARIES (red):')
  for (const tooth of cariesDetails) {
    console.log(`   Tooth #${tooth.tooth_number} - ${tooth.primary_diagnosis} (Rec: ${tooth.recommended_treatment})`)
  }
  
  console.log('\n🎯 [RESULT] Analysis completed!')
}

analyzeCompletedWork().catch(console.error)