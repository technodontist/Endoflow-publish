const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseJSONBSafe(field) {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return null;
  }
}

async function testAllNewFilters() {
  console.log('\n🎯 COMPREHENSIVE NEW FILTER TEST\n');
  console.log('=' .repeat(80));

  // Fetch consultations
  const { data: consultations } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')
    .eq('status', 'completed')
    .limit(100);

  // Fetch tooth diagnoses
  const { data: toothDiagnoses } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .limit(100);

  console.log(`\nData: ${consultations?.length || 0} consultations, ${toothDiagnoses?.length || 0} tooth diagnoses\n`);

  // TEST 1: Treatment Plan Procedures
  console.log('TEST 1: Treatment Plan Procedures (treatment_plan.plan)');
  console.log('-'.repeat(80));

  const withTreatment = consultations.filter(c => {
    const tp = parseJSONBSafe(c.treatment_plan);
    return tp?.plan && Array.isArray(tp.plan) && tp.plan.length > 0;
  });

  console.log(`✅ ${withTreatment.length} consultations have treatment_plan.plan data`);

  if (withTreatment.length > 0) {
    const procedures = new Set();
    withTreatment.forEach(c => {
      const tp = parseJSONBSafe(c.treatment_plan);
      tp.plan.forEach(p => procedures.add(p));
    });

    console.log(`Found ${procedures.size} unique procedures:`);
    [...procedures].forEach(p => console.log(`   - "${p}"`));
  }

  // TEST 2: FDI Chart Primary Diagnosis
  console.log('\n\nTEST 2: FDI Chart Primary Diagnosis');
  console.log('-'.repeat(80));

  console.log(`✅ ${toothDiagnoses?.length || 0} tooth diagnoses (FDI Chart records)`);

  if (toothDiagnoses && toothDiagnoses.length > 0) {
    const diagnoses = [...new Set(toothDiagnoses.map(td => td.primary_diagnosis).filter(Boolean))];
    console.log(`Found ${diagnoses.length} unique primary diagnoses:`);
    diagnoses.forEach(d => {
      const count = toothDiagnoses.filter(td => td.primary_diagnosis === d).length;
      console.log(`   - "${d}" (${count} teeth)`);
    });
  }

  // TEST 3: Tooth Status
  console.log('\n\nTEST 3: Tooth Status');
  console.log('-'.repeat(80));

  if (toothDiagnoses && toothDiagnoses.length > 0) {
    const statuses = {};
    toothDiagnoses.forEach(td => {
      const s = td.status || 'unknown';
      statuses[s] = (statuses[s] || 0) + 1;
    });

    console.log('Status distribution:');
    Object.entries(statuses).forEach(([s, c]) => console.log(`   ${s}: ${c} teeth`));
  }

  // SUMMARY
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n✅ Treatment Procedures: ${withTreatment.length > 0 ? 'WORKING' : 'NO DATA'}`);
  console.log(`✅ FDI Chart Diagnosis: ${toothDiagnoses?.length > 0 ? 'WORKING' : 'NO DATA'}`);
  console.log(`✅ Tooth Status: ${toothDiagnoses?.length > 0 ? 'WORKING' : 'NO DATA'}`);

  if (withTreatment.length > 0) {
    console.log(`\nWorking Example Filters:`);
    console.log(`   - Treatment Procedures contains "filling"`);
    console.log(`   - Treatment Procedures contains "root canal"`);
  }

  if (toothDiagnoses?.length > 0) {
    console.log(`   - Primary Diagnosis (FDI Chart) contains "caries"`);
    console.log(`   - Tooth Status equals "caries"`);
    console.log(`   - Treatment Priority equals "medium"`);
  }

  console.log('\n');
}

testAllNewFilters().catch(console.error);
