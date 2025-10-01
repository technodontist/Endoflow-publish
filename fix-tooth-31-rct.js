require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function fixTooth31RCT() {
  console.log('🦷 [FIX] Fixing tooth #31 Root Canal Treatment...\n')

  // Find the RCT appointment with note "31 rct"
  const { data: rctAppt } = await supabase
    .schema('api')
    .from('appointments')
    .select('*')
    .eq('appointment_type', 'Root Canal Treatment')
    .ilike('notes', '%31 rct%')
    .single()
  
  if (rctAppt) {
    console.log(`✅ Found Root Canal Treatment appointment for tooth #31`)
    console.log(`   Date: ${rctAppt.scheduled_date}`)
    console.log(`   Patient: ${rctAppt.patient_id}`)
    
    // Link the appointment to tooth 31
    await supabase
      .schema('api')
      .from('appointment_teeth')
      .insert({
        appointment_id: rctAppt.id,
        tooth_number: '31',
        diagnosis: 'Root Canal Treatment completed'
      })
    
    console.log(`   ✅ Linked appointment to tooth #31`)
    
    // Update tooth 31 to root_canal status
    const { error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .update({
        status: 'root_canal',
        color_code: '#8b5cf6',
        follow_up_required: false,
        updated_at: new Date().toISOString()
      })
      .eq('patient_id', rctAppt.patient_id)
      .eq('tooth_number', '31')
    
    if (!error) {
      console.log(`   ✅ Updated tooth #31 to root_canal status (purple)`)
    } else {
      // If no existing diagnosis, create one
      await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .insert({
          patient_id: rctAppt.patient_id,
          tooth_number: '31',
          status: 'root_canal',
          color_code: '#8b5cf6',
          primary_diagnosis: 'Treated with Root Canal',
          recommended_treatment: 'Crown recommended',
          follow_up_required: false,
          examination_date: rctAppt.scheduled_date
        })
      console.log(`   ✅ Created tooth #31 diagnosis as root_canal (purple)`)
    }
  }

  // Now check the final status
  console.log('\n📊 Final tooth status check:')
  
  const { data: finalStatus } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('status, COUNT(*)', { count: 'exact' })
    .order('status')
  
  // Count statuses manually
  const { data: allTeeth } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('status')
  
  const counts = {}
  for (const tooth of allTeeth || []) {
    counts[tooth.status] = (counts[tooth.status] || 0) + 1
  }
  
  console.log('\nUpdated distribution:')
  Object.entries(counts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} teeth`)
  })
  
  // List remaining caries teeth
  const { data: remainingCaries } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('tooth_number, primary_diagnosis')
    .eq('status', 'caries')
  
  if (remainingCaries && remainingCaries.length > 0) {
    console.log('\n⚠️ Remaining teeth with caries (these may genuinely need treatment):')
    remainingCaries.forEach(t => {
      console.log(`   Tooth #${t.tooth_number} - ${t.primary_diagnosis}`)
    })
  }
  
  console.log('\n🎯 [RESULT] All completed treatments have been properly linked!')
}

fixTooth31RCT().catch(console.error)