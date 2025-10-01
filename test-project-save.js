require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testProjectSave() {
  try {
    console.log('🔬 Testing research project save functionality...');

    // Test that research tables exist
    const { data: projects, error: projectsError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('count(*)', { count: 'exact', head: true });

    if (projectsError) {
      console.error('❌ Research projects table error:', projectsError);
      return;
    }

    console.log('✅ Research projects table exists and accessible');

    // Test getting dentist profile
    const { data: dentists, error: dentistError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'dentist')
      .eq('status', 'active')
      .limit(1);

    if (dentistError || !dentists || dentists.length === 0) {
      console.error('❌ No active dentists found:', dentistError);
      return;
    }

    console.log(`✅ Found dentist: ${dentists[0].full_name} (ID: ${dentists[0].id})`);

    // Test project creation with real dentist ID
    const testProject = {
      name: 'Test Research Project ' + Date.now(),
      description: 'This is a test project to verify save functionality',
      hypothesis: 'Testing hypothesis',
      status: 'draft',
      start_date: new Date().toISOString(),
      dentist_id: dentists[0].id,
      tags: ['test', 'verification']
    };

    const { data: newProject, error: createError } = await supabase
      .schema('api')
      .from('research_projects')
      .insert([testProject])
      .select()
      .single();

    if (createError) {
      console.error('❌ Project creation error:', createError);
      return;
    }

    console.log(`✅ Project created successfully: ${newProject.name} (ID: ${newProject.id})`);

    // Clean up - delete test project
    await supabase
      .schema('api')
      .from('research_projects')
      .delete()
      .eq('id', newProject.id);

    console.log('✅ Test project cleaned up');
    console.log('\n🎉 Project save functionality is working correctly!');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testProjectSave();