const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAddToCohort() {
  console.log('🧪 TESTING ADD TO COHORT WORKFLOW\n');

  // 1. Get an existing project
  const { data: projects, error: projectsError } = await supabase
    .schema('api')
    .from('research_projects')
    .select('id, name')
    .limit(1);

  if (projectsError || !projects || projects.length === 0) {
    console.error('❌ No research projects found. Create one first.');
    return;
  }

  const project = projects[0];
  console.log(`✅ Found project: "${project.name}" (${project.id})\n`);

  // 2. Get a patient
  const { data: patients, error: patientsError } = await supabase
    .schema('api')
    .from('patients')
    .select('id, first_name, last_name')
    .limit(1);

  if (patientsError || !patients || patients.length === 0) {
    console.error('❌ No patients found.');
    return;
  }

  const patient = patients[0];
  console.log(`✅ Found patient: ${patient.first_name} ${patient.last_name} (${patient.id})\n`);

  // 3. Check if research_cohorts table exists
  const { data: existingCohort, error: checkError } = await supabase
    .schema('api')
    .from('research_cohorts')
    .select('id')
    .eq('project_id', project.id)
    .eq('patient_id', patient.id)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('❌ Error checking cohort table:', checkError.message);
    return;
  }

  if (existingCohort) {
    console.log('⚠️ Patient already in cohort. Skipping add.\n');
  } else {
    // 4. Add patient to cohort with group
    const groupName = 'Control';
    const anonymousId = `P${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    console.log(`📝 Adding patient to cohort with group: "${groupName}"...`);

    const { data: newCohortEntry, error: addError } = await supabase
      .schema('api')
      .from('research_cohorts')
      .insert({
        project_id: project.id,
        patient_id: patient.id,
        group_name: groupName,
        anonymous_id: anonymousId,
        status: 'included',
        inclusion_date: new Date().toISOString(),
        baseline_data_collected: false,
        follow_up_data_collected: false
      })
      .select()
      .single();

    if (addError) {
      console.error('❌ Failed to add to cohort:', addError.message);
      return;
    }

    console.log('✅ Successfully added to cohort!');
    console.log(`   Anonymous ID: ${anonymousId}`);
    console.log(`   Group: ${groupName}\n`);
  }

  // 5. Fetch all cohort patients
  console.log('📋 Fetching all cohort patients...');

  const { data: cohortData, error: cohortError } = await supabase
    .schema('api')
    .from('research_cohorts')
    .select(`
      id,
      patient_id,
      group_name,
      anonymous_id,
      status,
      inclusion_date
    `)
    .eq('project_id', project.id)
    .eq('status', 'included')
    .order('inclusion_date', { ascending: true });

  if (cohortError) {
    console.error('❌ Failed to fetch cohort patients:', cohortError.message);
    return;
  }

  console.log(`✅ Found ${cohortData.length} patient(s) in cohort:`);

  if (cohortData.length > 0) {
    // Get patient details
    const patientIds = cohortData.map(c => c.patient_id);
    const { data: patientDetails } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .in('id', patientIds);

    cohortData.forEach(entry => {
      const patientInfo = patientDetails?.find(p => p.id === entry.patient_id);
      console.log(`   - ${entry.anonymous_id} (${patientInfo?.first_name} ${patientInfo?.last_name}) - Group: ${entry.group_name}`);
    });
  }

  console.log('\n✅ ALL TESTS PASSED!');
}

testAddToCohort().catch(console.error);
