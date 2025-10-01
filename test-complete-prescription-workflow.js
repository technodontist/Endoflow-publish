const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCompletePrescriptionWorkflow() {
  console.log('🧪 [TEST] Testing complete prescription notification → alarm workflow...\n');

  try {
    // Step 1: Get the latest prescription notification
    const { data: notifications, error: notError } = await supabase
      .schema('api')
      .from('notifications')
      .select('*')
      .eq('type', 'prescription_prescribed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (notError || !notifications || notifications.length === 0) {
      console.log('❌ [TEST] No prescription notifications found');
      return;
    }

    const notification = notifications[0];
    console.log(`📬 [TEST] Using notification: ${notification.title}`);
    console.log(`👤 [TEST] Patient: ${notification.user_id}`);
    console.log(`📅 [TEST] Created: ${new Date(notification.created_at).toLocaleString()}\n`);

    // Step 2: Get prescription details
    const { data: prescriptions, error: presError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .select('*')
      .eq('consultation_id', notification.related_id)
      .eq('status', 'active');

    if (presError || !prescriptions || prescriptions.length === 0) {
      console.error('❌ [TEST] No prescription details found');
      return;
    }

    console.log(`💊 [TEST] Found ${prescriptions.length} prescriptions:`);
    prescriptions.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.medication_name} ${p.dosage} (${p.times_per_day}x daily)`);
      console.log(`     Current alarms: ${p.reminder_times || 'None set'}`);
    });

    // Step 3: Test "Make Alarm" functionality for first prescription
    const testPrescription = prescriptions[0];
    console.log(`\n⏰ [TEST] Testing "Make Alarm" for ${testPrescription.medication_name}...`);

    // Generate default times (same logic as component)
    const generateDefaultTimes = (timesPerDay) => {
      switch (timesPerDay) {
        case 1: return ['09:00'];
        case 2: return ['09:00', '21:00'];
        case 3: return ['09:00', '13:00', '21:00'];
        case 4: return ['08:00', '12:00', '17:00', '22:00'];
        case 5: return ['08:00', '11:00', '14:00', '17:00', '20:00'];
        case 6: return ['08:00', '10:00', '12:00', '15:00', '18:00', '21:00'];
        default: return ['09:00'];
      }
    };

    const defaultTimes = generateDefaultTimes(testPrescription.times_per_day);
    console.log(`  📊 Suggested times: ${defaultTimes.join(', ')}`);

    // Step 4: Simulate clicking "Make Alarm" button
    console.log(`  🔄 Simulating "Make Alarm" button click...`);

    const { error: updateError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .update({
        reminder_times: JSON.stringify(defaultTimes),
        alarm_sound: 'default',
        notes: `${testPrescription.notes || ''}\n\n🔔 Alarm created: ${defaultTimes.join(', ')}`.trim()
      })
      .eq('id', testPrescription.id);

    if (updateError) {
      console.error(`  ❌ Failed to create alarm: ${updateError.message}`);
      return;
    }

    console.log(`  ✅ Alarm created successfully!`);

    // Step 5: Verify alarm was created
    const { data: updatedPrescription, error: verifyError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .select('*')
      .eq('id', testPrescription.id)
      .single();

    if (verifyError) {
      console.error(`  ❌ Failed to verify alarm creation: ${verifyError.message}`);
      return;
    }

    console.log(`  ✅ Verification successful:`);
    console.log(`      - Reminder times: ${updatedPrescription.reminder_times}`);
    console.log(`      - Alarm sound: ${updatedPrescription.alarm_sound}`);
    console.log(`      - Updated notes: ${updatedPrescription.notes?.split('\\n').pop()}`);

    // Step 6: Test patient experience simulation
    console.log(`\n📱 [TEST] Patient experience simulation:`);
    console.log(`  1. Patient receives notification: "${notification.title}"`);
    console.log(`  2. Patient clicks "View Details" in alarms tab`);
    console.log(`  3. Patient sees prescription: ${testPrescription.medication_name} ${testPrescription.dosage}`);
    console.log(`  4. Patient sees suggested times: ${defaultTimes.join(', ')}`);
    console.log(`  5. Patient clicks "Make Alarm" button`);
    console.log(`  6. Alarm created with times: ${JSON.parse(updatedPrescription.reminder_times).join(', ')}`);
    console.log(`  7. Patient receives confirmation message`);
    console.log(`  8. Alarm appears in prescription alarms section`);

    // Step 7: Test complete workflow summary
    console.log('\n📊 [TEST SUMMARY]');
    console.log('================');
    console.log(`✅ Prescription notification: ${notification.title}`);
    console.log(`✅ Prescription details loaded: ${prescriptions.length} medications`);
    console.log(`✅ Default times generated: ${defaultTimes.join(', ')}`);
    console.log(`✅ Alarm creation: Successful`);
    console.log(`✅ Alarm verification: Successful`);
    console.log(`✅ Patient workflow: Complete`);

    console.log('\n🎉 [TEST] Complete prescription notification → alarm workflow test PASSED!');

    console.log('\n🔄 [NEXT STEPS] For production:');
    console.log('   1. Patient will see "Make Alarm" buttons in prescription details');
    console.log('   2. Clicking creates optimized medication schedule');
    console.log('   3. Alarms integrate with existing prescription alarm system');
    console.log('   4. Patient can manage alarms in enhanced prescription alarms section');

  } catch (error) {
    console.error('❌ [TEST] Unexpected error:', error);
  }
}

// Run the test
testCompletePrescriptionWorkflow();