const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function testSpecificUsers() {
  console.log('🧪 Testing specific user credentials...\n');

  const testCredentials = [
    { email: 'dr.nisarg@endoflow.com', password: 'endoflow123' },
    { email: 'dr.pranav@endoflow.com', password: 'endoflow123' },
    { email: 'assistant@endoflow.com', password: 'endoflow123' },
    { email: 'patient@endoflow.com', password: 'endoflow123' },
    { email: 'dentist@endoflow.com', password: 'endoflow123' }
  ];

  for (const { email, password } of testCredentials) {
    console.log(`🧪 Testing: ${email}`);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.log(`  ❌ Login failed: ${error.message}`);
      } else {
        console.log(`  ✅ Login successful! User ID: ${data.user.id}`);

        // Sign out after test
        await client.auth.signOut();
      }
    } catch (error) {
      console.log(`  ❌ Exception: ${error.message}`);
    }
    console.log('');
  }
}

testSpecificUsers();