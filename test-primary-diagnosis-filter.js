// Test Primary Diagnosis filter with your exact criteria
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simulate the exact filter logic
function parseJSONBSafe(field) {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return null;
  }
}

function applyStringFilterInMemory(fieldValue, operator, filterValue) {
  const value = (fieldValue || '').toString().toLowerCase();
  const filter = (filterValue || '').toString().toLowerCase();

  if (operator === 'contains') {
    return value.includes(filter);
  }
  return false;
}

function applyNumericFilterInMemory(fieldValue, operator, filterValue) {
  const value = Number(fieldValue) || 0;
  const filter = Number(filterValue) || 0;

  if (operator === 'greater_than') {
    return value > filter;
  }
  return false;
}

async function testExactFilters() {
  console.log('🧪 Testing Your Exact Filter Combination:\n');
  console.log('Filter 1: Pain Intensity > 2');
  console.log('Filter 2: Primary Diagnosis contains "moderate caries"\n');

  const { data: consultations } = await supabase
    .schema('api')
    .from('consultations')
    .select('patient_id, pain_assessment, diagnosis')
    .eq('status', 'completed');

  if (!consultations) {
    console.log('No consultations found');
    return;
  }

  let matches = [];

  consultations.forEach(c => {
    const painData = parseJSONBSafe(c.pain_assessment);
    const diagnosisData = parseJSONBSafe(c.diagnosis);

    // Filter 1: Pain Intensity > 2
    const painMatch = applyNumericFilterInMemory(painData?.intensity, 'greater_than', 2);

    // Filter 2: Primary Diagnosis contains "moderate caries"
    // Using the new fallback logic
    let diagMatch = false;

    // Try primary field
    if (diagnosisData?.primary) {
      diagMatch = applyStringFilterInMemory(diagnosisData.primary, 'contains', 'moderate caries');
    }

    // Fallback 1: final array
    if (!diagMatch && Array.isArray(diagnosisData?.final) && diagnosisData.final.length > 0) {
      const finalText = diagnosisData.final.join(' ');
      diagMatch = applyStringFilterInMemory(finalText, 'contains', 'moderate caries');
    }

    // Fallback 2: provisional array
    if (!diagMatch && Array.isArray(diagnosisData?.provisional) && diagnosisData.provisional.length > 0) {
      const provisionalText = diagnosisData.provisional.join(' ');
      diagMatch = applyStringFilterInMemory(provisionalText, 'contains', 'moderate caries');
    }

    if (painMatch && diagMatch) {
      matches.push({
        patientId: c.patient_id,
        pain: painData?.intensity,
        diagnosis: diagnosisData
      });
    }
  });

  console.log(`✅ Found ${matches.length} matching patients:\n`);

  matches.forEach((m, i) => {
    console.log(`Patient ${i + 1}:`);
    console.log(`  ID: ${m.patientId.substring(0, 8)}...`);
    console.log(`  Pain Intensity: ${m.pain}`);
    console.log(`  Final Diagnosis: ${m.diagnosis?.final?.join(', ') || 'None'}`);
    console.log(`  Provisional Diagnosis: ${m.diagnosis?.provisional?.join(', ') || 'None'}`);
    console.log('');
  });

  if (matches.length === 0) {
    console.log('⚠️ NO MATCHES FOUND\n');
    console.log('Possible reasons:');
    console.log('1. Search term "moderate caries" is too specific');
    console.log('2. Try just "moderate" or just "caries"\n');

    // Show what would match with just "moderate"
    let moderateMatches = consultations.filter(c => {
      const painData = parseJSONBSafe(c.pain_assessment);
      const diagnosisData = parseJSONBSafe(c.diagnosis);
      const painMatch = applyNumericFilterInMemory(painData?.intensity, 'greater_than', 2);

      let diagMatch = false;
      if (Array.isArray(diagnosisData?.provisional)) {
        diagMatch = diagnosisData.provisional.join(' ').toLowerCase().includes('moderate');
      }
      if (!diagMatch && Array.isArray(diagnosisData?.final)) {
        diagMatch = diagnosisData.final.join(' ').toLowerCase().includes('moderate');
      }

      return painMatch && diagMatch;
    });

    console.log(`💡 If you search for just "moderate" instead:`);
    console.log(`   ${moderateMatches.length} patients would match!\n`);
  }
}

testExactFilters();
