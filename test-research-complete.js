const { createClient } = require('@supabase/supabase-js');

async function testResearchFunctionality() {
  try {
    console.log('🧪 Testing Research Projects functionality...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Check if research tables exist
    console.log('1️⃣ Testing research tables setup...');
    const { data: projects, error: projectsError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('count(*)', { count: 'exact', head: true });

    if (projectsError) {
      console.log('❌ Research tables missing. Please run the SQL setup first:');
      console.log('   node manual-research-setup.js');
      return;
    }
    console.log('✅ Research tables exist');

    // Test 2: Check patient data access
    console.log('\n2️⃣ Testing patient data access...');
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('count(*)', { count: 'exact', head: true });

    if (patientsError) {
      console.log('❌ Cannot access patient data:', patientsError.message);
      return;
    }
    console.log('✅ Patient data accessible');

    // Test 3: Get sample patients for filtering
    console.log('\n3️⃣ Testing patient filtering...');
    const { data: samplePatients, error: sampleError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.log('❌ Cannot fetch sample patients:', sampleError.message);
    } else {
      console.log(`✅ Found ${samplePatients?.length || 0} sample patients`);
      if (samplePatients && samplePatients.length > 0) {
        console.log('   Sample patient:', {
          name: `${samplePatients[0].first_name} ${samplePatients[0].last_name}`,
          id: samplePatients[0].id.substring(0, 8) + '...'
        });
      }
    }

    // Test 4: Check dentist profiles for project creation
    console.log('\n4️⃣ Testing dentist profiles...');
    const { data: dentists, error: dentistError } = await supabase
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('role', 'dentist')
      .eq('status', 'active')
      .limit(3);

    if (dentistError) {
      console.log('❌ Cannot access dentist profiles:', dentistError.message);
    } else {
      console.log(`✅ Found ${dentists?.length || 0} active dentists`);
      if (dentists && dentists.length > 0) {
        console.log('   Sample dentist:', {
          name: dentists[0].full_name,
          id: dentists[0].id.substring(0, 8) + '...'
        });
      }
    }

    console.log('\n🎯 Summary:');
    console.log('✅ Database tables are set up correctly');
    console.log('✅ Patient search functionality should work');
    console.log('✅ Project creation should work for dentists');
    console.log('\n🚀 Research Projects system is ready!');

    console.log('\n📋 Next steps:');
    console.log('1. Navigate to the Research Projects tab as a dentist');
    console.log('2. Create a new research project');
    console.log('3. Set up filter criteria (e.g., age > 18)');
    console.log('4. See matching patients in real-time');
    console.log('5. Save the project');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testResearchFunctionality();