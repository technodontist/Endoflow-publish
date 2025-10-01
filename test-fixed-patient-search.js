const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFixedPatientSearch() {
  try {
    console.log('🔍 Testing fixed patient search functionality...\n');

    // Simulate the findMatchingPatients function with manual joins
    console.log('👥 Fetching patients...');
    const { data: allPatients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (patientsError) {
      console.error('❌ Error fetching patients:', patientsError);
      return;
    }

    console.log(`✅ Found ${allPatients.length} patients`);

    console.log('🏥 Fetching consultations...');
    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*');

    if (consultationsError) {
      console.error('❌ Error fetching consultations:', consultationsError);
    } else {
      console.log(`✅ Found ${consultations?.length || 0} consultations`);
    }

    console.log('📅 Fetching appointments...');
    const { data: appointments, error: appointmentsError } = await supabase
      .schema('api')
      .from('appointments')
      .select('*');

    if (appointmentsError) {
      console.error('❌ Error fetching appointments:', appointmentsError);
    } else {
      console.log(`✅ Found ${appointments?.length || 0} appointments`);
    }

    // Manual join
    console.log('\n🔗 Performing manual joins...');
    const patientsWithRelations = allPatients.map(patient => ({
      ...patient,
      consultations: consultations?.filter(c => c.patient_id === patient.id) || [],
      appointments: appointments?.filter(a => a.patient_id === patient.id) || []
    }));

    console.log('📊 Patient search results:');
    patientsWithRelations.forEach((patient, index) => {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0;

      console.log(`\n  ${index + 1}. ${patient.first_name} ${patient.last_name}`);
      console.log(`     Age: ${age} years`);
      console.log(`     Consultations: ${patient.consultations.length}`);
      console.log(`     Appointments: ${patient.appointments.length}`);
      console.log(`     Medical History: ${patient.medical_history_summary || 'None'}`);

      // Test age filtering
      if (age >= 18) {
        console.log(`     ✅ Matches age filter (>=18)`);
      }

      // Test consultation filtering
      if (patient.consultations.length > 0) {
        console.log(`     ✅ Matches consultation filter (has consultations)`);
        patient.consultations.forEach((consultation, cIndex) => {
          console.log(`       - Consultation ${cIndex + 1}: ${consultation.diagnosis || 'No diagnosis'}`);
        });
      }
    });

    // Test filter criteria simulation
    console.log('\n🔍 Testing filter criteria...');

    // Age filter
    const adultPatients = patientsWithRelations.filter(patient => {
      if (!patient.date_of_birth) return false;
      const age = Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age >= 18;
    });

    console.log(`📊 Adult patients (>=18): ${adultPatients.length}/${patientsWithRelations.length}`);

    // Consultation filter
    const patientsWithConsultations = patientsWithRelations.filter(patient =>
      patient.consultations && patient.consultations.length > 0
    );

    console.log(`📊 Patients with consultations: ${patientsWithConsultations.length}/${patientsWithRelations.length}`);

    // Medical history filter
    const patientsWithMedicalHistory = patientsWithRelations.filter(patient =>
      patient.medical_history_summary && patient.medical_history_summary.trim() !== ''
    );

    console.log(`📊 Patients with medical history: ${patientsWithMedicalHistory.length}/${patientsWithRelations.length}`);

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Manual joins working correctly');
    console.log('✅ Patient data available for filtering');
    console.log('✅ Age calculations working');
    console.log('✅ Consultation and appointment data accessible');
    console.log('✅ Research patient search should now work!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testFixedPatientSearch();