require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function fixTooth46() {
  console.log('🦷 [FIX] Fixing tooth #46 status...\n')

  // Get the treatment for tooth 46
  const { data: treatment } = await supabase
    .schema('api')
    .from('treatments')
    .select('*')
    .eq('tooth_number', '46')
    .eq('status', 'completed')
    .single()
  
  if (treatment) {
    console.log(`✅ Found completed treatment for tooth #46: ${treatment.treatment_type}`)
    console.log(`   Patient: ${treatment.patient_id}`)
    
    // Determine status based on treatment type
    let status = 'filled'
    let color = '#3b82f6'
    
    const treatmentType = treatment.treatment_type?.toLowerCase() || ''
    if (treatmentType.includes('root canal')) {
      status = 'root_canal'
      color = '#8b5cf6'
    } else if (treatmentType.includes('crown')) {
      status = 'crown' 
      color = '#10b981'
    }
    
    // Update the tooth diagnosis
    const { data: updated, error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .update({
        status: status,
        color_code: color,
        follow_up_required: false,
        updated_at: new Date().toISOString()
      })
      .eq('patient_id', treatment.patient_id)
      .eq('tooth_number', '46')
      .select()
    
    if (!error) {
      console.log(`\n✅ Successfully updated tooth #46 to ${status}!`)
      console.log(`   Updated ${updated.length} records`)
    } else {
      console.error('❌ Error:', error)
    }
  }

  // Also check teeth #36 and #48 which need root canal
  console.log('\n🦷 [FIX] Checking teeth #36 and #48 (recommended for Root Canal)...')
  
  const teethNeedingRCT = ['36', '48']
  
  for (const toothNum of teethNeedingRCT) {
    const { data: diagnosis } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('tooth_number', toothNum)
      .eq('status', 'caries')
      .single()
    
    if (diagnosis && diagnosis.recommended_treatment?.includes('Root Canal')) {
      console.log(`\n🔧 Tooth #${toothNum} is recommended for Root Canal but not completed yet`)
      console.log(`   Keeping as caries (red) - this is correct!`)
      // These teeth should stay red until their root canal treatment is actually completed
    }
  }
  
  console.log('\n🎯 [RESULT] Fix completed!')
}

fixTooth46().catch(console.error)