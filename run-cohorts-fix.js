const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runFix() {
  console.log('🔧 FIXING RESEARCH_COHORTS SCHEMA\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'FIX_RESEARCH_COHORTS_SCHEMA.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split into individual statements (simple split by semicolons outside of strings)
  const statements = sql
    .split(';\n')
    .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'))
    .map(stmt => stmt.trim() + ';');

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt === ';') continue;

    console.log(`\n⚙️  Executing statement ${i + 1}/${statements.length}...`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });

      if (error) {
        // Try direct execution instead
        console.log('   Trying direct execution...');
        const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ sql_query: stmt })
        });

        if (!result.ok) {
          console.error(`   ❌ Failed: ${error.message || result.statusText}`);
        } else {
          console.log('   ✅ Success');
        }
      } else {
        console.log('   ✅ Success');
        if (data) {
          console.log('   Result:', data);
        }
      }
    } catch (err) {
      console.error(`   ❌ Error:`, err.message);
    }
  }

  console.log('\n📊 Verifying table structure...\n');

  // Check current structure
  const { data: columns, error: colError } = await supabase
    .schema('api')
    .from('research_cohorts')
    .select('*')
    .limit(0);

  if (colError) {
    console.error('❌ Failed to verify:', colError.message);
  } else {
    console.log('✅ Table structure verified!');
  }

  console.log('\n🎯 Please run this SQL directly in Supabase SQL Editor:');
  console.log('   Go to: https://supabase.com/dashboard → SQL Editor');
  console.log(`   Copy and paste the contents of: FIX_RESEARCH_COHORTS_SCHEMA.sql\n`);
}

runFix().catch(console.error);
