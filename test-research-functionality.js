const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testResearchFunctionality() {
  try {
    console.log('🔍 Testing Research Projects functionality...\n');

    // 1. Test if research_projects table exists
    console.log('📊 Testing research_projects table...');
    const { data: researchProjects, error: researchError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('*')
      .limit(1);

    if (researchError) {
      console.log('❌ Research projects table missing:', researchError.message);
      console.log('💡 Need to create research tables first\n');
    } else {
      console.log('✅ Research projects table exists');
      console.log(`📊 Found ${researchProjects.length} existing projects\n`);
    }

    // 2. Test patient data availability for research
    console.log('👥 Testing patient data for research...');
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select(`
        id, first_name, last_name, date_of_birth, medical_history_summary, created_at,
        consultations(id, diagnosis, treatment_plan, prognosis, status, created_at),
        appointments(id, appointment_date, status, created_at)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (patientsError) {
      console.error('❌ Error fetching patients:', patientsError);
      return;
    }

    console.log(`✅ Found ${patients.length} patients available for research`);

    if (patients.length > 0) {
      console.log('\n📋 Sample patient data for research:');
      patients.slice(0, 3).forEach((patient, index) => {
        const age = patient.date_of_birth
          ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0;

        console.log(`  ${index + 1}. ${patient.first_name} ${patient.last_name}`);
        console.log(`     Age: ${age} years`);
        console.log(`     Consultations: ${patient.consultations?.length || 0}`);
        console.log(`     Appointments: ${patient.appointments?.length || 0}`);
        console.log(`     Medical History: ${patient.medical_history_summary || 'None'}`);
        console.log('');
      });

      // 3. Test filter criteria simulation
      console.log('🔍 Testing research filter criteria...');

      // Simulate age filtering
      const adultPatients = patients.filter(patient => {
        if (!patient.date_of_birth) return false;
        const age = Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= 18;
      });

      console.log(`📊 Adult patients (>=18): ${adultPatients.length}/${patients.length}`);

      // Simulate consultation filtering
      const patientsWithConsultations = patients.filter(patient =>
        patient.consultations && patient.consultations.length > 0
      );

      console.log(`📊 Patients with consultations: ${patientsWithConsultations.length}/${patients.length}`);

      // Simulate diagnosis filtering
      const patientsWithDiagnosis = patients.filter(patient =>
        patient.consultations?.some(consultation => consultation.diagnosis)
      );

      console.log(`📊 Patients with diagnoses: ${patientsWithDiagnosis.length}/${patients.length}`);
    }

    // 4. Test authentication for dentist role
    console.log('\n🔒 Testing dentist authentication...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role, status, full_name')
      .eq('role', 'dentist')
      .eq('status', 'active');

    if (profilesError) {
      console.error('❌ Error fetching dentist profiles:', profilesError);
    } else {
      console.log(`✅ Found ${profiles.length} active dentists`);
      profiles.forEach(profile => {
        console.log(`  - ${profile.full_name} (${profile.id})`);
      });
    }

    console.log('\n🎯 SUMMARY:');
    if (researchError) {
      console.log('❌ Research tables need to be created');
      console.log('📋 Run RESEARCH_PROJECTS_SCHEMA.sql in Supabase SQL Editor');
    } else {
      console.log('✅ Research tables exist');
    }

    if (patients.length > 0) {
      console.log('✅ Patient data is available for research');
      console.log('✅ Filter criteria can be applied to patient data');
    } else {
      console.log('⚠️ No patient data available for research');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testResearchFunctionality();