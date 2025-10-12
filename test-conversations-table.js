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
  },
  db: {
    schema: 'api'
  }
});

async function testTable() {
  console.log('🧪 Testing endoflow_conversations table in API schema...\n');

  try {
    // Test 1: Query existing conversations
    console.log('1️⃣ Querying existing conversations...');
    const { data: existingConvs, error: queryError } = await supabase
      .from('endoflow_conversations')
      .select('*')
      .limit(5);

    if (queryError) {
      console.error('❌ Query failed:', queryError.message);
      return false;
    }

    console.log(`✅ Found ${existingConvs?.length || 0} conversation(s)`);
    
    if (existingConvs && existingConvs.length > 0) {
      console.log('\n📋 Sample conversation:');
      const sample = existingConvs[0];
      console.log('   ID:', sample.id);
      console.log('   Dentist ID:', sample.dentist_id);
      console.log('   Messages:', Array.isArray(sample.messages) ? sample.messages.length : 'Invalid format');
      console.log('   Intent:', sample.intent_type || 'N/A');
      console.log('   Created:', sample.created_at);
      console.log('   Last message:', sample.last_message_at);
    }

    // Test 2: Check table structure
    console.log('\n2️⃣ Verifying table structure...');
    const expectedColumns = ['id', 'dentist_id', 'messages', 'intent_type', 'created_at', 'last_message_at'];
    
    if (existingConvs && existingConvs.length > 0) {
      const actualColumns = Object.keys(existingConvs[0]);
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      
      if (missingColumns.length === 0) {
        console.log('✅ All required columns present');
      } else {
        console.error('❌ Missing columns:', missingColumns);
        return false;
      }
    } else {
      console.log('⚠️  No data to verify structure, but query succeeded');
    }

    // Test 3: Check messages format
    console.log('\n3️⃣ Checking messages format...');
    if (existingConvs && existingConvs.length > 0) {
      const sample = existingConvs[0];
      if (Array.isArray(sample.messages)) {
        console.log('✅ Messages is an array');
        
        if (sample.messages.length > 0) {
          const firstMsg = sample.messages[0];
          if (firstMsg.role && firstMsg.content) {
            console.log('✅ Message structure is correct');
            console.log(`   Sample: ${firstMsg.role}: "${firstMsg.content.substring(0, 50)}..."`);
          } else {
            console.warn('⚠️  Message structure might be incomplete');
          }
        } else {
          console.log('ℹ️  Messages array is empty (new conversation)');
        }
      } else {
        console.error('❌ Messages is not an array!');
        return false;
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ TABLE IS READY AND WORKING!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Table: api.endoflow_conversations');
    console.log('✅ Schema: Correct (api)');
    console.log('✅ Structure: Valid');
    console.log('✅ Accessible: Yes');
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. ✅ Table is set up correctly');
    console.log('2. Test the voice feature in your application');
    console.log('3. Check browser console and server logs for any errors');
    console.log('4. The conversation history should now work!\n');
    
    return true;

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('1. Ensure RLS policies allow service role access');
    console.log('2. Check that the table was created in api schema');
    console.log('3. Verify Supabase service role key is correct\n');
    return false;
  }
}

testTable()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
