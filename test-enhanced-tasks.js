const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testEnhancedTasks() {
  console.log('🔧 Testing enhanced task fetching...')

  try {
    // Simulate the enhanced getTasksAction logic
    console.log('📋 Fetching tasks...')
    const { data: tasks, error } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('❌ Task fetch error:', error.message)
      return
    }

    console.log(`✅ Fetched ${tasks.length} tasks`)

    if (tasks && tasks.length > 0) {
      // Get unique assistant IDs
      const assignedIds = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))]
      const createdByIds = [...new Set(tasks.map(t => t.created_by))]
      const allUserIds = [...new Set([...assignedIds, ...createdByIds])]

      console.log('👥 User IDs to lookup:', allUserIds)

      // Fetch all user profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allUserIds)

      if (profilesError) {
        console.error('❌ Profiles fetch error:', profilesError.message)
        return
      }

      console.log('👤 Fetched profiles:', profiles)

      if (profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]))
        console.log('🗺️ Profile map created')

        // Add profile data to each task
        const tasksWithProfiles = tasks.map(task => ({
          ...task,
          assigned_to_profile: task.assigned_to ? profileMap.get(task.assigned_to) : null,
          created_by_profile: profileMap.get(task.created_by)
        }))

        console.log('\\n📊 ENHANCED TASKS RESULT:')
        tasksWithProfiles.forEach((task, index) => {
          console.log(`${index + 1}. ${task.title}`)
          console.log(`   Status: ${task.status}`)
          console.log(`   Assigned to: ${task.assigned_to_profile ? task.assigned_to_profile.full_name : 'Unassigned'}`)
          console.log(`   Created by: ${task.created_by_profile ? task.created_by_profile.full_name : 'Unknown'}`)
          console.log('')
        })

        return tasksWithProfiles
      }
    }

    console.log('✅ No tasks found or no enhancement needed')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testEnhancedTasks()