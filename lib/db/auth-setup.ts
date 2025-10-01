import { createServiceClient } from '@/lib/supabase/server';

async function setupDentistAuth() {
  const supabase = await createServiceClient();

  console.log('🔧 Setting up authentication for Dr. Nisarg and Dr. Pranav...');

  try {
    // First, let's check what exists in the dentists table
    const { data: dentists, error: dentistsError } = await supabase
      .schema('api')
      .from('dentists')
      .select('*');

    if (dentistsError) {
      console.error('❌ Error fetching dentists:', dentistsError);
      return;
    }

    console.log('✅ Found dentists in database:', dentists?.length || 0);
    dentists?.forEach(dentist => {
      console.log(`  - ${dentist.full_name} (${dentist.id}) - ${dentist.specialty}`);
    });

    // Check if Dr. Nisarg already has auth records
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log('✅ Found auth users:', authUsers?.users?.length || 0);

    const existingNisarg = authUsers?.users?.find(user => user.email === 'dr.nisarg@endoflow.com');
    const existingPranav = authUsers?.users?.find(user => user.email === 'dr.pranav@endoflow.com');

    // Create Dr. Nisarg auth user if missing
    if (!existingNisarg && dentists?.find(d => d.full_name === 'Dr. Nisarg')) {
      console.log('🔧 Creating auth user for Dr. Nisarg...');

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
        console.error('❌ Error creating Dr. Nisarg auth user:', createError);
        return;
      }

      console.log('✅ Created Dr. Nisarg auth user:', newUser?.user?.id);

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
        console.error('❌ Error creating Dr. Nisarg profile:', profileError);
      } else {
        console.log('✅ Created Dr. Nisarg profile');
      }

      // Update the dentists table with the correct auth user ID
      const nisargDentist = dentists?.find(d => d.full_name === 'Dr. Nisarg');
      if (nisargDentist && newUser?.user?.id) {
        const { error: updateError } = await supabase
          .schema('api')
          .from('dentists')
          .update({ id: newUser.user.id })
          .eq('id', nisargDentist.id);

        if (updateError) {
          console.error('❌ Error updating Dr. Nisarg dentist record:', updateError);
        } else {
          console.log('✅ Updated Dr. Nisarg dentist record with auth ID');
        }
      }
    } else if (existingNisarg) {
      console.log('✅ Dr. Nisarg auth user already exists:', existingNisarg.id);

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingNisarg.id)
        .single();

      if (!existingProfile) {
        console.log('🔧 Creating missing profile for Dr. Nisarg...');
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
          console.error('❌ Error creating Dr. Nisarg profile:', profileError);
        } else {
          console.log('✅ Created Dr. Nisarg profile');
        }
      }
    }

    // Create Dr. Pranav auth user if missing
    if (!existingPranav && dentists?.find(d => d.full_name === 'Dr. Pranav Shah')) {
      console.log('🔧 Creating auth user for Dr. Pranav...');

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
        console.error('❌ Error creating Dr. Pranav auth user:', createError);
        return;
      }

      console.log('✅ Created Dr. Pranav auth user:', newUser?.user?.id);

      // Create profile entry
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser?.user?.id,
          role: 'dentist',
          status: 'active',
          full_name: 'Dr. Pranav Shah',
          created_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('❌ Error creating Dr. Pranav profile:', profileError);
      } else {
        console.log('✅ Created Dr. Pranav profile');
      }

      // Update the dentists table with the correct auth user ID
      const pranavDentist = dentists?.find(d => d.full_name === 'Dr. Pranav Shah');
      if (pranavDentist && newUser?.user?.id) {
        const { error: updateError } = await supabase
          .schema('api')
          .from('dentists')
          .update({ id: newUser.user.id })
          .eq('id', pranavDentist.id);

        if (updateError) {
          console.error('❌ Error updating Dr. Pranav dentist record:', updateError);
        } else {
          console.log('✅ Updated Dr. Pranav dentist record with auth ID');
        }
      }
    } else if (existingPranav) {
      console.log('✅ Dr. Pranav auth user already exists:', existingPranav.id);

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingPranav.id)
        .single();

      if (!existingProfile) {
        console.log('🔧 Creating missing profile for Dr. Pranav...');
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: existingPranav.id,
            role: 'dentist',
            status: 'active',
            full_name: 'Dr. Pranav Shah',
            created_at: new Date().toISOString()
          });

        if (profileError) {
          console.error('❌ Error creating Dr. Pranav profile:', profileError);
        } else {
          console.log('✅ Created Dr. Pranav profile');
        }
      }
    }

    console.log('🎉 Authentication setup completed!');
    console.log('📧 Login credentials:');
    console.log('   - Dr. Nisarg: dr.nisarg@endoflow.com / endoflow123');
    console.log('   - Dr. Pranav: dr.pranav@endoflow.com / endoflow123');

  } catch (error) {
    console.error('❌ Error in authentication setup:', error);
  }
}

// Run the setup
setupDentistAuth().then(() => {
  console.log('✅ Setup completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});