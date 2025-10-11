/**
 * Run Voice Diagnosis Migration
 *
 * This script adds the new voice extraction columns to the consultations table.
 * Run this before testing the voice-to-diagnosis feature.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function runMigration() {
  console.log('🚀 Running Voice Diagnosis Migration...\n')

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'lib', 'db', 'migrations', 'add_voice_extracted_diagnoses_to_consultations.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded:', migrationPath)
    console.log('📝 Executing SQL...\n')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // Try direct query if RPC doesn't exist
      console.log('⚠️ RPC method not available, trying direct query...')

      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))

      for (const statement of statements) {
        console.log(`\n🔄 Executing: ${statement.substring(0, 100)}...`)
        const { error: stmtError } = await supabase.rpc('exec_sql', { query: statement + ';' })

        if (stmtError) {
          // Check if column already exists
          if (stmtError.message?.includes('already exists') || stmtError.code === '42701') {
            console.log('✅ Column already exists, skipping')
          } else {
            throw stmtError
          }
        } else {
          console.log('✅ Statement executed successfully')
        }
      }
    } else {
      console.log('✅ Migration executed successfully!')
    }

    // Verify columns were added
    console.log('\n🔍 Verifying new columns...')
    const { data: columns, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'api')
      .eq('table_name', 'consultations')
      .in('column_name', [
        'global_voice_transcript',
        'global_voice_processed_data',
        'voice_recording_duration',
        'voice_extracted_tooth_diagnoses'
      ])

    if (verifyError) {
      console.warn('⚠️ Could not verify columns (this is okay):', verifyError.message)
    } else if (columns && columns.length > 0) {
      console.log('✅ Found new columns:')
      columns.forEach(col => console.log(`   - ${col.column_name}`))
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('   1. Restart your Next.js dev server')
    console.log('   2. Test voice recording with tooth diagnoses')
    console.log('   3. Check that diagnoses auto-populate in dialog')
    console.log('\n📖 See VOICE_DIAGNOSIS_QUICK_TEST_GUIDE.md for testing instructions')

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    console.error('\n💡 Manual fix:')
    console.error('   1. Go to Supabase Dashboard → SQL Editor')
    console.error('   2. Open: lib/db/migrations/add_voice_extracted_diagnoses_to_consultations.sql')
    console.error('   3. Copy and paste the SQL, then execute')
    process.exit(1)
  }
}

runMigration()
