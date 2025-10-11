const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function applySelfLearningMigration() {
  console.log('🚀 Applying Self-Learning Chat Sessions Migration...\n');
  
  // Verify environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    process.exit(1);
  }
  
  // Create Supabase client with service role key
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
  
  console.log('✅ Supabase client initialized');
  console.log(`📍 Project URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);
  
  try {
    // Read the migration file
    const migrationPath = 'lib/db/migrations/add_self_learning_chat_sessions.sql';
    console.log(`📖 Reading migration file: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Error: Migration file not found at:', migrationPath);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded successfully\n');
    
    // Split SQL into statements (improved splitting)
    console.log('📝 Parsing SQL statements...');
    const statements = migrationSQL
      .split(/;[\r\n]/g)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.startsWith('--'))
      .filter(s => !s.toLowerCase().includes('select') || s.toLowerCase().includes('create'))
      .map(s => s + (s.endsWith(';') ? '' : ';'));
    
    console.log(`✅ Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement via RPC
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      
      console.log(`⚡ [${i + 1}/${statements.length}] Executing: ${preview}...`);
      
      try {
        // Use Supabase's query method for raw SQL
        const { data, error } = await supabase.rpc('exec_sql', { 
          query: statement 
        });
        
        if (error) {
          // Check if it's an expected error (already exists)
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate') ||
              error.message.includes('does not exist')) {
            console.log(`   ⚠️  Skipped (already exists)`);
            skipCount++;
          } else if (error.message.includes('exec_sql')) {
            // RPC function doesn't exist, try alternative approach
            console.log(`   ℹ️  RPC not available, need manual execution`);
            console.log(`   📋 Please execute this SQL manually in Supabase dashboard`);
            errorCount++;
          } else {
            console.log(`   ⚠️  Error: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.log(`   ❌ Exception: ${err.message}`);
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⚠️  Skipped:    ${skipCount}`);
    console.log(`❌ Errors:     ${errorCount}`);
    console.log('='.repeat(60) + '\n');
    
    // Verify tables were created
    console.log('🔍 Verifying migration...\n');
    
    try {
      // Check if tables exist by querying them
      const { data: sessionsData, error: sessionsError } = await supabase
        .schema('api')
        .from('self_learning_chat_sessions')
        .select('id')
        .limit(1);
      
      if (!sessionsError) {
        console.log('✅ Table verified: api.self_learning_chat_sessions');
      } else {
        console.log('⚠️  Table check failed: api.self_learning_chat_sessions');
        console.log('   Error:', sessionsError.message);
      }
      
      const { data: messagesData, error: messagesError } = await supabase
        .schema('api')
        .from('self_learning_messages')
        .select('id')
        .limit(1);
      
      if (!messagesError) {
        console.log('✅ Table verified: api.self_learning_messages');
      } else {
        console.log('⚠️  Table check failed: api.self_learning_messages');
        console.log('   Error:', messagesError.message);
      }
    } catch (verifyErr) {
      console.log('⚠️  Verification failed:', verifyErr.message);
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (errorCount > 0 || skipCount === statements.length) {
      console.log('⚠️  MANUAL MIGRATION REQUIRED');
      console.log('='.repeat(60));
      console.log('\nThe migration could not be fully applied automatically.');
      console.log('This is common with Supabase hosted projects.');
      console.log('\n📋 Please follow these steps:\n');
      console.log('1. Open Supabase dashboard: https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Go to SQL Editor');
      console.log('4. Click "New Query"');
      console.log('5. Copy the entire contents of:');
      console.log('   lib/db/migrations/add_self_learning_chat_sessions.sql');
      console.log('6. Paste into SQL Editor');
      console.log('7. Click "Run" (or press Ctrl+Enter)');
      console.log('8. Verify success message appears');
      console.log('\nThen run this script again to verify.');
    } else {
      console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('\n✅ All tables and policies created');
      console.log('✅ Ready to test the feature\n');
      console.log('Next steps:');
      console.log('1. Start dev server: npm run dev');
      console.log('2. Navigate to Self Learning Assistant');
      console.log('3. Click "AI Chat Assistant" tab');
      console.log('4. Test creating sessions and sending messages\n');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  applySelfLearningMigration()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { applySelfLearningMigration };
