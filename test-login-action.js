const { createClient } = require('@supabase/supabase-js');

async function testLoginAction() {
  console.log('🧪 Testing login action locally...\n');

  // Test the action by calling it directly
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'assistant@endoflow.com',
      password: 'endoflow123'
    });

    if (error) {
      console.log('❌ Login failed:', error.message);
    } else {
      console.log('✅ Login successful!');
      console.log('   User ID:', data.user.id);
      console.log('   Email:', data.user.email);

      // Sign out
      await supabase.auth.signOut();
      console.log('✅ Sign out successful');
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });
testLoginAction();