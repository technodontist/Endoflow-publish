// Check appointment and treatment data for debugging
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAppointmentData() {
  console.log('🔍 Checking Appointment and Treatment Data\n')
  
  // Get recent appointments
  const { data: appointments, error: aptError } = await supabase
    .schema('api')
    .from('appointments')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5)
  
  if (aptError) {
    console.error('Error fetching appointments:', aptError)
    return
  }
  
  console.log(`Found ${appointments.length} recent appointments:\n`)
  
  for (const apt of appointments) {
    console.log(`📅 Appointment ID: ${apt.id}`)
    console.log(`   Type: "${apt.appointment_type}"`)
    console.log(`   Status: ${apt.status}`)
    console.log(`   Date: ${apt.scheduled_date} ${apt.scheduled_time}`)
    console.log(`   Patient: ${apt.patient_id}`)
    console.log(`   Notes: ${apt.notes || 'N/A'}`)
    
    // Get linked treatments
    const { data: treatments } = await supabase
      .schema('api')
      .from('treatments')
      .select('*')
      .eq('appointment_id', apt.id)
    
    if (treatments && treatments.length > 0) {
      console.log(`   💊 Linked Treatments:`)
      for (const tr of treatments) {
        console.log(`      - Type: "${tr.treatment_type}"`)
        console.log(`        Status: ${tr.status}`)
        console.log(`        Tooth: ${tr.tooth_number || 'N/A'}`)
        console.log(`        Diagnosis ID: ${tr.tooth_diagnosis_id || 'N/A'}`)
        
        // If has diagnosis ID, get the diagnosis info
        if (tr.tooth_diagnosis_id) {
          const { data: diag } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .select('tooth_number, status, primary_diagnosis, recommended_treatment')
            .eq('id', tr.tooth_diagnosis_id)
            .single()
          
          if (diag) {
            console.log(`        📋 Diagnosis for Tooth #${diag.tooth_number}:`)
            console.log(`           Primary: "${diag.primary_diagnosis}"`)
            console.log(`           Recommended: "${diag.recommended_treatment}"`)
            console.log(`           Current Status: ${diag.status}`)
          }
        }
      }
    } else {
      console.log(`   💊 No linked treatments`)
    }
    console.log()
  }
  
  // Specifically check tooth #46
  console.log('\n🦷 Checking Tooth #46 Specifically:\n')
  
  const { data: tooth46 } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .eq('tooth_number', '46')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  
  if (tooth46) {
    console.log('Latest diagnosis for Tooth #46:')
    console.log(`  Primary Diagnosis: "${tooth46.primary_diagnosis}"`)
    console.log(`  Recommended Treatment: "${tooth46.recommended_treatment}"`)
    console.log(`  Current Status: ${tooth46.status}`)
    console.log(`  Color Code: ${tooth46.color_code}`)
    console.log(`  Updated: ${tooth46.updated_at}`)
  } else {
    console.log('No diagnosis found for Tooth #46')
  }
}

checkAppointmentData().catch(console.error)