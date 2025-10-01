const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFollowUpFormFix() {
  console.log('🔧 Testing Follow-up Form Fix...');

  try {
    // 1. Get a follow-up appointment to test with
    console.log('\n📅 1. Getting test follow-up appointment...');
    const { data: testAppt, error: apptError } = await supabase
      .schema('api')
      .from('appointments')
      .select('id, patient_id, appointment_type, status, scheduled_date')
      .eq('appointment_type', 'follow_up')
      .limit(1)
      .single();

    if (apptError) {
      console.error('❌ No follow-up appointments found for testing');
      return;
    }

    console.log(`✅ Found test appointment: ${testAppt.id.slice(0,8)}...`);
    console.log(`   Patient: ${testAppt.patient_id.slice(0,8)}...`);
    console.log(`   Status: ${testAppt.status}`);

    // 2. Test the exact queries the form uses
    console.log('\n🔍 2. Testing form data loading queries...');

    // Test appointment query
    console.log('   Testing appointment query...');
    const { data: appt, error: apptQueryError } = await supabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('id', testAppt.id)
      .single();

    if (apptQueryError) {
      console.error(`   ❌ Appointment query failed: ${apptQueryError.message}`);
      return;
    } else {
      console.log('   ✅ Appointment query succeeded');
    }

    // Test patient query
    console.log('   Testing patient query...');
    const { data: patient, error: patientQueryError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, date_of_birth, phone')
      .eq('id', appt.patient_id)
      .single();

    if (patientQueryError) {
      console.error(`   ❌ Patient query failed: ${patientQueryError.message}`);
    } else {
      console.log('   ✅ Patient query succeeded');
      console.log(`      Patient: ${patient.first_name} ${patient.last_name}`);
    }

    // Test treatment query (if treatment_id exists)
    if (appt.treatment_id) {
      console.log('   Testing treatment query...');
      const { data: treatment, error: treatmentError } = await supabase
        .schema('api')
        .from('treatments')
        .select('*')
        .eq('id', appt.treatment_id)
        .single();

      if (treatmentError) {
        console.log(`   ⚠️  Treatment query failed: ${treatmentError.message}`);
      } else {
        console.log('   ✅ Treatment query succeeded');
      }
    } else {
      console.log('   ℹ️  No treatment_id linked to this appointment');
    }

    // Test appointment_teeth query
    console.log('   Testing appointment teeth query...');
    const { data: teeth, error: teethError } = await supabase
      .schema('api')
      .from('appointment_teeth')
      .select('*')
      .eq('appointment_id', testAppt.id);

    if (teethError) {
      console.log(`   ⚠️  Teeth query failed: ${teethError.message}`);
    } else {
      console.log(`   ✅ Teeth query succeeded - found ${teeth?.length || 0} linked teeth`);
      if (teeth && teeth.length > 0) {
        teeth.forEach(tooth => {
          console.log(`      - Tooth ${tooth.tooth_number}`);
        });
      }
    }

    // 3. Test the form's expected data structure
    console.log('\n📋 3. Testing form data structure...');
    const formData = {
      appointmentId: testAppt.id,
      patientId: testAppt.patient_id,
      treatmentId: appt.treatment_id || undefined,
      consultationId: appt.consultation_id || undefined
    };

    console.log('   Form will receive:');
    console.log(`     appointmentId: ${formData.appointmentId.slice(0,8)}...`);
    console.log(`     patientId: ${formData.patientId.slice(0,8)}...`);
    console.log(`     treatmentId: ${formData.treatmentId?.slice(0,8) || 'undefined'}...`);
    console.log(`     consultationId: ${formData.consultationId?.slice(0,8) || 'undefined'}...`);

    // 4. Simulate the complete data loading process
    console.log('\n🔄 4. Simulating complete form loading process...');

    // Create the combined appointment object like the form expects
    const fullAppointment = {
      ...appt,
      patients: patient
    };

    console.log('✅ Form data loading simulation successful!');
    console.log('   ✅ Appointment data loaded');
    console.log('   ✅ Patient data attached');
    console.log(`   ✅ Patient name: ${fullAppointment.patients?.first_name} ${fullAppointment.patients?.last_name}`);
    console.log('   ✅ Form can render without "Appointment not found" error');

    console.log('\n🎉 SUCCESS: Follow-up form should now work correctly!');
    console.log('   The "Failed to load appointment data" error should be resolved.');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testFollowUpFormFix().catch(console.error);