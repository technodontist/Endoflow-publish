const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTable() {
  console.log('🔍 Checking if endoflow_conversations table exists...\n');

  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('endoflow_conversations')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('❌ TABLE DOES NOT EXIST');
        console.log('\n📋 The endoflow_conversations table needs to be created.');
        console.log('👉 Run: CREATE_ENDOFLOW_CONVERSATIONS_TABLE.sql in your database\n');
        return false;
      } else {
        console.error('❌ Error checking table:', error.message);
        return false;
      }
    }

    console.log('✅ TABLE EXISTS!');
    console.log(`📊 Found ${data?.length || 0} conversation(s) in first query\n`);

    // Get more details
    const { data: conversations, error: countError } = await supabase
      .from('endoflow_conversations')
      .select('id, dentist_id, created_at, last_message_at, intent_type')
      .order('last_message_at', { ascending: false })
      .limit(10);

    if (!countError && conversations) {
      console.log(`📈 Total conversations in table: ${conversations.length}`);
      
      if (conversations.length > 0) {
        console.log('\n🔍 Recent conversations:');
        conversations.forEach(conv => {
          console.log(`  - ID: ${conv.id}`);
          console.log(`    Dentist: ${conv.dentist_id}`);
          console.log(`    Intent: ${conv.intent_type || 'N/A'}`);
          console.log(`    Last message: ${conv.last_message_at}`);
          console.log('');
        });
      } else {
        console.log('\n⚠️  Table exists but is empty (no conversations yet)');
      }
    }

    return true;

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

checkTable()
  .then(exists => {
    if (!exists) {
      console.log('\n🔧 RECOMMENDED NEXT STEPS:');
      console.log('1. Run CREATE_ENDOFLOW_CONVERSATIONS_TABLE.sql to create the table');
      console.log('2. Verify table creation with VERIFY_CONVERSATIONS_TABLE.sql');
      console.log('3. Test the voice feature again\n');
    } else {
      console.log('\n✅ Table is ready! If voice history still fails:');
      console.log('1. Check that conversationId is being passed correctly');
      console.log('2. Verify RLS policies allow the current user to access conversations');
      console.log('3. Check backend logs for more specific errors\n');
    }
    process.exit(exists ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
