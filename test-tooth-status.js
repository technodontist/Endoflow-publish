// Test script to verify tooth status updates are working correctly
// Run this in the browser console after applying the fixes

(function() {
  console.log('🧪 Starting tooth status verification test...')
  console.log('This test will check if tooth statuses are being correctly set based on diagnoses')
  
  // Test 1: Check current tooth data
  console.log('\n=== Test 1: Current Tooth Data ===')
  
  // Find all tooth elements in the FDI chart
  const teethElements = document.querySelectorAll('[data-tooth-number]')
  console.log(`Found ${teethElements.length} teeth in the dental chart`)
  
  // Check for teeth with various statuses
  const statusClasses = {
    'healthy': 'tooth-healthy',
    'caries': 'tooth-caries',
    'filled': 'tooth-filled',
    'crown': 'tooth-crown',
    'missing': 'tooth-missing'
  }
  
  const statusCounts = {}
  Object.entries(statusClasses).forEach(([status, className]) => {
    const count = document.querySelectorAll(`.${className}`).length
    statusCounts[status] = count
    if (count > 0) {
      console.log(`  ${status}: ${count} teeth`)
    }
  })
  
  // Test 2: Simulate adding a diagnosis
  console.log('\n=== Test 2: Testing Diagnosis Dialog ===')
  console.log('Instructions:')
  console.log('1. Click on a tooth (e.g., tooth #18)')
  console.log('2. Add diagnosis "Deep Caries"')
  console.log('3. Check if status automatically changes to "caries"')
  console.log('4. Save and verify the tooth turns red')
  
  // Test 3: Check specific teeth with known issues
  console.log('\n=== Test 3: Checking Specific Teeth ===')
  
  // Check tooth 41 specifically (from your logs)
  const tooth41 = document.querySelector('[data-tooth-number="41"]')
  if (tooth41) {
    const tooth41Classes = tooth41.className || ''
    const tooth41Path = tooth41.querySelector('path, rect')
    const tooth41Fill = tooth41Path ? window.getComputedStyle(tooth41Path).fill : 'unknown'
    
    console.log('Tooth #41:')
    console.log('  Classes:', tooth41Classes)
    console.log('  Fill color:', tooth41Fill)
    
    if (tooth41Fill === 'rgb(239, 68, 68)' || tooth41Fill === '#ef4444') {
      console.log('  ✅ Correctly showing RED (caries)')
    } else if (tooth41Fill === 'rgb(34, 197, 94)' || tooth41Fill === '#22c55e') {
      console.log('  ❌ Showing GREEN (healthy) - status not updated correctly')
    }
  }
  
  // Check tooth 18
  const tooth18 = document.querySelector('[data-tooth-number="18"]')
  if (tooth18) {
    const tooth18Path = tooth18.querySelector('path, rect')
    const tooth18Fill = tooth18Path ? window.getComputedStyle(tooth18Path).fill : 'unknown'
    
    console.log('Tooth #18:')
    console.log('  Fill color:', tooth18Fill)
    
    if (tooth18Fill === 'rgb(239, 68, 68)' || tooth18Fill === '#ef4444') {
      console.log('  ✅ Correctly showing RED (caries)')
    } else if (tooth18Fill === 'rgb(34, 197, 94)' || tooth18Fill === '#22c55e') {
      console.log('  ❌ Showing GREEN (healthy) - status not updated correctly')
    }
  }
  
  // Test 4: Manual color override test
  console.log('\n=== Test 4: Manual Color Override ===')
  console.log('Run this to manually test colors:')
  console.log(`
// Make tooth 41 red (caries)
document.querySelector('[data-tooth-number="41"] path, [data-tooth-number="41"] rect').style.fill = '#ef4444'

// Make tooth 18 red (caries)  
document.querySelector('[data-tooth-number="18"] path, [data-tooth-number="18"] rect').style.fill = '#ef4444'
`)
  
  console.log('\n📊 Test Summary:')
  console.log('If teeth with caries diagnosis are showing green, the status mapping needs fixing.')
  console.log('After fixes are applied:')
  console.log('  - New diagnoses should auto-set correct status')
  console.log('  - Teeth with caries should show red (#ef4444)')
  console.log('  - Teeth with fillings should show blue (#3b82f6)')
  console.log('  - Healthy teeth should show green (#22c55e)')
})()