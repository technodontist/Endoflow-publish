/**
 * Manual Color Update Test
 * Run this in browser console to manually test color updates
 */

console.log('🎨 MANUAL COLOR UPDATE TEST');
console.log('=' .repeat(60));

// Function to manually update a tooth element's color
window.forceToothColor = function(toothNumber = '41', status = 'caries') {
  const tooth = document.querySelector(`[title*="Tooth ${toothNumber}"]`);
  if (!tooth) {
    console.error(`❌ Tooth ${toothNumber} not found`);
    return;
  }
  
  console.log(`\n🔨 Forcing tooth #${toothNumber} to status: ${status}`);
  
  // Remove all color classes
  const colorClasses = [
    'bg-green-100', 'border-green-300', 'text-green-800',
    'bg-red-100', 'border-red-300', 'text-red-800',
    'bg-blue-100', 'border-blue-300', 'text-blue-800',
    'bg-yellow-100', 'border-yellow-300', 'text-yellow-800',
    'bg-orange-100', 'border-orange-300', 'text-orange-800',
    'bg-purple-100', 'border-purple-300', 'text-purple-800',
    'bg-gray-200', 'border-gray-400', 'text-gray-600'
  ];
  
  colorClasses.forEach(cls => tooth.classList.remove(cls));
  
  // Add new color classes based on status
  const statusColors = {
    'healthy': ['bg-green-100', 'border-green-300', 'text-green-800'],
    'caries': ['bg-red-100', 'border-red-300', 'text-red-800'],
    'filled': ['bg-blue-100', 'border-blue-300', 'text-blue-800'],
    'crown': ['bg-yellow-100', 'border-yellow-300', 'text-yellow-800'],
    'missing': ['bg-gray-200', 'border-gray-400', 'text-gray-600'],
    'attention': ['bg-orange-100', 'border-orange-300', 'text-orange-800'],
    'root_canal': ['bg-purple-100', 'border-purple-300', 'text-purple-800']
  };
  
  const colors = statusColors[status] || statusColors['healthy'];
  colors.forEach(cls => tooth.classList.add(cls));
  
  console.log(`✅ Applied classes:`, colors.join(', '));
  console.log(`📋 Final classes:`, tooth.className);
  
  // Update title
  const oldTitle = tooth.getAttribute('title');
  tooth.setAttribute('title', oldTitle.replace(/Status: \w+/, `Status: ${status}`));
  
  console.log(`\n✨ Tooth #${toothNumber} should now be:`, {
    'healthy': '🟢 GREEN',
    'caries': '🔴 RED',
    'filled': '🔵 BLUE',
    'crown': '🟡 YELLOW',
    'attention': '🟠 ORANGE',
    'root_canal': '🟣 PURPLE',
    'missing': '⚫ GRAY'
  }[status] || '❓ UNKNOWN');
};

// Function to check React state
window.checkReactState = function() {
  console.log('\n📊 Checking React Component State:');
  
  // Try to access React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools detected');
    
    // Get React fiber
    const toothElement = document.querySelector('[title*="Tooth 41"]');
    if (toothElement && toothElement._reactInternalFiber) {
      console.log('Found React fiber for tooth 41');
      // This would show the props if accessible
    }
  } else {
    console.log('❌ React DevTools not available');
    console.log('💡 Tip: Install React DevTools extension to inspect component state');
  }
};

// Function to simulate what should happen after save
window.simulateCorrectFlow = function(toothNumber = '41') {
  console.log(`\n🔄 SIMULATING CORRECT FLOW FOR TOOTH #${toothNumber}:`);
  console.log('1️⃣ User saves with status: caries');
  console.log('2️⃣ Database saves with color_code: #ef4444');
  console.log('3️⃣ Parent reloads data...');
  
  setTimeout(() => {
    console.log('4️⃣ Parent sets toothData with status: caries');
    console.log('5️⃣ Chart receives new props...');
    
    setTimeout(() => {
      console.log('6️⃣ Chart re-renders...');
      forceToothColor(toothNumber, 'caries');
      console.log('7️⃣ ✅ Tooth should now be RED!');
    }, 500);
  }, 1000);
};

// Auto-run tests
console.log('\n🧪 Running initial tests...\n');

// Check current state
const tooth41 = document.querySelector('[title*="Tooth 41"]');
if (tooth41) {
  console.log('Tooth #41 current state:');
  console.log('  Classes:', tooth41.className);
  console.log('  Has bg-red?', tooth41.className.includes('bg-red'));
  console.log('  Has bg-green?', tooth41.className.includes('bg-green'));
}

console.log('\n' + '=' .repeat(60));
console.log('📌 Available commands:');
console.log('  forceToothColor("41", "caries")  - Make tooth #41 red');
console.log('  forceToothColor("41", "filled")  - Make tooth #41 blue');
console.log('  forceToothColor("41", "healthy") - Make tooth #41 green');
console.log('  simulateCorrectFlow("41")        - Simulate the correct update flow');
console.log('  checkReactState()                - Check React component state');
console.log('=' .repeat(60));