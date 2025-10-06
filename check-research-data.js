// Quick diagnostic script to check why research filtering isn't finding patients
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseResearchFiltering() {
  console.log('🔍 Diagnosing Research Filtering Issues\n');

  try {
    // 1. Check total patients
    const { data: allPatients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, date_of_birth')
      .limit(10);

    if (patientsError) {
      console.error('❌ Error fetching patients:', patientsError.message);
      return;
    }

    console.log(`✅ Total patients in database: ${allPatients?.length || 0}`);

    if (!allPatients || allPatients.length === 0) {
      console.log('\n⚠️ NO PATIENTS FOUND!');
      console.log('📝 You need to create patients first:');
      console.log('   1. Go to Assistant Dashboard → Register Patient');
      console.log('   2. Create at least 2-3 test patients\n');
      return;
    }

    // 2. Check consultations
    const { data: consultations, error: consultError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .eq('status', 'completed')
      .limit(10);

    if (consultError) {
      console.error('❌ Error fetching consultations:', consultError.message);
      return;
    }

    console.log(`✅ Completed consultations: ${consultations?.length || 0}\n`);

    if (!consultations || consultations.length === 0) {
      console.log('⚠️ NO COMPLETED CONSULTATIONS FOUND!');
      console.log('\n📝 This is why research filtering shows 0 patients.');
      console.log('\n🔧 SOLUTION:');
      console.log('   1. Login as Dr. Nisarg (dr.nisarg@endoflow.com / endoflow123)');
      console.log('   2. Go to Enhanced Consultation tab');
      console.log('   3. Select a patient');
      console.log('   4. Fill out a COMPLETE consultation with:');
      console.log('      ✓ Primary Diagnosis (e.g., "moderate caries")');
      console.log('      ✓ Pain Intensity (e.g., 7)');
      console.log('      ✓ Treatment Plan');
      console.log('      ✓ All other fields');
      console.log('   5. Save consultation with status = "completed"');
      console.log('   6. Repeat for 2-3 more patients\n');
      console.log('   Then your research filters will work!\n');
      return;
    }

    // 3. Analyze consultation data quality
    console.log('📊 Analyzing consultation data quality:\n');

    consultations.forEach((c, index) => {
      console.log(`Consultation ${index + 1}:`);
      console.log(`  Patient ID: ${c.patient_id?.substring(0, 8)}...`);
      console.log(`  Date: ${c.consultation_date}`);

      // Check JSONB fields
      const hasData = {
        diagnosis: !!c.diagnosis,
        pain_assessment: !!c.pain_assessment,
        treatment_plan: !!c.treatment_plan,
        clinical_examination: !!c.clinical_examination,
        medical_history: !!c.medical_history
      };

      console.log(`  Has Diagnosis: ${hasData.diagnosis ? '✓' : '✗'}`);
      console.log(`  Has Pain Assessment: ${hasData.pain_assessment ? '✓' : '✗'}`);
      console.log(`  Has Treatment Plan: ${hasData.treatment_plan ? '✓' : '✗'}`);

      // Parse and show actual values
      if (c.diagnosis) {
        try {
          const diagData = typeof c.diagnosis === 'string' ? JSON.parse(c.diagnosis) : c.diagnosis;
          console.log(`  ➜ Primary Diagnosis: "${diagData?.primary || 'N/A'}"`);
        } catch (e) {
          console.log(`  ➜ Primary Diagnosis: (parsing error)`);
        }
      }

      if (c.pain_assessment) {
        try {
          const painData = typeof c.pain_assessment === 'string' ? JSON.parse(c.pain_assessment) : c.pain_assessment;
          console.log(`  ➜ Pain Intensity: ${painData?.intensity || 'N/A'}`);
        } catch (e) {
          console.log(`  ➜ Pain Intensity: (parsing error)`);
        }
      }

      console.log('');
    });

    // 4. Test your specific filter
    console.log('\n🧪 Testing your filter criteria:\n');
    console.log('Filter 1: Primary Diagnosis = "moderate caries"');
    console.log('Filter 2: Pain Intensity > 7\n');

    // Test diagnosis filter
    const { data: diagnosisMatches } = await supabase
      .schema('api')
      .from('consultations')
      .select('patient_id, diagnosis')
      .eq('status', 'completed')
      .not('diagnosis', 'is', null);

    let diagnosisMatchCount = 0;
    if (diagnosisMatches) {
      diagnosisMatchCount = diagnosisMatches.filter(c => {
        try {
          const diagData = typeof c.diagnosis === 'string' ? JSON.parse(c.diagnosis) : c.diagnosis;
          const primary = (diagData?.primary || '').toLowerCase();
          return primary.includes('moderate') && primary.includes('caries');
        } catch {
          return false;
        }
      }).length;
    }

    console.log(`Patients with "moderate caries" diagnosis: ${diagnosisMatchCount}`);

    // Test pain filter
    const { data: painMatches } = await supabase
      .schema('api')
      .from('consultations')
      .select('patient_id, pain_assessment')
      .eq('status', 'completed')
      .not('pain_assessment', 'is', null);

    let painMatchCount = 0;
    if (painMatches) {
      painMatchCount = painMatches.filter(c => {
        try {
          const painData = typeof c.pain_assessment === 'string' ? JSON.parse(c.pain_assessment) : c.pain_assessment;
          return (painData?.intensity || 0) > 7;
        } catch {
          return false;
        }
      }).length;
    }

    console.log(`Patients with pain intensity > 7: ${painMatchCount}`);

    // Final recommendation
    console.log('\n💡 RECOMMENDATIONS:\n');

    if (diagnosisMatchCount === 0 && painMatchCount === 0) {
      console.log('❌ No patients match your filter criteria!');
      console.log('\n📝 To fix this:');
      console.log('   Option 1: Create consultations that match your filters');
      console.log('      - Diagnosis containing "moderate caries"');
      console.log('      - Pain intensity 8, 9, or 10');
      console.log('\n   Option 2: Adjust your filters to match existing data');
      console.log('      - Try broader criteria (e.g., "caries" instead of "moderate caries")');
      console.log('      - Lower pain threshold (e.g., > 5 instead of > 7)');
    } else if (diagnosisMatchCount === 0) {
      console.log('⚠️ No patients with "moderate caries" diagnosis');
      console.log('   Try changing diagnosis filter to match existing data');
    } else if (painMatchCount === 0) {
      console.log('⚠️ No patients with pain intensity > 7');
      console.log('   Try lowering pain threshold or creating patients with higher pain');
    } else {
      console.log('✅ Both filters have matches individually!');
      console.log('   But combined with AND logic, they may not overlap.');
      console.log('   Check if the same patients match BOTH criteria.');
    }

    console.log('\n✅ Diagnosis complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

diagnoseResearchFiltering();
