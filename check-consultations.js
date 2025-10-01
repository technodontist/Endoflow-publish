require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function checkConsultations() {
  console.log('🔍 [CHECK] Checking consultations in the system...\n')

  // Get all consultations
  const { data: consultations, error } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')
    .order('consultation_date', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('❌ Error fetching consultations:', error)
    return
  }
  
  console.log(`Found ${consultations?.length || 0} recent consultations:\n`)
  
  for (const consultation of consultations || []) {
    console.log(`📋 Consultation ID: ${consultation.id}`)
    console.log(`   Date: ${consultation.consultation_date}`)
    console.log(`   Patient: ${consultation.patient_id?.substring(0, 8)}...`)
    console.log(`   Chief Complaint: ${consultation.chief_complaint || 'N/A'}`)
    console.log(`   Dentist: ${consultation.dentist_id?.substring(0, 8) || 'N/A'}...`)
    
    // Check if this consultation has tooth diagnoses
    const { data: toothDiagnoses } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('tooth_number, primary_diagnosis, recommended_treatment')
      .eq('consultation_id', consultation.id)
    
    if (toothDiagnoses && toothDiagnoses.length > 0) {
      console.log(`   Teeth examined: ${toothDiagnoses.length}`)
      toothDiagnoses.slice(0, 3).forEach(td => {
        console.log(`     - Tooth #${td.tooth_number}: ${td.primary_diagnosis} (Rec: ${td.recommended_treatment})`)
      })
      if (toothDiagnoses.length > 3) {
        console.log(`     ... and ${toothDiagnoses.length - 3} more teeth`)
      }
    } else {
      console.log(`   ⚠️ No tooth diagnoses linked`)
    }
    
    // Check treatments planned
    const { data: treatments } = await supabase
      .schema('api')
      .from('treatments')
      .select('treatment_type, status, planned_status, tooth_number')
      .eq('consultation_id', consultation.id)
    
    if (treatments && treatments.length > 0) {
      console.log(`   Treatments: ${treatments.length}`)
      treatments.forEach(t => {
        const status = t.planned_status || t.status || 'pending'
        console.log(`     - ${t.treatment_type} (${status}) ${t.tooth_number ? `for tooth #${t.tooth_number}` : ''}`)
      })
    }
    
    console.log('') // Empty line between consultations
  }
  
  // Check for a specific patient to see their consultations
  console.log('\n🔍 Checking consultations for patient with recent work...')
  
  const patientId = '2fa4bd8a-b070-4461-80d5-f36d0a407e56' // Patient with root canal work
  
  const { data: patientConsultations } = await supabase
    .schema('api')
    .from('consultations')
    .select('id, consultation_date')
    .eq('patient_id', patientId)
    .order('consultation_date', { ascending: false })
  
  console.log(`\nPatient ${patientId.substring(0, 8)}... has ${patientConsultations?.length || 0} consultations:`)
  patientConsultations?.forEach(c => {
    console.log(`   ${c.consultation_date} - ID: ${c.id}`)
  })
  
  console.log('\n🎯 [RESULT] Consultation check completed!')
}

checkConsultations().catch(console.error)