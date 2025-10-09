// Comprehensive fix for tooth status not updating based on diagnosis
// Run this in your project directory to fix the status mapping issue

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting comprehensive tooth status fix...\n');

// 1. First, let's fix the tooth-diagnosis-dialog-v2.tsx to properly set status based on diagnosis
const dialogFile = path.join(__dirname, 'components', 'dentist', 'tooth-diagnosis-dialog-v2.tsx');
console.log('📝 Fixing tooth-diagnosis-dialog-v2.tsx...');

let dialogContent = fs.readFileSync(dialogFile, 'utf8');

// Add the diagnosis-to-status mapping function
const statusMappingFunction = `
  // Map diagnosis text to appropriate status
  const getStatusFromDiagnosis = (diagnosis: string): string => {
    const diagnosisLower = diagnosis.toLowerCase();
    
    // Map diagnosis to status
    if (diagnosisLower.includes('caries') || diagnosisLower.includes('cavity')) {
      return 'caries';
    }
    if (diagnosisLower.includes('filled') || diagnosisLower.includes('filling')) {
      return 'filled';
    }
    if (diagnosisLower.includes('crown')) {
      return 'crown';
    }
    if (diagnosisLower.includes('missing') || diagnosisLower.includes('extracted')) {
      return 'missing';
    }
    if (diagnosisLower.includes('root canal') || diagnosisLower.includes('rct')) {
      return 'root_canal';
    }
    if (diagnosisLower.includes('bridge')) {
      return 'bridge';
    }
    if (diagnosisLower.includes('implant')) {
      return 'implant';
    }
    if (diagnosisLower.includes('attention') || diagnosisLower.includes('watch')) {
      return 'attention';
    }
    
    // Default to healthy if no specific condition is found
    return 'healthy';
  };`;

// Insert the function after the imports
const importEndIndex = dialogContent.lastIndexOf('import');
const importEndLineIndex = dialogContent.indexOf('\n', importEndIndex);
dialogContent = dialogContent.slice(0, importEndLineIndex + 1) + statusMappingFunction + dialogContent.slice(importEndLineIndex + 1);

