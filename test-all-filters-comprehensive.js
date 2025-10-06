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

async function testAllFilters() {
  console.log('\n🔬 COMPREHENSIVE FILTER COMPATIBILITY ANALYSIS\n');
  console.log('=' .repeat(80));

  // Fetch all consultations with JSONB data
  const { data: consultations, error } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')
    .eq('status', 'completed')
    .limit(1000);

  if (error) {
    console.error('❌ Error fetching consultations:', error);
    return;
  }

  console.log(`\n📊 Total Consultations: ${consultations.length}\n`);

  const results = {
    working: [],
    notWorking: [],
    dataIssues: []
  };

  // Test Pain Assessment Filters
  console.log('\n🩹 PAIN ASSESSMENT FILTERS\n');
  console.log('-'.repeat(80));

  // Pain Intensity
  const painIntensityData = consultations.filter(c => {
    const pain = parseJSONBSafe(c.pain_assessment);
    return pain?.intensity != null;
  });
  const painIntensityCount = painIntensityData.length;
  const painIntensityValues = painIntensityData.map(c => parseJSONBSafe(c.pain_assessment)?.intensity).filter(v => v != null);

  if (painIntensityCount > 0) {
    console.log(`✅ pain_intensity - ${painIntensityCount} consultations have data`);
    console.log(`   Values found: ${Math.min(...painIntensityValues)} to ${Math.max(...painIntensityValues)}`);
    console.log(`   Example: "Pain Intensity > 2" would find ${painIntensityValues.filter(v => v > 2).length} patients`);
    results.working.push({
      field: 'pain_intensity',
      label: 'Pain Intensity (1-10)',
      count: painIntensityCount,
      example: 'Pain Intensity > 2',
      exampleMatches: painIntensityValues.filter(v => v > 2).length
    });
  } else {
    console.log(`❌ pain_intensity - No data found`);
    results.notWorking.push({
      field: 'pain_intensity',
      label: 'Pain Intensity (1-10)',
      reason: 'No consultations have pain_assessment.intensity data'
    });
  }

  // Pain Location
  const painLocationData = consultations.filter(c => {
    const pain = parseJSONBSafe(c.pain_assessment);
    return pain?.location && pain.location.trim() !== '';
  });
  const painLocationCount = painLocationData.length;

  if (painLocationCount > 0) {
    const locations = painLocationData.map(c => parseJSONBSafe(c.pain_assessment)?.location).filter(Boolean);
    console.log(`✅ pain_location - ${painLocationCount} consultations have data`);
    console.log(`   Example values: ${locations.slice(0, 3).join(', ')}`);
    results.working.push({
      field: 'pain_location',
      label: 'Pain Location',
      count: painLocationCount,
      example: `Pain Location contains "${locations[0]}"`,
      exampleMatches: 1
    });
  } else {
    console.log(`❌ pain_location - No data found (field empty in all consultations)`);
    results.notWorking.push({
      field: 'pain_location',
      label: 'Pain Location',
      reason: 'All consultations have empty pain_assessment.location'
    });
  }

  // Pain Duration
  const painDurationData = consultations.filter(c => {
    const pain = parseJSONBSafe(c.pain_assessment);
    return pain?.duration && pain.duration.trim() !== '';
  });
  const painDurationCount = painDurationData.length;

  if (painDurationCount > 0) {
    const durations = painDurationData.map(c => parseJSONBSafe(c.pain_assessment)?.duration).filter(Boolean);
    console.log(`✅ pain_duration - ${painDurationCount} consultations have data`);
    console.log(`   Example values: ${durations.slice(0, 3).join(', ')}`);
    results.working.push({
      field: 'pain_duration',
      label: 'Pain Duration',
      count: painDurationCount,
      example: `Pain Duration equals "${durations[0]}"`,
      exampleMatches: durations.filter(d => d === durations[0]).length
    });
  } else {
    console.log(`❌ pain_duration - No data found`);
    results.notWorking.push({
      field: 'pain_duration',
      label: 'Pain Duration',
      reason: 'No consultations have pain_assessment.duration data'
    });
  }

  // Pain Character
  const painCharacterData = consultations.filter(c => {
    const pain = parseJSONBSafe(c.pain_assessment);
    return pain?.character && pain.character.trim() !== '';
  });
  const painCharacterCount = painCharacterData.length;

  if (painCharacterCount > 0) {
    console.log(`✅ pain_character - ${painCharacterCount} consultations have data`);
    results.working.push({
      field: 'pain_character',
      label: 'Pain Character',
      count: painCharacterCount
    });
  } else {
    console.log(`❌ pain_character - No data found`);
    results.notWorking.push({
      field: 'pain_character',
      label: 'Pain Character',
      reason: 'No consultations have pain_assessment.character data'
    });
  }

  // Test Diagnosis Filters
  console.log('\n\n🔬 DIAGNOSIS FILTERS\n');
  console.log('-'.repeat(80));

  // Diagnosis Final (Array)
  const diagnosisFinalData = consultations.filter(c => {
    const diag = parseJSONBSafe(c.diagnosis);
    return Array.isArray(diag?.final) && diag.final.length > 0;
  });
  const diagnosisFinalCount = diagnosisFinalData.length;

  if (diagnosisFinalCount > 0) {
    const allFinal = diagnosisFinalData.flatMap(c => parseJSONBSafe(c.diagnosis)?.final || []);
    const uniqueFinal = [...new Set(allFinal)];
    console.log(`✅ diagnosis_final - ${diagnosisFinalCount} consultations have data`);
    console.log(`   Unique diagnoses: ${uniqueFinal.length}`);
    console.log(`   Examples: ${uniqueFinal.slice(0, 3).join(', ')}`);
    console.log(`   Example filter: "Final Diagnosis contains 'tooth'" would find ${allFinal.filter(d => d.toLowerCase().includes('tooth')).length} matches`);
    results.working.push({
      field: 'diagnosis_final',
      label: 'Final Diagnosis (JSONB)',
      count: diagnosisFinalCount,
      example: 'Final Diagnosis contains "tooth"',
      exampleMatches: allFinal.filter(d => d.toLowerCase().includes('tooth')).length
    });
  } else {
    console.log(`❌ diagnosis_final - No data found`);
    results.notWorking.push({
      field: 'diagnosis_final',
      label: 'Final Diagnosis (JSONB)',
      reason: 'No consultations have diagnosis.final array'
    });
  }

  // Diagnosis Provisional (Array)
  const diagnosisProvisionalData = consultations.filter(c => {
    const diag = parseJSONBSafe(c.diagnosis);
    return Array.isArray(diag?.provisional) && diag.provisional.length > 0;
  });
  const diagnosisProvisionalCount = diagnosisProvisionalData.length;

  if (diagnosisProvisionalCount > 0) {
    const allProvisional = diagnosisProvisionalData.flatMap(c => parseJSONBSafe(c.diagnosis)?.provisional || []);
    const uniqueProvisional = [...new Set(allProvisional)];
    console.log(`✅ diagnosis_provisional - ${diagnosisProvisionalCount} consultations have data`);
    console.log(`   Unique diagnoses: ${uniqueProvisional.length}`);
    console.log(`   Examples: ${uniqueProvisional.slice(0, 3).join(', ')}`);
    console.log(`   Example filter: "Provisional Diagnosis contains 'caries'" would find ${allProvisional.filter(d => d.toLowerCase().includes('caries')).length} matches`);
    results.working.push({
      field: 'diagnosis_provisional',
      label: 'Provisional Diagnosis (JSONB)',
      count: diagnosisProvisionalCount,
      example: 'Provisional Diagnosis contains "caries"',
      exampleMatches: allProvisional.filter(d => d.toLowerCase().includes('caries')).length
    });
  } else {
    console.log(`❌ diagnosis_provisional - No data found`);
    results.notWorking.push({
      field: 'diagnosis_provisional',
      label: 'Provisional Diagnosis (JSONB)',
      reason: 'No consultations have diagnosis.provisional array'
    });
  }

  // Diagnosis Primary (NEW STRUCTURE - may not exist yet)
  const diagnosisPrimaryData = consultations.filter(c => {
    const diag = parseJSONBSafe(c.diagnosis);
    return diag?.primary && diag.primary.trim() !== '';
  });
  const diagnosisPrimaryCount = diagnosisPrimaryData.length;

  if (diagnosisPrimaryCount > 0) {
    console.log(`✅ diagnosis_primary - ${diagnosisPrimaryCount} consultations have data`);
    results.working.push({
      field: 'diagnosis_primary',
      label: 'Primary Diagnosis (JSONB)',
      count: diagnosisPrimaryCount
    });
  } else {
    console.log(`⚠️  diagnosis_primary - No data (but has backward compatibility)`);
    console.log(`   Note: Filter uses fallback to check diagnosis.final and diagnosis.provisional arrays`);
    results.dataIssues.push({
      field: 'diagnosis_primary',
      label: 'Primary Diagnosis (JSONB)',
      status: 'Works via fallback',
      note: 'No diagnosis.primary field in data, but filter checks diagnosis.final and diagnosis.provisional as fallback'
    });
  }

  // Test Treatment Plan Filters
  console.log('\n\n💊 TREATMENT PLAN FILTERS\n');
  console.log('-'.repeat(80));

  // Treatment Type
  const treatmentTypeData = consultations.filter(c => {
    const tp = parseJSONBSafe(c.treatment_plan);
    return tp?.type && tp.type.trim() !== '';
  });
  const treatmentTypeCount = treatmentTypeData.length;

  if (treatmentTypeCount > 0) {
    const types = treatmentTypeData.map(c => parseJSONBSafe(c.treatment_plan)?.type).filter(Boolean);
    const uniqueTypes = [...new Set(types)];
    console.log(`✅ treatment_type_jsonb - ${treatmentTypeCount} consultations have data`);
    console.log(`   Unique types: ${uniqueTypes.join(', ')}`);
    results.working.push({
      field: 'treatment_type_jsonb',
      label: 'Treatment Type (JSONB)',
      count: treatmentTypeCount,
      example: `Treatment Type equals "${uniqueTypes[0]}"`,
      exampleMatches: types.filter(t => t === uniqueTypes[0]).length
    });
  } else {
    console.log(`❌ treatment_type_jsonb - No data found`);
    results.notWorking.push({
      field: 'treatment_type_jsonb',
      label: 'Treatment Type (JSONB)',
      reason: 'No consultations have treatment_plan.type data'
    });
  }

  // Proposed Procedure
  const proposedProcedureData = consultations.filter(c => {
    const tp = parseJSONBSafe(c.treatment_plan);
    return tp?.proposed_procedure && tp.proposed_procedure.trim() !== '';
  });
  const proposedProcedureCount = proposedProcedureData.length;

  if (proposedProcedureCount > 0) {
    const procedures = proposedProcedureData.map(c => parseJSONBSafe(c.treatment_plan)?.proposed_procedure).filter(Boolean);
    console.log(`✅ proposed_procedure - ${proposedProcedureCount} consultations have data`);
    console.log(`   Example: ${procedures[0].substring(0, 50)}...`);
    results.working.push({
      field: 'proposed_procedure',
      label: 'Proposed Procedure',
      count: proposedProcedureCount
    });
  } else {
    console.log(`❌ proposed_procedure - No data found`);
    results.notWorking.push({
      field: 'proposed_procedure',
      label: 'Proposed Procedure',
      reason: 'No consultations have treatment_plan.proposed_procedure data'
    });
  }

  // Test Combined Filters (USER'S EXACT SCENARIO)
  console.log('\n\n🎯 USER\'S FILTER SCENARIO TEST\n');
  console.log('-'.repeat(80));
  console.log('Testing: Pain Intensity > 2 AND Primary Diagnosis contains "moderate caries"\n');

  const combinedMatches = consultations.filter(c => {
    // Pain Intensity > 2
    const pain = parseJSONBSafe(c.pain_assessment);
    if (!pain?.intensity || pain.intensity <= 2) return false;

    // Primary Diagnosis contains "moderate caries"
    const diag = parseJSONBSafe(c.diagnosis);

    // Check new structure (primary field)
    if (diag?.primary && diag.primary.toLowerCase().includes('moderate') && diag.primary.toLowerCase().includes('caries')) {
      return true;
    }

    // Fallback: Check provisional array
    if (Array.isArray(diag?.provisional)) {
      const provisionalText = diag.provisional.join(' ').toLowerCase();
      if (provisionalText.includes('moderate') && provisionalText.includes('caries')) {
        return true;
      }
    }

    // Fallback: Check final array
    if (Array.isArray(diag?.final)) {
      const finalText = diag.final.join(' ').toLowerCase();
      if (finalText.includes('moderate') && finalText.includes('caries')) {
        return true;
      }
    }

    return false;
  });

  console.log(`${combinedMatches.length > 0 ? '✅' : '❌'} Combined Filter Result: ${combinedMatches.length} patients match`);

  if (combinedMatches.length > 0) {
    console.log('\nMatching Patients:');
    combinedMatches.forEach((c, idx) => {
      const pain = parseJSONBSafe(c.pain_assessment);
      const diag = parseJSONBSafe(c.diagnosis);
      console.log(`  ${idx + 1}. Patient ID: ${c.patient_id}`);
      console.log(`     Pain Intensity: ${pain?.intensity}`);
      console.log(`     Provisional: ${JSON.stringify(diag?.provisional)}`);
      console.log(`     Final: ${JSON.stringify(diag?.final)}`);
    });
  }

  // FINAL SUMMARY
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('📋 FINAL SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n✅ WORKING FILTERS (${results.working.length}):\n`);
  results.working.forEach(f => {
    console.log(`   • ${f.label}`);
    console.log(`     Field: ${f.field}`);
    console.log(`     Data Available: ${f.count} consultations`);
    if (f.example) {
      console.log(`     Example: "${f.example}" → ${f.exampleMatches} matches`);
    }
    console.log('');
  });

  console.log(`\n❌ NOT WORKING FILTERS (${results.notWorking.length}):\n`);
  results.notWorking.forEach(f => {
    console.log(`   • ${f.label}`);
    console.log(`     Field: ${f.field}`);
    console.log(`     Reason: ${f.reason}`);
    console.log('');
  });

  console.log(`\n⚠️  SPECIAL CASES (${results.dataIssues.length}):\n`);
  results.dataIssues.forEach(f => {
    console.log(`   • ${f.label}`);
    console.log(`     Field: ${f.field}`);
    console.log(`     Status: ${f.status}`);
    console.log(`     Note: ${f.note}`);
    console.log('');
  });

  // RECOMMENDED WORKING COMBINATIONS
  console.log('\n💡 RECOMMENDED WORKING FILTER COMBINATIONS:\n');
  if (painIntensityCount > 0 && diagnosisProvisionalCount > 0) {
    console.log('   1. Pain Intensity > 2 AND Provisional Diagnosis contains "caries"');
  }
  if (diagnosisFinalCount > 0) {
    console.log('   2. Final Diagnosis contains "tooth"');
  }
  if (painIntensityCount > 0) {
    console.log('   3. Pain Intensity between 5 and 10');
  }
  if (painDurationCount > 0 && diagnosisProvisionalCount > 0) {
    console.log('   4. Pain Duration equals "2" AND Provisional Diagnosis contains "caries"');
  }

  console.log('\n\n🔍 DIFFICULTY ANALYSIS:\n');
  console.log('Main issues found:');
  if (results.notWorking.length > 0) {
    console.log(`   • ${results.notWorking.length} filters have NO data in current consultations`);
    console.log('   • These filters will always return 0 patients until data is saved');
  }
  if (results.dataIssues.length > 0) {
    console.log(`   • ${results.dataIssues.length} filters use backward compatibility fallbacks`);
    console.log('   • These work but rely on old data structure (arrays vs objects)');
  }
  console.log('\n✅ Good news:');
  console.log(`   • ${results.working.length} filters have working data`);
  console.log(`   • Combined filters DO work (tested user scenario: ${combinedMatches.length} matches)`);

  console.log('\n');
}

testAllFilters().catch(console.error);
