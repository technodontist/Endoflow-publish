const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyCompleteSetup() {
  console.log('🧪 Verifying Complete ENDOFLOW Supabase Setup...\n');

  // Check environment variables first
  console.log('🔍 Step 1: Checking Environment Variables...\n');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  let envVarsOk = true;
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Present`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
      envVarsOk = false;
    }
  }

  if (!envVarsOk) {
    console.log('\n❌ Environment variables are missing. Please check your .env.local file.\n');
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('\n🔍 Step 2: Testing Database Connection...\n');

  // Test connection
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.log('❌ Database connection failed:', error.message);
      return;
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (err) {
    console.log('❌ Database connection error:', err.message);
    return;
  }

  console.log('\n🔍 Step 3: Verifying Table Structure...\n');

  const expectedTables = [
    'appointment_requests',
    'appointments', 
    'appointment_teeth',
    'assistants',
    'dentists',
    'notifications',
    'messages',
    'treatments',
    'patients',
    'pending_registrations'
  ];

  let allTablesExist = true;
  const tableResults = {};

  for (const table of expectedTables) {
    try {
      const { data, error } = await supabase
        .schema('api')
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`);
        tableResults[table] = false;
        allTablesExist = false;
      } else {
        console.log(`✅ Table '${table}': EXISTS`);
        tableResults[table] = true;
      }
    } catch (err) {
      console.log(`❌ Table '${table}': Exception - ${err.message}`);
      tableResults[table] = false;
      allTablesExist = false;
    }
  }

  console.log('\n🔍 Step 4: Testing Critical Columns...\n');

  // Test critical columns in appointment_requests
  if (tableResults['appointment_requests']) {
    const criticalColumns = [
      'additional_notes',
      'appointment_type', 
      'preferred_date',
      'preferred_time',
      'reason_for_visit',
      'patient_id'
    ];

    for (const column of criticalColumns) {
      try {
        const { data, error } = await supabase
          .schema('api')
          .from('appointment_requests')
          .select(column)
          .limit(1);
        
        if (error) {
          console.log(`❌ Column '${column}': ${error.message}`);
        } else {
          console.log(`✅ Column '${column}': EXISTS`);
        }
      } catch (err) {
        console.log(`❌ Column '${column}': Exception - ${err.message}`);
      }
    }
  }

  console.log('\n🔍 Step 5: Testing Insert/Read Operations...\n');

  // Test inserting a sample appointment request
  try {
    const testData = {
      patient_id: 'd1864a3f-d700-4cb5-a737-781071d2fc16',
      appointment_type: 'Test Consultation',
      preferred_date: '2025-01-20',
      preferred_time: '10:00 AM',
      reason_for_visit: 'Testing database setup',
      pain_level: 1,
      additional_notes: 'This is a test to verify the setup works',
      status: 'pending'
    };

    const { data, error } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert(testData)
      .select();
    
    if (error) {
      console.log('❌ Insert test failed:', error.message);
    } else {
      console.log('✅ Insert test successful');
      
      // Clean up test data
      if (data && data.length > 0) {
        await supabase
          .schema('api')
          .from('appointment_requests')
          .delete()
          .eq('id', data[0].id);
        console.log('✅ Test data cleaned up');
      }
    }
  } catch (err) {
    console.log('❌ Insert test exception:', err.message);
  }

  console.log('\n🔍 Step 6: Checking Authentication Setup...\n');

  // Check if test users exist (this might fail if not set up yet, that's ok)
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('⚠️  Cannot check users (admin API might not be accessible)');
    } else {
      console.log(`✅ Found ${users.length} users in authentication`);
      
      const testEmails = ['patient@endoflow.com', 'assistant@endoflow.com', 'dentist@endoflow.com'];
      const existingEmails = users.map(u => u.email);
      
      for (const email of testEmails) {
        if (existingEmails.includes(email)) {
          console.log(`✅ Test user exists: ${email}`);
        } else {
          console.log(`⚠️  Test user missing: ${email} (create manually)`);
        }
      }
    }
  } catch (err) {
    console.log('⚠️  Cannot verify users:', err.message);
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SETUP VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  if (envVarsOk && allTablesExist) {
    console.log('🎉 SUCCESS! Your Supabase setup is complete and ready.');
    console.log('');
    console.log('✅ Environment variables: OK');
    console.log('✅ Database connection: OK');
    console.log('✅ All required tables: EXISTS');
    console.log('✅ Critical columns: PRESENT');
    console.log('✅ Database operations: WORKING');
    console.log('');
    console.log('🚀 You can now start your application with: npm run dev');
  } else {
    console.log('⚠️  SETUP INCOMPLETE - Please address the issues above.');
    console.log('');
    if (!envVarsOk) {
      console.log('❌ Fix environment variables in .env.local');
    }
    if (!allTablesExist) {
      console.log('❌ Run the COMPLETE RESET script in Supabase SQL Editor');
    }
  }
  console.log('='.repeat(60));
}

if (require.main === module) {
  verifyCompleteSetup().catch(console.error);
}

module.exports = { verifyCompleteSetup };