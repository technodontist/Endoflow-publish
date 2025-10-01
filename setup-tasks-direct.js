const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupAssistantTasksTables() {
  console.log('🔧 Setting up Assistant Tasks tables...\n')

  try {
    // Check if tables already exist first
    console.log('📋 Checking if assistant_tasks table exists...')
    const { data: existingTasks, error: checkError } = await supabase
      .schema('api')
      .from('assistant_tasks')
      .select('count', { count: 'exact', head: true })

    if (!checkError) {
      console.log('✅ assistant_tasks table already exists')
      return true
    }

    console.log('🏗️ Creating assistant_tasks table...')

    // Create assistant_tasks table
    const { error: createTasksError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS api.assistant_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          patient_name TEXT,
          priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
          due_date TIMESTAMPTZ,
          estimated_duration INTEGER,
          status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled', 'on_hold')),
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          category TEXT,
          tags TEXT,
          notes TEXT,
          is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
          requires_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `
    })

    if (createTasksError) {
      console.error('❌ Failed to create assistant_tasks table:', createTasksError)
      return false
    }

    console.log('✅ assistant_tasks table created')

    // Create task_comments table
    console.log('🏗️ Creating task_comments table...')
    const { error: createCommentsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS api.task_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id UUID NOT NULL REFERENCES api.assistant_tasks(id) ON DELETE CASCADE,
          author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          author_type TEXT NOT NULL CHECK (author_type IN ('dentist', 'assistant')),
          comment TEXT NOT NULL,
          comment_type TEXT NOT NULL DEFAULT 'update' CHECK (comment_type IN ('update', 'question', 'instruction', 'completion')),
          previous_status TEXT,
          new_status TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `
    })

    if (createCommentsError) {
      console.error('❌ Failed to create task_comments table:', createCommentsError)
      return false
    }

    console.log('✅ task_comments table created')

    // Create task_activity_log table
    console.log('🏗️ Creating task_activity_log table...')
    const { error: createActivityError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS api.task_activity_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id UUID NOT NULL REFERENCES api.assistant_tasks(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          user_type TEXT NOT NULL CHECK (user_type IN ('dentist', 'assistant')),
          action TEXT NOT NULL,
          previous_value TEXT,
          new_value TEXT,
          description TEXT NOT NULL,
          metadata TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `
    })

    if (createActivityError) {
      console.error('❌ Failed to create task_activity_log table:', createActivityError)
      return false
    }

    console.log('✅ task_activity_log table created')

    // Create indexes
    console.log('🏗️ Creating indexes...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_assistant_tasks_created_by ON api.assistant_tasks(created_by);',
      'CREATE INDEX IF NOT EXISTS idx_assistant_tasks_assigned_to ON api.assistant_tasks(assigned_to);',
      'CREATE INDEX IF NOT EXISTS idx_assistant_tasks_status ON api.assistant_tasks(status);',
      'CREATE INDEX IF NOT EXISTS idx_assistant_tasks_priority ON api.assistant_tasks(priority);',
      'CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON api.task_comments(task_id);',
      'CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON api.task_activity_log(task_id);'
    ]

    for (const indexSql of indexes) {
      const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSql })
      if (indexError) {
        console.error('❌ Failed to create index:', indexError)
      }
    }

    console.log('✅ Indexes created')

    console.log('\n🎉 All assistant task tables created successfully!')
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Run the setup
setupAssistantTasksTables()
  .then((success) => {
    if (success) {
      console.log('\n✅ Assistant tasks setup completed successfully')
      process.exit(0)
    } else {
      console.log('\n❌ Assistant tasks setup failed')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Assistant tasks setup failed:', error)
    process.exit(1)
  })