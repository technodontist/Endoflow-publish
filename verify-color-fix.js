/**
 * FINAL VERIFICATION SCRIPT - FDI Chart Color Updates
 * Run this in browser console after saving a tooth diagnosis
 * 
 * Expected flow:
 * 1. Click tooth #18
 * 2. Set status to "Caries" 
 * 3. Save
 * 4. Check console for these logs
 */

console.log('=' .repeat(60));
console.log('🔍 FDI CHART COLOR FIX VERIFICATION');
console.log('=' .repeat(60));

// What to look for in console after saving tooth #18 with caries:

console.log('\n📋 EXPECTED CONSOLE LOGS AFTER SAVE:\n');

console.log('1️⃣ From parent reload (enhanced-new-consultation-v3.tsx):');
console.log('   🔄 [RELOAD] Fetching latest tooth diagnoses for patient: xxx');
console.log('   ✅ [RELOAD] Loaded X teeth with diagnoses from database');
console.log('   🦷 Tooth #18: status=caries, diagnosis=Deep Caries, color=#ef4444');
console.log('   ✅ [RELOAD] Tooth #18 updated with status=\'caries\', colorCode=\'#ef4444\'');
console.log('   💾 [RELOAD] Setting toothData state with X teeth\n');

console.log('2️⃣ From chart component (interactive-dental-chart.tsx):');
console.log('   🎯 [DENTAL-CHART] Using external toothData from parent');
console.log('   🎯 [DENTAL-CHART] Sample tooth #18 from overlay: {status: "caries", ...}');
console.log('   🔍 [RENDER-TOOTH-18] Raw tooth data: {status: "caries", currentStatus: "caries", ...}');
console.log('   🔍 [RENDER-TOOTH-18] Final tooth.status = \'caries\'');
console.log('   🦷 [TOOTH-18] Status: caries, ColorCode: #ef4444, Classes: bg-red-100...\n');

console.log('3️⃣ Visual result:');
console.log('   🔴 Tooth #18 should be RED (bg-red-100 class applied)\n');

console.log('=' .repeat(60));
console.log('🧪 QUICK TEST FUNCTIONS:');
console.log('=' .repeat(60));

// Function to check tooth element classes
window.checkToothColor = function(toothNumber = '18') {
  const toothElement = document.querySelector(`[title*="Tooth ${toothNumber}"]`);
  if (!toothElement) {
    console.error(`❌ Tooth #${toothNumber} element not found`);
    return;
  }
  
  console.log(`\n🦷 Tooth #${toothNumber} Analysis:`);
  console.log('Classes:', toothElement.className);
  
  // Check for color indicators
  const hasRed = toothElement.className.includes('bg-red');
  const hasBlue = toothElement.className.includes('bg-blue');
  const hasGreen = toothElement.className.includes('bg-green');
  const hasYellow = toothElement.className.includes('bg-yellow');
  const hasOrange = toothElement.className.includes('bg-orange');
  
  if (hasRed) console.log('✅ RED color detected (caries/extraction needed)');
  else if (hasBlue) console.log('✅ BLUE color detected (filled)');
  else if (hasGreen) console.log('✅ GREEN color detected (healthy)');
  else if (hasYellow) console.log('✅ YELLOW color detected (crown)');
  else if (hasOrange) console.log('✅ ORANGE color detected (attention)');
  else console.log('⚠️ No standard color class detected');
  
  // Check inline styles
  if (toothElement.style.backgroundColor) {
    console.log('Inline backgroundColor:', toothElement.style.backgroundColor);
  }
  if (toothElement.style.borderColor) {
    console.log('Inline borderColor:', toothElement.style.borderColor);
  }
};

// Function to check all teeth with data
window.checkAllTeethColors = function() {
  console.log('\n🦷 All Teeth Color Analysis:');
  const allTeeth = document.querySelectorAll('[title*="Tooth "]');
  let colorStats = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
    orange: 0,
    purple: 0,
    gray: 0,
    unknown: 0
  };
  
  allTeeth.forEach(tooth => {
    const classes = tooth.className;
    if (classes.includes('bg-red')) colorStats.red++;
    else if (classes.includes('bg-blue')) colorStats.blue++;
    else if (classes.includes('bg-green')) colorStats.green++;
    else if (classes.includes('bg-yellow')) colorStats.yellow++;
    else if (classes.includes('bg-orange')) colorStats.orange++;
    else if (classes.includes('bg-purple')) colorStats.purple++;
    else if (classes.includes('bg-gray')) colorStats.gray++;
    else colorStats.unknown++;
  });
  
  console.table(colorStats);
  
  if (colorStats.red > 0) {
    console.log(`🔴 ${colorStats.red} teeth with caries/extraction needed`);
  }
  if (colorStats.blue > 0) {
    console.log(`🔵 ${colorStats.blue} filled teeth`);
  }
  if (colorStats.green > 0) {
    console.log(`🟢 ${colorStats.green} healthy teeth`);
  }
};

console.log('\n📌 Run these commands to check:');
console.log('   checkToothColor(\'18\')  - Check tooth #18 color');
console.log('   checkToothColor(\'17\')  - Check tooth #17 color');
console.log('   checkAllTeethColors()   - Check all teeth colors\n');

console.log('=' .repeat(60));
console.log('✅ Verification script loaded. Save a tooth and check the logs!');
console.log('=' .repeat(60));