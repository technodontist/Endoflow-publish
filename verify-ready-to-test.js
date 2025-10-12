const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log('🔍 VERIFYING SYSTEM IS READY FOR TESTING\n');
console.log('═══════════════════════════════════════════════════════\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let allGood = true;

// Check 1: Environment variables
console.log('1️⃣ Checking environment variables...');
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  allGood = false;
} else {
  console.log('✅ Environment variables configured\n');
}

// Check 2: Database table
console.log('2️⃣ Checking database table...');
if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'api' }
  });

  (async () => {
    try {
      const { data, error } = await supabase
        .from('endoflow_conversations')
        .select('id')
        .limit(1);

      if (error) {
        console.error('❌ Table check failed:', error.message);
        allGood = false;
      } else {
        console.log('✅ Database table accessible\n');
      }

      // Check 3: Frontend code changes
      console.log('3️⃣ Checking frontend code changes...');
      const frontendPath = 'D:\\endoflow\\Endoflow-publish\\components\\dentist\\endoflow-voice-controller.tsx';
      const frontendCode = fs.readFileSync(frontendPath, 'utf8');

      if (frontendCode.includes('localStorage.getItem(\'endoflow_current_conversation_id\')')) {
        console.log('✅ LocalStorage persistence code added\n');
      } else {
        console.error('❌ LocalStorage code not found in voice controller');
        allGood = false;
      }

      // Check 4: Build artifacts
      console.log('4️⃣ Checking build status...');
      if (fs.existsSync('.next')) {
        console.log('✅ Next.js build exists\n');
      } else {
        console.warn('⚠️  No build found - run: npm run build\n');
      }

      // Summary
      console.log('═══════════════════════════════════════════════════════');
      if (allGood) {
        console.log('✅ ALL CHECKS PASSED - READY FOR TESTING!');
        console.log('═══════════════════════════════════════════════════════\n');
        
        console.log('📋 NEXT STEPS:\n');
        console.log('1. Start dev server (if not running):');
        console.log('   npm run dev\n');
        console.log('2. Open browser to:');
        console.log('   http://localhost:3000/dentist\n');
        console.log('3. Follow the test guide:');
        console.log('   TEST_CONVERSATION_CONTEXT.md\n');
        console.log('4. Watch for these console logs:');
        console.log('   💾 [PERSISTENCE] Loaded conversation ID...');
        console.log('   💾 [PERSISTENCE] Saving conversation ID...');
        console.log('   ✅ [ENDOFLOW ACTION] Loaded conversation history...\n');
        
        console.log('🎯 TEST SCENARIO:');
        console.log('   Query 1: "Show me appointments for October"');
        console.log('   Query 2: "How many patients were there?" ← Should understand context!\n');
        
        process.exit(0);
      } else {
        console.log('❌ SOME CHECKS FAILED - REVIEW ERRORS ABOVE');
        console.log('═══════════════════════════════════════════════════════\n');
        process.exit(1);
      }

    } catch (err) {
      console.error('❌ Verification failed:', err.message);
      process.exit(1);
    }
  })();
}
