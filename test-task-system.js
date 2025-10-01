const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testTaskSystem() {
  console.log('🔧 Testing Assistant Tasks System...\n')

  try {
    // Test 1: Check if tables exist
    console.log('📋 Test 1: Checking table existence...')

    const { data: tasks_table, error: tasks_error } = await supabase
      .from('api.assistant_tasks')
      .select('count', { count: 'exact', head: true })

    if (tasks_error) {
      console.error('❌ assistant_tasks table not found:', tasks_error.message)
      return false
    }
    console.log('✅ assistant_tasks table exists')

    const { data: comments_table, error: comments_error } = await supabase
      .from('api.task_comments')
      .select('count', { count: 'exact', head: true })

    if (comments_error) {
      console.error('❌ task_comments table not found:', comments_error.message)
      return false
    }
    console.log('✅ task_comments table exists')

    const { data: activity_table, error: activity_error } = await supabase
      .from('api.task_activity_log')
      .select('count', { count: 'exact', head: true })

    if (activity_error) {
      console.error('❌ task_activity_log table not found:', activity_error.message)
      return false
    }
    console.log('✅ task_activity_log table exists\n')

    // Test 2: Get dentist and assistant users
    console.log('👥 Test 2: Finding test users...')

    const { data: dentists } = await supabase
      .from('public.profiles')
      .select('id, full_name')
      .eq('role', 'dentist')
      .eq('status', 'active')
      .limit(1)

    const { data: assistants } = await supabase
      .from('public.profiles')
      .select('id, full_name')
      .eq('role', 'assistant')
      .eq('status', 'active')
      .limit(1)

    const { data: patients } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1)

    if (!dentists || dentists.length === 0) {
      console.log('⚠️ No active dentists found - skipping creation test')
      return true
    }

    console.log(`✅ Found dentist: ${dentists[0].full_name}`)

    if (assistants && assistants.length > 0) {
      console.log(`✅ Found assistant: ${assistants[0].full_name}`)
    }

    if (patients && patients.length > 0) {
      console.log(`✅ Found patient: ${patients[0].first_name} ${patients[0].last_name}`)
    }

    // Test 3: Create a test task
    console.log('\n📝 Test 3: Creating test task...')

    const testTask = {
      created_by: dentists[0].id,
      assigned_to: assistants && assistants.length > 0 ? assistants[0].id : null,
      title: 'Test Task - System Verification',
      description: 'This is a test task to verify the assistant task management system is working correctly.',
      priority: 'medium',
      patient_id: patients && patients.length > 0 ? patients[0].id : null,
      patient_name: patients && patients.length > 0 ? `${patients[0].first_name} ${patients[0].last_name}` : null,
      category: 'administrative',
      is_urgent: false
    }

    const { data: createdTask, error: createError } = await supabase
      .from('api.assistant_tasks')
      .insert(testTask)
      .select()
      .single()

    if (createError) {
      console.error('❌ Failed to create test task:', createError.message)
      return false
    }

    console.log('✅ Test task created successfully')
    console.log(`   Task ID: ${createdTask.id}`)
    console.log(`   Title: ${createdTask.title}`)
    console.log(`   Status: ${createdTask.status}`)

    // Test 4: Add a comment
    console.log('\n💬 Test 4: Adding test comment...')

    const { data: comment, error: commentError } = await supabase
      .from('api.task_comments')
      .insert({
        task_id: createdTask.id,
        author_id: dentists[0].id,
        author_type: 'dentist',
        comment: 'This is a test comment to verify the commenting system works.',
        comment_type: 'instruction'
      })
      .select()
      .single()

    if (commentError) {
      console.error('❌ Failed to create test comment:', commentError.message)
      return false
    }

    console.log('✅ Test comment added successfully')
    console.log(`   Comment ID: ${comment.id}`)

    // Test 5: Add activity log
    console.log('\n📊 Test 5: Adding activity log entry...')

    const { data: activity, error: activityError } = await supabase
      .from('api.task_activity_log')
      .insert({
        task_id: createdTask.id,
        user_id: dentists[0].id,
        user_type: 'dentist',
        action: 'created',
        description: 'Task created for system testing',
        new_value: 'todo'
      })
      .select()
      .single()

    if (activityError) {
      console.error('❌ Failed to create activity log:', activityError.message)
      return false
    }

    console.log('✅ Activity log entry added successfully')
    console.log(`   Activity ID: ${activity.id}`)

    // Test 6: Update task status
    console.log('\n🔄 Test 6: Updating task status...')

    const { data: updatedTask, error: updateError } = await supabase
      .from('api.assistant_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', createdTask.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Failed to update task status:', updateError.message)
      return false
    }

    console.log('✅ Task status updated successfully')
    console.log(`   New status: ${updatedTask.status}`)
    console.log(`   Completed at: ${updatedTask.completed_at}`)

    // Test 7: Query with relationships
    console.log('\n🔍 Test 7: Testing relationship queries...')

    const { data: taskWithRelations, error: relationError } = await supabase
      .from('api.assistant_tasks')
      .select(`
        *,
        created_by_profile:public.profiles!created_by(full_name),
        assigned_to_profile:public.profiles!assigned_to(full_name)
      `)
      .eq('id', createdTask.id)
      .single()

    if (relationError) {
      console.error('❌ Failed to query task relationships:', relationError.message)
      return false
    }

    console.log('✅ Relationship queries working')
    console.log(`   Created by: ${taskWithRelations.created_by_profile?.full_name}`)
    console.log(`   Assigned to: ${taskWithRelations.assigned_to_profile?.full_name || 'Unassigned'}`)

    // Cleanup: Delete test task
    console.log('\n🧹 Cleaning up test data...')

    const { error: deleteError } = await supabase
      .from('api.assistant_tasks')
      .delete()
      .eq('id', createdTask.id)

    if (deleteError) {
      console.error('❌ Failed to delete test task:', deleteError.message)
    } else {
      console.log('✅ Test task cleaned up successfully')
    }

    console.log('\n🎉 All tests passed! Assistant Tasks system is working correctly!')
    return true

  } catch (error) {
    console.error('❌ Unexpected error during testing:', error)
    return false
  }
}

// Run the test
testTaskSystem()
  .then((success) => {
    if (success) {
      console.log('\n✅ Task system test completed successfully')
      process.exit(0)
    } else {
      console.log('\n❌ Task system test failed')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Task system test failed:', error)
    process.exit(1)
  })