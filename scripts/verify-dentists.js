#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key (full access)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyDentistProfiles() {
  try {
    console.log('🔍 Verifying dentist profiles...\n');

    // Check profiles table
    console.log('📋 Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, role, status, created_at')
      .eq('role', 'dentist')
      .in('full_name', ['Dr. Nisarg', 'Dr. Pranav']);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    } else {
      console.log(`✅ Found ${profiles.length} dentist profile(s):`);
      profiles.forEach(p => {
        console.log(`   • ${p.full_name} (${p.status}) - Created: ${new Date(p.created_at).toLocaleString()}`);
      });
    }

    // Check dentists table
    console.log('\n🦷 Checking api.dentists table...');
    const { data: dentists, error: dentistsError } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name, specialty, created_at')
      .in('full_name', ['Dr. Nisarg', 'Dr. Pranav']);

    if (dentistsError) {
      console.error('❌ Error fetching api.dentists:', dentistsError);
    } else {
      console.log(`✅ Found ${dentists.length} dentist record(s) in api.dentists:`);
      dentists.forEach(d => {
        console.log(`   • ${d.full_name} - ${d.specialty} - Created: ${new Date(d.created_at).toLocaleString()}`);
      });
    }

    // Check auth.users table using admin API
    console.log('\n🔐 Checking auth.users table...');
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error('❌ Error fetching auth users:', authError);
      } else {
        const dentistUsers = authData.users.filter(user =>
          user.email && (user.email === 'dr.nisarg@endoflow.com' || user.email === 'dr.pranav@endoflow.com')
        );

        console.log(`✅ Found ${dentistUsers.length} dentist auth user(s):`);
        dentistUsers.forEach(user => {
          console.log(`   • ${user.email} - Created: ${new Date(user.created_at).toLocaleString()}`);
        });

        if (dentistUsers.length === 0) {
          console.log('❌ No dentist accounts found in auth.users table');
          console.log('   This explains the "Database error querying schema" login error');
        }
      }
    } catch (authError) {
      console.error('❌ Exception checking auth users:', authError);
    }

    // Summary
    console.log('\n📊 VERIFICATION SUMMARY:');
    if (profiles && profiles.length === 2) {
      console.log('✅ Both Dr. Nisarg and Dr. Pranav profiles found');
      console.log('🔑 Login credentials:');
      console.log('   • dr.nisarg@endoflow.com / endoflow123');
      console.log('   • dr.pranav@endoflow.com / endoflow123');
    } else {
      console.log('❌ Dentist profiles not found or incomplete');
      console.log('👆 Please execute the SQL script manually in Supabase Dashboard');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

verifyDentistProfiles();