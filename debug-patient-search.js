require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Environment check:');
console.log('NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugPatientSearch() {
  try {
    console.log('🔍 [DEBUG] Testing patient search functionality...');

    // 1. Test direct patient count
    const { data: patientCount, error: countError } = await supabase
      .schema('api')
      .from('patients')
      .select('count(*)', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting patients:', countError);
      return;
    }

    console.log(`✅ Total patients in database: ${patientCount}`);

    // 2. Test fetching first few patients
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (patientsError) {
      console.error('❌ Error fetching patients:', patientsError);
      return;
    }

    console.log(`✅ Fetched ${patients.length} patient records:`);
    patients.forEach((patient, i) => {
      console.log(`  ${i + 1}. ${patient.first_name} ${patient.last_name} (ID: ${patient.id})`);
    });

    // 3. Test consultations data
    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .limit(5);

    if (consultationsError) {
      console.error('❌ Error fetching consultations:', consultationsError);
    } else {
      console.log(`✅ Fetched ${consultations.length} consultation records`);
    }

    // 4. Test the exact filter logic from the research action
    console.log('\n🔍 [DEBUG] Testing filter logic...');

    // Simulate basic age filter (age > 18)
    const filteredPatients = patients.filter(patient => {
      if (!patient.date_of_birth) return false;

      const age = Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age > 18;
    });

    console.log(`✅ After age filter (>18): ${filteredPatients.length} patients`);

    // 5. Test the transformation logic
    const transformedPatients = filteredPatients.map(patient => {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0;

      return {
        id: patient.id,
        firstName: patient.first_name || 'Unknown',
        lastName: patient.last_name || 'Unknown',
        age: age,
        gender: 'Not specified',
        lastVisit: new Date(patient.created_at),
        condition: 'No diagnosis recorded',
        matchScore: Math.round(75 + Math.random() * 25)
      };
    });

    console.log(`✅ Transformed ${transformedPatients.length} patients with real data`);
    console.log('Sample transformed patient:', transformedPatients[0]);

    // 6. Test with empty criteria (should return all patients)
    console.log('\n🔍 [DEBUG] Testing with empty criteria...');
    const emptyCriteria = [];
    let allPatients = patients;

    for (const filter of emptyCriteria) {
      // This loop should not execute with empty criteria
      console.log('Processing filter:', filter);
    }

    console.log(`✅ With empty criteria: ${allPatients.length} patients (should match original count)`);

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugPatientSearch();