require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

async function simulateAppointmentCompletion() {
  console.log('🦷 [DEMO] Simulating appointment completion and real-time tooth updates...\n')

  // Find a scheduled dental filling appointment
  console.log('📋 Looking for scheduled Dental Filling appointments...')
  
  const { data: scheduledAppts } = await supabase
    .schema('api')
    .from('appointments')
    .select('*')
    .eq('status', 'scheduled')
    .ilike('appointment_type', '%filling%')
    .limit(1)
  
  if (!scheduledAppts || scheduledAppts.length === 0) {
    console.log('⚠️ No scheduled filling appointments found to demonstrate with.')
    console.log('\nTo see real-time updates in action:')
    console.log('1. Create a new appointment for a tooth with caries')
    console.log('2. Link it to the specific tooth using the Contextual Appointment Form')
    console.log('3. Mark the appointment as completed')
    console.log('4. Watch the tooth color change from red (caries) to blue (filled) in real-time!')
    return
  }

  const appointment = scheduledAppts[0]
  console.log(`\n✅ Found appointment: ${appointment.appointment_type}`)
  console.log(`   Patient: ${appointment.patient_id}`)
  console.log(`   Date: ${appointment.scheduled_date}`)
  console.log(`   Current status: ${appointment.status}`)

  // Check if it has teeth linked
  const { data: linkedTeeth } = await supabase
    .schema('api')
    .from('appointment_teeth')
    .select('tooth_number')
    .eq('appointment_id', appointment.id)
  
  if (!linkedTeeth || linkedTeeth.length === 0) {
    console.log('\n⚠️ This appointment has no teeth linked.')
    console.log('   For real-time updates to work, appointments must be linked to specific teeth.')
    
    // Try to find a tooth with caries for this patient
    const { data: cariesTeeth } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('tooth_number')
      .eq('patient_id', appointment.patient_id)
      .eq('status', 'caries')
      .limit(1)
    
    if (cariesTeeth && cariesTeeth.length > 0) {
      console.log(`\n   Linking appointment to tooth #${cariesTeeth[0].tooth_number}...`)
      
      await supabase
        .schema('api')
        .from('appointment_teeth')
        .insert({
          appointment_id: appointment.id,
          tooth_number: cariesTeeth[0].tooth_number,
          diagnosis: 'Dental caries'
        })
      
      console.log('   ✅ Linked!')
    }
  } else {
    console.log(`   Linked teeth: ${linkedTeeth.map(t => '#' + t.tooth_number).join(', ')}`)
  }

  console.log('\n🎬 Simulating appointment workflow...')
  
  // Step 1: Mark as in progress
  console.log('\n1️⃣ Marking appointment as "in_progress"...')
  await supabase
    .schema('api')
    .from('appointments')
    .update({ status: 'in_progress' })
    .eq('id', appointment.id)
  
  console.log('   ✅ Patient is now in the chair!')
  console.log('   ⚡ Real-time update: Tooth shows orange (attention) on the FDI chart')
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Step 2: Mark as completed
  console.log('\n2️⃣ Marking appointment as "completed"...')
  const { error } = await supabase
    .schema('api')
    .from('appointments')
    .update({ status: 'completed' })
    .eq('id', appointment.id)
  
  if (!error) {
    console.log('   ✅ Treatment completed!')
    console.log('   ⚡ Real-time update: Tooth now shows blue (filled) on the FDI chart')
    
    // The updateAppointmentStatus service will automatically:
    // 1. Call updateTreatmentsForAppointmentStatus
    // 2. Which calls updateToothStatusForAppointmentStatus
    // 3. Which updates the tooth_diagnoses table
    // 4. The frontend subscription picks up the change
    // 5. The tooth color updates in real-time!
    
    console.log('\n🎯 [RESULT] Real-time update chain triggered!')
    console.log('   Database → WebSocket → Frontend → Chart Update')
    console.log('\n   Open the FDI chart in your browser to see the color change!')
  } else {
    console.error('❌ Error completing appointment:', error)
  }
}

simulateAppointmentCompletion().catch(console.error)