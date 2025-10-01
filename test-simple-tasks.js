const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testSimpleTasks() {
  console.log('🔧 Testing Simple Task Operations...\n')

  try {
    // Test 1: Direct table access
    console.log('📋 Test 1: Direct table access...')

    const { data: tasks, error: tasksError } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('*')
      .limit(5)

    if (tasksError) {
      console.error('❌ Tasks query error:', tasksError.message)
      return false
    }

    console.log(`✅ Direct query successful. Found ${tasks.length} tasks`)

    // Test 2: Get available assistants (without foreign key joins)
    console.log('\n👥 Test 2: Get available assistants...')

    const { data: assistants, error: assistantsError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'assistant')
      .eq('status', 'active')

    if (assistantsError) {
      console.error('❌ Assistants query error:', assistantsError.message)
      return false
    }

    console.log(`✅ Assistants query successful. Found ${assistants.length} assistants`)

    // Test 3: Task stats query
    console.log('\n📊 Test 3: Task statistics...')

    const { data: taskStats, error: statsError } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('status, priority, is_urgent')

    if (statsError) {
      console.error('❌ Stats query error:', statsError.message)
      return false
    }

    console.log(`✅ Stats query successful. Analyzed ${taskStats.length} tasks`)

    console.log('\n🎉 All simple task tests passed!')
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Run the test
testSimpleTasks()
  .then((success) => {
    if (success) {
      console.log('\n✅ Simple task tests completed successfully')
      process.exit(0)
    } else {
      console.log('\n❌ Simple task tests failed')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Simple task tests failed:', error)
    process.exit(1)
  })