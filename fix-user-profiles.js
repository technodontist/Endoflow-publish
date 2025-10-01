const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixUserProfiles() {
  console.log('👥 Fixing User Profiles for ENDOFLOW...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Step 1: Checking existing users in authentication...\n');

  try {
    // Get all users from auth.users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.log('❌ Cannot access user list:', error.message);
      console.log('⚠️  This might be a permission issue with the service role key.');
      return;
    }

    console.log(`✅ Found ${users.length} users in authentication:`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user.id}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Created: ${user.created_at}`);
      console.log('');
    });

    if (users.length === 0) {
      console.log('⚠️  No users found in authentication.');
      console.log('   You need to create users first in Supabase Dashboard > Authentication > Users');
      console.log('   Or use the signup functionality in your app.');
      return;
    }

    console.log('🔍 Step 2: Checking current profiles table...\n');

    // Check current profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.log('❌ Cannot access profiles table:', profilesError.message);
    } else {
      console.log(`✅ Current profiles table has ${profiles.length} entries:`);
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ID: ${profile.id}`);
        console.log(`      Role: ${profile.role}`);
        console.log(`      Status: ${profile.status}`);
        console.log(`      Name: ${profile.full_name}`);
        console.log('');
      });
    }

    console.log('🔍 Step 3: Creating/updating profiles for existing users...\n');

    // Create profiles for each authenticated user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userNumber = i + 1;
      
      // Determine role based on email or assign defaults
      let role = 'patient'; // default
      let fullName = user.email || `User ${userNumber}`;

      if (user.email) {
        if (user.email.includes('patient')) {
          role = 'patient';
          fullName = 'Test Patient';
        } else if (user.email.includes('assistant')) {
          role = 'assistant';
          fullName = 'Test Assistant';
        } else if (user.email.includes('dentist')) {
          role = 'dentist';
          fullName = 'Test Dentist';
        } else {
          // For the main patient user we've been testing with
          if (user.id === 'd1864a3f-d700-4cb5-a737-781071d2fc16') {
            role = 'patient';
            fullName = 'Test Patient';
          }
        }
      }

      console.log(`📝 Creating/updating profile for user ${userNumber}:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Assigned Role: ${role}`);
      console.log(`   Full Name: ${fullName}`);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            role: role,
            status: 'active',
            full_name: fullName
          }, {
            onConflict: 'id'
          })
          .select();

        if (error) {
          console.log(`   ❌ Failed to create profile: ${error.message}`);
        } else {
          console.log(`   ✅ Profile created/updated successfully`);
        }
      } catch (err) {
        console.log(`   ❌ Exception: ${err.message}`);
      }

      console.log('');
    }

    console.log('🔍 Step 4: Final verification...\n');

    // Verify final state
    const { data: finalProfiles, error: finalError } = await supabase
      .from('profiles')
      .select('*');

    if (finalError) {
      console.log('❌ Cannot verify final profiles:', finalError.message);
    } else {
      console.log(`✅ Final profiles table has ${finalProfiles.length} entries:`);
      finalProfiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ${profile.full_name} (${profile.role}) - ${profile.status}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ User profiles have been fixed!');
    console.log('🚀 You can now test your application.');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error fixing user profiles:', error.message);
  }
}

if (require.main === module) {
  fixUserProfiles().catch(console.error);
}

module.exports = { fixUserProfiles };