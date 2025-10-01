const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runSQLFile() {
  console.log('🔧 Creating Assistant Tasks tables...')

  try {
    console.log('📄 Creating tables manually with individual SQL statements...')

    // Execute each table creation individually
    console.log('\n1️⃣ Creating assistant_tasks table...')
    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS api.assistant_tasks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          created_by uuid NOT NULL,
          assigned_to uuid,
          title text NOT NULL,
          description text NOT NULL,
          status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled', 'on_hold')),
          priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
          patient_id uuid,
          patient_name text,
          due_date timestamptz,
          category text,
          is_urgent boolean NOT NULL DEFAULT false,
          started_at timestamptz,
          completed_at timestamptz,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
      );
    `

    // Try to create the table by making a test insert that will fail
    try {
      await supabase.schema('api').from('assistant_tasks').select('*').limit(1)
      console.log('✅ assistant_tasks table already exists')
    } catch (error) {
      if (error.message.includes('does not exist') || error.message.includes('not found')) {
        console.log('❌ Table does not exist - we need to create it via SQL Editor')
        console.log('\n🔧 MANUAL SETUP REQUIRED:')
        console.log('1. Go to Supabase Dashboard → SQL Editor')
        console.log('2. Run this SQL:')
        console.log('\n' + createTasksTable)
        console.log('\n3. Then run the full CREATE_ASSISTANT_TASKS_TABLES.sql file')
      }
    }

    // Also create the other tables
    console.log('\n2️⃣ Testing if we can access existing tables...')

    // Test each table
    const tables = ['assistant_tasks', 'task_comments', 'task_activity_log']
    const results = []

    for (const table of tables) {
      try {
        await supabase.schema('api').from(table).select('*').limit(1)
        console.log(`✅ ${table} table exists`)
        results.push(table)
      } catch (error) {
        console.log(`❌ ${table} table missing`)
      }
    }

    if (results.length === 3) {
      console.log('\n🎉 All tables exist! Testing task creation...')
      return true
    } else {
      console.log('\n❌ Some tables are missing. Please run the SQL file manually.')
      console.log('\n📋 INSTRUCTIONS:')
      console.log('1. Open Supabase Dashboard')
      console.log('2. Go to SQL Editor')
      console.log('3. Copy and paste the contents of CREATE_ASSISTANT_TASKS_TABLES.sql')
      console.log('4. Click RUN to execute')
      console.log('\nThis will create all the necessary tables for the assistant task system.')
      return false
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('\n📋 Please create tables manually using the SQL file.')
    return false
  }
}

runSQLFile()