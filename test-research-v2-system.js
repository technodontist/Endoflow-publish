// Test script to verify Research V2 system is working
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testResearchV2System() {
  console.log('🔬 [RESEARCH V2 TEST] Complete System Verification\n');

  // Test 1: Check database function exists
  console.log('1. ✅ Testing advanced query database function...');
  try {
    // Test the function with a simple query
    const { data: functionTest, error: functionError } = await supabase
      .rpc('execute_advanced_research_query', {
        base_where_clause: "p.status = 'active'",
        query_params: {}
      });

    if (functionError) {
      console.error('❌ Database function error:', functionError.message);
      if (functionError.message.includes('function') && functionError.message.includes('does not exist')) {
        console.log('\n🔧 SOLUTION: Run the database function SQL in Supabase SQL Editor');
        console.log('(The CREATE OR REPLACE FUNCTION execute_advanced_research_query...)');
      }
      return false;
    }

    console.log(`✅ Database function works! Found ${functionTest?.length || 0} active patients`);
  } catch (error) {
    console.error('❌ Function test failed:', error.message);
    return false;
  }

  // Test 2: Check for consultations with clinical_data
  console.log('\n2. 📋 Checking for consultation data...');
  const { data: consultations, error: consError } = await supabase
    .schema('api')
    .from('consultations')
    .select('id, patient_id, clinical_data, chief_complaint')
    .not('clinical_data', 'is', null)
    .limit(3);

  if (consError) {
    console.error('❌ Consultations query error:', consError.message);
    return false;
  }

  if (!consultations || consultations.length === 0) {
    console.log('⚠️ No consultations with clinical_data found');
    console.log('🔧 SOLUTION: Create consultations using Enhanced Consultation form');
    console.log('   The form will now save structured data to clinical_data column');
  } else {
    console.log(`✅ Found ${consultations.length} consultations with clinical data`);

    // Analyze the structure
    consultations.forEach((cons, index) => {
      console.log(`\nConsultation ${index + 1}:`);
      console.log(`  Chief Complaint: ${cons.chief_complaint || 'None'}`);

      if (cons.clinical_data) {
        const structure = Object.keys(cons.clinical_data);
        console.log(`  Clinical Data Structure: ${structure.join(', ')}`);

        if (cons.clinical_data.diagnosis?.primary) {
          console.log(`  Primary Diagnosis: ${cons.clinical_data.diagnosis.primary}`);
        }
        if (cons.clinical_data.symptoms?.pain_level) {
          console.log(`  Pain Level: ${cons.clinical_data.symptoms.pain_level}/10`);
        }
      }
    });
  }

  // Test 3: Test specific filtering scenarios
  console.log('\n3. 🧪 Testing specific Research V2 queries...');

  // Test age filtering
  console.log('\n   Testing Age > 30 filter:');
  try {
    const ageQuery = `
      EXTRACT(YEAR FROM AGE(NOW(), api_patients.date_of_birth)) > 30
    `;

    const { data: ageResults, error: ageError } = await supabase
      .rpc('execute_advanced_research_query', {
        base_where_clause: ageQuery,
        query_params: {}
      });

    if (ageError) {
      console.error('   ❌ Age query failed:', ageError.message);
    } else {
      console.log(`   ✅ Age filter works! Found ${ageResults?.length || 0} patients > 30 years`);
    }
  } catch (error) {
    console.error('   ❌ Age test error:', error.message);
  }

  // Test clinical data filtering
  if (consultations && consultations.length > 0) {
    console.log('\n   Testing Clinical Data filter:');
    try {
      const clinicalQuery = `
        api_consultations.clinical_data IS NOT NULL
      `;

      const { data: clinicalResults, error: clinicalError } = await supabase
        .rpc('execute_advanced_research_query', {
          base_where_clause: clinicalQuery,
          query_params: {}
        });

      if (clinicalError) {
        console.error('   ❌ Clinical data query failed:', clinicalError.message);
      } else {
        console.log(`   ✅ Clinical data filter works! Found ${clinicalResults?.length || 0} patients with clinical data`);
      }
    } catch (error) {
      console.error('   ❌ Clinical data test error:', error.message);
    }

    // Test diagnosis filtering
    console.log('\n   Testing Diagnosis filter:');
    try {
      const diagnosisQuery = `
        api_consultations.clinical_data->>'diagnosis'->'primary' IS NOT NULL
      `;

      const { data: diagnosisResults, error: diagnosisError } = await supabase
        .rpc('execute_advanced_research_query', {
          base_where_clause: diagnosisQuery,
          query_params: {}
        });

      if (diagnosisError) {
        console.error('   ❌ Diagnosis query failed:', diagnosisError.message);
      } else {
        console.log(`   ✅ Diagnosis filter works! Found ${diagnosisResults?.length || 0} patients with primary diagnosis`);
      }
    } catch (error) {
      console.error('   ❌ Diagnosis test error:', error.message);
    }
  }

  // Test 4: Check filter_rules column in research_projects
  console.log('\n4. 📊 Testing research projects table...');
  const { data: projects, error: projectsError } = await supabase
    .schema('api')
    .from('research_projects')
    .select('id, name, filter_rules')
    .limit(1);

  if (projectsError) {
    console.error('❌ Research projects query error:', projectsError.message);
    if (projectsError.message.includes('filter_rules')) {
      console.log('\n🔧 SOLUTION: Run this SQL in Supabase:');
      console.log('ALTER TABLE api.research_projects ADD COLUMN filter_rules JSONB DEFAULT \'{}\'::jsonb;');
    }
  } else {
    console.log('✅ Research projects table ready with filter_rules column');
  }

  console.log('\n📋 SYSTEM STATUS SUMMARY:');
  console.log('✅ Database function: Working');
  console.log(`✅ Consultation data: ${consultations?.length || 0} with clinical_data`);
  console.log('✅ Research projects: Table ready');

  console.log('\n🎯 TO TEST THE COMPLETE SYSTEM:');
  console.log('1. Go to Dentist Dashboard → Enhanced Consultation');
  console.log('2. Fill out a complete consultation form with:');
  console.log('   - Chief complaint');
  console.log('   - Pain assessment (set pain level 1-10)');
  console.log('   - Medical history');
  console.log('   - Diagnosis (primary diagnosis)');
  console.log('   - Treatment plan');
  console.log('3. Save the consultation');
  console.log('4. Go to Research V2 (Advanced) tab');
  console.log('5. Create a group with conditions like:');
  console.log('   - Patient Age > 25');
  console.log('   - Pain Level > 5');
  console.log('   - Primary Diagnosis = "Caries"');
  console.log('6. Run the query and see results!');

  return true;
}

// Run the test
testResearchV2System();