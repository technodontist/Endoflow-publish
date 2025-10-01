const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugAndFixDatabase() {
  console.log('🔍 Debugging ENDOFLOW database issues...\n');

  // Create Supabase client with service role for admin operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('📋 Current environment:');
  console.log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`   Service key exists: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}\n`);

  // Step 1: Check current database state
  console.log('🔍 Step 1: Checking current database schema...\n');

  // Test basic connection
  try {
    const { data: connection, error: connError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (connError) {
      console.log('❌ Connection test failed:', connError.message);
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (err) {
    console.log('❌ Connection error:', err.message);
  }

  // Check if appointment_requests table exists
  try {
    const { data, error } = await supabase
      .from('appointment_requests')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ appointment_requests table issue:', error.message);
      console.log('   Code:', error.code);
      console.log('   Details:', error.details);
    } else {
      console.log('✅ appointment_requests table exists');
      if (data && data.length > 0) {
        console.log('   Sample columns:', Object.keys(data[0]));
      }
    }
  } catch (err) {
    console.log('❌ appointment_requests table error:', err.message);
  }

  // Step 2: Apply critical fixes using SQL through RPC
  console.log('\n🔧 Step 2: Applying database fixes...\n');

  const criticalFixes = [
    {
      name: 'Ensure api schema exists',
      sql: 'CREATE SCHEMA IF NOT EXISTS api;'
    },
    {
      name: 'Create or update appointment_requests table',
      sql: `
        CREATE TABLE IF NOT EXISTS api.appointment_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID,
          appointment_type TEXT NOT NULL,
          preferred_date DATE NOT NULL,
          preferred_time TEXT NOT NULL,
          reason_for_visit TEXT NOT NULL,
          pain_level INTEGER,
          additional_notes TEXT,
          status TEXT DEFAULT 'pending',
          notification_sent BOOLEAN DEFAULT FALSE,
          assigned_to UUID,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    },
    {
      name: 'Add missing column if table exists but column is missing',
      sql: `
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'appointment_requests') THEN
            IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'api' AND table_name = 'appointment_requests' AND column_name = 'additional_notes') THEN
              ALTER TABLE api.appointment_requests ADD COLUMN additional_notes TEXT;
            END IF;
          END IF;
        END $$;
      `
    },
    {
      name: 'Create assistants table',
      sql: `
        CREATE TABLE IF NOT EXISTS api.assistants (
          id UUID PRIMARY KEY,
          full_name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `
    },
    {
      name: 'Create dentists table',
      sql: `
        CREATE TABLE IF NOT EXISTS api.dentists (
          id UUID PRIMARY KEY,
          full_name TEXT NOT NULL,
          specialty TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `
    }
  ];

  // Execute fixes using direct SQL
  for (const fix of criticalFixes) {
    console.log(`⚡ ${fix.name}...`);
    
    try {
      // Try executing via RPC (if available)
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: fix.sql.trim() 
      });
      
      if (error) {
        console.log(`   ⚠️  RPC Error (expected for some operations): ${error.message}`);
        
        // For critical table creation, try alternative approach
        if (fix.name.includes('appointment_requests')) {
          console.log('   🔄 Trying direct table creation...');
          
          // Try creating through PostgREST directly
          const { error: createError } = await supabase
            .schema('api')
            .from('appointment_requests')
            .select('id')
            .limit(0);
          
          if (createError && createError.code === 'PGRST116') {
            console.log('   ❌ Table definitely does not exist in api schema');
          }
        }
      } else {
        console.log(`   ✅ Success`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  // Step 3: Verify fixes
  console.log('\n🧪 Step 3: Verifying fixes...\n');

  try {
    const { data, error } = await supabase
      .from('appointment_requests')
      .select('*')
      .limit(1);
    
    if (!error) {
      console.log('✅ appointment_requests table is now accessible');
      console.log('   Available columns:', data && data.length > 0 ? Object.keys(data[0]) : 'No data yet');
      
      // Check specifically for additional_notes column
      if (data && data.length > 0 && 'additional_notes' in data[0]) {
        console.log('✅ additional_notes column is present');
      } else {
        console.log('⚠️  additional_notes column may still be missing');
      }
    } else {
      console.log('❌ Verification failed:', error.message);
    }
  } catch (err) {
    console.log('❌ Verification error:', err.message);
  }

  console.log('\n📋 Summary and Next Steps:');
  console.log('1. If RPC errors occurred, you need to run SQL manually in Supabase dashboard');
  console.log('2. Go to https://supabase.com/dashboard');
  console.log('3. Navigate to SQL Editor');
  console.log('4. Run the contents of fix-database-schema.sql');
  console.log('5. Restart your Next.js application');
  
  console.log('\n🔧 Alternative: Direct SQL to run in Supabase dashboard:');
  console.log('```sql');
  console.log('CREATE SCHEMA IF NOT EXISTS api;');
  console.log('');
  console.log('CREATE TABLE IF NOT EXISTS api.appointment_requests (');
  console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
  console.log('  patient_id UUID REFERENCES auth.users(id),');
  console.log('  appointment_type TEXT NOT NULL,');
  console.log('  preferred_date DATE NOT NULL,');
  console.log('  preferred_time TEXT NOT NULL,');
  console.log('  reason_for_visit TEXT NOT NULL,');
  console.log('  pain_level INTEGER,');
  console.log('  additional_notes TEXT,');
  console.log('  status TEXT DEFAULT \'pending\',');
  console.log('  notification_sent BOOLEAN DEFAULT FALSE,');
  console.log('  assigned_to UUID,');
  console.log('  created_at TIMESTAMP DEFAULT NOW()');
  console.log(');');
  console.log('```');
}

if (require.main === module) {
  debugAndFixDatabase().catch(console.error);
}

module.exports = { debugAndFixDatabase };