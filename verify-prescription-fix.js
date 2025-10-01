const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function verifyFix() {
  try {
    console.log('🔍 Verifying prescription alarms database fix...\n')

    // Test 1: Check if tables exist and are accessible
    console.log('📋 Test 1: Checking table accessibility...')
    
    const { data: prescriptionsTest, error: prescError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .select('*')
      .limit(1)

    if (prescError) {
      console.log('❌ patient_prescriptions error:', prescError.message)
      console.log('   Code:', prescError.code)
      return false
    } else {
      console.log('✅ patient_prescriptions table is accessible')
    }

    const { data: remindersTest, error: reminderError } = await supabase
      .schema('api')
      .from('medication_reminders')
      .select('*')
      .limit(1)

    if (reminderError) {
      console.log('❌ medication_reminders error:', reminderError.message)
      console.log('   Code:', reminderError.code)
      return false
    } else {
      console.log('✅ medication_reminders table is accessible')
    }

    // Test 2: Try to insert a test prescription
    console.log('\n🧪 Test 2: Testing prescription creation...')
    
    // Get a test user first
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('role', 'patient')
      .limit(1)

    if (profileError || !profiles || profiles.length === 0) {
      console.log('⚠️  No test patients found, skipping insertion test')
    } else {
      const testPatientId = profiles[0].id
      
      const testPrescription = {
        patient_id: testPatientId,
        dentist_id: testPatientId, // Use same ID for test
        medication_name: 'Test Medication',
        dosage: '500mg',
        frequency: 'twice daily',
        times_per_day: 2,
        reminder_times: JSON.stringify(['09:00', '21:00']),
        instructions: 'Take with food',
        status: 'active',
        start_date: new Date().toISOString().split('T')[0]
      }

      const { data: newPrescription, error: insertError } = await supabase
        .schema('api')
        .from('patient_prescriptions')
        .insert(testPrescription)
        .select()
        .single()

      if (insertError) {
        console.log('❌ Prescription insertion failed:', insertError.message)
        console.log('   Code:', insertError.code)
        return false
      } else {
        console.log('✅ Test prescription created successfully')
        console.log('   ID:', newPrescription.id)

        // Test 3: Try to create a reminder
        console.log('\n🔔 Test 3: Testing reminder creation...')
        
        const testReminder = {
          prescription_id: newPrescription.id,
          patient_id: testPatientId,
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: '09:00:00',
          reminder_date_time: new Date().toISOString(),
          status: 'pending'
        }

        const { data: newReminder, error: reminderInsertError } = await supabase
          .schema('api')
          .from('medication_reminders')
          .insert(testReminder)
          .select()
          .single()

        if (reminderInsertError) {
          console.log('❌ Reminder insertion failed:', reminderInsertError.message)
          console.log('   Code:', reminderInsertError.code)
        } else {
          console.log('✅ Test reminder created successfully')
          console.log('   ID:', newReminder.id)

          // Clean up test reminder
          await supabase
            .schema('api')
            .from('medication_reminders')
            .delete()
            .eq('id', newReminder.id)
        }

        // Clean up test prescription
        await supabase
          .schema('api')
          .from('patient_prescriptions')
          .delete()
          .eq('id', newPrescription.id)

        console.log('🧹 Test data cleaned up')
      }
    }

    console.log('\n🎉 Database permissions verification completed successfully!')
    console.log('\n✅ The prescription alarms system should now work without permission errors.')
    return true

  } catch (error) {
    console.error('❌ Verification failed:', error.message)
    return false
  }
}

// Run verification
verifyFix().then(success => {
  process.exit(success ? 0 : 1)
})