// Test script to verify consultation data flow for Research V2
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConsultationDataFlow() {
  console.log('🔬 [TEST] Testing Consultation Data Flow for Research V2\n');

  try {
    // 1. Check if clinical_data column exists
    console.log('1. ✅ Checking if clinical_data column exists...');
    const { data: consultations, error: fetchError } = await supabase
      .schema('api')
      .from('consultations')
      .select('id, patient_id, clinical_data, diagnosis, chief_complaint, created_at')
      .limit(5);

    if (fetchError) {
      console.error('❌ Error fetching consultations:', fetchError.message);

      // Check if it's a column issue
      if (fetchError.message.includes('clinical_data')) {
        console.log('\n🔧 SOLUTION: Run this SQL in Supabase:');
        console.log('ALTER TABLE api.consultations ADD COLUMN clinical_data JSONB;');
      }
      return;
    }

    console.log(`✅ Found ${consultations.length} existing consultations`);

    // 2. Check clinical_data structure
    console.log('\n2. 🔍 Analyzing clinical_data structure...');

    let hasStructuredData = 0;
    let hasLegacyData = 0;
    let hasNoData = 0;

    consultations.forEach((consultation, index) => {
      console.log(`\nConsultation ${index + 1}:`);
      console.log(`  ID: ${consultation.id}`);
      console.log(`  Chief Complaint: ${consultation.chief_complaint || 'None'}`);

      if (consultation.clinical_data) {
        if (consultation.clinical_data.diagnosis || consultation.clinical_data.symptoms) {
          console.log('  ✅ Has structured clinical_data (V2 compatible)');
          console.log(`  Structure: ${Object.keys(consultation.clinical_data).join(', ')}`);
          hasStructuredData++;
        } else {
          console.log('  ⚠️ Has clinical_data but not V2 format');
          hasLegacyData++;
        }
      } else {
        console.log('  ❌ No clinical_data');
        hasNoData++;
      }

      if (consultation.diagnosis) {
        try {
          const diagnosisData = JSON.parse(consultation.diagnosis);
          console.log(`  Legacy diagnosis: ${diagnosisData.final?.[0] || 'None'}`);
        } catch (e) {
          console.log(`  Legacy diagnosis: ${consultation.diagnosis}`);
        }
      }
    });

    // 3. Summary and recommendations
    console.log('\n📊 SUMMARY:');
    console.log(`  ${hasStructuredData} consultations with V2-compatible data`);
    console.log(`  ${hasLegacyData} consultations with legacy clinical_data`);
    console.log(`  ${hasNoData} consultations without clinical_data`);

    if (hasStructuredData === 0) {
      console.log('\n⚠️ ISSUE: No V2-compatible consultation data found!');
      console.log('\n🔧 SOLUTIONS:');
      console.log('1. Create new consultations using the Enhanced Consultation form');
      console.log('2. The consultation save actions have been updated to save structured data');
      console.log('3. New consultations will work with Research V2 filtering');
    } else {
      console.log('\n✅ Research V2 should work with existing structured data!');
    }

    // 4. Test a simple research query
    if (hasStructuredData > 0) {
      console.log('\n4. 🧪 Testing simple research query...');

      const { data: queryResult, error: queryError } = await supabase
        .schema('api')
        .from('consultations')
        .select(`
          id,
          patient_id,
          clinical_data,
          profiles:patient_id (
            id,
            full_name
          )
        `)
        .not('clinical_data', 'is', null)
        .limit(3);

      if (queryError) {
        console.error('❌ Query test failed:', queryError.message);
      } else {
        console.log(`✅ Query test successful! Found ${queryResult.length} consultations with clinical data`);

        queryResult.forEach((result, index) => {
          console.log(`\nTest Query Result ${index + 1}:`);
          console.log(`  Patient: ${result.profiles?.full_name || 'Unknown'}`);
          console.log(`  Has pain_level: ${result.clinical_data?.symptoms?.pain_level || 'No'}`);
          console.log(`  Has diagnosis: ${result.clinical_data?.diagnosis?.primary || 'No'}`);
        });
      }
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Go to Dentist Dashboard → Enhanced Consultation');
    console.log('2. Complete a consultation with patient data');
    console.log('3. Go to Research V2 (Advanced) tab');
    console.log('4. Test advanced filtering on the new consultation data');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testConsultationDataFlow();