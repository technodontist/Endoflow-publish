// Inspect actual JSONB structure in consultations
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectConsultationData() {
  console.log('🔍 Inspecting Consultation JSONB Structure\n');

  const { data: consultations } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')
    .eq('status', 'completed')
    .limit(3);

  if (!consultations || consultations.length === 0) {
    console.log('No consultations found');
    return;
  }

  consultations.forEach((c, i) => {
    console.log(`\n=== CONSULTATION ${i + 1} ===`);
    console.log(`Patient ID: ${c.patient_id?.substring(0, 8)}...`);
    console.log(`Date: ${c.consultation_date}\n`);

    // Show raw JSONB strings
    console.log('📋 DIAGNOSIS (raw):');
    console.log(c.diagnosis);
    console.log('\n🩹 PAIN ASSESSMENT (raw):');
    console.log(c.pain_assessment);
    console.log('\n🦷 TREATMENT PLAN (raw):');
    console.log(c.treatment_plan);
    console.log('\n🔍 CLINICAL EXAMINATION (raw):');
    console.log(c.clinical_examination);
    console.log('\n📊 INVESTIGATIONS (raw):');
    console.log(c.investigations);
    console.log('\n💊 PRESCRIPTION DATA (raw):');
    console.log(c.prescription_data);
    console.log('\n📅 FOLLOW-UP DATA (raw):');
    console.log(c.follow_up_data);

    // Parse and show structure
    if (c.diagnosis) {
      try {
        const parsed = typeof c.diagnosis === 'string' ? JSON.parse(c.diagnosis) : c.diagnosis;
        console.log('\n✅ Parsed Diagnosis Structure:');
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('\n❌ Failed to parse diagnosis');
      }
    }

    if (c.pain_assessment) {
      try {
        const parsed = typeof c.pain_assessment === 'string' ? JSON.parse(c.pain_assessment) : c.pain_assessment;
        console.log('\n✅ Parsed Pain Assessment Structure:');
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('\n❌ Failed to parse pain_assessment');
      }
    }
  });
}

inspectConsultationData();
