const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyFix() {
  console.log('🧪 Verifying ENDOFLOW database fix...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const checks = [
    {
      name: 'appointment_requests table exists',
      test: async () => {
        const { data, error } = await supabase
          .schema('api')
          .from('appointment_requests')
          .select('*')
          .limit(1);
        return { success: !error, error: error?.message };
      }
    },
    {
      name: 'additional_notes column exists',
      test: async () => {
        const { data, error } = await supabase
          .schema('api')
          .from('appointment_requests')
          .select('additional_notes')
          .limit(1);
        return { success: !error, error: error?.message };
      }
    },
    {
      name: 'Can insert appointment request',
      test: async () => {
        const testData = {
          patient_id: '53143863-9a6d-4d6d-a4a3-7d8ab16ba7f5', // Your actual patient user ID
          appointment_type: 'Test Consultation',
          preferred_date: '2025-01-20',
          preferred_time: '10:00 AM',
          reason_for_visit: 'Test booking functionality',
          pain_level: 1,
          additional_notes: 'This is a test appointment to verify the fix',
          status: 'pending'
        };

        const { data, error } = await supabase
          .schema('api')
          .from('appointment_requests')
          .insert(testData)
          .select();
        
        if (!error && data && data.length > 0) {
          // Clean up test data
          await supabase
            .schema('api')
            .from('appointment_requests')
            .delete()
            .eq('id', data[0].id);
        }

        return { success: !error, error: error?.message, data };
      }
    },
    {
      name: 'Other required tables exist',
      test: async () => {
        const tables = ['assistants', 'dentists', 'appointments', 'notifications', 'messages'];
        const results = {};
        
        for (const table of tables) {
          try {
            const { error } = await supabase
              .schema('api')
              .from(table)
              .select('*')
              .limit(1);
            results[table] = !error;
          } catch (err) {
            results[table] = false;
          }
        }
        
        const allExist = Object.values(results).every(exists => exists);
        return { 
          success: allExist, 
          error: allExist ? null : `Missing tables: ${Object.entries(results).filter(([_, exists]) => !exists).map(([name]) => name).join(', ')}`,
          details: results 
        };
      }
    }
  ];

  console.log('Running verification checks...\n');

  let allPassed = true;
  for (const check of checks) {
    try {
      const result = await check.test();
      if (result.success) {
        console.log(`✅ ${check.name}`);
        if (result.details) {
          console.log(`   Details:`, result.details);
        }
      } else {
        console.log(`❌ ${check.name}`);
        console.log(`   Error: ${result.error}`);
        allPassed = false;
      }
    } catch (err) {
      console.log(`❌ ${check.name}`);
      console.log(`   Exception: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 All checks passed! Your ENDOFLOW app should now work correctly.');
    console.log('✅ The appointment booking functionality should be fixed.');
    console.log('✅ You can restart your Next.js app and test it.');
  } else {
    console.log('⚠️  Some checks failed. Please:');
    console.log('1. Make sure you ran URGENT_FIX.sql in your Supabase dashboard');
    console.log('2. Check the Supabase SQL Editor for any error messages');
    console.log('3. Verify that all tables were created successfully');
  }
  console.log('='.repeat(50));
}

if (require.main === module) {
  verifyFix().catch(console.error);
}

module.exports = { verifyFix };