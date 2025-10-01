require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function debugConsultationForm() {
  console.log('🔍 [DEBUG] Debugging consultation form issues...\n')

  // Simulate what the ContextualAppointmentForm does
  const patientId = '2fa4bd8a-b070-4461-80d5-f36d0a407e56' // Patient with recent consultations
  
  console.log(`Testing consultation fetch for patient: ${patientId}\n`)
  
  // Exact query from the form (lines 105-112)
  const { data: consultations, error } = await supabase
    .schema('api')
    .from('consultations')
    .select('id, consultation_date, clinical_data, treatment_plan, chief_complaint')
    .eq('patient_id', patientId)
    .order('consultation_date', { ascending: false })
    .limit(30)
  
  if (error) {
    console.error('❌ Error fetching consultations:', error)
    return
  }
  
  console.log(`✅ Found ${consultations?.length || 0} consultations using the form's query\n`)
  
  // Show what the dropdown would display
  console.log('📋 Consultations that should appear in dropdown:')
  consultations?.forEach(c => {
    const date = (c.consultation_date || '').slice(0, 10) // Form shows date only
    console.log(`   Option: ${date || c.id}`)
    console.log(`   ID: ${c.id}`)
    console.log(`   Chief Complaint: ${c.chief_complaint || 'N/A'}`)
    
    // Check if this consultation has treatments to link
    console.log('   Checking for planned treatments...')
  })
  
  // Test the treatment loading for the most recent consultation
  if (consultations && consultations.length > 0) {
    const selectedConsultationId = consultations[0].id
    console.log(`\n\n🔍 Testing treatment loading for consultation: ${selectedConsultationId}`)
    
    // Check DB treatments (same query as form line 131-136)
    const { data: dbTreat } = await supabase
      .schema('api')
      .from('treatments')
      .select('id, treatment_type, description, status, planned_status, tooth_number, consultation_id, patient_id')
      .eq('patient_id', patientId)
      .eq('consultation_id', selectedConsultationId)
    
    console.log(`\n   DB Treatments found: ${dbTreat?.length || 0}`)
    for (const t of dbTreat || []) {
      const s = String(t.planned_status || t.status || '').toLowerCase()
      if (s === 'planned' || s === 'pending') {
        const name = t.treatment_type || t.description || 'Treatment'
        const toothNum = t.tooth_number || null
        const tooth = toothNum ? ` (Tooth ${toothNum})` : ''
        console.log(`     ✅ Planned: ${name}${tooth}`)
      } else {
        console.log(`     ❌ Not planned: ${t.treatment_type} (status: ${s})`)
      }
    }
    
    // Check tooth diagnoses as fallback
    const { data: td } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('id, tooth_number, recommended_treatment, status')
      .eq('consultation_id', selectedConsultationId)
    
    console.log(`\n   Tooth diagnoses found: ${td?.length || 0}`)
    td?.forEach(row => {
      if (row.recommended_treatment) {
        console.log(`     - Tooth #${row.tooth_number}: ${row.recommended_treatment}`)
      }
    })
  }
  
  console.log('\n\n💡 Common issues and solutions:')
  console.log('1. Make sure appointment type is set to "treatment" or "follow_up"')
  console.log('2. Make sure the correct patient is selected')
  console.log('3. Treatments need status "planned" or "pending" to show up')
  console.log('4. Try refreshing the page to reload consultations')
  
  console.log('\n🎯 [RESULT] Debug completed!')
}

debugConsultationForm().catch(console.error)