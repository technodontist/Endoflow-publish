const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugFollowUpForm() {
  console.log('🔍 Debugging Follow-up Form Issue...');

  try {
    // 1. Get some follow-up appointments to test with
    console.log('\n📅 1. Getting sample follow-up appointments...');
    const { data: followUps, error: followUpError } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        id,
        patient_id,
        appointment_type,
        status,
        scheduled_date,
        treatment_id,
        consultation_id,
        patients!patient_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('appointment_type', 'follow_up')
      .limit(3);

    if (followUpError) {
      console.error('❌ Error fetching follow-ups:', followUpError);
      return;
    }

    console.log(`✅ Found ${followUps?.length || 0} follow-up appointments`);

    if (followUps && followUps.length > 0) {
      console.log('\nTesting appointment queries:');

      for (const appt of followUps) {
        console.log(`\n🔬 Testing appointment ${appt.id.slice(0,8)}...`);
        console.log(`   Patient: ${appt.patients?.first_name} ${appt.patients?.last_name}`);
        console.log(`   Status: ${appt.status}`);

        // Test the exact query the form uses
        const { data: testAppt, error: testError } = await supabase
          .schema('api')
          .from('appointments')
          .select(`
            *,
            patients!patient_id (
              id,
              first_name,
              last_name,
              date_of_birth,
              phone
            )
          `)
          .eq('id', appt.id)
          .single();

        if (testError) {
          console.log(`   ❌ Query failed: ${testError.message}`);
          console.log(`      Code: ${testError.code}`);

          // Try fallback query
          const { data: fallback, error: fallbackError } = await supabase
            .schema('api')
            .from('appointments')
            .select('*')
            .eq('id', appt.id)
            .single();

          if (fallbackError) {
            console.log(`   ❌ Fallback also failed: ${fallbackError.message}`);
          } else {
            console.log(`   ✅ Fallback succeeded`);
          }
        } else {
          console.log(`   ✅ Query succeeded`);
          console.log(`      Patient data: ${testAppt.patients ? 'Present' : 'Missing'}`);
        }

        // Check appointment_teeth linkage
        const { data: teeth, error: teethError } = await supabase
          .schema('api')
          .from('appointment_teeth')
          .select('tooth_number, tooth_diagnosis_id')
          .eq('appointment_id', appt.id);

        if (teethError) {
          console.log(`   ⚠️  Teeth query failed: ${teethError.message}`);
        } else {
          console.log(`   🦷 Found ${teeth?.length || 0} linked teeth`);
        }
      }

      // 2. Test a specific appointment ID format
      console.log('\n🆔 2. Testing appointment ID formats...');
      const sampleId = followUps[0].id;
      console.log(`Sample ID: ${sampleId}`);
      console.log(`ID length: ${sampleId.length}`);
      console.log(`ID format: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sampleId) ? 'Valid UUID' : 'Invalid UUID'}`);

    } else {
      console.log('ℹ️  No follow-up appointments found to debug');
    }

    // 3. Check if there are any permission issues
    console.log('\n🔐 3. Testing permissions...');
    const { data: permTest, error: permError } = await supabase
      .schema('api')
      .from('appointments')
      .select('count(*)')
      .eq('appointment_type', 'follow_up');

    if (permError) {
      console.log(`❌ Permission issue: ${permError.message}`);
    } else {
      console.log(`✅ Permissions OK - can access appointments table`);
    }

  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

debugFollowUpForm().catch(console.error);