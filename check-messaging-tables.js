const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function checkMessagingTables() {
  console.log('🔍 [MESSAGING CHECK] Verifying messaging tables...\n')

  // Check message_threads table
  console.log('📋 [CHECK 1] Testing api.message_threads...')
  try {
    const { data: threadsData, error: threadsError } = await supabase
      .schema('api')
      .from('message_threads')
      .select('count')
      .limit(1)

    if (threadsError) {
      console.log('   ❌ Error:', threadsError.message)
      if (threadsError.code === 'PGRST116') {
        console.log('   💡 Table does not exist')
      }
    } else {
      console.log('   ✅ message_threads table exists and accessible')
    }
  } catch (e) {
    console.log('   ❌ Exception:', e.message)
  }

  // Check thread_messages table
  console.log('\n📋 [CHECK 2] Testing api.thread_messages...')
  try {
    const { data: messagesData, error: messagesError } = await supabase
      .schema('api')
      .from('thread_messages')
      .select('count')
      .limit(1)

    if (messagesError) {
      console.log('   ❌ Error:', messagesError.message)
      if (messagesError.code === 'PGRST116') {
        console.log('   💡 Table does not exist')
      }
    } else {
      console.log('   ✅ thread_messages table exists and accessible')
    }
  } catch (e) {
    console.log('   ❌ Exception:', e.message)
  }

  // Check existing messages table (from original schema)
  console.log('\n📋 [CHECK 3] Testing api.messages (legacy table)...')
  try {
    const { data: legacyData, error: legacyError } = await supabase
      .schema('api')
      .from('messages')
      .select('count')
      .limit(1)

    if (legacyError) {
      console.log('   ❌ Error:', legacyError.message)
      if (legacyError.code === 'PGRST116') {
        console.log('   💡 Table does not exist')
      }
    } else {
      console.log('   ✅ messages table exists and accessible')
    }
  } catch (e) {
    console.log('   ❌ Exception:', e.message)
  }

  console.log('\n🎯 [SUMMARY] Messaging System Status')
  console.log('   ✅ If tables exist: Ready to implement messaging!')
  console.log('   ❌ If tables missing: Need to run SQL creation script')
  console.log('   💡 Suggestion: Create tables manually in Supabase Dashboard → SQL Editor')
}

checkMessagingTables().catch(console.error)
