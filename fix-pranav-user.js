#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function fixPranavUser() {
  console.log('🔧 Diagnosing dr.pranav@endoflow.com issue...\n');
  
  // Step 1: Check if user exists in profiles table
  console.log('Step 1: Checking profiles table for existing Dr. Pranav...');
  try {
    const { data: profiles, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .ilike('full_name', '%pranav%')
      .or('full_name.ilike.%Dr. Pranav%,email.eq.dr.pranav@endoflow.com');
      
    if (profileError) {
      console.log('❌ Error querying profiles:', profileError.message);
    } else {
      console.log('✅ Found profiles matching Pranav:', profiles.length);
      profiles.forEach(profile => {
        console.log(`  - ID: ${profile.id}, Name: ${profile.full_name}, Role: ${profile.role}, Status: ${profile.status}`);
      });
    }
    
    // Step 2: Try to create auth user with specific ID if profile exists
    if (profiles && profiles.length > 0) {
      const existingProfile = profiles[0];
      console.log(`\nStep 2: Creating auth user with existing profile ID: ${existingProfile.id}`);
      
      try {
        const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
          email: 'dr.pranav@endoflow.com',
          password: 'endoflow123',
          email_confirm: true,
          user_metadata: {
            full_name: 'Dr. Pranav',
            role: 'dentist'
          }
        });
        
        if (authError) {
          if (authError.message.includes('User already registered')) {
            console.log('  ⚠️  Auth user already exists - this is the source of the issue');
            
            // Try to find the existing auth user
            console.log('\nStep 3: Finding existing auth user...');
            
            // Since we can't list users, try to sign in to see what error we get
            const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
              email: 'dr.pranav@endoflow.com',
              password: 'endoflow123'
            });
            
            if (signInError) {
              console.log('  ❌ Sign in still fails:', signInError.message);
              
              // If it's still a schema error, there might be an ID mismatch
              if (signInError.message.includes('Database error querying schema')) {
                console.log('\n🔧 The issue is likely an ID mismatch between auth.users and profiles table');
                console.log('   This happens when auth user was created with different ID than profile');
                
                // Let's try to fix by updating the profile to have the correct status
                const { error: updateError } = await serviceClient
                  .from('profiles')
                  .update({ 
                    status: 'active',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingProfile.id);
                  
                if (updateError) {
                  console.log('  ❌ Failed to update profile:', updateError.message);
                } else {
                  console.log('  ✅ Profile updated - trying login again...');
                  
                  const { data: retryData, error: retryError } = await anonClient.auth.signInWithPassword({
                    email: 'dr.pranav@endoflow.com',
                    password: 'endoflow123'
                  });
                  
                  if (retryError) {
                    console.log('  ❌ Login still fails:', retryError.message);
                  } else {
                    console.log('  ✅ Login now works!');
                    await anonClient.auth.signOut();
                  }
                }
              }
            } else {
              console.log('  ✅ Sign in actually works now!');
              await anonClient.auth.signOut();
            }
            
          } else {
            console.log('  ❌ Unexpected auth error:', authError.message);
          }
        } else {
          console.log('  ✅ Auth user created successfully');
        }
        
      } catch (authException) {
        console.log('  ❌ Exception creating auth user:', authException.message);
      }
      
    } else {
      // No profile exists, create both profile and auth user
      console.log('\nStep 2: No existing profile found, creating new profile and auth user...');
      
      try {
        const { data: newAuthUser, error: newAuthError } = await serviceClient.auth.admin.createUser({
          email: 'dr.pranav@endoflow.com',
          password: 'endoflow123',
          email_confirm: true,
          user_metadata: {
            full_name: 'Dr. Pranav',
            role: 'dentist'
          }
        });
        
        if (newAuthError) {
          console.log('  ❌ Error creating new auth user:', newAuthError.message);
        } else {
          console.log('  ✅ New auth user created');
          
          // Create profile
          const { error: newProfileError } = await serviceClient
            .from('profiles')
            .insert({
              id: newAuthUser.user.id,
              role: 'dentist',
              status: 'active',
              full_name: 'Dr. Pranav',
              created_at: new Date().toISOString()
            });
            
          if (newProfileError) {
            console.log('  ❌ Error creating profile:', newProfileError.message);
          } else {
            console.log('  ✅ Profile created successfully');
          }
        }
        
      } catch (newException) {
        console.log('  ❌ Exception in new user creation:', newException.message);
      }
    }
    
  } catch (err) {
    console.error('❌ Exception during diagnosis:', err.message);
  }
}

if (require.main === module) {
  fixPranavUser().catch(console.error);
}

module.exports = { fixPranavUser };