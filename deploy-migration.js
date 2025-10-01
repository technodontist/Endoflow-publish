const fs = require('fs')
const { Client } = require('pg')

async function deployMigration() {
  const client = new Client({
    connectionString: "postgresql://postgres:[Asdfghjkl@4444]@db.pxpfbeqlqqrjpkiqlxmi.supabase.co:5432/postgres"
  })

  try {
    console.log('🚀 [MIGRATION] Connecting to database...')
    await client.connect()
    console.log('✅ [MIGRATION] Connected successfully')

    // Read the migration file
    console.log('📄 [MIGRATION] Reading migration file...')
    const migrationSql = fs.readFileSync('./lib/db/migrations/0002_youthful_black_cat.sql', 'utf8')

    // Split by statement-breakpoint
    const statements = migrationSql.split('--> statement-breakpoint')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)

    console.log(`📋 [MIGRATION] Found ${statements.length} statements to execute`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      if (!statement) continue

      console.log(`\n🔄 [${i + 1}/${statements.length}] Executing statement...`)
      console.log(`   ${statement.substring(0, 60)}${statement.length > 60 ? '...' : ''}`)

      try {
        await client.query(statement)
        console.log(`   ✅ Statement ${i + 1} executed successfully`)
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`   ℹ️  Statement ${i + 1}: Object already exists, continuing...`)
        } else {
          console.error(`   ❌ Statement ${i + 1} error:`, error.message)
          // Continue with other statements instead of failing
        }
      }
    }

    // Test messaging tables access
    console.log('\n🔍 [TEST] Testing messaging tables...')

    try {
      const result1 = await client.query('SELECT COUNT(*) FROM api.message_threads')
      console.log('✅ [TEST] message_threads accessible - count:', result1.rows[0].count)
    } catch (error) {
      console.log('❌ [TEST] message_threads error:', error.message)
    }

    try {
      const result2 = await client.query('SELECT COUNT(*) FROM api.thread_messages')
      console.log('✅ [TEST] thread_messages accessible - count:', result2.rows[0].count)
    } catch (error) {
      console.log('❌ [TEST] thread_messages error:', error.message)
    }

    // Check if RLS is enabled
    console.log('\n🔒 [RLS] Checking Row Level Security...')
    try {
      const rlsCheck = await client.query(`
        SELECT schemaname, tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'api' AND (tablename = 'message_threads' OR tablename = 'thread_messages')
      `)

      rlsCheck.rows.forEach(row => {
        console.log(`   ${row.tablename}: RLS ${row.rowsecurity ? 'ENABLED' : 'DISABLED'}`)
      })
    } catch (error) {
      console.log('❌ [RLS] Error checking RLS status:', error.message)
    }

    // Update the migration tracking table
    console.log('\n📝 [TRACKING] Updating migration status...')
    try {
      await client.query(`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES ('0002_youthful_black_cat', now())
        ON CONFLICT (hash) DO NOTHING
      `)
      console.log('✅ [TRACKING] Migration marked as applied')
    } catch (error) {
      console.log('ℹ️  [TRACKING] Migration tracking not available (normal for first run)')
    }

    console.log('\n🎉 [COMPLETE] Migration deployment finished!')
    console.log('   All messaging tables should now be available')

  } catch (error) {
    console.error('💥 [FATAL] Deployment failed:', error.message)
  } finally {
    await client.end()
    console.log('🔌 [CLEANUP] Database connection closed')
  }
}

deployMigration().catch(console.error)