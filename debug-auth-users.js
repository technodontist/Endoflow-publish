#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create service client to check users
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

// Create regular client to test login
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function debugAuthUsers() {
  console.log('🔍 Debugging Supabase Auth Users...\n');
  
  // Step 1: List all users in auth.users table
  console.log('Step 1: Checking existing users in auth.users...');
  try {
    const { data: { users }, error } = await serviceClient.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error listing users:', error.message);
      return;
    }
    
    console.log(`✅ Found ${users.length} users in auth.users:`);
    users.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id.substring(0, 8)}..., Status: ${user.email_confirmed_at ? 'confirmed' : 'unconfirmed'})`);
    });
    
    // Step 2: Check specific problematic users
    console.log('\nStep 2: Checking specific problematic users...');
    const testEmails = [
      'dr.pranav@endoflow.com',
      'assistant@endoflow.com', 
      'patient@endoflow.com',
      'dentist@endoflow.com'
    ];
    
    const existingEmails = users.map(u => u.email);
    
    for (const email of testEmails) {
      if (existingEmails.includes(email)) {
        console.log(`✅ User exists: ${email}`);
      } else {
        console.log(`❌ User missing: ${email}`);
      }
    }
    
    // Step 3: Test login for existing users
    console.log('\nStep 3: Testing login for existing users...');
    
    // Test with known password from scripts
    if (existingEmails.includes('dr.pranav@endoflow.com')) {
      console.log('Testing dr.pranav@endoflow.com with password "endoflow123"...');
      const { data, error } = await anonClient.auth.signInWithPassword({
        email: 'dr.pranav@endoflow.com',
        password: 'endoflow123'
      });
      
      if (error) {
        console.log(`❌ Login failed: ${error.message}`);
      } else {
        console.log(`✅ Login successful for dr.pranav@endoflow.com`);
        // Sign out immediately
        await anonClient.auth.signOut();
      }
    }
    
    // Test with generic passwords for other accounts
    const testPassword = 'endoflow123'; // Common password from scripts
    
    for (const email of ['assistant@endoflow.com', 'patient@endoflow.com', 'dentist@endoflow.com']) {
      if (existingEmails.includes(email)) {
        console.log(`Testing ${email} with password "${testPassword}"...`);
        const { data, error } = await anonClient.auth.signInWithPassword({
          email: email,
          password: testPassword
        });
        
        if (error) {
          console.log(`❌ Login failed for ${email}: ${error.message}`);
        } else {
          console.log(`✅ Login successful for ${email}`);
          await anonClient.auth.signOut();
        }
      }
    }
    
    // Step 4: Check profiles table to see if users have corresponding profiles
    console.log('\nStep 4: Checking profiles table for existing users...');
    
    for (const user of users) {
      const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('role, status, full_name')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.log(`❌ No profile found for ${user.email}: ${profileError.message}`);
      } else {
        console.log(`✅ Profile exists for ${user.email}: ${profile.role} (${profile.status}) - ${profile.full_name}`);
      }
    }
    
  } catch (err) {
    console.error('❌ Exception during auth debug:', err.message);
  }
}

if (require.main === module) {
  debugAuthUsers().catch(console.error);
}

module.exports = { debugAuthUsers };