require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function fixToothLinkages() {
  console.log('🔧 [FIX] Starting tooth linkage repair...\n')

  // Step 1: Find treatments that should have tooth numbers but don't
  console.log('📋 [FIX] Finding treatments missing tooth_number...')
  const { data: treatmentsToFix, error: treatError } = await supabase
    .schema('api')
    .from('treatments')
    .select(`
      id,
      treatment_type,
      description,
      patient_id,
      consultation_id,
      appointment_id,
      status
    `)
    .is('tooth_number', null)
    .limit(50)
  
  if (treatError) {
    console.error('❌ Error finding treatments:', treatError)
    return
  }

  console.log(`✅ Found ${treatmentsToFix.length} treatments without tooth_number`)

  // Step 2: For each treatment, try to find the tooth from consultation data
  let fixedCount = 0
  for (const treatment of treatmentsToFix) {
    const treatmentType = treatment.treatment_type?.toLowerCase() || ''
    
    // Skip consultations - they don't need tooth numbers
    if (treatmentType === 'consultation' || treatmentType === 'first_visit') {
      continue
    }

    console.log(`\n🔍 Processing treatment: ${treatment.treatment_type} (${treatment.id})`)

    // Try to find tooth info from tooth_diagnoses for this consultation
    if (treatment.consultation_id) {
      const { data: toothDiagnoses } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select('tooth_number, primary_diagnosis, recommended_treatment')
        .eq('consultation_id', treatment.consultation_id)
        .eq('patient_id', treatment.patient_id)

      if (toothDiagnoses && toothDiagnoses.length > 0) {
        // Try to match treatment type with recommended treatments
        let matchedTooth = null
        
        for (const td of toothDiagnoses) {
          const recTreatment = td.recommended_treatment?.toLowerCase() || ''
          if (
            (treatmentType.includes('filling') && recTreatment.includes('filling')) ||
            (treatmentType.includes('root canal') && recTreatment.includes('root canal')) ||
            (treatmentType.includes('crown') && recTreatment.includes('crown')) ||
            (treatmentType.includes('extraction') && recTreatment.includes('extraction'))
          ) {
            matchedTooth = td
            break
          }
        }

        if (matchedTooth) {
          // Update the treatment with the tooth number
          const { error: updateError } = await supabase
            .schema('api')
            .from('treatments')
            .update({ tooth_number: matchedTooth.tooth_number })
            .eq('id', treatment.id)

          if (!updateError) {
            console.log(`  ✅ Updated treatment with tooth #${matchedTooth.tooth_number}`)
            fixedCount++

            // Also create appointment_teeth entry if appointment exists
            if (treatment.appointment_id) {
              const { error: linkError } = await supabase
                .schema('api')
                .from('appointment_teeth')
                .insert({
                  appointment_id: treatment.appointment_id,
                  consultation_id: treatment.consultation_id,
                  tooth_number: matchedTooth.tooth_number,
                  diagnosis: matchedTooth.primary_diagnosis
                })

              if (!linkError) {
                console.log(`  ✅ Created appointment_teeth link`)
              } else if (linkError.code !== '23505') { // Ignore duplicate key errors
                console.warn(`  ⚠️ Could not create appointment_teeth link:`, linkError.message)
              }
            }
          } else {
            console.error(`  ❌ Failed to update treatment:`, updateError.message)
          }
        } else {
          console.log(`  ⚠️ No matching tooth diagnosis found for ${treatmentType}`)
        }
      }
    }
  }

  console.log(`\n✨ Fixed ${fixedCount} treatments with tooth linkages`)

  // Step 3: Update tooth statuses for completed treatments
  console.log('\n📋 [FIX] Updating tooth statuses for completed treatments...')
  
  const { data: completedTreatments } = await supabase
    .schema('api')
    .from('treatments')
    .select(`
      id,
      treatment_type,
      tooth_number,
      patient_id,
      consultation_id,
      status
    `)
    .eq('status', 'completed')
    .not('tooth_number', 'is', null)
    .limit(100)

  let statusUpdateCount = 0
  for (const treatment of completedTreatments || []) {
    const toothNumber = treatment.tooth_number
    const treatmentType = treatment.treatment_type?.toLowerCase() || ''
    
    // Determine the appropriate status based on treatment type
    let newStatus = 'healthy'
    let colorCode = '#22c55e'
    
    if (treatmentType.includes('filling')) {
      newStatus = 'filled'
      colorCode = '#3b82f6'
    } else if (treatmentType.includes('root canal')) {
      newStatus = 'root_canal'
      colorCode = '#8b5cf6'
    } else if (treatmentType.includes('crown')) {
      newStatus = 'crown'
      colorCode = '#10b981'
    } else if (treatmentType.includes('extraction')) {
      newStatus = 'missing'
      colorCode = '#6b7280'
    }

    // Update the tooth diagnosis
    const { error: updateError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .update({
        status: newStatus,
        color_code: colorCode,
        follow_up_required: false,
        updated_at: new Date().toISOString()
      })
      .eq('patient_id', treatment.patient_id)
      .eq('tooth_number', toothNumber)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!updateError) {
      console.log(`  ✅ Updated tooth #${toothNumber} to ${newStatus} for completed ${treatment.treatment_type}`)
      statusUpdateCount++
    }
  }

  console.log(`\n✨ Updated ${statusUpdateCount} tooth statuses`)
  console.log('\n🎯 [RESULT] Tooth linkage repair completed!')
}

fixToothLinkages().catch(console.error)
