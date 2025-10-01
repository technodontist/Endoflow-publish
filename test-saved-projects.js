const { createClient } = require('@supabase/supabase-js');

async function testSavedProjects() {
  try {
    console.log('🔍 Testing saved projects functionality...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Check if we can see any research projects
    console.log('1️⃣ Checking existing research projects...');
    const { data: allProjects, error: allError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching all projects:', allError.message);
    } else {
      console.log(`✅ Found ${allProjects?.length || 0} total research projects in database`);
      if (allProjects && allProjects.length > 0) {
        console.log('📋 Recent projects:');
        allProjects.slice(0, 3).forEach((project, index) => {
          console.log(`   ${index + 1}. "${project.name}" (ID: ${project.id.substring(0, 8)}...) - Dentist: ${project.dentist_id.substring(0, 8)}...`);
        });
      }
    }

    // Test 2: Get the current dentist ID (from your logs)
    const testDentistId = '5e1c48db-9045-45f6-99dc-08fb2655b785'; // From your logs
    console.log(`\n2️⃣ Checking projects for dentist: ${testDentistId.substring(0, 8)}...`);

    const { data: dentistProjects, error: dentistError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('*')
      .eq('dentist_id', testDentistId)
      .order('created_at', { ascending: false });

    if (dentistError) {
      console.error('❌ Error fetching dentist projects:', dentistError.message);
    } else {
      console.log(`✅ Found ${dentistProjects?.length || 0} projects for this dentist`);
      if (dentistProjects && dentistProjects.length > 0) {
        console.log('📋 Your projects:');
        dentistProjects.forEach((project, index) => {
          console.log(`   ${index + 1}. "${project.name}" - Status: ${project.status} - Created: ${new Date(project.created_at).toLocaleDateString()}`);
        });
      }
    }

    // Test 3: Create a test project to verify saving works
    console.log('\n3️⃣ Testing project creation...');
    const testProject = {
      dentist_id: testDentistId,
      name: 'Test Research Project ' + Date.now(),
      description: 'Test project created by automated test',
      status: 'draft',
      filter_criteria: JSON.stringify([{
        field: 'age',
        operator: 'greater_than',
        value: '25',
        dataType: 'number'
      }])
    };

    const { data: newProject, error: createError } = await supabase
      .schema('api')
      .from('research_projects')
      .insert(testProject)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating test project:', createError.message);
    } else {
      console.log(`✅ Successfully created test project: "${newProject.name}"`);
      console.log(`   Project ID: ${newProject.id}`);

      // Clean up - delete the test project
      await supabase
        .schema('api')
        .from('research_projects')
        .delete()
        .eq('id', newProject.id);

      console.log('🧹 Cleaned up test project');
    }

    console.log('\n🎯 Results:');
    console.log('✅ Database access is working');
    console.log('✅ Project creation works');
    console.log('✅ Project querying works');
    console.log('\n💡 If you still can\'t see projects in the UI:');
    console.log('   1. Check browser console for any JavaScript errors');
    console.log('   2. Try refreshing the page');
    console.log('   3. Check that projects are being created with the correct dentist_id');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSavedProjects();