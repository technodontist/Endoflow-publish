/**
 * BROWSER CONSOLE DEBUGGING SCRIPT FOR CHIEF COMPLAINT FORM
 * 
 * Copy and paste this entire script into your browser's Developer Console
 * while you have the Chief Complaint dialog open.
 * 
 * This will help us identify exactly why the form inputs are not responding.
 */

console.log('🔍 CHIEF COMPLAINT FORM DEBUG SCRIPT');
console.log('=' .repeat(60));

// Function to check form elements
function debugChiefComplaintForm() {
  console.log('\n📋 1. CHECKING FORM ELEMENTS EXISTENCE');
  
  // Check if the dialog is open
  const dialog = document.querySelector('[role="dialog"]');
  console.log('Dialog found:', !!dialog);
  
  if (!dialog) {
    console.log('❌ No dialog found. Make sure Chief Complaint dialog is open.');
    return;
  }
  
  // Check for Chief Complaint specific elements
  const chiefComplaintElements = {
    'Primary Complaint Select': dialog.querySelector('button[role="combobox"]'),
    'Patient Description Textarea': dialog.querySelector('textarea[placeholder*="patient says"]'),
    'Location Input': dialog.querySelector('input[placeholder*="Upper right"]'),
    'Pain Scale Slider': dialog.querySelector('input[type="range"]'),
    'Symptom Checkboxes': dialog.querySelectorAll('button[role="checkbox"]'),
    'Save Button': dialog.querySelector('button:contains("Save")')
  };
  
  Object.entries(chiefComplaintElements).forEach(([name, element]) => {
    if (element) {
      console.log(`✅ ${name}: Found`);
    } else {
      console.log(`❌ ${name}: Not found`);
    }
  });
  
  console.log('\n📋 2. CHECKING ELEMENT PROPERTIES');
  
  // Check if elements are disabled
  const inputs = dialog.querySelectorAll('input, textarea, button[role="combobox"], button[role="checkbox"]');
  console.log(`Total interactive elements found: ${inputs.length}`);
  
  inputs.forEach((input, index) => {
    const tagName = input.tagName.toLowerCase();
    const type = input.type || input.getAttribute('role') || 'unknown';
    const disabled = input.disabled || input.getAttribute('aria-disabled') === 'true';
    const placeholder = input.placeholder || input.getAttribute('placeholder') || '';
    
    console.log(`Element ${index + 1}: ${tagName}[${type}] - Disabled: ${disabled} - Placeholder: "${placeholder}"`);
  });
  
  console.log('\n📋 3. TESTING ELEMENT INTERACTION');
  
  // Test textarea interaction
  const textarea = dialog.querySelector('textarea');
  if (textarea) {
    console.log('🧪 Testing textarea interaction...');
    console.log('  - Disabled:', textarea.disabled);
    console.log('  - ReadOnly:', textarea.readOnly);
    console.log('  - Current value:', `"${textarea.value}"`);
    
    // Try to focus
    try {
      textarea.focus();
      console.log('  - Focus successful');
    } catch (e) {
      console.log('  - Focus failed:', e.message);
    }
    
    // Try to set value programmatically
    try {
      const originalValue = textarea.value;
      textarea.value = 'TEST VALUE';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('  - Programmatic value set successful');
      textarea.value = originalValue; // Restore
    } catch (e) {
      console.log('  - Programmatic value set failed:', e.message);
    }
  }
  
  // Test pain scale slider
  const painSlider = dialog.querySelector('input[type="range"]');
  if (painSlider) {
    console.log('🧪 Testing pain scale slider...');
    console.log('  - Disabled:', painSlider.disabled);
    console.log('  - Current value:', painSlider.value);
    console.log('  - Min:', painSlider.min);
    console.log('  - Max:', painSlider.max);
    
    try {
      const originalValue = painSlider.value;
      painSlider.value = '5';
      painSlider.dispatchEvent(new Event('input', { bubbles: true }));
      painSlider.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('  - Programmatic slider change successful');
      painSlider.value = originalValue; // Restore
    } catch (e) {
      console.log('  - Programmatic slider change failed:', e.message);
    }
  }
  
  // Test checkboxes
  const checkboxes = dialog.querySelectorAll('button[role="checkbox"]');
  console.log(`🧪 Testing ${checkboxes.length} checkboxes...`);
  checkboxes.forEach((checkbox, index) => {
    if (index < 3) { // Test first 3 only
      const ariaChecked = checkbox.getAttribute('aria-checked');
      console.log(`  Checkbox ${index + 1}: aria-checked="${ariaChecked}", disabled=${checkbox.disabled}`);
    }
  });
  
  console.log('\n📋 4. CHECKING REACT COMPONENT STATE');
  
  // Look for React components
  const reactComponents = dialog.querySelectorAll('[data-reactroot], [data-react-checksum]');
  console.log('React components found:', reactComponents.length);
  
  // Check for React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools detected');
  } else {
    console.log('❌ React DevTools not detected');
  }
  
  console.log('\n📋 5. CHECKING FOR JAVASCRIPT ERRORS');
  
  // Monitor for errors
  const originalError = window.console.error;
  let errorCount = 0;
  
  window.console.error = function(...args) {
    errorCount++;
    console.log(`🚨 JavaScript Error ${errorCount}:`, ...args);
    originalError.apply(console, args);
  };
  
  // Restore after 5 seconds
  setTimeout(() => {
    window.console.error = originalError;
    console.log(`\n📊 Total errors captured: ${errorCount}`);
  }, 5000);
  
  console.log('\n📋 6. CHECKING EVENT LISTENERS');
  
  // Check if elements have event listeners
  if (textarea) {
    console.log('🔍 Textarea event listeners check...');
    // Try to trigger events and see if they're handled
    ['focus', 'input', 'change', 'keyup', 'blur'].forEach(eventType => {
      try {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        const result = textarea.dispatchEvent(event);
        console.log(`  - ${eventType} event: ${result ? 'handled' : 'not handled or prevented'}`);
      } catch (e) {
        console.log(`  - ${eventType} event: error - ${e.message}`);
      }
    });
  }
  
  console.log('\n🎯 DEBUG COMPLETE');
  console.log('Check the results above to identify the issue.');
  console.log('If elements exist but are not interactive, it might be a React state or props issue.');
}

// Run the debug function
debugChiefComplaintForm();

// Also provide manual testing instructions
console.log('\n🧪 MANUAL TESTING INSTRUCTIONS:');
console.log('1. Try clicking on any text input in the form');
console.log('2. Try typing - do you see characters appear?');
console.log('3. Try moving the pain scale slider');
console.log('4. Try clicking any checkbox');
console.log('5. Check if you see any console messages when interacting');

// Set up event monitoring
console.log('\n📡 SETTING UP EVENT MONITORING...');
console.log('Now interact with the form. All events will be logged below:');

// Monitor all form interactions
const dialog = document.querySelector('[role="dialog"]');
if (dialog) {
  ['click', 'input', 'change', 'focus', 'blur', 'keydown', 'keyup'].forEach(eventType => {
    dialog.addEventListener(eventType, (e) => {
      console.log(`🎯 Event: ${eventType} on ${e.target.tagName.toLowerCase()}${e.target.type ? `[${e.target.type}]` : ''}`, e.target);
    }, true);
  });
  
  console.log('✅ Event monitoring active. Interact with the form now.');
} else {
  console.log('❌ Could not set up event monitoring - dialog not found');
}