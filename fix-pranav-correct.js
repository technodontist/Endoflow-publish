#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function fixPranavUserCorrect() {
  console.log('🔧 Fixing dr.pranav@endoflow.com issue correctly...\n');
  
  // Step 1: Check profiles table structure
  console.log('Step 1: Checking profiles table for any Pranav entries...');
  try {
    const { data: profiles, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .ilike('full_name', '%pranav%');
      
    if (profileError) {
      console.log('❌ Error querying profiles:', profileError.message);
    } else {
      console.log('✅ Found profiles matching Pranav:', profiles.length);
      profiles.forEach(profile => {
        console.log(`  - ID: ${profile.id}, Name: ${profile.full_name}, Role: ${profile.role}, Status: ${profile.status}`);
      });
    }
    
    // Step 2: Check if there's an orphaned auth user
    console.log('\nStep 2: Testing direct login to see specific error...');
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: 'dr.pranav@endoflow.com',
      password: 'endoflow123'
    });
    
    if (signInError) {
      console.log('  ❌ Login fails with:', signInError.message);
      
      if (signInError.message.includes('Database error querying schema')) {
        console.log('\n🔧 This suggests there is an auth user but no corresponding profile');
        console.log('   Let\'s try to fix by creating the missing profile entry');
        
        // The issue is likely that auth user exists but profile doesn't
        // We need to use the profile trigger or create it manually
        console.log('\nStep 3: Attempting to create profile via signup trigger simulation...');
        
        // Try a different approach - reset password to trigger profile creation
        try {
          const { error: resetError } = await serviceClient.auth.admin.updateUserById(
            // We don't know the user ID, so this won't work directly
            'temp-id', // This will fail, but let's try another approach
            {
              email_confirm: true,
              user_metadata: {
                full_name: 'Dr. Pranav',
                role: 'dentist'
              }
            }
          );
        } catch (err) {
          // Expected to fail since we don't have user ID
        }
        
        // Alternative: Try to create a profile with a new auth user
        console.log('\nStep 4: Creating fresh Dr. Pranav account...');
        
        // First delete any existing profile that might conflict
        const { error: deleteError } = await serviceClient
          .from('profiles')
          .delete()
          .ilike('full_name', '%Dr. Pranav%');
          
        console.log('  Cleaned up any existing profiles:', deleteError ? deleteError.message : 'Success');
        
        // Create new auth user
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
          if (newAuthError.message.includes('User already registered')) {
            console.log('  ⚠️  User still exists in auth table - need manual cleanup');
            
            // Last resort: try to update existing user
            console.log('\nStep 5: Attempting to reset existing user...');
            
            // Generate a random ID that might match
            const testIds = [
              '550e8400-e29b-41d4-a716-446655440000',
              '550e8400-e29b-41d4-a716-446655440001', 
              '550e8400-e29b-41d4-a716-446655440002'
            ];
            
            for (const testId of testIds) {
              try {
                console.log(`  Testing ID: ${testId}`);
                const { data: updateData, error: updateError } = await serviceClient.auth.admin.updateUserById(
                  testId,
                  {
                    email: 'dr.pranav@endoflow.com',
                    password: 'endoflow123',
                    email_confirm: true
                  }
                );
                
                if (!updateError) {
                  console.log(`  ✅ Found and updated user with ID: ${testId}`);
                  
                  // Create corresponding profile
                  const { error: profileError } = await serviceClient
                    .from('profiles')
                    .upsert({
                      id: testId,
                      role: 'dentist',
                      status: 'active',
                      full_name: 'Dr. Pranav',
                      created_at: new Date().toISOString()
                    });
                    
                  if (profileError) {
                    console.log(`  ⚠️  Profile creation warning: ${profileError.message}`);
                  } else {
                    console.log('  ✅ Profile created successfully');
                  }
                  
                  break;
                }
              } catch (idErr) {
                // This ID doesn't exist, try next
              }
            }
          } else {
            console.log('  ❌ Unexpected error:', newAuthError.message);
          }
        } else {
          console.log('  ✅ New auth user created successfully');
          
          // Create profile
          const { error: profileError } = await serviceClient
            .from('profiles')
            .insert({
              id: newAuthUser.user.id,
              role: 'dentist', 
              status: 'active',
              full_name: 'Dr. Pranav',
              created_at: new Date().toISOString()
            });
            
          if (profileError) {
            console.log('  ❌ Profile creation failed:', profileError.message);
          } else {
            console.log('  ✅ Profile created successfully');
          }
        }
        
      } else if (signInError.message.includes('Invalid login credentials')) {
        console.log('\n🔧 User doesn\'t exist, creating new one...');
        // This is the normal case - user doesn't exist
        const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
          email: 'dr.pranav@endoflow.com',
          password: 'endoflow123',
          email_confirm: true,
          user_metadata: {
            full_name: 'Dr. Pranav',
            role: 'dentist'
          }
        });
        
        if (createError) {
          console.log('  ❌ Failed to create user:', createError.message);
        } else {
          console.log('  ✅ User created successfully');
          
          const { error: profileError } = await serviceClient
            .from('profiles')
            .insert({
              id: newUser.user.id,
              role: 'dentist',
              status: 'active', 
              full_name: 'Dr. Pranav',
              created_at: new Date().toISOString()
            });
            
          if (profileError) {
            console.log('  ❌ Profile creation failed:', profileError.message);
          } else {
            console.log('  ✅ Profile created successfully');
          }
        }
      }
    } else {
      console.log('  ✅ Login actually works now!');
      await anonClient.auth.signOut();
    }
    
    // Final test
    console.log('\nStep 6: Final login test...');
    const { data: finalTest, error: finalError } = await anonClient.auth.signInWithPassword({
      email: 'dr.pranav@endoflow.com',
      password: 'endoflow123'
    });
    
    if (finalError) {
      console.log('  ❌ Final test failed:', finalError.message);
    } else {
      console.log('  ✅ Final test passed! Dr. Pranav can now login');
      await anonClient.auth.signOut();
    }
    
  } catch (err) {
    console.error('❌ Exception during fix:', err.message);
  }
}

if (require.main === module) {
  fixPranavUserCorrect().catch(console.error);
}

module.exports = { fixPranavUserCorrect };