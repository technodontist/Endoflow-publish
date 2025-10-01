require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🦷 [CHECK] Checking tooth diagnoses data...')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkToothDiagnoses() {
  try {
    console.log('\n📋 [CHECK] Step 1: Fetching all tooth diagnoses with caries status...')

    const { data: cariesTeeth, error: cariesError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('status', 'caries')
      .limit(20)

    if (cariesError) {
      console.error('❌ [ERROR] Failed to fetch caries teeth:', cariesError.message)
      return false
    }

    console.log(`✅ [SUCCESS] Found ${cariesTeeth?.length || 0} teeth with caries status`)
    
    if (cariesTeeth && cariesTeeth.length > 0) {
      console.log('\n🦷 Teeth with caries status:')
      cariesTeeth.forEach(tooth => {
        console.log(`   Tooth #${tooth.tooth_number}: ${tooth.primary_diagnosis || 'No diagnosis'} | Color: ${tooth.color_code} | Patient: ${tooth.patient_id}`)
      })
    }

    console.log('\n📋 [CHECK] Step 2: Checking completed treatments for these patients...')

    // Get unique patient IDs
    const patientIds = [...new Set(cariesTeeth?.map(t => t.patient_id) || [])]
    
    if (patientIds.length > 0) {
      const { data: treatments, error: treatmentError } = await supabase
        .schema('api')
        .from('treatments')
        .select('*')
        .in('patient_id', patientIds)
        .eq('status', 'completed')

      if (!treatmentError) {
        console.log(`✅ [SUCCESS] Found ${treatments?.length || 0} completed treatments`)
        
        if (treatments && treatments.length > 0) {
          console.log('\n🔧 Completed treatments:')
          treatments.forEach(treatment => {
            console.log(`   Treatment: ${treatment.treatment_type} | Tooth: ${treatment.tooth_number} | Patient: ${treatment.patient_id}`)
          })
        }
      }
    }

    console.log('\n📋 [CHECK] Step 3: Checking completed appointments with treatment types...')

    const { data: completedAppointments, error: apptError } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        *,
        appointment_teeth(*)
      `)
      .eq('status', 'completed')
      .in('patient_id', patientIds)
      .limit(20)

    if (!apptError) {
      console.log(`✅ [SUCCESS] Found ${completedAppointments?.length || 0} completed appointments`)
      
      if (completedAppointments && completedAppointments.length > 0) {
        console.log('\n📅 Completed appointments:')
        completedAppointments.forEach(appt => {
          console.log(`   Type: ${appt.appointment_type} | Date: ${appt.scheduled_date} | Linked teeth: ${appt.appointment_teeth?.length || 0}`)
          if (appt.appointment_teeth && appt.appointment_teeth.length > 0) {
            appt.appointment_teeth.forEach(tooth => {
              console.log(`      - Tooth #${tooth.tooth_number}`)
            })
          }
        })
      }
    }

    console.log('\n📋 [CHECK] Step 4: Sample of all tooth statuses...')

    const { data: allStatuses, error: statusError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('status, color_code, COUNT(*)')
      .select('status, color_code')

    if (!statusError) {
      // Count statuses manually
      const statusCounts = {}
      allStatuses?.forEach(tooth => {
        const key = `${tooth.status} (${tooth.color_code || 'no color'})`
        statusCounts[key] = (statusCounts[key] || 0) + 1
      })

      console.log('\n📊 Tooth status distribution:')
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} teeth`)
      })
    }

    console.log('\n📋 [CHECK] Step 5: Checking tooth #11 specifically (shown as Root Canal in the image)...')

    const { data: tooth11, error: tooth11Error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('tooth_number', '11')
      .order('updated_at', { ascending: false })

    if (!tooth11Error && tooth11) {
      console.log(`\n🦷 Tooth #11 diagnoses (${tooth11.length} records):`)
      tooth11.forEach((record, index) => {
        console.log(`   [${index + 1}] Status: ${record.status} | Color: ${record.color_code} | Updated: ${record.updated_at}`)
        console.log(`       Diagnosis: ${record.primary_diagnosis || 'None'}`)
        console.log(`       Treatment: ${record.recommended_treatment || 'None'}`)
      })
    }

    return true

  } catch (error) {
    console.error('❌ [FATAL] Check failed:', error.message)
    return false
  }
}

// Run the check
checkToothDiagnoses()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] Data check COMPLETED!')
    } else {
      console.log('\n💥 [RESULT] Data check FAILED')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
    process.exit(1)
  })