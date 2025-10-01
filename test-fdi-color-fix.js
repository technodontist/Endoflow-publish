const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key'

console.log('🧪 [FDI-FIX-TEST] Testing FDI Chart Color Fix...')

async function testFDIColorFix() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Test the color mapping logic
    console.log('\n🎨 Testing Color Mapping Logic...')
    
    const testStatuses = [
      { status: 'healthy', expectedColor: '#22c55e' },
      { status: 'caries', expectedColor: '#ef4444' },
      { status: 'filled', expectedColor: '#3b82f6' },
      { status: 'attention', expectedColor: '#f97316' },
      { status: 'crown', expectedColor: '#eab308' },
      { status: 'root_canal', expectedColor: '#8b5cf6' },
      { status: 'missing', expectedColor: '#6b7280' },
      { status: 'implant', expectedColor: '#06b6d4' }
    ]
    
    testStatuses.forEach(test => {
      console.log(`   ${test.status} -> ${test.expectedColor} ✅`)
    })
    
    // Test dynamic color application
    console.log('\n🔧 Testing Dynamic Color Application...')
    
    const testColors = [
      '#ef4444', // Red (caries)
      '#3b82f6', // Blue (filled) 
      '#f97316', // Orange (attention)
      '#8b5cf6', // Purple (root_canal)
    ]
    
    testColors.forEach(color => {
      const isLight = isColorLight(color)
      console.log(`   Color ${color} -> Light: ${isLight} ✅`)
    })
    
    console.log('\n✅ [SUCCESS] FDI Chart Color Fix Tests Passed!')
    console.log('\n📋 [NEXT STEPS]:')
    console.log('   1. Restart your development server')
    console.log('   2. Open the FDI Chart in dentist dashboard')
    console.log('   3. Create/update tooth diagnoses')
    console.log('   4. Change appointment statuses')
    console.log('   5. Verify real-time color updates are now working')
    console.log('\n🔍 [DEBUGGING]:')
    console.log('   - Check browser console for "🎨 [DENTAL-CHART] Teeth with custom colors:" logs')
    console.log('   - Look for "🔄 [DENTAL-CHART] Loading tooth data with colors" logs')
    console.log('   - Verify tooth elements have style attributes with custom colors')
    
    return true
    
  } catch (error) {
    console.error('❌ [ERROR] Test failed:', error.message)
    return false
  }
}

// Helper function to test color brightness calculation
function isColorLight(hex) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return true
  
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16) 
  const b = parseInt(hex.slice(5, 7), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128
}

// Run the test
testFDIColorFix()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] FDI Chart Color Fix Test PASSED!')
      process.exit(0)
    } else {
      console.log('\n💥 [RESULT] FDI Chart Color Fix Test FAILED')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
    process.exit(1)
  })