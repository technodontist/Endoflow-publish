/**
 * Run Research AI Conversations Migration
 *
 * This script creates the research_ai_conversations table using Supabase client
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxpfbeqlqqrjpkiqlxmi.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU'

console.log('🚀 [MIGRATION] Starting Research AI Conversations table creation...\n')

async function runMigration() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Read migration file
  const migrationPath = path.join(__dirname, 'lib', 'db', 'migrations', 'add_research_ai_conversations.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

  console.log('📄 [MIGRATION] Loaded migration file')
  console.log('📊 [MIGRATION] Executing SQL...\n')

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    })

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  [MIGRATION] exec_sql RPC not available, trying direct execution...\n')

      // Split SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))

      console.log(`📝 [MIGRATION] Found ${statements.length} SQL statements to execute\n`)

      // Create table first
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS api.research_ai_conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID,
            dentist_id UUID NOT NULL,
            user_query TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            analysis_type TEXT,
            cohort_size INTEGER,
            metadata TEXT,
            source TEXT NOT NULL DEFAULT 'langflow',
            confidence TEXT,
            processing_time INTEGER,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `

      const { error: createError } = await supabase.rpc('exec_sql', { sql_query: createTableSQL })

      if (createError) {
        console.error('❌ [MIGRATION] Failed to create table via RPC')
        console.error('   Error:', createError.message)
        console.log('\n📋 [MIGRATION] Please run this SQL manually in Supabase SQL Editor:')
        console.log('─'.repeat(80))
        console.log(migrationSQL)
        console.log('─'.repeat(80))
        process.exit(1)
      }

      console.log('✅ [MIGRATION] Table created successfully')

      // Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_project_id ON api.research_ai_conversations(project_id);',
        'CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_dentist_id ON api.research_ai_conversations(dentist_id);',
        'CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_created_at ON api.research_ai_conversations(created_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_analysis_type ON api.research_ai_conversations(analysis_type);'
      ]

      for (const indexSQL of indexes) {
        const { error: indexError } = await supabase.rpc('exec_sql', { sql_query: indexSQL })
        if (!indexError) {
          console.log('✅ [MIGRATION] Index created')
        }
      }

      console.log('\n⚠️  [MIGRATION] Basic table and indexes created')
      console.log('⚠️  [MIGRATION] Please run the full migration SQL in Supabase SQL Editor for:')
      console.log('   - Foreign key constraints')
      console.log('   - Row Level Security policies')
      console.log('   - Proper permissions')
      console.log('\n📋 [MIGRATION] Full SQL available at:')
      console.log('   ', migrationPath)

    } else {
      console.log('✅ [MIGRATION] Migration completed successfully!')
      console.log('   Table: api.research_ai_conversations created')
      console.log('   Indexes: Created')
      console.log('   RLS Policies: Enabled')
      console.log('   Permissions: Granted')
    }

  } catch (err) {
    console.error('❌ [MIGRATION] Migration failed:', err.message)
    console.log('\n📋 [MIGRATION] Please run this SQL manually in Supabase SQL Editor:')
    console.log('─'.repeat(80))
    console.log(migrationSQL)
    console.log('─'.repeat(80))
    process.exit(1)
  }

  // Test if table exists
  console.log('\n🧪 [MIGRATION] Testing table access...')
  const { data: testData, error: testError } = await supabase
    .schema('api')
    .from('research_ai_conversations')
    .select('count')
    .limit(1)

  if (testError) {
    console.error('❌ [MIGRATION] Table test failed:', testError.message)
    console.log('\n⚠️  [MIGRATION] The table may exist but RLS policies are blocking access')
    console.log('   Please ensure you run the FULL migration SQL in Supabase SQL Editor')
    console.log('   Location: lib/db/migrations/add_research_ai_conversations.sql')
  } else {
    console.log('✅ [MIGRATION] Table is accessible and ready to use!')
  }

  console.log('\n🎉 [MIGRATION] Migration process completed\n')
}

runMigration().catch(err => {
  console.error('💥 [MIGRATION] Fatal error:', err)
  process.exit(1)
})
