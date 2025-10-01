const { createClient } = require('@supabase/supabase-js')

async function checkTableExistence() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 CHECKING TABLE EXISTENCE')
  console.log('=' .repeat(40))

  try {
    // Check table existence using information_schema (should bypass RLS)
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT
            table_name,
            table_schema
          FROM information_schema.tables
          WHERE table_schema = 'api'
          AND table_name IN ('consultations', 'tooth_diagnoses', 'voice_sessions')
          ORDER BY table_name;
        `
      })

    if (error) {
      console.log('⚠️  Could not check via information_schema, trying alternative...')
      console.log('Error:', error.message)

      // Alternative: try to get table info directly
      const tables = ['consultations', 'tooth_diagnoses', 'voice_sessions']
      for (const table of tables) {
        try {
          // This will fail with permission denied if table exists but RLS blocks access
          // or with "relation does not exist" if table doesn't exist
          await supabase.schema('api').from(table).select('*').limit(0)
          console.log(`✅ Table 'api.${table}' exists (permission denied = exists with RLS)`)
        } catch (err) {
          if (err.message.includes('permission denied')) {
            console.log(`✅ Table 'api.${table}' exists (RLS blocking access)`)
          } else if (err.message.includes('does not exist')) {
            console.log(`❌ Table 'api.${table}' does not exist`)
          } else {
            console.log(`❓ Table 'api.${table}' - Unclear: ${err.message}`)
          }
        }
      }
    } else {
      console.log('📊 Found tables in api schema:')
      if (data && data.length > 0) {
        data.forEach(table => {
          console.log(`✅ ${table.table_schema}.${table.table_name}`)
        })
      } else {
        console.log('❌ No consultation tables found in api schema')
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message)
  }

  console.log('\n🎯 TABLE EXISTENCE CHECK COMPLETE')
}

checkTableExistence().catch(console.error)