// Fix the handleSave function to use the mapping
const handleSavePattern = /const handleSave = async \(\) => \{[\s\S]*?const toothData = \{[\s\S]*?status: .*?,/;
const handleSaveReplacement = dialogContent.match(handleSavePattern)[0].replace(
  /status: .*?,/,
  'status: getStatusFromDiagnosis(diagnosis || primaryDiagnosis),'
);

dialogContent = dialogContent.replace(handleSavePattern, handleSaveReplacement);

// Also update the useEffect that loads existing data to ensure status is set correctly
const useEffectPattern = /useEffect\(\(\) => \{[\s\S]*?if \(existingData\) \{[\s\S]*?\}[\s\S]*?\}, \[existingData, toothNumber\]\)/;
const useEffectMatch = dialogContent.match(useEffectPattern);
if (useEffectMatch) {
  let useEffectContent = useEffectMatch[0];
  // Add status recalculation when loading existing data
  useEffectContent = useEffectContent.replace(
    'setStatus(existingData.status || "healthy")',
    'setStatus(existingData.status || getStatusFromDiagnosis(existingData.primaryDiagnosis || ""))'
  );
  dialogContent = dialogContent.replace(useEffectPattern, useEffectContent);
}

fs.writeFileSync(dialogFile, dialogContent);
console.log('✅ Fixed tooth-diagnosis-dialog-v2.tsx\n');

// 2. Fix the enhanced-new-consultation-v3.tsx to ensure status and currentStatus are both set
const consultationFile = path.join(__dirname, 'components', 'dentist', 'enhanced-new-consultation-v3.tsx');
console.log('📝 Fixing enhanced-new-consultation-v3.tsx...');

let consultationContent = fs.readFileSync(consultationFile, 'utf8');

// Fix the reloadToothDiagnoses function to set both status and currentStatus
const reloadPattern = /const reloadToothDiagnoses = async \(\) => \{[\s\S]*?setToothData\(updatedToothData\);/;
const reloadMatch = consultationContent.match(reloadPattern);

if (reloadMatch) {
  let reloadContent = reloadMatch[0];
  
  // Ensure both status and currentStatus are set when processing tooth data
  reloadContent = reloadContent.replace(
    /updatedToothData\[toothNumber\] = \{[\s\S]*?\};/g,
    `updatedToothData[toothNumber] = {
          number: toothNumber,
          status: tooth.status || tooth.currentStatus || 'healthy',
          currentStatus: tooth.status || tooth.currentStatus || 'healthy',
          diagnosis: tooth.primaryDiagnosis || '',
          treatment: tooth.recommendedTreatment || '',
          date: tooth.examinationDate || new Date().toISOString().split('T')[0],
          colorCode: tooth.colorCode || getToothColor(tooth.status || tooth.currentStatus || 'healthy'),
          primaryDiagnosis: tooth.primaryDiagnosis,
          recommendedTreatment: tooth.recommendedTreatment,
          estimatedCost: tooth.estimatedCost,
          treatmentPriority: tooth.treatmentPriority,
          notes: tooth.notes,
          followUpRequired: tooth.followUpRequired,
          estimatedDuration: tooth.estimatedDuration
        };`
  );
  
  consultationContent = consultationContent.replace(reloadPattern, reloadContent);
}

// Ensure getToothColor function is present and correct
if (!consultationContent.includes('const getToothColor')) {
  const getToothColorFunction = `
  const getToothColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'caries': return '#ef4444';
      case 'filled': return '#3b82f6';
      case 'crown': return '#a855f7';
      case 'missing': return '#6b7280';
      case 'root_canal': return '#f97316';
      case 'bridge': return '#8b5cf6';
      case 'implant': return '#06b6d4';
      case 'attention': return '#eab308';
      default: return '#22c55e';
    }
  };`;
  
  // Insert after the component declaration
  const componentStart = consultationContent.indexOf('export default function');
  const functionBodyStart = consultationContent.indexOf('{', componentStart);
  consultationContent = consultationContent.slice(0, functionBodyStart + 1) + getToothColorFunction + consultationContent.slice(functionBodyStart + 1);
}

fs.writeFileSync(consultationFile, consultationContent);
console.log('✅ Fixed enhanced-new-consultation-v3.tsx\n');

// 3. Create a database migration script to fix existing data
const migrationScript = `
// Database migration to fix tooth status based on diagnosis
// Run this script to update existing tooth records with incorrect status

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixToothStatuses() {
  console.log('🔧 Fixing tooth statuses in database...');
  
  // Fetch all tooth diagnoses
  const { data: teeth, error } = await supabase
    .from('tooth_diagnoses')
    .select('*');
    
  if (error) {
    console.error('Error fetching teeth:', error);
    return;
  }
  
  console.log(\`Found \${teeth.length} tooth records to check\`);
  
  let updated = 0;
  for (const tooth of teeth) {
    const diagnosisLower = (tooth.primaryDiagnosis || '').toLowerCase();
    let newStatus = 'healthy';
    
    // Determine correct status based on diagnosis
    if (diagnosisLower.includes('caries') || diagnosisLower.includes('cavity')) {
      newStatus = 'caries';
    } else if (diagnosisLower.includes('filled') || diagnosisLower.includes('filling')) {
      newStatus = 'filled';
    } else if (diagnosisLower.includes('crown')) {
      newStatus = 'crown';
    } else if (diagnosisLower.includes('missing') || diagnosisLower.includes('extracted')) {
      newStatus = 'missing';
    } else if (diagnosisLower.includes('root canal') || diagnosisLower.includes('rct')) {
      newStatus = 'root_canal';
    } else if (diagnosisLower.includes('bridge')) {
      newStatus = 'bridge';
    } else if (diagnosisLower.includes('implant')) {
      newStatus = 'implant';
    } else if (diagnosisLower.includes('attention') || diagnosisLower.includes('watch')) {
      newStatus = 'attention';
    }
    
    // Update if status doesn't match
    if (tooth.status !== newStatus) {
      const { error: updateError } = await supabase
        .from('tooth_diagnoses')
        .update({ 
          status: newStatus,
          currentStatus: newStatus,
          colorCode: getColorForStatus(newStatus)
        })
        .eq('id', tooth.id);
        
      if (updateError) {
        console.error(\`Error updating tooth \${tooth.toothNumber}:\`, updateError);
      } else {
        console.log(\`Updated tooth \${tooth.toothNumber}: \${tooth.status} -> \${newStatus}\`);
        updated++;
      }
    }
  }
  
  console.log(\`✅ Updated \${updated} tooth records\`);
}

function getColorForStatus(status) {
  const colors = {
    'healthy': '#22c55e',
    'caries': '#ef4444',
    'filled': '#3b82f6',
    'crown': '#a855f7',
    'missing': '#6b7280',
    'root_canal': '#f97316',
    'bridge': '#8b5cf6',
    'implant': '#06b6d4',
    'attention': '#eab308'
  };
  return colors[status] || '#22c55e';
}

fixToothStatuses().catch(console.error);
`;

fs.writeFileSync('fix-tooth-db-statuses.js', migrationScript);
console.log('✅ Created database migration script: fix-tooth-db-statuses.js\n');

// 4. Create a verification test file
const testScript = `
// Test script to verify tooth status updates are working correctly
// Run this in the browser console after applying the fixes

(function() {
  console.log('🧪 Starting tooth status verification test...');
  
  // Test 1: Check if dialog saves correct status
  console.log('\\nTest 1: Simulating tooth diagnosis save...');
  
  // Find and click tooth #41
  const tooth41 = document.querySelector('[data-tooth-number="41"]');
  if (tooth41) {
    console.log('Found tooth #41, simulating click...');
    tooth41.click();
    
    setTimeout(() => {
      // Check if dialog opened
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        console.log('Dialog opened successfully');
        
        // Set diagnosis to "Deep Caries"
        const diagnosisInput = dialog.querySelector('input[placeholder*="diagnosis"]');
        if (diagnosisInput) {
          diagnosisInput.value = 'Deep Caries';
          diagnosisInput.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('Set diagnosis to "Deep Caries"');
          
          // The status should now automatically be set to 'caries'
          // Check after a brief delay
          setTimeout(() => {
            const statusSelect = dialog.querySelector('select');
            if (statusSelect) {
              console.log('Current status value:', statusSelect.value);
              console.log('Expected: caries');
              
              if (statusSelect.value === 'caries') {
                console.log('✅ Status correctly set based on diagnosis!');
              } else {
                console.log('❌ Status not automatically updated');
              }
            }
            
            // Close dialog
            const closeButton = dialog.querySelector('button[aria-label="Close"]');
            if (closeButton) closeButton.click();
          }, 500);
        }
      }
    }, 500);
  } else {
    console.log('Could not find tooth #41');
  }
  
  // Test 2: Check tooth colors after save
  console.log('\\nTest 2: Checking tooth colors...');
  
  setTimeout(() => {
    const teethWithCaries = document.querySelectorAll('.tooth-caries');
    const teethWithFilled = document.querySelectorAll('.tooth-filled');
    const teethHealthy = document.querySelectorAll('.tooth-healthy');
    
    console.log('Teeth with caries (red):', teethWithCaries.length);
    console.log('Teeth with fillings (blue):', teethWithFilled.length);
    console.log('Healthy teeth (green):', teethHealthy.length);
    
    // Check specific tooth #41
    const tooth41Element = document.querySelector('[data-tooth-number="41"] rect, [data-tooth-number="41"] path');
    if (tooth41Element) {
      const styles = window.getComputedStyle(tooth41Element);
      console.log('\\nTooth #41 fill color:', styles.fill);
      
      if (styles.fill === 'rgb(239, 68, 68)') {
        console.log('✅ Tooth #41 is red (caries)');
      } else if (styles.fill === 'rgb(34, 197, 94)') {
        console.log('❌ Tooth #41 is still green (healthy) - status not updated');
      }
    }
  }, 2000);
  
  console.log('\\n📊 Test complete. Check the results above.');
})();
`;

fs.writeFileSync('test-tooth-status.js', testScript);
console.log('✅ Created test script: test-tooth-status.js\n');

console.log('🎉 All fixes applied successfully!\n');
console.log('Next steps:');
console.log('1. Restart your Next.js development server');
console.log('2. Run: node fix-tooth-db-statuses.js (to fix existing database records)');
console.log('3. Test by creating a new tooth diagnosis with "Caries" in the diagnosis field');
console.log('4. The tooth should turn red immediately upon saving');
console.log('\nYou can also run the test script in your browser console:');
console.log('Copy and paste the contents of test-tooth-status.js into the browser console');