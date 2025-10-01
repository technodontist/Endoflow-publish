const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || serviceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function debugRealtimeMessaging() {
  console.log('🔍 [REALTIME DEBUG] Testing real-time messaging functionality...\n')

  try {
    // Step 1: Get test patient
    console.log('👤 [STEP 1] Finding test patient...')
    const { data: patient, error: patientError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1)
      .single()

    if (patientError || !patient) {
      console.log('   ❌ No patient found')
      return
    }

    console.log(`   ✅ Using patient: ${patient.first_name} ${patient.last_name} (${patient.id})`)

    // Step 2: Set up real-time listener
    console.log('\n📡 [STEP 2] Setting up real-time subscription...')

    const channel = supabase
      .channel(`debug-messages-${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'messages',
          filter: `patient_id=eq.${patient.id}`
        },
        (payload) => {
          console.log(`🔥 [REALTIME EVENT] Received:`, payload)
          console.log(`   Event Type: ${payload.eventType}`)
          console.log(`   Table: ${payload.table}`)
          console.log(`   Schema: ${payload.schema}`)
          if (payload.new) {
            console.log(`   New Data:`, payload.new)
          }
          if (payload.old) {
            console.log(`   Old Data:`, payload.old)
          }
        }
      )
      .subscribe((status) => {
        console.log(`   📶 Subscription status: ${status}`)
      })

    // Wait for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 3: Send test message and check if real-time picks it up
    console.log('\n💬 [STEP 3] Sending test message...')

    const testMessage = {
      patient_id: patient.id,
      sender_id: patient.id,
      sender_type: 'patient',
      message: `🧪 REALTIME TEST MESSAGE - ${new Date().toISOString()}`,
      is_from_patient: true,
      read: false
    }

    const { data: message, error: msgError } = await supabase
      .schema('api')
      .from('messages')
      .insert(testMessage)
      .select()
      .single()

    if (msgError) {
      console.log('   ❌ Failed to send test message:', msgError.message)
      return
    }

    console.log('   ✅ Test message sent successfully')
    console.log(`   📋 Message ID: ${message.id}`)

    // Step 4: Wait for real-time event
    console.log('\n⏳ [STEP 4] Waiting for real-time event (10 seconds)...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Step 5: Test subscription cleanup
    console.log('\n🔌 [STEP 5] Cleaning up subscription...')
    channel.unsubscribe()

    // Step 6: Clean up test message
    console.log('\n🧹 [STEP 6] Cleaning up test message...')
    const { error: deleteError } = await supabase
      .schema('api')
      .from('messages')
      .delete()
      .eq('id', message.id)

    if (deleteError) {
      console.log('   ⚠️  Could not delete test message:', deleteError.message)
    } else {
      console.log('   ✅ Test message cleaned up')
    }

    console.log('\n📋 [SUMMARY] Real-time Messaging Debug Complete')
    console.log('   🔍 Check the logs above for real-time events')
    console.log('   ✅ If you see "REALTIME EVENT" logs, real-time is working')
    console.log('   ❌ If no real-time events, check:')
    console.log('      • Database RLS policies')
    console.log('      • Supabase real-time settings')
    console.log('      • Network connectivity')
    console.log('      • Browser console for client-side errors')

    console.log('\n🔧 [TROUBLESHOOTING STEPS]')
    console.log('   1. Check browser console for WebSocket connection errors')
    console.log('   2. Verify RLS policies allow authenticated users to see messages')
    console.log('   3. Test with simple manual database inserts')
    console.log('   4. Check Supabase dashboard for real-time logs')

  } catch (error) {
    console.error('💥 [ERROR] Debug test failed:', error)
  }
}

debugRealtimeMessaging().catch(console.error)