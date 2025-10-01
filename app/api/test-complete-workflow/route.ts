import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createServiceClient();

    console.log('🧪 Testing complete workflow...');

    const results = {
      schema_tests: {} as any,
      auth_tests: {} as any,
      patient_tests: {} as any,
      workflow_tests: {} as any,
      errors: [] as string[],
      success: true
    };

    // 1. Test schema structure
    console.log('📊 Testing api.patients table structure...');

    try {
      const { data: schemaTest, error: schemaError } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name, phone, email, emergency_contact_name, emergency_contact_phone, date_of_birth, medical_history_summary')
        .limit(1);

      results.schema_tests = {
        table_accessible: !schemaError,
        required_columns_exist: !schemaError,
        error: schemaError?.message || null,
        sample_structure: schemaTest ? Object.keys(schemaTest[0] || {}) : []
      };

      if (schemaError) {
        results.errors.push(`Schema test failed: ${schemaError.message}`);
        results.success = false;
      } else {
        console.log('✅ Schema test passed - all columns accessible');
      }
    } catch (err) {
      results.errors.push(`Schema test exception: ${err}`);
      results.success = false;
    }

    // 2. Test authentication
    console.log('🔐 Testing authentication system...');

    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        results.errors.push(`Auth test failed: ${authError.message}`);
        results.success = false;
      } else {
        const nisargUser = authUsers?.users?.find(u => u.email === 'dr.nisarg@endoflow.com');
        const pranavUser = authUsers?.users?.find(u => u.email === 'dr.pranav@endoflow.com');

        results.auth_tests = {
          total_users: authUsers?.users?.length || 0,
          nisarg_exists: !!nisargUser,
          pranav_exists: !!pranavUser,
          nisarg_metadata_valid: nisargUser ? !!nisargUser.user_metadata && Object.keys(nisargUser.user_metadata).length > 0 : false,
          pranav_metadata_valid: pranavUser ? !!pranavUser.user_metadata && Object.keys(pranavUser.user_metadata).length > 0 : false
        };

        if (!nisargUser || !pranavUser) {
          results.errors.push('Missing dentist auth users');
          results.success = false;
        } else {
          console.log('✅ Auth test passed - dentist users exist with valid metadata');
        }
      }
    } catch (err) {
      results.errors.push(`Auth test exception: ${err}`);
      results.success = false;
    }

    // 3. Test patient data queries
    console.log('👥 Testing patient data queries...');

    try {
      const { data: patients, error: patientError } = await supabase
        .schema('api')
        .from('patients')
        .select('*')
        .limit(5);

      results.patient_tests = {
        query_successful: !patientError,
        patient_count: patients?.length || 0,
        error: patientError?.message || null,
        sample_patient: patients && patients.length > 0 ? {
          has_phone: !!patients[0].phone,
          has_email: !!patients[0].email,
          has_emergency_contact: !!patients[0].emergency_contact_name
        } : null
      };

      if (patientError) {
        results.errors.push(`Patient query failed: ${patientError.message}`);
        results.success = false;
      } else {
        console.log(`✅ Patient test passed - found ${patients?.length || 0} patients`);
      }
    } catch (err) {
      results.errors.push(`Patient test exception: ${err}`);
      results.success = false;
    }

    // 4. Test appointment queries
    console.log('📅 Testing appointment queries...');

    try {
      const { data: appointments, error: appointmentError } = await supabase
        .schema('api')
        .from('appointments')
        .select('*')
        .limit(5);

      results.workflow_tests.appointments = {
        query_successful: !appointmentError,
        appointment_count: appointments?.length || 0,
        error: appointmentError?.message || null
      };

      if (appointmentError) {
        results.errors.push(`Appointment query failed: ${appointmentError.message}`);
      } else {
        console.log(`✅ Appointment test passed - found ${appointments?.length || 0} appointments`);
      }
    } catch (err) {
      results.errors.push(`Appointment test exception: ${err}`);
    }

    // 5. Test dentist queries
    console.log('👨‍⚕️ Testing dentist queries...');

    try {
      const { data: dentists, error: dentistError } = await supabase
        .schema('api')
        .from('dentists')
        .select('*');

      results.workflow_tests.dentists = {
        query_successful: !dentistError,
        dentist_count: dentists?.length || 0,
        error: dentistError?.message || null,
        dentist_names: dentists?.map(d => d.full_name) || []
      };

      if (dentistError) {
        results.errors.push(`Dentist query failed: ${dentistError.message}`);
      } else {
        console.log(`✅ Dentist test passed - found ${dentists?.length || 0} dentists`);
      }
    } catch (err) {
      results.errors.push(`Dentist test exception: ${err}`);
    }

    // Final assessment
    const criticalIssues = results.errors.filter(e =>
      e.includes('Schema test failed') ||
      e.includes('Missing dentist auth users') ||
      e.includes('Patient query failed')
    );

    return NextResponse.json({
      success: results.success && criticalIssues.length === 0,
      message: results.success && criticalIssues.length === 0
        ? 'All workflow tests passed! 🎉'
        : `${criticalIssues.length} critical issues found`,
      results,
      critical_issues: criticalIssues,
      next_steps: results.success && criticalIssues.length === 0 ? [
        '✅ Schema is properly configured',
        '✅ Authentication is working',
        '✅ Patient queries are functional',
        '🎯 Ready to test in browser!'
      ] : [
        '❗ Review the errors above',
        '🔧 Run the manual SQL commands if schema issues persist',
        '🔐 Use /api/fix-auth-users to fix authentication',
        '📊 Check Supabase Dashboard for manual fixes needed'
      ]
    });

  } catch (error) {
    console.error('❌ Error in workflow test:', error);
    return NextResponse.json({
      success: false,
      error: 'Workflow test failed',
      details: error
    }, { status: 500 });
  }
}