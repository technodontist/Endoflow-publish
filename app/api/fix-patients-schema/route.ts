import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createServiceClient();

    console.log('🔧 Checking current api.patients table structure...');

    // First, let's check what columns currently exist
    const { data: currentPatients, error: currentError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .limit(1);

    console.log('📊 Current patients table query result:', { currentPatients, currentError });

    // Try to test if the missing columns exist by attempting to insert
    const testPatient = {
      id: '00000000-0000-0000-0000-000000000000', // Test UUID that won't conflict
      first_name: 'TEST',
      last_name: 'SCHEMA',
      phone: '+1234567890',
      email: 'test@example.com',
      emergency_contact_name: 'Test Contact',
      emergency_contact_phone: '+1234567890'
    };

    // Test insert (will rollback)
    const { data: insertTest, error: insertError } = await supabase
      .schema('api')
      .from('patients')
      .insert(testPatient)
      .rollback();

    const results = {
      current_structure_check: {
        success: !currentError,
        error: currentError?.message || null,
        columns_found: currentPatients ? Object.keys(currentPatients[0] || {}) : []
      },
      insert_test: {
        success: !insertError,
        error: insertError?.message || null,
        missing_columns: insertError ? ['phone', 'email', 'emergency_contact_name', 'emergency_contact_phone'] : []
      },
      analysis: {} as Record<string, boolean>,
      manual_sql_needed: false
    };

    // Analyze the error to determine what columns are missing
    if (insertError) {
      const errorMsg = insertError.message.toLowerCase();
      results.manual_sql_needed = true;

      if (errorMsg.includes('phone')) {
        results.analysis.phone_missing = true;
      }
      if (errorMsg.includes('email')) {
        results.analysis.email_missing = true;
      }
      if (errorMsg.includes('emergency_contact')) {
        results.analysis.emergency_contact_missing = true;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Schema analysis completed',
      results,
      manual_steps_required: results.manual_sql_needed ? [
        '1. Go to Supabase Dashboard > SQL Editor',
        '2. Run the following SQL:',
        'ALTER TABLE api.patients ADD COLUMN IF NOT EXISTS phone TEXT;',
        'ALTER TABLE api.patients ADD COLUMN IF NOT EXISTS email TEXT;',
        'ALTER TABLE api.patients ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;',
        'ALTER TABLE api.patients ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;',
        '3. Come back and run the patient registration update'
      ] : ['Schema appears to be correct - no manual steps needed'],
      next_endpoint: '/api/fix-auth-users'
    });

  } catch (error) {
    console.error('❌ Error analyzing patients schema:', error);
    return NextResponse.json({
      success: false,
      error: 'Schema analysis failed',
      details: error
    }, { status: 500 });
  }
}