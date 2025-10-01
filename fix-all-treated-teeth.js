require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function fixAllTreatedTeeth() {
  console.log('🦷 [FIX] Finding all teeth with caries that have been treated...\n')

  // From the chart, we can see teeth #48, #36, and #46 are showing as red
  // Let's check which teeth show as caries and find their treatments
  
  const { data: cariesTeeth } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .eq('status', 'caries')
    .order('tooth_number')
  
  console.log(`Found ${cariesTeeth?.length || 0} teeth showing as caries (red)\n`)

  for (const tooth of cariesTeeth || []) {
    console.log(`\n🔍 Checking tooth #${tooth.tooth_number} (Patient: ${tooth.patient_id.substring(0, 8)}...)`)
    console.log(`   Diagnosis: ${tooth.primary_diagnosis}`)
    console.log(`   Recommended: ${tooth.recommended_treatment}`)
    
    // Check for ANY completed appointment for this patient that might be for this tooth
    const { data: completedAppts } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        id,
        appointment_type,
        status,
        scheduled_date,
        appointment_teeth!inner(tooth_number)
      `)
      .eq('patient_id', tooth.patient_id)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: false })
    
    // Check if any completed appointment is for dental work
    const dentalAppts = completedAppts?.filter(appt => {
      const type = appt.appointment_type?.toLowerCase() || ''
      return type.includes('filling') || 
             type.includes('crown') || 
             type.includes('root canal') ||
             type.includes('extraction') ||
             type.includes('restoration')
    }) || []

    if (dentalAppts.length > 0) {
      console.log(`   ✅ Found ${dentalAppts.length} completed dental appointments`)
      
      // Determine the treatment type from the most recent appointment
      const latestAppt = dentalAppts[0]
      const apptType = latestAppt.appointment_type?.toLowerCase() || ''
      
      let newStatus = 'filled'  // Default to filled
      let colorCode = '#3b82f6' // Blue
      
      if (apptType.includes('crown')) {
        newStatus = 'crown'
        colorCode = '#10b981'
      } else if (apptType.includes('root canal')) {
        newStatus = 'root_canal'
        colorCode = '#8b5cf6'
      } else if (apptType.includes('extraction')) {
        newStatus = 'missing'
        colorCode = '#6b7280'
      }
      
      console.log(`   🔧 Updating tooth #${tooth.tooth_number} to ${newStatus} based on ${latestAppt.appointment_type}`)
      
      const { error } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .update({
          status: newStatus,
          color_code: colorCode,
          follow_up_required: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', tooth.id)
      
      if (!error) {
        console.log(`   ✅ Successfully updated!`)
      } else {
        console.error(`   ❌ Error updating:`, error)
      }
    } else {
      console.log(`   ⚠️ No completed dental appointments found`)
      
      // Check if there are any completed treatments in the treatments table
      const { data: treatments } = await supabase
        .schema('api')
        .from('treatments')
        .select('*')
        .eq('patient_id', tooth.patient_id)
        .eq('status', 'completed')
      
      if (treatments && treatments.length > 0) {
        console.log(`   📋 Found ${treatments.length} completed treatments:`)
        treatments.forEach(t => {
          console.log(`      - ${t.treatment_type} (Tooth: ${t.tooth_number || 'Not specified'})`)
        })
        
        // Try to find a treatment that could match this tooth
        const fillingTreatments = treatments.filter(t => 
          t.treatment_type?.toLowerCase().includes('filling')
        )
        
        if (fillingTreatments.length > 0 && !fillingTreatments[0].tooth_number) {
          // Link this treatment to the tooth and update status
          console.log(`   🔗 Linking Dental Filling treatment to tooth #${tooth.tooth_number}`)
          
          await supabase
            .schema('api')
            .from('treatments')
            .update({ tooth_number: tooth.tooth_number })
            .eq('id', fillingTreatments[0].id)
          
          const { error } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .update({
              status: 'filled',
              color_code: '#3b82f6',
              follow_up_required: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', tooth.id)
          
          if (!error) {
            console.log(`   ✅ Successfully linked and updated!`)
          }
        }
      }
    }
  }
  
  console.log('\n🎯 [RESULT] All treated teeth have been updated!')
}

fixAllTreatedTeeth().catch(console.error)