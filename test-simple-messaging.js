const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function testMessaging() {
  console.log('🧪 [MESSAGING TEST] Testing simple messaging functionality...\n')

  try {
    // Step 1: Get a patient to test with
    console.log('📋 [STEP 1] Finding test patient...')
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1)

    if (patientsError || !patients || patients.length === 0) {
      console.log('   ❌ No patients found or error:', patientsError?.message)
      console.log('   💡 Create a patient first through the assistant dashboard')
      return
    }

    const testPatient = patients[0]
    console.log(`   ✅ Using patient: ${testPatient.first_name} ${testPatient.last_name} (${testPatient.id})`)

    // Step 2: Get a dentist to test with
    console.log('\n📋 [STEP 2] Finding test dentist...')
    const { data: dentists, error: dentistsError } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name')
      .limit(1)

    if (dentistsError || !dentists || dentists.length === 0) {
      console.log('   ❌ No dentists found or error:', dentistsError?.message)
      return
    }

    const testDentist = dentists[0]
    console.log(`   ✅ Using dentist: ${testDentist.full_name} (${testDentist.id})`)

    // Step 3: Test sending a message from patient perspective
    console.log('\n💬 [STEP 3] Sending test message from patient...')
    const { data: patientMessage, error: messageError1 } = await supabase
      .schema('api')
      .from('messages')
      .insert({
        patient_id: testPatient.id,
        sender_id: testPatient.id,
        sender_type: 'patient',
        message: 'Hello! I have a question about my upcoming appointment.',
        is_from_patient: true,
        read: false
      })
      .select()
      .single()

    if (messageError1) {
      console.log('   ❌ Error sending patient message:', messageError1.message)
      return
    }

    console.log('   ✅ Patient message sent successfully')
    console.log(`   📝 Message ID: ${patientMessage.id}`)

    // Step 4: Test sending a reply from dentist
    console.log('\n💬 [STEP 4] Sending reply from dentist...')
    const { data: dentistMessage, error: messageError2 } = await supabase
      .schema('api')
      .from('messages')
      .insert({
        patient_id: testPatient.id,
        sender_id: testDentist.id,
        sender_type: 'dentist',
        message: 'Hi! I\'d be happy to help. What specific questions do you have about your appointment?',
        is_from_patient: false,
        read: false
      })
      .select()
      .single()

    if (messageError2) {
      console.log('   ❌ Error sending dentist message:', messageError2.message)
      return
    }

    console.log('   ✅ Dentist reply sent successfully')
    console.log(`   📝 Message ID: ${dentistMessage.id}`)

    // Step 5: Test retrieving conversation
    console.log('\n📖 [STEP 5] Retrieving full conversation...')
    const { data: conversation, error: convError } = await supabase
      .schema('api')
      .from('messages')
      .select('*')
      .eq('patient_id', testPatient.id)
      .order('created_at', { ascending: true })

    if (convError) {
      console.log('   ❌ Error retrieving conversation:', convError.message)
      return
    }

    console.log(`   ✅ Retrieved ${conversation.length} messages`)
    conversation.forEach((msg, index) => {
      const sender = msg.is_from_patient ? 'Patient' : 'Staff'
      const time = new Date(msg.created_at).toLocaleTimeString()
      console.log(`   ${index + 1}. [${time}] ${sender}: ${msg.message}`)
    })

    // Step 6: Test marking messages as read
    console.log('\n✅ [STEP 6] Marking patient messages as read...')
    const { error: readError } = await supabase
      .schema('api')
      .from('messages')
      .update({ read: true })
      .eq('patient_id', testPatient.id)
      .eq('is_from_patient', true)
      .eq('read', false)

    if (readError) {
      console.log('   ❌ Error marking messages as read:', readError.message)
    } else {
      console.log('   ✅ Messages marked as read')
    }

    // Step 7: Clean up test messages (optional)
    console.log('\n🧹 [STEP 7] Cleaning up test messages...')
    const { error: cleanupError } = await supabase
      .schema('api')
      .from('messages')
      .delete()
      .in('id', [patientMessage.id, dentistMessage.id])

    if (cleanupError) {
      console.log('   ⚠️  Could not clean up test messages:', cleanupError.message)
      console.log('   💡 Test messages will remain in database')
    } else {
      console.log('   ✅ Test messages cleaned up')
    }

    console.log('\n🎉 [SUCCESS] Simple messaging system test completed!')
    console.log('   🔗 Integration ready for:')
    console.log('   • Patient dashboard messaging component')
    console.log('   • Dentist dashboard messaging interface')
    console.log('   • Real-time updates with Supabase subscriptions')

  } catch (error) {
    console.error('💥 [ERROR] Test failed:', error)
  }
}

testMessaging().catch(console.error)