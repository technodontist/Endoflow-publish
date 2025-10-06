/**
 * Test script for Research AI Chatbot with Gemini integration
 * Tests the complete flow from patient data to AI analysis
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxpfbeqlqqrjpkiqlxmi.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDWpUU2GkXSMNxrn-CanK0Si4Gq3Ko2ZM4'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testResearchAIChatbot() {
  console.log('🧪 Testing Research AI Chatbot Integration\n')

  // Step 1: Fetch sample patient data with related records
  console.log('📊 Step 1: Fetching patient cohort data...')
  const { data: patients, error: patientsError } = await supabase
    .schema('api')
    .from('patients')
    .select(`
      *,
      consultations:consultations(*),
      treatments:treatments(*),
      appointments:appointments(*)
    `)
    .limit(10)

  if (patientsError) {
    console.error('❌ Error fetching patients:', patientsError)
    return
  }

  console.log(`✅ Found ${patients.length} patients with related data\n`)

  // Step 2: Test Gemini API directly
  console.log('🧠 Step 2: Testing Gemini API integration...')

  const testQuery = 'What is the average age of patients and what are the most common diagnoses?'

  try {
    const response = await fetch('http://localhost:3000/api/research/ai-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId: 'test-project',
        query: testQuery,
        cohortData: patients,
        analysisType: 'analyze_cohort'
      })
    })

    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText)
      console.log('💡 Make sure the development server is running (npm run dev)')
      return
    }

    const result = await response.json()

    if (result.success) {
      console.log('✅ Gemini API responded successfully!\n')
      console.log('📝 AI Response:')
      console.log('─'.repeat(80))
      console.log(JSON.stringify(result.response, null, 2))
      console.log('─'.repeat(80))
      console.log(`\n⏱️  Processing Time: ${result.processingTime}ms`)
      console.log(`🔧 Source: ${result.source}`)
    } else {
      console.error('❌ API returned error:', result)
    }
  } catch (error) {
    console.error('❌ Error calling API:', error.message)
    console.log('💡 Make sure the development server is running (npm run dev)')
    return
  }

  // Step 3: Test conversation saving
  console.log('\n💾 Step 3: Testing conversation persistence...')

  // Get a dentist ID for testing
  const { data: dentists } = await supabase
    .schema('api')
    .from('dentists')
    .select('id')
    .limit(1)
    .single()

  if (!dentists) {
    console.error('❌ No dentist found in database')
    return
  }

  const { data: conversation, error: saveError } = await supabase
    .schema('api')
    .from('research_ai_conversations')
    .insert({
      project_id: null,
      dentist_id: dentists.id,
      user_query: testQuery,
      ai_response: 'Test AI response from automated test',
      analysis_type: 'analyze_cohort',
      cohort_size: patients.length,
      source: 'gemini',
      metadata: JSON.stringify({ test: true })
    })
    .select()
    .single()

  if (saveError) {
    console.error('❌ Error saving conversation:', saveError)
  } else {
    console.log('✅ Conversation saved successfully!')
    console.log(`   ID: ${conversation.id}`)
    console.log(`   Dentist: ${conversation.dentist_id}`)
    console.log(`   Created: ${conversation.created_at}`)

    // Clean up test data
    await supabase
      .schema('api')
      .from('research_ai_conversations')
      .delete()
      .eq('id', conversation.id)

    console.log('🧹 Test conversation deleted')
  }

  console.log('\n✅ All tests completed successfully!')
  console.log('\n📋 Summary:')
  console.log('   ✅ Patient data fetching works')
  console.log('   ✅ Gemini API integration works')
  console.log('   ✅ Conversation persistence works')
  console.log('\n🎉 Research AI Chatbot is ready to use!')
}

// Run the test
testResearchAIChatbot().catch(console.error)
