#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function finalAuthTest() {
  console.log('🧪 FINAL AUTHENTICATION TEST');
  console.log('='.repeat(50));
  
  const testUsers = [
    { email: 'dr.pranav@endoflow.com', password: 'endoflow123', expectedRole: 'dentist' },
    { email: 'assistant@endoflow.com', password: 'endoflow123', expectedRole: 'assistant' },
    { email: 'patient@endoflow.com', password: 'endoflow123', expectedRole: 'patient' },
    { email: 'dentist@endoflow.com', password: 'endoflow123', expectedRole: 'dentist' }
  ];
  
  const results = [];
  
  for (const user of testUsers) {
    console.log(`\\n🔐 Testing: ${user.email}`);
    
    try {
      const { data, error } = await anonClient.auth.signInWithPassword({
        email: user.email,
        password: user.password
      });
      
      if (error) {
        console.log(`  ❌ FAILED: ${error.message}`);
        results.push({
          email: user.email,
          status: 'FAILED',
          error: error.message,
          canLogin: false
        });
      } else {
        console.log(`  ✅ SUCCESS: Login successful`);
        console.log(`     User ID: ${data.user.id.substring(0, 8)}...`);
        console.log(`     Email confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}`);
        
        // Sign out immediately
        await anonClient.auth.signOut();
        
        results.push({
          email: user.email,
          status: 'SUCCESS',
          userId: data.user.id,
          canLogin: true
        });
      }
      
    } catch (exception) {
      console.log(`  ❌ EXCEPTION: ${exception.message}`);
      results.push({
        email: user.email,
        status: 'EXCEPTION',
        error: exception.message,
        canLogin: false
      });
    }
  }
  
  console.log('\\n' + '='.repeat(50));
  console.log('📊 AUTHENTICATION SUMMARY');
  console.log('='.repeat(50));
  
  const working = results.filter(r => r.canLogin);
  const broken = results.filter(r => !r.canLogin);
  
  console.log(`✅ Working logins: ${working.length}`);
  working.forEach(user => {
    console.log(`   • ${user.email}`);
  });
  
  console.log(`\\n❌ Broken logins: ${broken.length}`);
  broken.forEach(user => {
    console.log(`   • ${user.email}: ${user.error}`);
  });
  
  if (working.length === testUsers.length) {
    console.log('\\n🎉 ALL AUTHENTICATION ISSUES RESOLVED!');
    console.log('✅ Your application should now work correctly.');
    console.log('\\nYou can now:');
    console.log('  1. Start your app with: npm run dev');
    console.log('  2. Login with any of these test accounts:');
    testUsers.forEach(user => {
      console.log(`     • ${user.email} / ${user.password}`);
    });
  } else {
    console.log('\\n⚠️  Some authentication issues remain:');
    broken.forEach(user => {
      if (user.error.includes('Database error querying schema')) {
        console.log(`   • ${user.email}: ID mismatch between auth user and profile`);
      } else if (user.error.includes('Invalid login credentials')) {
        console.log(`   • ${user.email}: User does not exist or wrong password`);
      } else {
        console.log(`   • ${user.email}: ${user.error}`);
      }
    });
    
    if (broken.length === 1 && broken[0].email === 'dr.pranav@endoflow.com') {
      console.log('\\n💡 RECOMMENDATION:');
      console.log('   The dr.pranav@endoflow.com issue is an ID mismatch.');
      console.log('   You can either:');
      console.log('   1. Delete the dr.pranav@endoflow.com account and recreate it');
      console.log('   2. Or use the other working test accounts for development');
      console.log('   3. The other 3 accounts should work fine for testing');
    }
  }
  
  console.log('\\n' + '='.repeat(50));
}

if (require.main === module) {
  finalAuthTest().catch(console.error);
}

module.exports = { finalAuthTest };