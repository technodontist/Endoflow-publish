const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testSchema() {
  try {
    console.log('🔍 Testing prescription alarms schema...')

    // Test api.prescription_alarms table
    console.log('\n📋 Testing api.prescription_alarms table...')
    const { data: alarmsData, error: alarmsError } = await supabase
      .schema('api')
      .from('prescription_alarms')
      .select('*')
      .limit(1)

    if (alarmsError) {
      console.log('❌ prescription_alarms error:', alarmsError.message)
    } else {
      console.log('✅ prescription_alarms table accessible')
      console.log('📊 Current records:', alarmsData?.length || 0)
    }

    // Test api.alarm_instances table
    console.log('\n📋 Testing api.alarm_instances table...')
    const { data: instancesData, error: instancesError } = await supabase
      .schema('api')
      .from('alarm_instances')
      .select('*')
      .limit(1)

    if (instancesError) {
      console.log('❌ alarm_instances error:', instancesError.message)
    } else {
      console.log('✅ alarm_instances table accessible')
      console.log('📊 Current records:', instancesData?.length || 0)
    }

    // Test creating a sample alarm
    console.log('\n🧪 Testing alarm creation...')

    // First, let's see if we have any patients
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('role', 'patient')
      .limit(1)

    if (profilesError) {
      console.log('❌ Could not fetch patients:', profilesError.message)
      return
    }

    if (!profiles || profiles.length === 0) {
      console.log('⚠️  No patients found - cannot test alarm creation')
      return
    }

    const patientId = profiles[0].id
    console.log('👤 Using patient ID:', patientId)

    const testAlarm = {
      patient_id: patientId,
      medication_name: 'Test Medication',
      dosage: '500mg',
      schedule_type: 'daily',
      frequency_per_day: 2,
      specific_times: JSON.stringify(['09:00', '21:00']),
      duration_type: 'days',
      duration_value: 7,
      start_date: new Date().toISOString().split('T')[0],
      alarm_enabled: true,
      alarm_sound: 'default',
      snooze_enabled: true,
      snooze_duration_minutes: 10
    }

    const { data: newAlarm, error: createError } = await supabase
      .schema('api')
      .from('prescription_alarms')
      .insert(testAlarm)
      .select()
      .single()

    if (createError) {
      console.log('❌ Alarm creation failed:', createError.message)
    } else {
      console.log('✅ Test alarm created successfully!')
      console.log('🆔 Alarm ID:', newAlarm.id)

      // Clean up - delete the test alarm
      await supabase
        .schema('api')
        .from('prescription_alarms')
        .delete()
        .eq('id', newAlarm.id)

      console.log('🧹 Test alarm cleaned up')
    }

    console.log('\n🎉 Schema testing completed!')

  } catch (error) {
    console.error('❌ Testing failed:', error.message)
  }
}

testSchema()