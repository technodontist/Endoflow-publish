const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testResearchTables() {
  try {
    console.log('🔍 Testing research tables creation...');

    // First, let's check if the schema 'api' exists
    const { data: schemas, error: schemaError } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'api');

    if (schemaError) {
      console.error('❌ Error checking schema:', schemaError);
      return;
    }

    console.log('📋 Available schemas with "api":', schemas);

    // Check if research_projects table exists
    const { data: existingTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'api')
      .eq('table_name', 'research_projects');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
      return;
    }

    console.log('📊 Existing research_projects table:', existingTables);

    if (existingTables.length === 0) {
      console.log('⚠️ Research projects table does not exist');
      console.log('💡 You need to run the SQL schema manually in Supabase SQL Editor');
      console.log('📁 File to run: RESEARCH_PROJECTS_SCHEMA.sql');
    } else {
      console.log('✅ Research projects table exists');

      // Test querying research projects
      const { data: projects, error: projectsError } = await supabase
        .from('research_projects')
        .select('*')
        .limit(5);

      if (projectsError) {
        console.error('❌ Error querying research projects:', projectsError);
      } else {
        console.log(`📊 Found ${projects.length} research projects`);
      }
    }

    // Also test patient search functionality
    console.log('🔍 Testing patient search...');
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select(`
        id, first_name, last_name, date_of_birth, medical_history_summary, created_at,
        consultations(id, diagnosis, treatment_plan, prognosis, status, created_at),
        appointments(id, appointment_date, status, created_at)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (patientsError) {
      console.error('❌ Error fetching patients:', patientsError);
    } else {
      console.log(`👥 Found ${patients.length} patients for research`);
      patients.forEach(patient => {
        const age = patient.date_of_birth
          ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0;
        console.log(`  - ${patient.first_name} ${patient.last_name}, Age: ${age}, Consultations: ${patient.consultations?.length || 0}`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testResearchTables();