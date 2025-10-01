// Test server actions directly (simulating what the UI does)

// Simulate getAllPatientsAction
async function testGetAllPatientsAction() {
  console.log('🏥 Testing getAllPatientsAction...')

  try {
    const { createServiceClient } = require('./lib/supabase/server.js')
    const supabase = await createServiceClient()

    console.log('🔧 [SERVICE CLIENT] Creating service client...')

    const { data: patients, error } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, date_of_birth')
      .eq('status', 'active')
      .order('first_name')

    if (error) {
      console.error('❌ Error fetching patients:', error)
      return { success: false, error: 'Failed to fetch patients' }
    }

    console.log(`✅ Found ${patients.length} patients`)
    return {
      success: true,
      patients: patients.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name
      }))
    }
  } catch (error) {
    console.error('❌ getAllPatientsAction error:', error)
    return { success: false, error: 'Failed to fetch patients' }
  }
}

// Simulate getAvailableAssistantsAction
async function testGetAvailableAssistantsAction() {
  console.log('👥 Testing getAvailableAssistantsAction...')

  try {
    const { createServiceClient } = require('./lib/supabase/server.js')
    const supabase = await createServiceClient()

    const { data: assistants, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'assistant')
      .eq('status', 'active')
      .order('full_name')

    if (error) {
      console.error('❌ Error fetching assistants:', error)
      return { success: false, error: 'Failed to fetch assistants' }
    }

    console.log(`✅ Found ${assistants.length} assistants`)
    return { success: true, assistants }

  } catch (error) {
    console.error('❌ getAvailableAssistantsAction error:', error)
    return { success: false, error: 'Failed to fetch assistants' }
  }
}

async function runTests() {
  console.log('🔧 Testing Server Actions (simulated)...\n')

  const patientsResult = await testGetAllPatientsAction()
  console.log('Patients result:', patientsResult)

  console.log()

  const assistantsResult = await testGetAvailableAssistantsAction()
  console.log('Assistants result:', assistantsResult)

  console.log('\n🎉 Server actions test completed!')
}

runTests().catch(console.error)