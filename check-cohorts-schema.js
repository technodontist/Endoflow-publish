const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 CHECKING RESEARCH_COHORTS TABLE SCHEMA\n');

  // Try to fetch one row to see the structure
  const { data, error } = await supabase
    .schema('api')
    .from('research_cohorts')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying table:', error.message);

    // Check if table exists at all
    const { data: tables } = await supabase
      .rpc('get_schema_tables', { schema_name: 'api' })
      .catch(() => ({ data: null }));

    console.log('\n📋 Attempting direct query...');
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Table exists! Sample row structure:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n📋 Available columns:');
    Object.keys(data[0]).forEach(col => {
      console.log(`   - ${col}: ${typeof data[0][col]}`);
    });
  } else {
    console.log('⚠️ Table exists but is empty.');
    console.log('   Checking column info via information_schema...\n');
  }
}

checkSchema().catch(console.error);
