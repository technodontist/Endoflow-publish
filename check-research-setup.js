const { createClient } = require('@supabase/supabase-js');

async function checkResearchSetup() {
  try {
    console.log('🔍 Checking Research Projects setup...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if research_projects table exists
    console.log('📊 Checking research_projects table...');
    const { data: projects, error: projectsError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('count(*)', { count: 'exact', head: true });

    if (projectsError) {
      console.log('❌ research_projects table missing:', projectsError.message);
      console.log('🔧 Need to run CREATE_RESEARCH_TABLES_SIMPLE.sql in Supabase SQL Editor');
      return false;
    } else {
      console.log('✅ research_projects table exists');
    }

    // Check if research_cohorts table exists
    console.log('👥 Checking research_cohorts table...');
    const { data: cohorts, error: cohortsError } = await supabase
      .schema('api')
      .from('research_cohorts')
      .select('count(*)', { count: 'exact', head: true });

    if (cohortsError) {
      console.log('❌ research_cohorts table missing:', cohortsError.message);
      console.log('🔧 Need to run CREATE_RESEARCH_TABLES_SIMPLE.sql in Supabase SQL Editor');
      return false;
    } else {
      console.log('✅ research_cohorts table exists');
    }

    // Test patient data access
    console.log('👤 Testing patient data access...');
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('count(*)', { count: 'exact', head: true });

    if (patientsError) {
      console.log('❌ Cannot access patient data:', patientsError.message);
    } else {
      console.log('✅ Patient data accessible');
    }

    console.log('🎉 Research Projects system setup verified!');
    return true;

  } catch (error) {
    console.error('❌ Check failed:', error);
    return false;
  }
}

checkResearchSetup();