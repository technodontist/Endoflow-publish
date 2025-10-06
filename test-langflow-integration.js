/**
 * Test Script: LangFlow Integration for Research AI
 *
 * This script tests the complete LangFlow integration workflow:
 * 1. Database table creation
 * 2. API endpoint configuration
 * 3. Message persistence
 * 4. Conversation history retrieval
 */

const { createClient } = require('@supabase/supabase-js')

// Environment variables (replace with your actual values)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxpfbeqlqqrjpkiqlxmi.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'

// LangFlow configuration
const LANGFLOW_API_URL = process.env.LANGFLOW_API_URL || 'http://localhost:3001/api/v1/run'
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY || 'test-key'
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID || 'research-flow'

console.log('🧪 [TEST] LangFlow Integration Test Starting...\n')

async function testDatabaseSetup() {
  console.log('📊 [TEST 1] Testing Database Setup')
  console.log('─'.repeat(50))

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Check if table exists by trying to select
    const { data, error } = await supabase
      .schema('api')
      .from('research_ai_conversations')
      .select('count')
      .limit(1)

    if (error) {
      console.log('❌ Table does not exist or has permissions issues')
      console.log('   Run the migration: lib/db/migrations/add_research_ai_conversations.sql')
      console.log('   Error:', error.message)
      return false
    }

    console.log('✅ Table "research_ai_conversations" exists and is accessible')
    return true

  } catch (err) {
    console.log('❌ Database test failed:', err.message)
    return false
  }
}

