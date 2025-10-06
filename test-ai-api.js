/**
 * Test AI API with Authentication
 * Tests the actual API endpoints to see what's failing
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧪 Testing AI API Endpoints with Authentication\n')

async function testWithServiceRole() {
  console.log('🔐 [TEST 1] Testing with Service Role\n')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Test the AI query API endpoint directly
    const testPayload = {
      projectId: 'temp-analysis',
      query: 'What is the success rate for root canal treatments?',
      cohortData: [
        { id: 1, treatment: 'RCT', success: true, age: 35 },
        { id: 2, treatment: 'RCT', success: true, age: 42 },
        { id: 3, treatment: 'RCT', success: false, age: 28 }
      ],
      analysisType: 'general_query'
    }

    console.log('📊 Testing /api/research/ai-query endpoint...')
    
    const response = await fetch('http://localhost:3004/api/research/ai-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(testPayload),
    })

    console.log('Response status:', response.status)
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ API Response:', JSON.stringify(result, null, 2))
    } else {
      const error = await response.text()
      console.log('❌ API Error:', error)
    }

  } catch (err) {
    console.error('❌ Request failed:', err.message)
  }
}

async function testVectorSearchDirectly() {
  console.log('\n🔍 [TEST 2] Testing Vector Search Directly\n')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Test if the vector search function exists
    const testEmbedding = Array(768).fill(0).map(() => Math.random() - 0.5)
    
    console.log('🔧 Testing api.search_treatment_protocols function...')
    
    const { data, error } = await supabase.rpc('search_treatment_protocols', {
      query_embedding: testEmbedding,
      match_threshold: 0.1,
      match_count: 3
    })

    if (error) {
      console.log('❌ Vector function error:', error.message)
      console.log('📋 You need to run: fix_vector_search.sql in Supabase SQL Editor')
    } else {
      console.log(`✅ Vector search working! Found ${data.length} results`)
      if (data.length > 0) {
        console.log('   First result:', data[0].title)
      }
    }

  } catch (err) {
    console.error('❌ Vector search failed:', err.message)
  }
}

async function testMedicalKnowledgeAccess() {
  console.log('\n📚 [TEST 3] Testing Medical Knowledge Access\n')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('📖 Checking medical knowledge entries...')
    
    const { data, error } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('id, title, embedding, authors, specialty')

    if (error) {
      console.log('❌ Medical knowledge error:', error.message)
    } else {
      console.log(`✅ Found ${data.length} medical knowledge entries`)
      data.forEach((entry, idx) => {
        console.log(`   ${idx + 1}. "${entry.title}" - ${entry.specialty}`)
        console.log(`      Has embedding: ${entry.embedding ? 'Yes' : 'No'}`)
      })
    }

  } catch (err) {
    console.error('❌ Medical knowledge test failed:', err.message)
  }
}

async function testGeminiIntegration() {
  console.log('\n🤖 [TEST 4] Testing Gemini API Integration\n')
  
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY not found in environment')
    return
  }

  try {
    console.log('🧠 Testing Gemini cohort analysis...')
    
    // Import the Gemini service and test it
    const { analyzePatientCohort } = require('./lib/services/gemini-ai')
    
    const testCohortData = [
      { id: 1, age: 35, condition: 'irreversible pulpitis', outcome: 'success' },
      { id: 2, age: 42, condition: 'deep caries', outcome: 'success' },
      { id: 3, age: 28, condition: 'irreversible pulpitis', outcome: 'failure' }
    ]
    
    const result = await analyzePatientCohort({
      cohortData: testCohortData,
      query: 'What are the success rates and demographics?'
    })
    
    console.log('✅ Gemini analysis successful!')
    console.log('   Summary:', result.summary)
    console.log('   Statistics:', result.statistics)
    
  } catch (err) {
    console.error('❌ Gemini integration test failed:', err.message)
  }
}

async function runAllTests() {
  console.log('🚀 Starting AI API Tests...\n')
  
  // Check if development server is running
  try {
    const healthCheck = await fetch('http://localhost:3004/api/check-auth-status')
    if (!healthCheck.ok) {
      console.log('⚠️  Development server not running on port 3004')
      console.log('   Please start with: npm run dev')
      console.log('   Then run this test again\n')
    } else {
      console.log('✅ Development server is running\n')
    }
  } catch (err) {
    console.log('⚠️  Development server not accessible')
    console.log('   Please start with: npm run dev\n')
  }

  await testVectorSearchDirectly()
  await testMedicalKnowledgeAccess()
  await testGeminiIntegration()
  
  console.log('\n🎯 SUMMARY:')
  console.log('──────────────────────────────────────────────────')
  console.log('1. If vector search failed: Run fix_vector_search.sql in Supabase')
  console.log('2. If medical knowledge has no embeddings: Run node generate-medical-embeddings.js')
  console.log('3. If Gemini works: Your AI integration should work once steps 1-2 are done')
  console.log('──────────────────────────────────────────────────')
}

runAllTests().catch(error => {
  console.error('💥 Test failed:', error)
  process.exit(1)
})