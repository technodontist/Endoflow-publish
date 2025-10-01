const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPrescriptionNotificationFlow() {
  console.log('🧪 [TEST] Starting prescription notification flow test...\n');

  try {
    // Step 1: Get a test patient
    const { data: patients, error: patientsError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'patient')
      .eq('status', 'active')
      .limit(1);

    if (patientsError || !patients || patients.length === 0) {
      console.error('❌ [TEST] No active patients found for testing');
      return;
    }

    const testPatient = patients[0];
    console.log(`👤 [TEST] Using test patient: ${testPatient.full_name} (ID: ${testPatient.id})`);

    // Step 2: Get a test dentist
    const { data: dentists, error: dentistsError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'dentist')
      .eq('status', 'active')
      .limit(1);

    if (dentistsError || !dentists || dentists.length === 0) {
      console.error('❌ [TEST] No active dentists found for testing');
      return;
    }

    const testDentist = dentists[0];
    console.log(`👨‍⚕️ [TEST] Using test dentist: ${testDentist.full_name} (ID: ${testDentist.id})\n`);

    // Step 3: Create a test consultation with prescriptions
    const testConsultation = {
      patient_id: testPatient.id,
      dentist_id: testDentist.id,
      consultation_date: new Date().toISOString(),
      chief_complaint: 'Test consultation for prescription notification',
      status: 'completed',
      prescription_data: JSON.stringify([
        {
          medicationName: 'Amoxicillin',
          brandName: 'Amoxil',
          dosage: '500mg',
          strength: '500mg',
          form: 'capsule',
          frequency: 'three times daily',
          timesPerDay: 3,
          instructions: 'Take with food to reduce stomach upset',
          duration: '7',
          quantity: '21 capsules',
          refills: 0
        },
        {
          medicationName: 'Ibuprofen',
          brandName: 'Advil',
          dosage: '400mg',
          strength: '400mg',
          form: 'tablet',
          frequency: 'twice daily as needed',
          timesPerDay: 2,
          instructions: 'Take with food. Do not exceed 6 tablets per day',
          duration: '5',
          quantity: '10 tablets',
          refills: 1
        }
      ])
    };

    console.log('💊 [TEST] Creating test consultation with prescriptions...');

    const { data: consultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .insert(testConsultation)
      .select()
      .single();

    if (consultationError) {
      console.error('❌ [TEST] Failed to create consultation:', consultationError.message);
      return;
    }

    console.log(`✅ [TEST] Created consultation: ${consultation.id}\n`);

    // Step 4: Manually trigger prescription notification
    console.log('📋 [TEST] Triggering prescription notification...');

    const prescriptions = JSON.parse(consultation.prescription_data);

    // Create notification manually
    const notificationTitle = prescriptions.length === 1
      ? `New Prescription: ${prescriptions[0].medicationName}`
      : `${prescriptions.length} New Prescriptions`;

    const medicationNames = prescriptions.slice(0, 2).map(p => p.medicationName).join(', ');
    const additionalCount = prescriptions.length > 2 ? ` and ${prescriptions.length - 2} more` : '';

    const notificationMessage = prescriptions.length === 1
      ? `Dr. ${testDentist.full_name} has prescribed ${prescriptions[0].medicationName} (${prescriptions[0].dosage}) for you. Please check the details and dosage instructions in your alarms tab.`
      : `Dr. ${testDentist.full_name} has prescribed ${medicationNames}${additionalCount} for you. Please check the details and dosage instructions for all medications in your alarms tab.`;

    const { data: notification, error: notificationError } = await supabase
      .schema('api')
      .from('notifications')
      .insert({
        user_id: testPatient.id,
        type: 'prescription_prescribed',
        title: notificationTitle,
        message: notificationMessage,
        related_id: consultation.id,
        read: false
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ [TEST] Failed to create notification:', notificationError.message);
      return;
    }

    console.log(`✅ [TEST] Created notification: ${notification.id}`);
    console.log(`📄 [TEST] Title: ${notification.title}`);
    console.log(`📝 [TEST] Message: ${notification.message}\n`);

    // Step 5: Store detailed prescription information
    console.log('💾 [TEST] Storing detailed prescription information...');

    const prescriptionInserts = prescriptions.map(prescription => ({
      patient_id: testPatient.id,
      dentist_id: testDentist.id,
      consultation_id: consultation.id,
      medication_name: prescription.medicationName,
      brand_name: prescription.brandName || null,
      dosage: prescription.dosage,
      strength: prescription.strength || null,
      form: prescription.form || null,
      frequency: prescription.frequency,
      times_per_day: prescription.timesPerDay,
      duration_days: prescription.duration ? parseInt(prescription.duration) || null : null,
      instructions: prescription.instructions || null,
      total_quantity: prescription.quantity || null,
      refills_remaining: prescription.refills || 0,
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
      reminder_times: JSON.stringify(['09:00', '13:00', '19:00'].slice(0, prescription.timesPerDay))
    }));

    const { data: prescriptionRecords, error: prescriptionError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .insert(prescriptionInserts)
      .select();

    if (prescriptionError) {
      console.error('❌ [TEST] Failed to store prescription details:', prescriptionError.message);
      return;
    }

    console.log(`✅ [TEST] Stored ${prescriptionRecords.length} prescription records\n`);

    // Step 6: Verify notification can be retrieved
    console.log('🔍 [TEST] Verifying notification retrieval...');

    const { data: retrievedNotifications, error: retrieveError } = await supabase
      .schema('api')
      .from('notifications')
      .select('*')
      .eq('user_id', testPatient.id)
      .eq('type', 'prescription_prescribed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (retrieveError) {
      console.error('❌ [TEST] Failed to retrieve notifications:', retrieveError.message);
      return;
    }

    console.log(`✅ [TEST] Retrieved ${retrievedNotifications.length} prescription notifications`);

    // Step 7: Verify prescription details can be retrieved
    console.log('🔍 [TEST] Verifying prescription details retrieval...');

    const { data: retrievedPrescriptions, error: prescriptionRetrieveError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .select('*')
      .eq('consultation_id', consultation.id)
      .eq('status', 'active');

    if (prescriptionRetrieveError) {
      console.error('❌ [TEST] Failed to retrieve prescription details:', prescriptionRetrieveError.message);
      return;
    }

    console.log(`✅ [TEST] Retrieved ${retrievedPrescriptions.length} prescription detail records\n`);

    // Step 8: Test summary
    console.log('📊 [TEST SUMMARY]');
    console.log('================');
    console.log(`✅ Patient: ${testPatient.full_name}`);
    console.log(`✅ Dentist: ${testDentist.full_name}`);
    console.log(`✅ Consultation created: ${consultation.id}`);
    console.log(`✅ Prescriptions: ${prescriptions.length}`);
    console.log(`✅ Notification created: ${notification.id}`);
    console.log(`✅ Prescription records: ${prescriptionRecords.length}`);
    console.log(`\n🎉 [TEST] Prescription notification flow test completed successfully!`);
    console.log('\n📱 Patient can now:');
    console.log('   - View notification in alarms tab');
    console.log('   - See detailed prescription information');
    console.log('   - Set up medication alarms based on prescriptions');

  } catch (error) {
    console.error('❌ [TEST] Unexpected error:', error);
  }
}

// Run the test
testPrescriptionNotificationFlow();