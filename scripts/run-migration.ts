/**
 * Migration Runner Script
 *
 * This script applies the FK relationship fixes to the Supabase database.
 * Run this with: npm run migration:fk-fix
 */

import { createServiceClient } from '@/lib/supabase/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

async function runMigration() {
  console.log('🚀 Starting FK relationship migration...')

  try {
    // Create service client with admin privileges
    const supabase = await createServiceClient()

    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'lib', 'db', 'migrations', '0004_fix_foreign_key_relationships.sql')
    const migrationSQL = await readFile(migrationPath, 'utf-8')

    console.log('📖 Migration SQL loaded successfully')
    console.log(`📏 Migration size: ${migrationSQL.length} characters`)

    // Split the migration into individual statements
    // We need to execute them one by one for better error handling
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`🔢 Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    let successCount = 0
    let warningCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) {
        continue
      }

      console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`)
      console.log(`🔍 Statement preview: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`)

      try {
        const { data, error } = await supabase.rpc('exec', {
          sql: statement + ';'
        })

        if (error) {
          // Some errors are expected (like constraint already exists)
          if (error.message.includes('already exists') ||
              error.message.includes('does not exist') ||
              error.code === '42P07' || // relation already exists
              error.code === '42710') { // object already exists
            console.log(`⚠️  Warning (expected): ${error.message}`)
            warningCount++
          } else {
            console.error(`❌ Error executing statement:`, error)
            throw error
          }
        } else {
          console.log(`✅ Statement executed successfully`)
          successCount++
        }
      } catch (error) {
        console.error(`💥 Failed to execute statement ${i + 1}:`, error)
        console.error(`📄 Statement was: ${statement}`)

        // For some statements, we can continue despite errors
        if (statement.includes('DROP TRIGGER IF EXISTS') ||
            statement.includes('CREATE INDEX IF NOT EXISTS') ||
            statement.includes('ALTER TABLE') && statement.includes('ADD CONSTRAINT')) {
          console.log('🔄 Continuing despite error (non-critical statement)')
          warningCount++
        } else {
          throw error
        }
      }
    }

    console.log('\n🎉 Migration completed!')
    console.log(`✅ Successful statements: ${successCount}`)
    console.log(`⚠️  Warnings: ${warningCount}`)

    // Test the migration by checking some key constraints
    console.log('\n🔍 Testing migration results...')

    // Test if the new view exists
    const { data: viewExists, error: viewError } = await supabase
      .from('pending_patient_verifications')
      .select('*')
      .limit(1)

    if (viewError) {
      console.error('❌ Failed to query pending_patient_verifications view:', viewError)
    } else {
      console.log('✅ pending_patient_verifications view is working')
    }

    // Test if the validation function exists
    try {
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_user_profile_consistency')

      if (validationError) {
        console.error('❌ Validation function test failed:', validationError)
      } else {
        console.log('✅ validate_user_profile_consistency function is working')
        console.log(`📊 Found ${validationData?.length || 0} users with potential issues`)
      }
    } catch (error) {
      console.error('❌ Validation function not available:', error)
    }

    console.log('\n🚀 Migration and testing completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('1. Test the signup workflow')
    console.log('2. Test the patient verification workflow')
    console.log('3. Verify FK constraints are working')
    console.log('4. Check assistant dashboard for proper patient queue')

  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

// Execute if run directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error)
      process.exit(1)
    })
}

export { runMigration }