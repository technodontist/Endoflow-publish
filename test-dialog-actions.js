const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testDialogActions() {
  console.log('🔧 Testing Dialog Actions...\n')

  try {
    // Test 1: Get available assistants
    console.log('👥 Test 1: Get available assistants...')
    const { data: assistants, error: assistantsError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'assistant')
      .eq('status', 'active')

    if (assistantsError) {
      console.error('❌ Assistants error:', assistantsError.message)
    } else {
      console.log(`✅ Found ${assistants.length} assistants:`, assistants.map(a => a.full_name))
    }

    // Test 2: Get patients (try both methods)
    console.log('\n🏥 Test 2: Get patients...')

    // Method 1: Direct query
    const { data: patients1, error: patientsError1 } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(5)

    if (patientsError1) {
      console.error('❌ Patients (api.patients) error:', patientsError1.message)
    } else {
      console.log(`✅ Found ${patients1.length} patients via api.patients:`, patients1.map(p => `${p.first_name} ${p.last_name}`))
    }

    // Method 2: Via profiles
    const { data: patients2, error: patientsError2 } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'patient')
      .eq('status', 'active')
      .limit(5)

    if (patientsError2) {
      console.error('❌ Patients (profiles) error:', patientsError2.message)
    } else {
      console.log(`✅ Found ${patients2.length} patients via profiles:`, patients2.map(p => p.full_name))
    }

    console.log('\n🎉 Dialog actions test completed!')
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

testDialogActions()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })