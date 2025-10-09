/**
 * Debug Script: Check what data the FDI chart is receiving
 * Run this in browser console to see the actual tooth data
 */

console.log('🔍 DEBUGGING FDI CHART DATA');
console.log('=' .repeat(60));

// Function to check React props
window.debugChartData = function() {
  // Try to find the chart container
  const charts = document.querySelectorAll('[class*="dental"]');
  console.log(`Found ${charts.length} dental chart related elements`);
  
  // Look for tooth elements to infer data
  const toothElements = document.querySelectorAll('[title*="Tooth "]');
  console.log(`\nFound ${toothElements.length} tooth elements`);
  
  if (toothElements.length > 0) {
    // Sample a few teeth
    const sampleTeeth = ['18', '17', '41', '46'];
    
    sampleTeeth.forEach(toothNum => {
      const tooth = document.querySelector(`[title*="Tooth ${toothNum}"]`);
      if (tooth) {
        console.log(`\n🦷 Tooth #${toothNum}:`);
        console.log('  Title:', tooth.getAttribute('title'));
        console.log('  Classes:', tooth.className);
        console.log('  Has bg-red?', tooth.className.includes('bg-red'));
        console.log('  Has bg-green?', tooth.className.includes('bg-green'));
        console.log('  Has bg-blue?', tooth.className.includes('bg-blue'));
        console.log('  Inline styles:', {
          backgroundColor: tooth.style.backgroundColor,
          borderColor: tooth.style.borderColor,
          color: tooth.style.color
        });
      }
    });
  }
};

// Function to manually test color application
window.testColorApplication = function(toothNumber = '18') {
  const tooth = document.querySelector(`[title*="Tooth ${toothNumber}"]`);
  if (!tooth) {
    console.error(`Tooth ${toothNumber} not found`);
    return;
  }
  
  console.log(`\n🎨 Testing color application for tooth #${toothNumber}`);
  console.log('Current classes:', tooth.className);
  
  // Try to manually add red color class
  console.log('Adding bg-red-100 class...');
  tooth.classList.add('bg-red-100', 'border-red-300', 'text-red-800');
  tooth.classList.remove('bg-green-100', 'border-green-300', 'text-green-800');
  
  console.log('New classes:', tooth.className);
  console.log('✅ If tooth turned red, the issue is with data flow');
  console.log('❌ If tooth stayed green, there might be CSS issues');
};

// Function to check what the console logs show
window.checkConsoleLogs = function() {
  console.log('\n📋 Expected console log patterns after saving:');
  console.log('1. [TOOTH-DIAGNOSES] Saving tooth diagnosis for tooth: X');
  console.log('2. [TOOTH-DIAGNOSES] Successfully saved tooth diagnosis for tooth: X');
  console.log('3. [RELOAD] Fetching latest tooth diagnoses for patient');
  console.log('4. [RELOAD] Loaded X teeth with diagnoses from database');
  console.log('5. [RELOAD] Tooth #X: status=caries, diagnosis=..., color=#ef4444');
  console.log('6. [DENTAL-CHART] Using external toothData from parent');
  console.log('7. [RENDER-TOOTH-X] Final tooth.status = \'caries\'');
  console.log('\n⚠️ Check if all these logs appear in order');
};

// Auto-run on load
console.log('\nRunning initial debug...\n');
debugChartData();

console.log('\n' + '=' .repeat(60));
console.log('Available commands:');
console.log('  debugChartData()          - Check current tooth data');
console.log('  testColorApplication(\'18\') - Test manual color change');
console.log('  checkConsoleLogs()        - Show expected log patterns');
console.log('=' .repeat(60));