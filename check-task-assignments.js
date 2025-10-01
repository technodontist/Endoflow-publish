const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkCurrentTasks() {
  console.log('📋 Checking current task assignments...')

  try {
    const { data: tasks, error } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('id, title, assigned_to, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('❌ Error:', error.message)
      return
    }

    console.log('\nRecent tasks:')
    for (let task of tasks) {
      // Get assistant name if assigned
      let assistantName = 'Unassigned'
      if (task.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', task.assigned_to)
          .single()

        assistantName = profile ? profile.full_name : 'Unknown Assistant'
      }

      console.log(`- ${task.title} → ${assistantName} (ID: ${task.assigned_to || 'null'})`)
    }

    // Check if Test Assistant exists
    console.log('\n🔍 Verifying Test Assistant:')
    const testId = 'adbe299b-3a1d-44ce-8f12-9f32c6178d9d'
    const { data: testAssistant } = await supabase
      .from('profiles')
      .select('full_name, status')
      .eq('id', testId)
      .single()

    if (testAssistant) {
      console.log(`✅ Test Assistant exists: ${testAssistant.full_name} (${testAssistant.status})`)
    } else {
      console.log('❌ Test Assistant not found')
    }

    console.log('\n🎯 With the latest fix, new tasks should automatically assign to Test Assistant')
    console.log('Try creating a new task in the UI to test the assignment fix!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkCurrentTasks()