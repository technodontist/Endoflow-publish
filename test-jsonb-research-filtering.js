// Test script for JSONB-enhanced research project filtering
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

async function testJSONBResearchFiltering() {
  console.log('🔬 [TEST] Testing JSONB Research Filtering System\n');

  try {
    // =====================================================
    // TEST 1: Check consultation data with JSONB fields
    // =====================================================
    console.log('📋 TEST 1: Fetching consultations with JSONB data...');
    const { data: consultations, error: consultError } = await supabase
      .schema('api')
      .from('consultations')
      .select(`
        id,
        patient_id,
        consultation_date,
        status,
        pain_assessment,
        diagnosis,
        treatment_plan,
        clinical_examination,
        medical_history,
        investigations,
        prescription_data,
        follow_up_data
      `)
      .eq('status', 'completed')
      .limit(5);

    if (consultError) {
      console.error('❌ Error fetching consultations:', consultError.message);
      return;
    }

    console.log(`✅ Found ${consultations.length} completed consultations`);

    if (consultations.length === 0) {
      console.log('\n⚠️ WARNING: No completed consultations found in database!');
      console.log('📝 To test JSONB filtering, you need to:');
      console.log('   1. Go to Dentist Dashboard → Enhanced Consultation');
      console.log('   2. Complete a consultation with full clinical data');
      console.log('   3. Re-run this test script\n');
      return;
    }

    // Analyze JSONB field population
    console.log('\n📊 Analyzing JSONB field population:');
    let jsonbStats = {
      pain_assessment: 0,
      diagnosis: 0,
      treatment_plan: 0,
      clinical_examination: 0,
      medical_history: 0,
      investigations: 0,
      prescription_data: 0,
      follow_up_data: 0
    };

    consultations.forEach(c => {
      if (c.pain_assessment) jsonbStats.pain_assessment++;
      if (c.diagnosis) jsonbStats.diagnosis++;
      if (c.treatment_plan) jsonbStats.treatment_plan++;
      if (c.clinical_examination) jsonbStats.clinical_examination++;
      if (c.medical_history) jsonbStats.medical_history++;
      if (c.investigations) jsonbStats.investigations++;
      if (c.prescription_data) jsonbStats.prescription_data++;
      if (c.follow_up_data) jsonbStats.follow_up_data++;
    });

    console.log(`  Pain Assessment:       ${jsonbStats.pain_assessment}/${consultations.length}`);
    console.log(`  Diagnosis:             ${jsonbStats.diagnosis}/${consultations.length}`);
    console.log(`  Treatment Plan:        ${jsonbStats.treatment_plan}/${consultations.length}`);
    console.log(`  Clinical Examination:  ${jsonbStats.clinical_examination}/${consultations.length}`);
    console.log(`  Medical History:       ${jsonbStats.medical_history}/${consultations.length}`);
    console.log(`  Investigations:        ${jsonbStats.investigations}/${consultations.length}`);
    console.log(`  Prescription Data:     ${jsonbStats.prescription_data}/${consultations.length}`);
    console.log(`  Follow-up Data:        ${jsonbStats.follow_up_data}/${consultations.length}`);

    // =====================================================
    // TEST 2: Show sample JSONB structures
    // =====================================================
    console.log('\n📋 TEST 2: Sample JSONB structures:');
    const sampleConsultation = consultations[0];

    if (sampleConsultation.pain_assessment) {
      const painData = typeof sampleConsultation.pain_assessment === 'string'
        ? JSON.parse(sampleConsultation.pain_assessment)
        : sampleConsultation.pain_assessment;
      console.log('\n🩹 Pain Assessment:');
      console.log(JSON.stringify(painData, null, 2));
    }

    if (sampleConsultation.diagnosis) {
      const diagnosisData = typeof sampleConsultation.diagnosis === 'string'
        ? JSON.parse(sampleConsultation.diagnosis)
        : sampleConsultation.diagnosis;
      console.log('\n🔬 Diagnosis:');
      console.log(JSON.stringify(diagnosisData, null, 2));
    }

    if (sampleConsultation.treatment_plan) {
      const treatmentData = typeof sampleConsultation.treatment_plan === 'string'
        ? JSON.parse(sampleConsultation.treatment_plan)
        : sampleConsultation.treatment_plan;
      console.log('\n🦷 Treatment Plan:');
      console.log(JSON.stringify(treatmentData, null, 2));
    }

    // =====================================================
    // TEST 3: Test JSONB path queries
    // =====================================================
    console.log('\n📋 TEST 3: Testing JSONB path queries...');

    // Test 3.1: Pain intensity query
    console.log('\n  3.1: Patients with pain intensity > 5');
    const { data: highPainPatients, error: painError } = await supabase
      .schema('api')
      .from('consultations')
      .select('patient_id, pain_assessment')
      .gt('pain_assessment->>intensity', '5')
      .eq('status', 'completed')
      .limit(3);

    if (painError) {
      console.log('  ⚠️ Query failed:', painError.message);
    } else {
      console.log(`  ✅ Found ${highPainPatients?.length || 0} patients`);
      highPainPatients?.forEach(p => {
        const painData = typeof p.pain_assessment === 'string'
          ? JSON.parse(p.pain_assessment)
          : p.pain_assessment;
        console.log(`     - Pain intensity: ${painData?.intensity || 'N/A'}`);
      });
    }

    // Test 3.2: Primary diagnosis query
    console.log('\n  3.2: Patients with specific primary diagnosis');
    const { data: diagnosisPatients, error: diagError } = await supabase
      .schema('api')
      .from('consultations')
      .select('patient_id, diagnosis')
      .not('diagnosis->>primary', 'is', null)
      .eq('status', 'completed')
      .limit(3);

    if (diagError) {
      console.log('  ⚠️ Query failed:', diagError.message);
    } else {
      console.log(`  ✅ Found ${diagnosisPatients?.length || 0} patients with primary diagnosis`);
      diagnosisPatients?.forEach(p => {
        const diagData = typeof p.diagnosis === 'string'
          ? JSON.parse(p.diagnosis)
          : p.diagnosis;
        console.log(`     - Primary diagnosis: ${diagData?.primary || 'N/A'}`);
      });
    }

    // Test 3.3: Treatment procedure query
    console.log('\n  3.3: Patients with root canal treatment');
    const { data: rootCanalPatients, error: treatmentError } = await supabase
      .schema('api')
      .from('consultations')
      .select('patient_id, treatment_plan')
      .ilike('treatment_plan->>procedure', '%root%canal%')
      .eq('status', 'completed')
      .limit(3);

    if (treatmentError) {
      console.log('  ⚠️ Query failed:', treatmentError.message);
    } else {
      console.log(`  ✅ Found ${rootCanalPatients?.length || 0} patients`);
      rootCanalPatients?.forEach(p => {
        const treatData = typeof p.treatment_plan === 'string'
          ? JSON.parse(p.treatment_plan)
          : p.treatment_plan;
        console.log(`     - Procedure: ${treatData?.procedure || 'N/A'}`);
      });
    }

    // =====================================================
    // TEST 4: Check if indexes exist
    // =====================================================
    console.log('\n📋 TEST 4: Checking JSONB indexes...');
    const { data: indexes, error: indexError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = 'api'
          AND tablename = 'consultations'
          AND indexname LIKE 'idx_consultations_%'
          ORDER BY indexname;
        `
      });

    if (indexError) {
      console.log('  ⚠️ Could not check indexes (may need custom RPC function)');
      console.log('  💡 To create indexes, run: sql/CREATE_JSONB_RESEARCH_INDEXES.sql');
    } else if (indexes && indexes.length > 0) {
      console.log(`  ✅ Found ${indexes.length} research indexes:`);
      indexes.forEach(idx => {
        console.log(`     - ${idx.indexname}`);
      });
    } else {
      console.log('  ⚠️ No research indexes found');
      console.log('  💡 Run sql/CREATE_JSONB_RESEARCH_INDEXES.sql to create performance indexes');
    }

    // =====================================================
    // SUMMARY & RECOMMENDATIONS
    // =====================================================
    console.log('\n📊 TEST SUMMARY:');
    console.log('================');

    const totalJSONBFields = Object.values(jsonbStats).reduce((a, b) => a + b, 0);
    const avgFieldsPerConsultation = totalJSONBFields / consultations.length;

    console.log(`✅ Consultations found: ${consultations.length}`);
    console.log(`📈 Avg JSONB fields per consultation: ${avgFieldsPerConsultation.toFixed(1)}/8`);

    if (avgFieldsPerConsultation < 3) {
      console.log('\n⚠️ WARNING: Low JSONB data population!');
      console.log('   Most consultations are missing detailed clinical data.');
      console.log('   Research filtering will have limited results.');
      console.log('\n💡 RECOMMENDATION:');
      console.log('   Create new consultations with complete data using Enhanced Consultation form.');
    } else {
      console.log('\n✅ Good JSONB data population!');
      console.log('   Research filtering should work well with available data.');
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Go to Dentist Dashboard → Research V2 (Advanced) tab');
    console.log('2. Create a new research project');
    console.log('3. Use JSONB filters (look for color-coded categories):');
    console.log('   - 🩹 Pain Assessment');
    console.log('   - 🔬 Diagnosis');
    console.log('   - 🦷 Treatment Plan');
    console.log('   - 🔍 Clinical Examination');
    console.log('   - 📋 Medical History');
    console.log('4. Test complex queries like:');
    console.log('   "Pain Intensity > 7 AND Primary Diagnosis contains Pulpitis"');
    console.log('5. Verify patient matching in Live Patient Matching panel');

    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testJSONBResearchFiltering();
