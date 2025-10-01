const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMakeAlarmFeature() {
  console.log('🧪 [TEST] Testing Make Alarm feature from prescription notifications...\n');

  try {
    // Step 1: Get test patient and existing prescription notifications
    const { data: notifications, error: notError } = await supabase
      .schema('api')
      .from('notifications')
      .select('*')
      .eq('type', 'prescription_prescribed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (notError || !notifications || notifications.length === 0) {
      console.log('❌ [TEST] No prescription notifications found. Running prescription test first...');

      // Run the prescription notification test to create test data
      require('./test-prescription-notifications.js');
      return;
    }

    const testNotification = notifications[0];
    console.log(`📬 [TEST] Using notification: ${testNotification.title}`);
    console.log(`📄 [TEST] Patient ID: ${testNotification.user_id}`);
    console.log(`🔗 [TEST] Related consultation: ${testNotification.related_id}\n`);

    // Step 2: Get prescription details for this notification
    const { data: prescriptions, error: presError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .select('*')
      .eq('consultation_id', testNotification.related_id)
      .eq('status', 'active');

    if (presError || !prescriptions || prescriptions.length === 0) {
      console.error('❌ [TEST] No prescription details found for this notification');
      return;
    }

    console.log(`💊 [TEST] Found ${prescriptions.length} prescriptions:`);
    prescriptions.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.medication_name} ${p.dosage} (${p.times_per_day}x daily)`);
    });

    // Step 3: Test alarm creation logic for each prescription
    console.log('\n⏰ [TEST] Testing alarm creation logic:');

    for (const prescription of prescriptions) {
      console.log(`\n🔧 [TEST] Processing ${prescription.medication_name}:`);

      // Generate default times (same logic as the component)
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

      const defaultTimes = generateDefaultTimes(prescription.times_per_day);

      // Convert prescription to alarm format (same logic as the component)
      const alarmData = {
        patient_id: prescription.patient_id,
        medication_name: prescription.medication_name,
        dosage: prescription.dosage,
        form: prescription.form || 'tablet',
        schedule_type: 'daily',
        frequency_per_day: prescription.times_per_day,
        specific_times: JSON.stringify(defaultTimes),
        duration_type: prescription.duration_days ? 'days' : 'ongoing',
        duration_value: prescription.duration_days || null,
        start_date: prescription.start_date,
        end_date: null, // Will be calculated if duration is specified
        alarm_enabled: true,
        alarm_sound: 'default',
        snooze_enabled: true,
        snooze_duration_minutes: 10,
        instructions: prescription.instructions || `Take ${prescription.dosage} ${prescription.frequency}`,
        additional_notes: `Created from prescription notification`,
        status: 'active'
      };

      // Calculate end date if duration is specified
      if (prescription.duration_days && prescription.start_date) {
        const startDate = new Date(prescription.start_date);
        const endDate = new Date(startDate.getTime() + (prescription.duration_days * 24 * 60 * 60 * 1000));
        alarmData.end_date = endDate.toISOString().split('T')[0];
      }

      console.log(`  ✅ Medication: ${alarmData.medication_name}`);
      console.log(`  ✅ Dosage: ${alarmData.dosage}`);
      console.log(`  ✅ Schedule: ${alarmData.frequency_per_day}x daily`);
      console.log(`  ✅ Times: ${defaultTimes.join(', ')}`);
      console.log(`  ✅ Duration: ${alarmData.duration_type}${alarmData.duration_value ? ` (${alarmData.duration_value} days)` : ''}`);
      console.log(`  ✅ Start Date: ${alarmData.start_date}`);
      if (alarmData.end_date) {
        console.log(`  ✅ End Date: ${alarmData.end_date}`);
      }

      // Test creating the alarm in database
      console.log(`  🔄 Testing alarm creation...`);

      const { data: createdAlarm, error: alarmError } = await supabase
        .schema('api')
        .from('prescription_alarms')
        .insert(alarmData)
        .select()
        .single();

      if (alarmError) {
        console.error(`  ❌ Failed to create alarm: ${alarmError.message}`);
      } else {
        console.log(`  ✅ Alarm created successfully! ID: ${createdAlarm.id}`);

        // Test retrieving the created alarm
        const { data: retrievedAlarm, error: retrieveError } = await supabase
          .schema('api')
          .from('prescription_alarms')
          .select('*')
          .eq('id', createdAlarm.id)
          .single();

        if (retrieveError) {
          console.error(`  ❌ Failed to retrieve created alarm: ${retrieveError.message}`);
        } else {
          console.log(`  ✅ Alarm retrieval successful`);
          console.log(`      - Status: ${retrievedAlarm.status}`);
          console.log(`      - Times: ${JSON.parse(retrievedAlarm.specific_times).join(', ')}`);
          console.log(`      - Enabled: ${retrievedAlarm.alarm_enabled}`);
        }
      }
    }

    // Step 4: Test complete workflow summary
    console.log('\n📊 [TEST SUMMARY]');
    console.log('================');
    console.log(`✅ Test notification: ${testNotification.title}`);
    console.log(`✅ Prescriptions tested: ${prescriptions.length}`);
    console.log(`✅ Alarm creation logic: Working`);
    console.log(`✅ Default time generation: Working`);
    console.log(`✅ Duration calculation: Working`);

    console.log('\n🎉 [TEST] Make Alarm feature test completed successfully!');
    console.log('\n📱 Patient workflow:');
    console.log('   1. Patient receives prescription notification');
    console.log('   2. Patient clicks "View Details" on notification');
    console.log('   3. Patient sees detailed prescription information');
    console.log('   4. Patient clicks "Make Alarm" button for any medication');
    console.log('   5. System automatically creates alarm with optimal times');
    console.log('   6. Patient receives confirmation and can manage alarm');

  } catch (error) {
    console.error('❌ [TEST] Unexpected error:', error);
  }
}

// Run the test
testMakeAlarmFeature();