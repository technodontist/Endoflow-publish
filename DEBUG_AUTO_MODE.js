// PASTE THIS IN BROWSER CONSOLE TO DEBUG AUTO MODE
// Press F12, go to Console tab, paste this entire script and press Enter

console.log('🔧 [DEBUG] Starting Auto Mode Diagnostics...');

// Test 1: Check if component is loaded
const checkComponent = () => {
  const autoButton = document.querySelector('[title*="automated"]') || 
                     document.querySelector('button:has(.text-xs)');
  const wakeButton = document.querySelector('[title*="wake"]');
  const floatingButton = document.querySelector('.fixed.bottom-6.right-6');
  
  console.log('📦 [COMPONENT CHECK]', {
    'Auto Button Found': !!autoButton,
    'Wake Button Found': !!wakeButton,
    'Floating Button Found': !!floatingButton,
    'Auto Button Text': autoButton?.textContent?.trim(),
    'Auto Button Classes': autoButton?.className
  });
};

// Test 2: Check Speech Recognition
const checkSpeechRecognition = () => {
  const hasWebkit = 'webkitSpeechRecognition' in window;
  const hasNative = 'SpeechRecognition' in window;
  
  console.log('🎤 [SPEECH RECOGNITION CHECK]', {
    'WebKit Support': hasWebkit,
    'Native Support': hasNative,
    'Overall Support': hasWebkit || hasNative
  });
  
  if (!hasWebkit && !hasNative) {
    console.error('❌ Speech Recognition NOT supported in this browser!');
    console.log('💡 Try Chrome, Edge, or Safari');
  }
};

// Test 3: Check Microphone Permissions
const checkMicPermissions = async () => {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    console.log('🎙️ [MICROPHONE PERMISSIONS]', {
      'Status': result.state,
      'Granted': result.state === 'granted',
      'Denied': result.state === 'denied',
      'Prompt': result.state === 'prompt'
    });
    
    if (result.state === 'denied') {
      console.error('❌ Microphone access DENIED!');
      console.log('💡 Click the camera icon in address bar to allow microphone');
    }
  } catch (error) {
    console.error('❌ Could not check microphone permissions:', error);
  }
};

// Test 4: Simulate Wake Word
const testWakeWord = () => {
  console.log('🧪 [TEST] To test wake word:');
  console.log('1. Make sure chat is collapsed (floating button visible)');
  console.log('2. Say "Hey EndoFlow" clearly');
  console.log('3. Watch console for [WAKE WORD] logs');
  console.log('4. Look for green pulsing badge above button');
};

// Test 5: Simulate Auto Submit
const testAutoSubmit = () => {
  console.log('🧪 [TEST] To test auto-submit:');
  console.log('1. Click the microphone button (or say "Hey EndoFlow")');
  console.log('2. Say a query like "show my schedule"');
  console.log('3. Wait 2 seconds of silence');
  console.log('4. OR say "search it" / "do it" at the end');
  console.log('5. Watch console for [AUTO MODE] logs');
};

// Test 6: Check Console Filters
const checkConsoleFilters = () => {
  console.log('🔍 [CONSOLE TIPS]');
  console.log('Filter logs by typing in console filter:');
  console.log('  - "WAKE WORD" - see only wake word logs');
  console.log('  - "AUTO MODE" - see only auto-submit logs');
  console.log('  - "SILENCE TIMER" - see silence detection');
  console.log('  - "TRANSCRIPT" - see what you\'re saying');
};

// Test 7: Force Enable Auto Mode
const forceEnableAutoMode = () => {
  console.log('🔧 [FORCE] Attempting to enable auto mode...');
  const autoButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent.includes('Auto') || btn.textContent.includes('Manual'));
  
  if (autoButton) {
    const isAutoMode = autoButton.textContent.includes('Auto');
    console.log('Current mode:', isAutoMode ? 'AUTO' : 'MANUAL');
    
    if (!isAutoMode) {
      console.log('Clicking to enable AUTO mode...');
      autoButton.click();
      setTimeout(() => {
        console.log('✅ Auto mode should now be enabled');
      }, 500);
    } else {
      console.log('✅ Auto mode is already enabled');
    }
  } else {
    console.error('❌ Could not find Auto/Manual button');
  }
};

// Test 8: Check for Errors
const checkForErrors = () => {
  // This will show any React errors
  console.log('🚨 [ERROR CHECK] Looking for React errors...');
  const errorBoundary = document.querySelector('[role="alert"]');
  if (errorBoundary) {
    console.error('❌ Found error boundary:', errorBoundary.textContent);
  } else {
    console.log('✅ No visible errors');
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('\n🚀 [RUNNING ALL DIAGNOSTICS]\n');
  
  checkComponent();
  console.log('\n');
  
  checkSpeechRecognition();
  console.log('\n');
  
  await checkMicPermissions();
  console.log('\n');
  
  checkForErrors();
  console.log('\n');
  
  testWakeWord();
  console.log('\n');
  
  testAutoSubmit();
  console.log('\n');
  
  checkConsoleFilters();
  console.log('\n');
  
  console.log('💡 [TIP] Run forceEnableAutoMode() to manually enable auto mode');
  console.log('💡 [TIP] Clear browser cache with Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
  console.log('\n✅ [DIAGNOSTICS COMPLETE]\n');
};

// Export functions to window for manual use
window.debugEndoFlow = {
  runAllTests,
  checkComponent,
  checkSpeechRecognition,
  checkMicPermissions,
  testWakeWord,
  testAutoSubmit,
  forceEnableAutoMode,
  checkForErrors
};

// Auto-run diagnostics
runAllTests();

console.log('\n📚 [AVAILABLE COMMANDS]');
console.log('  debugEndoFlow.runAllTests() - Run all tests again');
console.log('  debugEndoFlow.forceEnableAutoMode() - Enable auto mode');
console.log('  debugEndoFlow.checkComponent() - Check UI components');
console.log('  debugEndoFlow.checkMicPermissions() - Check mic permissions');
