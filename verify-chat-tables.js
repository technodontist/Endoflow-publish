/**
 * Verification Script: Check if clinic analysis chat tables exist
 * Run: node verify-chat-tables.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verifyTables() {
  console.log('🔍 Checking clinic analysis chat tables...\n')

  // Check sessions table
  console.log('1️⃣ Checking clinic_analysis_chat_sessions table...')
  const { data: sessions, error: sessionsError } = await supabase
    .schema('api')
    .from('clinic_analysis_chat_sessions')
    .select('*')
    .limit(1)

  if (sessionsError) {
    console.log('❌ Sessions table NOT found:', sessionsError.message)
    console.log('   → Need to run migration: lib/db/migrations/add_clinic_analysis_chat_sessions.sql\n')
  } else {
    console.log('✅ Sessions table exists\n')
  }

  // Check messages table
  console.log('2️⃣ Checking clinic_analysis_messages table...')
  const { data: messages, error: messagesError } = await supabase
    .schema('api')
    .from('clinic_analysis_messages')
    .select('*')
    .limit(1)

  if (messagesError) {
    console.log('❌ Messages table NOT found:', messagesError.message)
    console.log('   → Need to run migration: lib/db/migrations/add_clinic_analysis_chat_sessions.sql\n')
  } else {
    console.log('✅ Messages table exists\n')
  }

  // Summary
  if (sessionsError || messagesError) {
    console.log('\n📋 NEXT STEPS:')
    console.log('1. Go to Supabase Dashboard → SQL Editor')
    console.log('2. Run the migration file: lib/db/migrations/add_clinic_analysis_chat_sessions.sql')
    console.log('3. Re-run this script to verify\n')
  } else {
    console.log('✅ All tables exist! Chat history feature is ready to use.\n')
  }
}

verifyTables()
