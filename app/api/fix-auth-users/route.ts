import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createServiceClient();

    console.log('🔧 Fixing authentication issues for dentists...');

    const results = {
      existing_users: [] as any[],
      deleted_users: [] as string[],
      created_users: [] as any[],
      profiles_created: [] as string[],
      errors: [] as string[]
    };

    // First, list all existing users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      results.errors.push(`Failed to list users: ${authError.message}`);
      console.error('❌ Error listing users:', authError);
    } else {
      console.log('✅ Found existing auth users:', authUsers?.users?.length || 0);
      results.existing_users = authUsers?.users?.map(u => ({
        id: u.id,
        email: u.email,
        providers: u.app_metadata?.providers || [],
        metadata_valid: !!u.user_metadata && Object.keys(u.user_metadata).length > 0
      })) || [];
    }

    // Find problematic users (Dr. Nisarg and Dr. Pranav)
    const problematicEmails = ['dr.nisarg@endoflow.com', 'dr.pranav@endoflow.com'];

    for (const email of problematicEmails) {
      const existingUser = authUsers?.users?.find(u => u.email === email);

      if (existingUser) {
        const hasEmptyProviders = !existingUser.app_metadata?.providers || existingUser.app_metadata.providers.length === 0;
        const hasNullMetadata = !existingUser.user_metadata || Object.keys(existingUser.user_metadata).length === 0;

        if (hasEmptyProviders || hasNullMetadata) {
          console.log(`🔧 Found problematic user ${email}, attempting to delete and recreate...`);

          // Try to delete the problematic user
          const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);

          if (deleteError) {
            results.errors.push(`Failed to delete ${email}: ${deleteError.message}`);
            console.error(`❌ Failed to delete ${email}:`, deleteError);
            continue;
          } else {
            results.deleted_users.push(email);
            console.log(`✅ Deleted problematic user: ${email}`);
          }
        } else {
          console.log(`ℹ️ User ${email} appears to be working correctly`);
          continue;
        }
      }

      // Create/recreate the user with proper metadata
      const fullName = email.includes('nisarg') ? 'Dr. Nisarg' : 'Dr. Pranav Shah';

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: 'endoflow123',
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: 'dentist'
        }
      });

      if (createError) {
        results.errors.push(`Failed to create ${email}: ${createError.message}`);
        console.error(`❌ Failed to create ${email}:`, createError);
        continue;
      }

      if (!newUser?.user) {
        results.errors.push(`${email}: No user data returned`);
        continue;
      }

      results.created_users.push({
        email: email,
        id: newUser.user.id,
        full_name: fullName
      });
      console.log(`✅ Created auth user for ${email}:`, newUser.user.id);

      // Create profile entry
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          role: 'dentist',
          status: 'active',
          full_name: fullName
        });

      if (profileError && profileError.code !== '23505') {
        results.errors.push(`Failed to create profile for ${email}: ${profileError.message}`);
        console.error(`❌ Failed to create profile for ${email}:`, profileError);
      } else {
        results.profiles_created.push(fullName);
        console.log(`✅ Created profile for ${fullName}`);
      }

      // Create/update dentist record
      const { error: dentistError } = await supabase
        .schema('api')
        .from('dentists')
        .upsert({
          id: newUser.user.id,
          full_name: fullName,
          specialty: email.includes('nisarg') ? 'General Dentistry' : 'Endodontics'
        });

      if (dentistError) {
        results.errors.push(`Failed to create dentist record for ${email}: ${dentistError.message}`);
        console.error(`❌ Failed to create dentist record for ${email}:`, dentistError);
      } else {
        console.log(`✅ Created/updated dentist record for ${fullName}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication fix completed',
      results,
      credentials: {
        nisarg: 'dr.nisarg@endoflow.com / endoflow123',
        pranav: 'dr.pranav@endoflow.com / endoflow123'
      },
      next_steps: [
        'Test login with both dentist accounts',
        'Verify patient search functionality works',
        'Check appointment scheduler functionality',
        'Run complete workflow test'
      ]
    });

  } catch (error) {
    console.error('❌ Error fixing auth users:', error);
    return NextResponse.json({
      success: false,
      error: 'Authentication fix failed',
      details: error
    }, { status: 500 });
  }
}