import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createServiceClient();

    // Check current auth status and provide manual setup instructions
    const results = {
      profiles: [] as any[],
      dentists: [] as any[],
      auth_users_accessible: false,
      recommendations: [] as string[]
    };

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'dentist');

    if (profilesError) {
      results.recommendations.push(`Profile query failed: ${profilesError.message}`);
    } else {
      results.profiles = profiles || [];
      results.recommendations.push(`Found ${profiles?.length || 0} dentist profiles`);
    }

    // Get all dentists
    const { data: dentists, error: dentistsError } = await supabase
      .schema('api')
      .from('dentists')
      .select('*');

    if (dentistsError) {
      results.recommendations.push(`Dentists query failed: ${dentistsError.message}`);
    } else {
      results.dentists = dentists || [];
      results.recommendations.push(`Found ${dentists?.length || 0} dentist records`);
    }

    // Try to check auth users (might fail)
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        results.recommendations.push(`Auth admin access failed: ${authError.message}`);
        results.recommendations.push('MANUAL ACTION REQUIRED: Create auth users through Supabase Dashboard');
        results.recommendations.push('1. Go to Supabase Dashboard > Authentication > Users');
        results.recommendations.push('2. Click "Add user" > "Create a new user"');
        results.recommendations.push('3. Email: dr.nisarg@endoflow.com, Password: endoflow123');
        results.recommendations.push('4. Email: dr.pranav@endoflow.com, Password: endoflow123');
        results.recommendations.push('5. Make sure "Auto Confirm User" is checked');
      } else {
        results.auth_users_accessible = true;
        results.recommendations.push(`Found ${authUsers?.users?.length || 0} auth users`);

        const nisargAuth = authUsers?.users?.find(u => u.email === 'dr.nisarg@endoflow.com');
        const pranavAuth = authUsers?.users?.find(u => u.email === 'dr.pranav@endoflow.com');

        if (!nisargAuth) {
          results.recommendations.push('❌ Dr. Nisarg auth user missing - create manually');
        } else {
          results.recommendations.push('✅ Dr. Nisarg auth user exists');
        }

        if (!pranavAuth) {
          results.recommendations.push('❌ Dr. Pranav auth user missing - create manually');
        } else {
          results.recommendations.push('✅ Dr. Pranav auth user exists');
        }
      }
    } catch (authCheckError) {
      results.recommendations.push(`Auth check exception: ${authCheckError}`);
    }

    // Status summary
    const profilesOk = results.profiles.length > 0;
    const dentistsOk = results.dentists.length > 0;

    results.recommendations.unshift(
      `STATUS: Profiles=${profilesOk ? '✅' : '❌'} Dentists=${dentistsOk ? '✅' : '❌'} Auth=${results.auth_users_accessible ? '✅' : '❌'}`
    );

    return NextResponse.json({
      success: true,
      message: 'Authentication status check completed',
      results,
      next_steps: [
        'If auth users are missing, create them manually in Supabase Dashboard',
        'Test login after auth users are created',
        'Patient search should already work with current schema fixes',
        'Appointment scheduler should work once login is fixed'
      ]
    });

  } catch (error) {
    console.error('❌ Error checking auth status:', error);
    return NextResponse.json({
      success: false,
      error: 'Auth status check failed',
      details: error
    }, { status: 500 });
  }
}