require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function fixTooth11() {
  console.log('🦷 [FIX] Fixing tooth #11 root canal status...\n')

  // Find the root canal treatment for tooth 11
  console.log('📋 [FIX] Looking for tooth #11 diagnoses with Root Canal Treatment...')
  
  const { data: tooth11Diagnoses } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .eq('tooth_number', '11')
    .order('updated_at', { ascending: false })
  
  console.log(`Found ${tooth11Diagnoses?.length || 0} records for tooth #11`)
  
  // Find the one that mentions Root Canal Treatment
  const rootCanalDiagnosis = tooth11Diagnoses?.find(d => 
    d.recommended_treatment?.toLowerCase().includes('root canal') ||
    d.treatment_provided?.toLowerCase().includes('root canal')
  )
  
  if (rootCanalDiagnosis) {
    console.log(`\n✅ Found Root Canal diagnosis for tooth #11:`)
    console.log(`   Patient: ${rootCanalDiagnosis.patient_id}`)
    console.log(`   Current status: ${rootCanalDiagnosis.status}`)
    console.log(`   Treatment: ${rootCanalDiagnosis.recommended_treatment}`)
    
    // Update to root_canal status
    const { error: updateError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .update({
        status: 'root_canal',
        color_code: '#8b5cf6',  // Purple color for root canal
        follow_up_required: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', rootCanalDiagnosis.id)
    
    if (!updateError) {
      console.log('\n✅ Successfully updated tooth #11 to root_canal status!')
    } else {
      console.error('\n❌ Error updating tooth #11:', updateError)
    }
  } else {
    console.log('\n⚠️ No Root Canal diagnosis found for tooth #11')
  }

  // Also check if there are any completed Root Canal treatments we can link
  console.log('\n📋 [FIX] Looking for completed Root Canal treatments...')
  
  const { data: rootCanalTreatments } = await supabase
    .schema('api')
    .from('treatments')
    .select('*')
    .ilike('treatment_type', '%root canal%')
    .eq('status', 'completed')
  
  console.log(`Found ${rootCanalTreatments?.length || 0} completed root canal treatments`)
  
  for (const treatment of rootCanalTreatments || []) {
    console.log(`\n   Treatment ID: ${treatment.id}`)
    console.log(`   Patient: ${treatment.patient_id}`)
    console.log(`   Tooth: ${treatment.tooth_number || 'Not specified'}`)
    
    // If this treatment doesn't have a tooth number but matches the patient with tooth 11
    if (!treatment.tooth_number && rootCanalDiagnosis && treatment.patient_id === rootCanalDiagnosis.patient_id) {
      const { error } = await supabase
        .schema('api')
        .from('treatments')
        .update({ tooth_number: '11' })
        .eq('id', treatment.id)
      
      if (!error) {
        console.log('   ✅ Linked treatment to tooth #11')
      }
    }
  }
  
  console.log('\n🎯 [RESULT] Tooth #11 fix completed!')
}

fixTooth11().catch(console.error)