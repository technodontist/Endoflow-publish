#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('🧪 Testing login for dr.pranav@endoflow.com...');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'dr.pranav@endoflow.com',
    password: 'endoflow123'
  });

  if (error) {
    console.error('❌ Login failed:', error.message);
    console.log('🔍 This confirms auth.users entry is missing');
  } else {
    console.log('✅ Login successful!', data.user.email);
  }
}

testLogin();