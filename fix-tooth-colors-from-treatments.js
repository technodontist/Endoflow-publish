require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🦷 [FDI FIX] Fixing tooth colors based on completed treatments...')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Color mapping based on treatment types
const treatmentToColorMap = {
  'filling': { status: 'filled', color: '#3b82f6' }, // Blue
  'composite filling': { status: 'filled', color: '#3b82f6' },
  'amalgam filling': { status: 'filled', color: '#3b82f6' },
  'restoration': { status: 'filled', color: '#3b82f6' },
  'composite': { status: 'filled', color: '#3b82f6' },
  'crown': { status: 'crown', color: '#eab308' }, // Yellow
  'crown placement': { status: 'crown', color: '#eab308' },
  'onlay': { status: 'crown', color: '#eab308' },
  'cap': { status: 'crown', color: '#eab308' },
  'root canal': { status: 'root_canal', color: '#8b5cf6' }, // Purple
  'root canal therapy': { status: 'root_canal', color: '#8b5cf6' },
  'rct': { status: 'root_canal', color: '#8b5cf6' },
  'extraction': { status: 'missing', color: '#6b7280' }, // Gray
  'tooth extraction': { status: 'missing', color: '#6b7280' },
  'implant': { status: 'implant', color: '#06b6d4' }, // Cyan
  'dental implant': { status: 'implant', color: '#06b6d4' },
  'implant placement': { status: 'implant', color: '#06b6d4' },
  'scaling': { status: 'healthy', color: '#22c55e' }, // Green
  'polishing': { status: 'healthy', color: '#22c55e' },
  'cleaning': { status: 'healthy', color: '#22c55e' }
}

