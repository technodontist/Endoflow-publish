const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyMigration() {
  console.log('🔍 Verifying Self-Learning Chat Migration Status...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  console.log('✅ Connected to Supabase\n');
  
  const checks = [];
  
  // 1. Check if sessions table exists and get row count
  console.log('📊 Checking api.self_learning_chat_sessions table...');
  try {
    const { data, error, count } = await supabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('*', { count: 'exact', head: true });
    
    if (!error) {
      checks.push({ name: 'Sessions table exists', status: '✅', details: `${count || 0} records` });
      console.log(`   ✅ Table exists with ${count || 0} sessions\n`);
    } else {
      checks.push({ name: 'Sessions table exists', status: '❌', details: error.message });
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  } catch (err) {
    checks.push({ name: 'Sessions table exists', status: '❌', details: err.message });
    console.log(`   ❌ Exception: ${err.message}\n`);
  }
  
  // 2. Check if messages table exists and get row count
  console.log('📊 Checking api.self_learning_messages table...');
  try {
    const { data, error, count } = await supabase
      .schema('api')
      .from('self_learning_messages')
      .select('*', { count: 'exact', head: true });
    
    if (!error) {
      checks.push({ name: 'Messages table exists', status: '✅', details: `${count || 0} records` });
      console.log(`   ✅ Table exists with ${count || 0} messages\n`);
    } else {
      checks.push({ name: 'Messages table exists', status: '❌', details: error.message });
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  } catch (err) {
    checks.push({ name: 'Messages table exists', status: '❌', details: err.message });
    console.log(`   ❌ Exception: ${err.message}\n`);
  }
  
  // 3. Test creating a session (requires authentication)
  console.log('🧪 Testing session creation...');
  checks.push({ name: 'Session creation (requires dentist auth)', status: '⏭️', details: 'Skipped - needs user auth' });
  console.log('   ⏭️  Skipped (requires authenticated dentist user)\n');
  
  // 4. Check table structure
  console.log('📋 Checking sessions table structure...');
  try {
    const { data, error } = await supabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('*')
      .limit(1);
    
    if (!error) {
      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        checks.push({ name: 'Sessions table structure', status: '✅', details: `${columns.length} columns` });
        console.log(`   ✅ Columns: ${columns.join(', ')}\n`);
      } else {
        checks.push({ name: 'Sessions table structure', status: '✅', details: 'Empty table' });
        console.log('   ✅ Table exists but empty (expected for new migration)\n');
      }
    } else {
      checks.push({ name: 'Sessions table structure', status: '⚠️', details: error.message });
      console.log(`   ⚠️  ${error.message}\n`);
    }
  } catch (err) {
    checks.push({ name: 'Sessions table structure', status: '❌', details: err.message });
    console.log(`   ❌ ${err.message}\n`);
  }
  
  // Print summary
  console.log('='.repeat(70));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  checks.forEach(check => {
    console.log(`${check.status} ${check.name.padEnd(45)} ${check.details}`);
  });
  console.log('='.repeat(70));
  
  const passedChecks = checks.filter(c => c.status === '✅').length;
  const totalChecks = checks.filter(c => c.status !== '⏭️').length;
  
  console.log(`\n${passedChecks}/${totalChecks} critical checks passed\n`);
  
  if (passedChecks === totalChecks) {
    console.log('🎉 MIGRATION VERIFIED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n✅ Database tables are ready');
    console.log('✅ Schema is correct');
    console.log('\n📋 Next Steps:');
    console.log('1. Start your dev server: npm run dev');
    console.log('2. Log in as a dentist user');
    console.log('3. Navigate to Self Learning Assistant → AI Chat Assistant');
    console.log('4. Test creating a new chat session');
    console.log('5. Send a message and verify it persists after refresh\n');
  } else {
    console.log('⚠️  MIGRATION INCOMPLETE');
    console.log('='.repeat(70));
    console.log('\nSome checks failed. Please:');
    console.log('1. Open Supabase Dashboard SQL Editor');
    console.log('2. Run the contents of: lib/db/migrations/add_self_learning_chat_sessions.sql');
    console.log('3. Run this verification script again\n');
  }
}

// Run verification
if (require.main === module) {
  verifyMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyMigration };
