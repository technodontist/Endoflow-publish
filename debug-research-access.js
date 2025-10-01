const { createClient } = require('@supabase/supabase-js');

async function debugResearchAccess() {
  try {
    console.log('🔍 Debugging Research Projects table access...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Try to access research_projects table directly
    console.log('1️⃣ Testing direct table access...');

    try {
      const { data, error } = await supabase
        .schema('api')
        .from('research_projects')
        .select('*')
        .limit(1);

      if (error) {
        console.log('❌ Direct access failed:', error.message);
        console.log('   Error code:', error.code);
        console.log('   Error details:', error.details);
      } else {
        console.log('✅ Direct access works! Found', data?.length || 0, 'projects');
      }
    } catch (err) {
      console.log('❌ Exception during direct access:', err.message);
    }

    // Test 2: Try count query
    console.log('\n2️⃣ Testing count query...');

    try {
      const { data, error, count } = await supabase
        .schema('api')
        .from('research_projects')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log('❌ Count query failed:', error.message);
      } else {
        console.log('✅ Count query works! Total projects:', count);
      }
    } catch (err) {
      console.log('❌ Exception during count query:', err.message);
    }

    // Test 3: Check table permissions
    console.log('\n3️⃣ Checking table information...');

    try {
      const { data, error } = await supabase
        .rpc('get_table_info', { table_name: 'research_projects' })
        .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

      if (error) {
        console.log('⚠️ Cannot get table info:', error.message);
      }
    } catch (err) {
      console.log('⚠️ Table info check skipped');
    }

    // Test 4: Try with different schema approaches
    console.log('\n4️⃣ Testing different schema access patterns...');

    // Test without explicit schema
    try {
      const { data, error } = await supabase
        .from('research_projects')
        .select('count(*)', { count: 'exact', head: true });

      if (error) {
        console.log('❌ Public schema access failed:', error.message);
      } else {
        console.log('✅ Public schema access works!');
      }
    } catch (err) {
      console.log('❌ Public schema exception:', err.message);
    }

    // Test 5: Check if we can access other api tables
    console.log('\n5️⃣ Testing other api schema tables...');

    try {
      const { data, error } = await supabase
        .schema('api')
        .from('patients')
        .select('count(*)', { count: 'exact', head: true });

      if (error) {
        console.log('❌ Cannot access patients table:', error.message);
      } else {
        console.log('✅ Can access patients table in api schema');
      }
    } catch (err) {
      console.log('❌ Patients table exception:', err.message);
    }

    console.log('\n📋 Diagnosis:');
    console.log('The research tables exist in the database (confirmed from your screenshot)');
    console.log('But there might be a permission or schema access issue');
    console.log('This is likely an RLS (Row Level Security) configuration problem');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugResearchAccess();