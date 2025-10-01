require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function createPlannedTreatment() {
  console.log('🔧 [CREATE] Creating planned treatments for recent consultation...\n')

  // Get the recent consultation with tooth #26 that needs RCT
  const consultationId = '3dc0ccbc-0135-4cc6-a864-cc988af21813'
  const patientId = '2fa4bd8a-b070-4461-80d5-f36d0a407e56'
  
  // Check tooth diagnoses from this consultation
  const { data: toothDiagnoses } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .eq('consultation_id', consultationId)
    .eq('tooth_number', '26')
    .single()
  
  if (toothDiagnoses) {
    console.log(`Found tooth #26 diagnosis: ${toothDiagnoses.primary_diagnosis}`)
    console.log(`Recommended: ${toothDiagnoses.recommended_treatment}`)
    
    // Create a planned treatment for tooth #26
    const { data: newTreatment, error } = await supabase
      .schema('api')
      .from('treatments')
      .insert({
        patient_id: patientId,
        consultation_id: consultationId,
        treatment_type: 'Root Canal Treatment',
        tooth_number: '26',
        tooth_diagnosis_id: toothDiagnoses.id,
        status: 'pending',
        planned_status: 'planned',
        description: 'Root Canal Treatment for tooth #26',
        total_visits: 1,
        completed_visits: 0
      })
      .select()
      .single()
    
    if (!error && newTreatment) {
      console.log('\n✅ Created new planned treatment!')
      console.log(`   ID: ${newTreatment.id}`)
      console.log(`   Type: ${newTreatment.treatment_type}`)
      console.log(`   Tooth: #${newTreatment.tooth_number}`)
      console.log(`   Status: ${newTreatment.status}`)
      console.log(`   Planned Status: ${newTreatment.planned_status}`)
    } else {
      console.error('❌ Error creating treatment:', error)
    }
  }
  
  // Also create one for tooth #36 from an earlier consultation
  const earlierConsultationId = '8c64d237-42cc-4667-a236-09cc9019b096'
  
  const { data: tooth36 } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .eq('consultation_id', earlierConsultationId)
    .eq('tooth_number', '36')
    .single()
  
  if (tooth36 && tooth36.recommended_treatment?.includes('Root Canal')) {
    console.log(`\nCreating planned treatment for tooth #36...`)
    
    const { data: newTreatment36, error: error36 } = await supabase
      .schema('api')
      .from('treatments')
      .insert({
        patient_id: patientId,
        consultation_id: earlierConsultationId,
        treatment_type: 'Root Canal Treatment',
        tooth_number: '36',
        tooth_diagnosis_id: tooth36.id,
        status: 'pending',
        planned_status: 'planned',
        description: 'Root Canal Treatment for tooth #36',
        total_visits: 1,
        completed_visits: 0
      })
      .select()
      .single()
    
    if (!error36 && newTreatment36) {
      console.log('✅ Created planned treatment for tooth #36!')
    }
  }
  
  console.log('\n🎯 [RESULT] Planned treatments created!')
  console.log('\n📋 Now in the Contextual Appointment Form:')
  console.log('1. Set appointment type to "Treatment"')
  console.log('2. Select the consultation date "2025-09-26"')
  console.log('3. You should see "Root Canal Treatment (Tooth 26)" in the treatments dropdown')
  console.log('4. Or select date "2025-09-26" (earlier) for tooth #36')
}

createPlannedTreatment().catch(console.error)