import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createServiceClient();

    console.log('🔧 Creating dentist profiles for existing auth users...');

    // Let's create a test profile for Dr. Nisarg if it doesn't exist
    // We'll use the existing dentist ID as the profile ID
    const { data: dentists, error: dentistsError } = await supabase
      .schema('api')
      .from('dentists')
      .select('*');

    if (dentistsError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch dentists',
        details: dentistsError
      });
    }

    const results = {
      dentists: dentists || [],
      profiles_created: [] as string[],
      existing_profiles: [] as string[],
      errors: [] as string[]
    };

    // For each dentist, ensure they have a profile
    for (const dentist of dentists || []) {
      // Check if profile already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', dentist.id)
        .single();

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        results.errors.push(`Error checking profile for ${dentist.full_name}: ${profileCheckError.message}`);
        continue;
      }

      if (existingProfile) {
        results.existing_profiles.push(`${dentist.full_name} (${existingProfile.status})`);
        console.log(`✅ Profile already exists for ${dentist.full_name}`);
      } else {
        // Create profile
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: dentist.id,
            role: 'dentist',
            status: 'active',
            full_name: dentist.full_name,
            created_at: new Date().toISOString()
          });

        if (createError) {
          results.errors.push(`Failed to create profile for ${dentist.full_name}: ${createError.message}`);
        } else {
          results.profiles_created.push(dentist.full_name);
          console.log(`✅ Created profile for ${dentist.full_name}`);
        }
      }
    }

    // Also test if we can query patients to verify our schema fixes
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, created_at')
      .limit(5);

    return NextResponse.json({
      success: true,
      message: 'Profile setup completed',
      results,
      test_data: {
        patients: patients || [],
        patients_error: patientsError?.message || null,
        schema_test_passed: !patientsError
      }
    });

  } catch (error) {
    console.error('❌ Error in profile setup:', error);
    return NextResponse.json({
      success: false,
      error: 'Profile setup failed',
      details: error
    }, { status: 500 });
  }
}