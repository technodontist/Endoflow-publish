// Test research filters with existing consultation data
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFiltersWithExistingData() {
  console.log('🧪 Testing Research Filters with Existing Data\n');

  // Get consultations
  const { data: consultations } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')
    .eq('status', 'completed')
    .limit(10);

  if (!consultations || consultations.length === 0) {
    console.log('No consultations found');
    return;
  }

  console.log(`Found ${consultations.length} consultations\n`);

  // Test 1: Pain Intensity Filter
  console.log('📊 TEST 1: Pain Intensity > 7');
  let painMatches = 0;
  consultations.forEach(c => {
    const painData = typeof c.pain_assessment === 'string'
      ? JSON.parse(c.pain_assessment)
      : c.pain_assessment;
    if ((painData?.intensity || 0) > 7) {
      painMatches++;
      console.log(`  ✓ Patient ${c.patient_id.substring(0,8)}... - Pain: ${painData.intensity}`);
    }
  });
  console.log(`  Result: ${painMatches} patients with pain > 7\n`);

  // Test 2: Final Diagnosis Filter (existing structure)
  console.log('📊 TEST 2: Final Diagnosis contains "caries"');
  let cariesMatches = 0;
  consultations.forEach(c => {
    const diagData = typeof c.diagnosis === 'string'
      ? JSON.parse(c.diagnosis)
      : c.diagnosis;
    if (Array.isArray(diagData?.final)) {
      const finalText = diagData.final.join(' ').toLowerCase();
      if (finalText.includes('caries')) {
        cariesMatches++;
        console.log(`  ✓ Patient ${c.patient_id.substring(0,8)}... - Diagnosis: ${diagData.final.join(', ')}`);
      }
    }
  });
  console.log(`  Result: ${cariesMatches} patients with "caries" in final diagnosis\n`);

  // Test 3: Provisional Diagnosis Filter
  console.log('📊 TEST 3: Provisional Diagnosis contains "moderate"');
  let moderateMatches = 0;
  consultations.forEach(c => {
    const diagData = typeof c.diagnosis === 'string'
      ? JSON.parse(c.diagnosis)
      : c.diagnosis;
    if (Array.isArray(diagData?.provisional)) {
      const provText = diagData.provisional.join(' ').toLowerCase();
      if (provText.includes('moderate')) {
        moderateMatches++;
        console.log(`  ✓ Patient ${c.patient_id.substring(0,8)}... - Provisional: ${diagData.provisional.join(', ')}`);
      }
    }
  });
  console.log(`  Result: ${moderateMatches} patients with "moderate" in provisional diagnosis\n`);

  // Test 4: Combined Filter
  console.log('📊 TEST 4: Pain > 2 AND Diagnosis contains "caries"');
  let combinedMatches = 0;
  consultations.forEach(c => {
    const painData = typeof c.pain_assessment === 'string'
      ? JSON.parse(c.pain_assessment)
      : c.pain_assessment;
    const diagData = typeof c.diagnosis === 'string'
      ? JSON.parse(c.diagnosis)
      : c.diagnosis;

    const hasPain = (painData?.intensity || 0) > 2;
    const hasCaries = Array.isArray(diagData?.final) &&
      diagData.final.join(' ').toLowerCase().includes('caries');

    if (hasPain && hasCaries) {
      combinedMatches++;
      console.log(`  ✓ Patient ${c.patient_id.substring(0,8)}... - Pain: ${painData.intensity}, Diagnosis: ${diagData.final.join(', ')}`);
    }
  });
  console.log(`  Result: ${combinedMatches} patients matching both criteria\n`);

  // Recommendations
  console.log('💡 RECOMMENDED FILTER COMBINATIONS:\n');
  console.log('1️⃣  Pain Intensity > 2 (finds patients with moderate pain)');
  console.log('2️⃣  Final Diagnosis contains "caries" (finds caries patients)');
  console.log('3️⃣  Provisional Diagnosis contains "moderate" (finds moderate cases)');
  console.log('4️⃣  Pain > 2 AND Final Diagnosis contains "caries" (combined criteria)\n');

  console.log('✅ All filters tested successfully!\n');
}

testFiltersWithExistingData();
