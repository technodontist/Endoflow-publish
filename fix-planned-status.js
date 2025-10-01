require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function fixPlannedStatus() {
  console.log('🔧 [FIX] Fixing planned treatment statuses...\n')

  // Update treatments that should be planned but don't have planned_status
  const { data: treatments, error } = await supabase
    .schema('api')
    .from('treatments')
    .select('*')
    .is('planned_status', null)
    .in('status', ['pending', 'scheduled'])
  
  console.log(`Found ${treatments?.length || 0} treatments that need planned_status\n`)
  
  for (const treatment of treatments || []) {
    console.log(`Updating treatment: ${treatment.treatment_type} (ID: ${treatment.id})`)
    
    const { error: updateError } = await supabase
      .schema('api')
      .from('treatments')
      .update({ planned_status: 'Planned' })
      .eq('id', treatment.id)
    
    if (!updateError) {
      console.log('   ✅ Updated to Planned status')
    } else {
      console.error('   ❌ Error:', updateError)
    }
  }
  
  // Also check the recent consultation's treatment
  const consultationId = '3dc0ccbc-0135-4cc6-a864-cc988af21813'
  console.log(`\n🔍 Checking treatment for recent consultation ${consultationId}...`)
  
  const { data: consultationTreatments } = await supabase
    .schema('api')
    .from('treatments')
    .select('*')
    .eq('consultation_id', consultationId)
  
  consultationTreatments?.forEach(t => {
    console.log(`\nTreatment: ${t.treatment_type}`)
    console.log(`   Status: ${t.status}`)
    console.log(`   Planned Status: ${t.planned_status}`)
    console.log(`   Tooth: ${t.tooth_number}`)
    
    if (t.status === 'pending' && !t.planned_status) {
      console.log('   🔧 This needs planned_status!')
    } else if (t.planned_status?.toLowerCase() === 'planned') {
      console.log('   ✅ This should show in the dropdown')
    }
  })
  
  console.log('\n🎯 [RESULT] Planned status fix completed!')
  console.log('\n📋 To see consultations in the form:')
  console.log('1. Set appointment type to "Treatment" or "Follow-up"')
  console.log('2. Select patient: 2fa4bd8a-b070-4461-80d5-f36d0a407e56')
  console.log('3. The dropdown should show dates like "2025-09-26"')
  console.log('4. After selecting a consultation, treatments should appear')
}

fixPlannedStatus().catch(console.error)