function getTreatmentMapping(treatmentType) {
  if (!treatmentType) return null
  
  const normalized = treatmentType.toLowerCase().trim()
  
  // Direct match
  if (treatmentToColorMap[normalized]) {
    return treatmentToColorMap[normalized]
  }
  
  // Partial match
  for (const [key, value] of Object.entries(treatmentToColorMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }
  
  return null
}

async function fixToothColorsFromTreatments() {
  try {
    console.log('\n📋 [FDI FIX] Step 1: Fetching completed treatments with tooth linkage...')

    // Get all completed treatments that have tooth information
    const { data: completedTreatments, error: treatmentsError } = await supabase
      .schema('api')
      .from('treatments')
      .select(`
        id,
        patient_id,
        appointment_id,
        consultation_id,
        treatment_type,
        tooth_number,
        tooth_diagnosis_id,
        status,
        completed_at
      `)
      .eq('status', 'completed')
      .not('tooth_number', 'is', null)

    if (treatmentsError) {
      console.error('❌ [ERROR] Failed to fetch treatments:', treatmentsError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Found ${completedTreatments?.length || 0} completed treatments with tooth linkage`)

    if (!completedTreatments || completedTreatments.length === 0) {
      console.log('ℹ️ [INFO] No completed treatments found to process')
      return true
    }

    console.log('\n📋 [FDI FIX] Step 2: Updating tooth diagnoses based on treatments...')

    let updatedCount = 0
    let errorCount = 0

    for (const treatment of completedTreatments) {
      const mapping = getTreatmentMapping(treatment.treatment_type)
      
      if (!mapping) {
        console.log(`⚠️ [SKIP] No mapping found for treatment type: ${treatment.treatment_type}`)
        continue
      }

      console.log(`\n🔄 Processing: ${treatment.treatment_type} for tooth ${treatment.tooth_number}`)
      console.log(`   Mapping to: ${mapping.status} (${mapping.color})`)

      // Update tooth diagnosis
      if (treatment.tooth_diagnosis_id) {
        // Direct update using tooth_diagnosis_id
        const { error: updateError } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .update({
            status: mapping.status,
            color_code: mapping.color,
            follow_up_required: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', treatment.tooth_diagnosis_id)

        if (updateError) {
          console.error(`❌ [ERROR] Failed to update tooth diagnosis ${treatment.tooth_diagnosis_id}:`, updateError.message)
          errorCount++
        } else {
          console.log(`✅ Updated tooth diagnosis ID: ${treatment.tooth_diagnosis_id}`)
          updatedCount++
        }
      } else if (treatment.consultation_id && treatment.tooth_number) {
        // Update using consultation_id + tooth_number
        const { error: updateError } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .update({
            status: mapping.status,
            color_code: mapping.color,
            follow_up_required: false,
            updated_at: new Date().toISOString()
          })
          .eq('consultation_id', treatment.consultation_id)
          .eq('tooth_number', treatment.tooth_number)

        if (updateError) {
          console.error(`❌ [ERROR] Failed to update tooth ${treatment.tooth_number} for consultation:`, updateError.message)
          errorCount++
        } else {
          console.log(`✅ Updated tooth ${treatment.tooth_number} via consultation linkage`)
          updatedCount++
        }
      } else if (treatment.patient_id && treatment.tooth_number) {
        // Last resort: update the most recent diagnosis for this patient/tooth
        const { data: latestDiagnosis } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('id')
          .eq('patient_id', treatment.patient_id)
          .eq('tooth_number', treatment.tooth_number)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (latestDiagnosis && latestDiagnosis[0]) {
          const { error: updateError } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .update({
              status: mapping.status,
              color_code: mapping.color,
              follow_up_required: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', latestDiagnosis[0].id)

          if (updateError) {
            console.error(`❌ [ERROR] Failed to update latest diagnosis for tooth ${treatment.tooth_number}:`, updateError.message)
            errorCount++
          } else {
            console.log(`✅ Updated tooth ${treatment.tooth_number} via latest diagnosis`)
            updatedCount++
          }
        }
      }
    }

    console.log('\n📋 [FDI FIX] Step 3: Checking for treatments linked via appointment_teeth...')

    // Also check appointment_teeth linkages
    const { data: appointmentTeeth, error: appointmentTeethError } = await supabase
      .schema('api')
      .from('appointment_teeth')
      .select(`
        appointment_id,
        tooth_number,
        tooth_diagnosis_id,
        appointments!inner(
          id,
          status,
          appointment_type,
          patient_id
        )
      `)
      .eq('appointments.status', 'completed')

    if (!appointmentTeethError && appointmentTeeth) {
      console.log(`✅ [SUCCESS] Found ${appointmentTeeth.length} completed appointments with tooth linkage`)

      for (const link of appointmentTeeth) {
        const appointmentType = link.appointments?.appointment_type
        const mapping = getTreatmentMapping(appointmentType)
        
        if (!mapping) {
          continue
        }

        if (link.tooth_diagnosis_id) {
          const { error: updateError } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .update({
              status: mapping.status,
              color_code: mapping.color,
              follow_up_required: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', link.tooth_diagnosis_id)

          if (!updateError) {
            console.log(`✅ Updated tooth ${link.tooth_number} from appointment linkage`)
            updatedCount++
          }
        }
      }
    }

    console.log('\n📋 [FDI FIX] Step 4: Fixing any missing color codes...')

    // Fix any tooth diagnoses that have status but missing color_code
    const statusToColorMap = {
      'healthy': '#22c55e',
      'caries': '#ef4444',
      'filled': '#3b82f6',
      'crown': '#eab308',
      'missing': '#6b7280',
      'attention': '#f97316',
      'root_canal': '#8b5cf6',
      'extraction_needed': '#dc2626',
      'implant': '#06b6d4'
    }

    for (const [status, color] of Object.entries(statusToColorMap)) {
      const { error: colorFixError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .update({ color_code: color })
        .eq('status', status)
        .or('color_code.is.null,color_code.eq.""')

      if (!colorFixError) {
        console.log(`✅ Fixed color codes for status: ${status}`)
      }
    }

    console.log('\n🎉 [SUCCESS] Tooth Color Fix Completed!')
    console.log(`📊 [SUMMARY]`)
    console.log(`   ✅ Successfully updated: ${updatedCount} teeth`)
    console.log(`   ❌ Errors encountered: ${errorCount}`)

    console.log('\n🚀 [NEXT STEPS]')
    console.log('   1. Refresh the FDI Chart in the dentist dashboard')
    console.log('   2. Verify that tooth colors now match completed treatments:')
    console.log('      - Blue for fillings')
    console.log('      - Yellow for crowns')
    console.log('      - Purple for root canals')
    console.log('      - Gray for extractions')
    console.log('      - Cyan for implants')
    console.log('   3. Future treatments will automatically update colors')

    return true

  } catch (error) {
    console.error('❌ [FATAL] Fix script failed:', error.message)
    return false
  }
}

// Run the fix
fixToothColorsFromTreatments()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] Tooth Color Fix COMPLETED!')
    } else {
      console.log('\n💥 [RESULT] Tooth Color Fix FAILED')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
    process.exit(1)
  })