const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function deployMessagingTables() {
  console.log('🚀 [MESSAGING DEPLOYMENT] Starting deployment...\n')

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'CREATE_MESSAGING_TABLES_DRIZZLE.sql')
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')

    console.log('📄 [SQL] Reading CREATE_MESSAGING_TABLES_DRIZZLE.sql...')
    console.log(`   File size: ${sqlContent.length} characters`)

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('DO $$'))

    console.log(`   Found ${statements.length} SQL statements to execute\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement) continue

      console.log(`🔄 [SQL ${i + 1}/${statements.length}] Executing...`)
      console.log(`   ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`)

      try {
        // Use rpc to execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql', {
          query: statement
        })

        if (error) {
          console.error(`❌ [SQL ${i + 1}] Error:`, error.message)

          // Check if it's a "already exists" error - that's OK
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`   ℹ️  [SQL ${i + 1}] Table/policy already exists, continuing...`)
            continue
          }

          // For other errors, log but continue
          console.log(`   ⚠️  [SQL ${i + 1}] Continuing despite error...`)
        } else {
          console.log(`✅ [SQL ${i + 1}] Success`)
        }
      } catch (execError) {
        console.error(`❌ [SQL ${i + 1}] Execution error:`, execError.message)
      }
    }

    console.log('\n🎯 [VERIFICATION] Checking deployed tables...')

    // Verify the tables were created
    const { data: tables, error: tableError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT table_schema, table_name,
                 CASE WHEN table_schema = 'api' THEN '🎯' ELSE '📋' END as icon
          FROM information_schema.tables
          WHERE (table_name LIKE '%message%' OR table_name LIKE '%thread%')
          AND table_schema IN ('api', 'public')
          ORDER BY table_schema, table_name;
        `
      })

    if (tableError) {
      console.error('❌ [VERIFICATION] Error checking tables:', tableError.message)
    } else if (tables && tables.length > 0) {
      console.log('✅ [VERIFICATION] Found messaging tables:')
      tables.forEach(table => {
        console.log(`   ${table.icon} ${table.table_schema}.${table.table_name}`)
      })
    } else {
      console.log('❌ [VERIFICATION] No messaging tables found')
    }

    // Test table access
    console.log('\n🔍 [ACCESS TEST] Testing table access...')

    try {
      const { data: threadTest, error: threadError } = await supabase
        .schema('api')
        .from('message_threads')
        .select('count')
        .limit(1)

      if (threadError) {
        console.log('❌ [ACCESS] message_threads error:', threadError.message)
      } else {
        console.log('✅ [ACCESS] message_threads accessible')
      }
    } catch (accessError) {
      console.log('❌ [ACCESS] message_threads exception:', accessError.message)
    }

    try {
      const { data: messageTest, error: messageError } = await supabase
        .schema('api')
        .from('thread_messages')
        .select('count')
        .limit(1)

      if (messageError) {
        console.log('❌ [ACCESS] thread_messages error:', messageError.message)
      } else {
        console.log('✅ [ACCESS] thread_messages accessible')
      }
    } catch (accessError) {
      console.log('❌ [ACCESS] thread_messages exception:', accessError.message)
    }

    console.log('\n🎉 [DEPLOYMENT] Messaging tables deployment completed!')
    console.log('   Next step: Test messaging functionality in the app')

  } catch (error) {
    console.error('💥 [DEPLOYMENT] Fatal error:', error)
  }
}

deployMessagingTables().catch(console.error)