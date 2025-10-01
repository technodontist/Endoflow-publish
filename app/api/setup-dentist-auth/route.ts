import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createServiceClient();

    console.log('🔧 Setting up authentication for Dr. Nisarg and Dr. Pranav...');

    // First, let's check what exists in the dentists table
    const { data: dentists, error: dentistsError } = await supabase
      .schema('api')
      .from('dentists')
      .select('*');

    if (dentistsError) {
      console.error('❌ Error fetching dentists:', dentistsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch dentists',
        details: dentistsError
      });
    }

    console.log('✅ Found dentists in database:', dentists?.length || 0);
    const results = {
      dentists: dentists || [],
      created: [] as string[],
      updated: [] as string[],
      errors: [] as string[]
    };

    // Check existing auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      results.errors.push(`Failed to fetch auth users: ${authError.message}`);
    }

    console.log('✅ Found auth users:', authUsers?.users?.length || 0);

    const existingNisarg = authUsers?.users?.find(user => user.email === 'dr.nisarg@endoflow.com');
    const existingPranav = authUsers?.users?.find(user => user.email === 'dr.pranav@endoflow.com');

    // Handle Dr. Nisarg
    const nisargDentist = dentists?.find(d => d.full_name?.includes('Nisarg') || d.full_name?.includes('Dr. Nisarg'));

    if (nisargDentist && !existingNisarg) {
      try {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: 'dr.nisarg@endoflow.com',
          password: 'endoflow123',
          email_confirm: true,
          user_metadata: {
            full_name: 'Dr. Nisarg',
            role: 'dentist'
          }
        });

        if (createError) {
          results.errors.push(`Failed to create Dr. Nisarg auth user: ${createError.message}`);
        } else {
          console.log('✅ Created Dr. Nisarg auth user:', newUser?.user?.id);
          results.created.push(`Dr. Nisarg auth user: ${newUser?.user?.id}`);

          // Create profile entry
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: newUser?.user?.id,
              role: 'dentist',
              status: 'active',
              full_name: 'Dr. Nisarg',
              created_at: new Date().toISOString()
            });

          if (profileError) {
            results.errors.push(`Failed to create Dr. Nisarg profile: ${profileError.message}`);
          } else {
            console.log('✅ Created Dr. Nisarg profile');
            results.created.push('Dr. Nisarg profile');

            // Update dentist record with auth ID
            const { error: updateError } = await supabase
              .schema('api')
              .from('dentists')
              .update({ id: newUser.user.id })
              .eq('id', nisargDentist.id);

            if (updateError) {
              results.errors.push(`Failed to update Dr. Nisarg dentist record: ${updateError.message}`);
            } else {
              results.updated.push('Dr. Nisarg dentist record with auth ID');
            }
          }
        }
      } catch (error) {
        results.errors.push(`Exception creating Dr. Nisarg: ${error}`);
      }
    } else if (existingNisarg) {
      console.log('✅ Dr. Nisarg auth user already exists');

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingNisarg.id)
        .single();

      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: existingNisarg.id,
            role: 'dentist',
            status: 'active',
            full_name: 'Dr. Nisarg',
            created_at: new Date().toISOString()
          });

        if (profileError) {
          results.errors.push(`Failed to create Dr. Nisarg profile: ${profileError.message}`);
        } else {
          results.created.push('Dr. Nisarg profile (was missing)');
        }
      }
    }

    // Handle Dr. Pranav (similar logic)
    const pranavDentist = dentists?.find(d => d.full_name?.includes('Pranav') || d.full_name?.includes('Dr. Pranav'));

    if (pranavDentist && !existingPranav) {
      try {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: 'dr.pranav@endoflow.com',
          password: 'endoflow123',
          email_confirm: true,
          user_metadata: {
            full_name: 'Dr. Pranav Shah',
            role: 'dentist'
          }
        });

        if (createError) {
          results.errors.push(`Failed to create Dr. Pranav auth user: ${createError.message}`);
        } else {
          console.log('✅ Created Dr. Pranav auth user:', newUser?.user?.id);
          results.created.push(`Dr. Pranav auth user: ${newUser?.user?.id}`);

          // Create profile and update dentist record (similar to Nisarg)
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: newUser?.user?.id,
              role: 'dentist',
              status: 'active',
              full_name: 'Dr. Pranav Shah',
              created_at: new Date().toISOString()
            });

          if (!profileError) {
            results.created.push('Dr. Pranav profile');

            const { error: updateError } = await supabase
              .schema('api')
              .from('dentists')
              .update({ id: newUser.user.id })
              .eq('id', pranavDentist.id);

            if (!updateError) {
              results.updated.push('Dr. Pranav dentist record with auth ID');
            }
          }
        }
      } catch (error) {
        results.errors.push(`Exception creating Dr. Pranav: ${error}`);
      }
    } else if (existingPranav) {
      console.log('✅ Dr. Pranav auth user already exists');
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication setup completed',
      results,
      credentials: {
        nisarg: 'dr.nisarg@endoflow.com / endoflow123',
        pranav: 'dr.pranav@endoflow.com / endoflow123'
      }
    });

  } catch (error) {
    console.error('❌ Error in authentication setup:', error);
    return NextResponse.json({
      success: false,
      error: 'Authentication setup failed',
      details: error
    }, { status: 500 });
  }
}