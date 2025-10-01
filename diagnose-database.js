const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function diagnoseDatabaseStructure() {
  console.log('🔍 Diagnosing ENDOFLOW database structure...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check what tables exist in the api schema
  console.log('📊 Checking tables in api schema...\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'api' 
        ORDER BY table_name, ordinal_position;
      `
    });

    if (error) {
      console.log('⚠️ Cannot use rpc, checking manually...');
      
      // Try to access each table individually to see what exists
      const tablesToCheck = ['appointment_requests', 'appointments', 'notifications', 'messages', 'treatments'];
      
      for (const table of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .schema('api')
            .from(table)
            .select('*')
            .limit(0); // Just get structure, no data
          
          if (error) {
            console.log(`❌ Table '${table}': ${error.message}`);
          } else {
            console.log(`✅ Table '${table}': EXISTS`);
          }
        } catch (err) {
          console.log(`❌ Table '${table}': Exception - ${err.message}`);
        }
      }
    } else {
      console.log('📋 Database structure:', data);
    }
  } catch (err) {
    console.log('❌ Error checking database structure:', err.message);
  }

  // Try to see what columns appointment_requests actually has
  console.log('\n🔍 Checking appointment_requests table structure...\n');
  
  try {
    // Use raw query to get table structure
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'api' 
        AND table_name = 'appointment_requests'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      console.log('❌ Cannot check table structure via RPC:', error.message);
    } else {
      console.log('📋 appointment_requests columns:', data);
    }
  } catch (err) {
    console.log('❌ Exception checking table structure:', err.message);
  }

  // Check RLS policies
  console.log('\n🔒 Checking RLS policies...\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, roles, cmd, qual
        FROM pg_policies 
        WHERE schemaname = 'api' 
        AND tablename = 'appointment_requests';
      `
    });

    if (error) {
      console.log('❌ Cannot check RLS policies:', error.message);
    } else {
      console.log('🔒 RLS Policies for appointment_requests:', data);
    }
  } catch (err) {
    console.log('❌ Exception checking RLS policies:', err.message);
  }

  // Test basic service role access
  console.log('\n🧪 Testing service role access...\n');
  
  try {
    const { data, error } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Service role cannot access appointment_requests:', error.message);
      console.log('   Code:', error.code);
      console.log('   Details:', error.details);
    } else {
      console.log('✅ Service role can access appointment_requests');
    }
  } catch (err) {
    console.log('❌ Exception testing service role access:', err.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 NEXT STEPS:');
  console.log('1. If tables are missing, the FINAL_FIX.sql didn\'t run properly');
  console.log('2. If permission denied, RLS policies need to be fixed');
  console.log('3. If columns are missing, table structure needs to be corrected');
  console.log('='.repeat(60));
}

if (require.main === module) {
  diagnoseDatabaseStructure().catch(console.error);
}

module.exports = { diagnoseDatabaseStructure };