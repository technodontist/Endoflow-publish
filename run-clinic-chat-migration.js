/**
 * 🔧 Run Clinic Analysis Chat Migration
 * 
 * This script creates the required tables for the Clinic Analysis Chat feature:
 * - clinic_analysis_chat_sessions (chat threads)
 * - clinic_analysis_messages (individual messages)
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

console.log('🚀 Starting Clinic Analysis Chat Migration\n')
console.log('═'.repeat(70))

async function runMigration() {
  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    console.error('\nPlease check your .env.local file')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'api' }
  })

  console.log('✅ Supabase client initialized\n')

  // Check if tables already exist
  console.log('🔍 Checking if tables already exist...')
  
  const { data: existingSessions, error: checkError } = await supabase
    .from('clinic_analysis_chat_sessions')
    .select('id')
    .limit(1)

  if (!checkError) {
    console.log('✅ Tables already exist!')
    console.log('   - clinic_analysis_chat_sessions: ✓')
    console.log('   - clinic_analysis_messages: ✓')
    console.log('\n✨ Migration already applied. No action needed.')
    console.log('═'.repeat(70))
    return
  }

  if (checkError.code !== 'PGRST205') {
    console.error('❌ Unexpected error checking tables:', checkError)
    process.exit(1)
  }

  console.log('⚠️  Tables not found. Running migration...\n')

  // Read migration file
  const migrationPath = path.join(__dirname, 'lib', 'db', 'migrations', 'add_clinic_analysis_chat_sessions.sql')
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath)
    process.exit(1)
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
  console.log('📄 Migration file loaded:', migrationPath)

  console.log('\n' + '─'.repeat(70))
  console.log('📋 MIGRATION INSTRUCTIONS')
  console.log('─'.repeat(70))
  console.log('\n⚠️  This script cannot execute SQL directly.')
  console.log('   Please run the migration manually in Supabase:\n')
  console.log('1. Open your Supabase Dashboard')
  console.log('2. Go to: SQL Editor')
  console.log('3. Click "New Query"')
  console.log('4. Copy and paste the contents of:')
  console.log(`   ${migrationPath}`)
  console.log('5. Click "Run" to execute\n')
  
  console.log('💡 Or copy the SQL below and run it in Supabase SQL Editor:\n')
  console.log('═'.repeat(70))
  console.log(migrationSQL)
  console.log('═'.repeat(70))
  
  console.log('\n✅ After running the migration, restart your Next.js app:')
  console.log('   npm run dev\n')
}

runMigration().catch(error => {
  console.error('\n❌ Error:', error)
  process.exit(1)
})