async function testLangFlowConnection() {
  console.log('\n🔗 [TEST 2] Testing LangFlow Connection')
  console.log('─'.repeat(50))

  const testPayload = {
    input_value: "What is the average success rate for root canal treatments?",
    tweaks: {
      cohort_data: JSON.stringify([
        { id: 1, treatment: 'RCT', success: true },
        { id: 2, treatment: 'RCT', success: true },
        { id: 3, treatment: 'RCT', success: false }
      ]),
      analysis_type: 'general_query',
      cohort_size: 3,
      context: {
        clinicType: 'dental',
        specialty: 'endodontics',
        anonymized: true
      }
    }
  }

  const endpoint = LANGFLOW_FLOW_ID
    ? `${LANGFLOW_API_URL}/${LANGFLOW_FLOW_ID}`
    : LANGFLOW_API_URL

  console.log('   Endpoint:', endpoint)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LANGFLOW_API_KEY}`,
      },
      body: JSON.stringify(testPayload),
    })

    if (!response.ok) {
      console.log('❌ LangFlow connection failed')
      console.log('   Status:', response.status, response.statusText)
      console.log('   This is expected if LangFlow is not configured')
      console.log('   The system will use fallback responses')
      return false
    }

    const result = await response.json()
    console.log('✅ LangFlow connection successful')
    console.log('   Response:', JSON.stringify(result, null, 2).substring(0, 200) + '...')
    return true

  } catch (err) {
    console.log('❌ LangFlow connection error:', err.message)
    console.log('   This is expected if LangFlow is not running')
    console.log('   The system will use fallback responses')
    return false
  }
}

async function testConversationPersistence() {
  console.log('\n💾 [TEST 3] Testing Conversation Persistence')
  console.log('─'.repeat(50))

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // You need a real dentist ID for this test
  // Replace with an actual dentist ID from your database
  const testDentistId = 'your-dentist-uuid-here'

  const testConversation = {
    project_id: null, // Temp analysis
    dentist_id: testDentistId,
    user_query: 'Test query: What are the success rates?',
    ai_response: 'Test response: The success rate is approximately 85%.',
    analysis_type: 'general_query',
    cohort_size: 10,
    metadata: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
    source: 'langflow',
    confidence: 'high',
    processing_time: 150
  }

  try {
    // Insert test conversation
    const { data, error } = await supabase
      .schema('api')
      .from('research_ai_conversations')
      .insert(testConversation)
      .select()
      .single()

    if (error) {
      console.log('❌ Failed to insert conversation')
      console.log('   Error:', error.message)
      console.log('   Note: You need to use a valid dentist_id for this test')
      return false
    }

    console.log('✅ Conversation saved successfully')
    console.log('   ID:', data.id)

    // Retrieve the conversation
    const { data: retrieved, error: fetchError } = await supabase
      .schema('api')
      .from('research_ai_conversations')
      .select('*')
      .eq('id', data.id)
      .single()

    if (fetchError) {
      console.log('❌ Failed to retrieve conversation')
      console.log('   Error:', fetchError.message)
      return false
    }

    console.log('✅ Conversation retrieved successfully')
    console.log('   Query:', retrieved.user_query)
    console.log('   Response:', retrieved.ai_response.substring(0, 50) + '...')

    // Clean up test data
    const { error: deleteError } = await supabase
      .schema('api')
      .from('research_ai_conversations')
      .delete()
      .eq('id', data.id)

    if (!deleteError) {
      console.log('✅ Test conversation cleaned up')
    }

    return true

  } catch (err) {
    console.log('❌ Conversation persistence test failed:', err.message)
    return false
  }
}

async function testAPIEndpoint() {
  console.log('\n🌐 [TEST 4] Testing API Endpoint')
  console.log('─'.repeat(50))

  const apiUrl = 'http://localhost:3000/api/research/ai-query'

  const testPayload = {
    projectId: 'temp-analysis',
    query: 'What is the average success rate for treatments?',
    cohortData: [
      { id: 1, treatment: 'RCT', success: true },
      { id: 2, treatment: 'RCT', success: true },
      { id: 3, treatment: 'RCT', success: false }
    ],
    analysisType: 'general_query'
  }

  console.log('   Endpoint:', apiUrl)
  console.log('   Note: This test requires the Next.js dev server to be running')

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })

    if (!response.ok) {
      console.log('❌ API endpoint test failed')
      console.log('   Status:', response.status, response.statusText)
      console.log('   Make sure the Next.js server is running (npm run dev)')
      return false
    }

    const result = await response.json()
    console.log('✅ API endpoint working')
    console.log('   Source:', result.source)
    console.log('   Processing time:', result.processingTime, 'ms')
    console.log('   Response preview:', JSON.stringify(result.response).substring(0, 100) + '...')
    return true

  } catch (err) {
    console.log('❌ API endpoint error:', err.message)
    console.log('   Make sure the Next.js server is running (npm run dev)')
    return false
  }
}

async function runAllTests() {
  console.log('═'.repeat(50))
  console.log('  LANGFLOW INTEGRATION TEST SUITE')
  console.log('═'.repeat(50) + '\n')

  const results = {
    database: await testDatabaseSetup(),
    langflow: await testLangFlowConnection(),
    persistence: await testConversationPersistence(),
    api: await testAPIEndpoint()
  }

  console.log('\n' + '═'.repeat(50))
  console.log('  TEST RESULTS SUMMARY')
  console.log('═'.repeat(50))
  console.log(`  Database Setup:        ${results.database ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  LangFlow Connection:   ${results.langflow ? '✅ PASS' : '⚠️  SKIP (Fallback will be used)'}`)
  console.log(`  Conversation Storage:  ${results.persistence ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  API Endpoint:          ${results.api ? '✅ PASS' : '❌ FAIL'}`)
  console.log('═'.repeat(50))

  const criticalTests = results.database && results.api
  console.log('\n' + (criticalTests ? '✅ CRITICAL TESTS PASSED' : '❌ CRITICAL TESTS FAILED'))
  console.log('   The system can run with fallback responses even if LangFlow is not configured\n')

  process.exit(criticalTests ? 0 : 1)
}

// Run tests
runAllTests().catch(err => {
  console.error('💥 Test suite crashed:', err)
  process.exit(1)
})
