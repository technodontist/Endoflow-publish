#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create service client 
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function createMissingUsers() {
  console.log('🚀 Creating missing test users...\n');
  
  const testUsers = [
    {
      email: 'dr.pranav@endoflow.com',
      password: 'endoflow123',
      role: 'dentist',
      full_name: 'Dr. Pranav'
    },
    {
      email: 'assistant@endoflow.com', 
      password: 'endoflow123',
      role: 'assistant',
      full_name: 'Test Assistant'
    },
    {
      email: 'patient@endoflow.com',
      password: 'endoflow123', 
      role: 'patient',
      full_name: 'Test Patient'
    },
    {
      email: 'dentist@endoflow.com',
      password: 'endoflow123',
      role: 'dentist', 
      full_name: 'Test Dentist'
    }
  ];
  
  for (const user of testUsers) {
    console.log(`Creating user: ${user.email}...`);
    
    try {
      // First try to create via admin API (more reliable)
      const { data, error } = await serviceClient.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Skip email confirmation for test users
        user_metadata: {
          full_name: user.full_name,
          role: user.role
        }
      });
      
      if (error) {
        if (error.message.includes('User already registered')) {
          console.log(`  ⚠️  User ${user.email} already exists - skipping`);
        } else {
          console.log(`  ❌ Error creating ${user.email}: ${error.message}`);
        }
        continue;
      }
      
      console.log(`  ✅ Successfully created user: ${user.email}`);
      
      // Now create corresponding profile entry
      const { error: profileError } = await serviceClient
        .from('profiles')
        .upsert({
          id: data.user.id,
          role: user.role,
          status: 'active', // Set as active for testing
          full_name: user.full_name,
          created_at: new Date().toISOString()
        });
        
      if (profileError) {
        console.log(`  ⚠️  Profile creation warning for ${user.email}: ${profileError.message}`);
      } else {
        console.log(`  ✅ Profile created for ${user.email}`);
      }
      
    } catch (err) {
      console.log(`  ❌ Exception creating ${user.email}: ${err.message}`);
    }
  }
  
  console.log('\\n🎉 User creation process completed!');
  console.log('\\nTest credentials:');
  testUsers.forEach(user => {
    console.log(`  ${user.email} / ${user.password}`);
  });
}

// Function to test login after creation
async function testLogin(email, password) {
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  console.log(`\\n🧪 Testing login for ${email}...`);
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.log(`  ❌ Login failed: ${error.message}`);
    return false;
  } else {
    console.log(`  ✅ Login successful!`);
    await anonClient.auth.signOut();
    return true;
  }
}

async function main() {
  await createMissingUsers();
  
  // Test logins
  console.log('\\n' + '='.repeat(50));
  console.log('🧪 TESTING LOGINS');
  console.log('='.repeat(50));
  
  const testEmails = [
    'dr.pranav@endoflow.com',
    'assistant@endoflow.com', 
    'patient@endoflow.com',
    'dentist@endoflow.com'
  ];
  
  for (const email of testEmails) {
    await testLogin(email, 'endoflow123');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createMissingUsers, testLogin };