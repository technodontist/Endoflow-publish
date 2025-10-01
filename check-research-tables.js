require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkResearchTables() {
  try {
    console.log('🔍 Checking if research tables exist...');

    // Check research_projects table
    const { data: projectsCheck, error: projectsError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('count(*)', { count: 'exact', head: true });

    if (projectsError) {
      console.error('❌ research_projects table error:', projectsError.message);
      console.log('📋 You need to run CREATE_RESEARCH_TABLES_SIMPLE.sql in Supabase SQL Editor');
      return false;
    } else {
      console.log('✅ research_projects table exists');
    }

    // Check research_cohorts table
    const { data: cohortsCheck, error: cohortsError } = await supabase
      .schema('api')
      .from('research_cohorts')
      .select('count(*)', { count: 'exact', head: true });

    if (cohortsError) {
      console.error('❌ research_cohorts table error:', cohortsError.message);
      return false;
    } else {
      console.log('✅ research_cohorts table exists');
    }

    // Check if we can access patients table (needed for search)
    const { data: patientsCheck, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('count(*)', { count: 'exact', head: true });

    if (patientsError) {
      console.error('❌ patients table access error:', patientsError.message);
      return false;
    } else {
      console.log(`✅ patients table accessible with ${patientsCheck} records`);
    }

    console.log('\n🎉 All research tables are properly set up!');
    console.log('🔬 The Research Projects system should now work correctly.');
    return true;

  } catch (error) {
    console.error('❌ Check error:', error);
    return false;
  }
}

checkResearchTables();