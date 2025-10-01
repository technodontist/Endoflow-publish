#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuthUsers() {
  try {
    console.log('🔍 Checking auth.users table for endoflow emails...\n');

    // This requires service role key to access auth.users
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    const endoflowUsers = data.users.filter(user =>
      user.email && user.email.includes('@endoflow.com')
    );

    console.log(`✅ Found ${endoflowUsers.length} endoflow user(s):`);
    endoflowUsers.forEach(user => {
      console.log(`   • ${user.email} - Created: ${new Date(user.created_at).toLocaleString()}`);
    });

    if (endoflowUsers.length === 0) {
      console.log('\n❌ No endoflow users found in auth.users table');
      console.log('👆 This confirms the SQL script needs to be executed');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAuthUsers();