const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Color mapping based on tooth status
const STATUS_COLOR_MAP = {
  'healthy': '#22c55e',      // Green
  'caries': '#ef4444',       // Red
  'filled': '#3b82f6',       // Blue
  'crown': '#eab308',        // Yellow
  'missing': '#6b7280',      // Gray
  'attention': '#f97316',    // Orange
  'extraction_needed': '#f97316', // Orange
  'root_canal': '#8b5cf6',   // Purple
  'implant': '#06b6d4'       // Cyan
};

// Treatment to status mapping
const TREATMENT_STATUS_MAP = {
  'root canal': 'root_canal',
  'rct': 'root_canal',
  'filling': 'filled',
  'restoration': 'filled',
  'composite': 'filled',
  'amalgam': 'filled',
  'crown': 'crown',
  'onlay': 'crown',
  'cap': 'crown',
  'extraction': 'missing',
  'implant': 'implant',
  'scaling': 'healthy',
  'polishing': 'healthy',
  'periodontal': 'attention'
};

function getExpectedStatusFromTreatment(treatment) {
  if (!treatment) return null;
  const treatmentLower = treatment.toLowerCase();
  
  for (const [key, status] of Object.entries(TREATMENT_STATUS_MAP)) {
    if (treatmentLower.includes(key)) {
      return status;
    }
  }
  
  return null;
}

async function auditAndFixToothColors() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔍 Auditing tooth diagnoses for color mismatches...\n');
    
    // Fetch all tooth diagnoses
    const { data: allTeeth, error: fetchError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error fetching tooth data:', fetchError);
      return;
    }
    
    console.log(`📊 Found ${allTeeth.length} total tooth diagnosis records\n`);
    
    const issues = [];
    const treatmentMismatches = [];
    
    // Check each tooth for issues
    for (const tooth of allTeeth) {
      const expectedColor = STATUS_COLOR_MAP[tooth.status];
      
      // Check color mismatch
      if (expectedColor && tooth.color_code !== expectedColor) {
        issues.push({
          id: tooth.id,
          tooth_number: tooth.tooth_number,
          patient_id: tooth.patient_id,
          status: tooth.status,
          current_color: tooth.color_code,
          expected_color: expectedColor,
          treatment: tooth.recommended_treatment
        });
      }
      
      // Check if treatment suggests a different status
      if (tooth.recommended_treatment) {
        const expectedStatus = getExpectedStatusFromTreatment(tooth.recommended_treatment);
        if (expectedStatus && expectedStatus !== tooth.status) {
          treatmentMismatches.push({
            id: tooth.id,
            tooth_number: tooth.tooth_number,
            patient_id: tooth.patient_id,
            current_status: tooth.status,
            expected_status: expectedStatus,
            treatment: tooth.recommended_treatment,
            expected_color: STATUS_COLOR_MAP[expectedStatus]
          });
        }
      }
    }
    
    // Report color mismatches
    if (issues.length > 0) {
      console.log(`🚨 Found ${issues.length} teeth with incorrect colors:\n`);
      
      // Group by tooth number for easier reading
      const groupedByTooth = {};
      issues.forEach(issue => {
        if (!groupedByTooth[issue.tooth_number]) {
          groupedByTooth[issue.tooth_number] = [];
        }
        groupedByTooth[issue.tooth_number].push(issue);
      });
      
      for (const [toothNumber, toothIssues] of Object.entries(groupedByTooth)) {
        console.log(`  Tooth #${toothNumber}:`);
        toothIssues.forEach((issue, index) => {
          console.log(`    ${index + 1}. Status: ${issue.status}, Color: ${issue.current_color} → ${issue.expected_color}`);
          if (issue.treatment) {
            console.log(`       Treatment: ${issue.treatment}`);
          }
        });
      }
      
      console.log('\n🔧 Fixing color mismatches...');
      
      // Fix each issue
      for (const issue of issues) {
        const { error: updateError } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .update({
            color_code: issue.expected_color,
            updated_at: new Date().toISOString()
          })
          .eq('id', issue.id);
        
        if (updateError) {
          console.error(`❌ Error fixing tooth #${issue.tooth_number}:`, updateError);
        }
      }
      
      console.log(`✅ Fixed ${issues.length} color mismatches\n`);
    } else {
      console.log('✅ No color mismatches found\n');
    }
    
    // Report treatment/status mismatches
    if (treatmentMismatches.length > 0) {
      console.log(`⚠️  Found ${treatmentMismatches.length} teeth where treatment doesn't match status:\n`);
      
      // Group by tooth number
      const groupedMismatches = {};
      treatmentMismatches.forEach(mismatch => {
        if (!groupedMismatches[mismatch.tooth_number]) {
          groupedMismatches[mismatch.tooth_number] = [];
        }
        groupedMismatches[mismatch.tooth_number].push(mismatch);
      });
      
      for (const [toothNumber, mismatches] of Object.entries(groupedMismatches)) {
        console.log(`  Tooth #${toothNumber}:`);
        mismatches.forEach((mismatch, index) => {
          console.log(`    ${index + 1}. Treatment: "${mismatch.treatment}"`);
          console.log(`       Current Status: ${mismatch.current_status} → Expected: ${mismatch.expected_status}`);
        });
      }
      
      console.log('\n💡 To fix these mismatches, you may want to update the status based on completed treatments.');
      console.log('   This script only fixes colors, not statuses, to avoid overriding intentional status settings.');
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`  Total records checked: ${allTeeth.length}`);
    console.log(`  Color mismatches fixed: ${issues.length}`);
    console.log(`  Treatment/status mismatches found: ${treatmentMismatches.length}`);
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

auditAndFixToothColors();