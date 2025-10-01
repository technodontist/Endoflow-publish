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

async function checkSchema() {
  console.log('🔍 [SCHEMA] Checking database schema...\n')

  // Check treatments table columns
  console.log('📋 [SCHEMA] Checking treatments table schema...')
  const { data: treatments, error: treatError } = await supabase
    .schema('api')
    .from('treatments')
    .select('*')
    .limit(1)
  
  if (treatError) {
    console.error('❌ Error checking treatments:', treatError)
  } else if (treatments.length > 0) {
    console.log('✅ Treatments table columns:')
    Object.keys(treatments[0]).forEach(col => {
      console.log(`   - ${col}`)
    })
  }

  // Check a specific treatment with tooth associations
  console.log('\n📋 [SCHEMA] Checking treatments with tooth associations...')
  const { data: treatmentsWithTeeth, error: treatWithTeethError } = await supabase
    .schema('api')
    .from('treatments')
    .select(`
      id,
      treatment_type,
      tooth_number,
      tooth_diagnosis_id,
      consultation_id,
      patient_id,
      status
    `)
    .not('tooth_number', 'is', null)
    .limit(10)
  
  if (!treatWithTeethError && treatmentsWithTeeth.length > 0) {
    console.log(`✅ Found ${treatmentsWithTeeth.length} treatments with tooth_number:`)
    treatmentsWithTeeth.forEach(t => {
      console.log(`   Treatment: ${t.treatment_type} | Tooth: ${t.tooth_number} | Status: ${t.status}`)
    })
  } else {
    console.log('⚠️ No treatments found with tooth_number associations')
  }

  // Check appointment_teeth entries
  console.log('\n📋 [SCHEMA] Checking appointment_teeth entries...')
  const { data: appointmentTeeth, error: apptTeethError } = await supabase
    .schema('api')
    .from('appointment_teeth')
    .select(`
      appointment_id,
      tooth_number,
      tooth_diagnosis_id,
      diagnosis,
      appointments!appointment_id (
        id,
        appointment_type,
        status
      )
    `)
    .limit(10)
  
  if (!apptTeethError && appointmentTeeth.length > 0) {
    console.log(`✅ Found ${appointmentTeeth.length} appointment_teeth entries:`)
    appointmentTeeth.forEach(at => {
      const appt = at.appointments
      console.log(`   Appointment: ${appt?.appointment_type || 'N/A'} | Tooth: ${at.tooth_number} | Status: ${appt?.status || 'N/A'}`)
    })
  } else {
    console.log('⚠️ No appointment_teeth entries found')
  }

  // Check how teeth are being linked when creating appointments
  console.log('\n📋 [SCHEMA] Checking recent appointments with treatment type...')
  const { data: recentAppointments, error: recentError } = await supabase
    .schema('api')
    .from('appointments')
    .select(`
      id,
      appointment_type,
      status,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (!recentError && recentAppointments.length > 0) {
    console.log(`✅ Recent appointments:`)
    for (const appt of recentAppointments) {
      // Check if this appointment has teeth linked
      const { data: linkedTeeth } = await supabase
        .schema('api')
        .from('appointment_teeth')
        .select('tooth_number')
        .eq('appointment_id', appt.id)
      
      const teethNumbers = linkedTeeth?.map(t => t.tooth_number).join(', ') || 'None'
      console.log(`   ${appt.appointment_type} | Status: ${appt.status} | Linked teeth: ${teethNumbers}`)
    }
  }

  console.log('\n🎯 [RESULT] Schema check completed!')
}

checkSchema().catch(console.error)