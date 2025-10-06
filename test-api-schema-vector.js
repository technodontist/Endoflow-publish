/**
 * Test API Schema Vector Function
 * Tests the vector function we created in api schema
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Testing API Schema Vector Function...\n')

async function testAPISchemaVectorFunction() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🧪 Step 1: Test vector function in api schema...')
  
  try {
    const testEmbedding = Array(768).fill(0.1) // Simple test embedding
    
    const { data, error } = await supabase
      .schema('api')
      .rpc('search_treatment_protocols', {
        query_embedding: testEmbedding,
        match_threshold: 0.1,
        match_count: 3
      })

    if (error) {
      console.log('❌ API schema vector function failed:', error.message)
      return false
    } else {
      console.log('✅ API schema vector function works!')
      console.log(`   Found ${data.length} results`)
      if (data.length > 0) {
        console.log(`   First result: "${data[0].title}"`)
        console.log(`   Similarity: ${(data[0].similarity * 100).toFixed(1)}%`)
      }
      return true
    }

  } catch (err) {
    console.log('❌ Vector function test error:', err.message)
    return false
  }
}

async function testFullAIWorkflow() {
  console.log('\n🤖 Step 2: Test complete AI workflow with vector search...')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY not configured')
    return false
  }

  try {
    // Generate embedding for test query
    console.log('   Generating embedding...')
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: 'Diagnosis: Irreversible pulpitis. Tooth: 24.' }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768
        })
      }
    )

    if (!response.ok) {
      throw new Error('Failed to generate embedding')
    }

    const embeddingData = await response.json()
    const queryEmbedding = embeddingData.embedding.values

    console.log('   Searching medical knowledge with vector similarity...')

    const { data: knowledgeResults, error: searchError } = await supabase
      .schema('api')
      .rpc('search_treatment_protocols', {
        query_embedding: queryEmbedding,
        diagnosis_filter: ['irreversible_pulpitis'],
        specialty_filter: 'endodontics',
        match_threshold: 0.1,
        match_count: 5
      })

    if (searchError) {
      console.log('❌ Vector search in workflow failed:', searchError.message)
      return false
    }

    console.log('✅ Complete AI workflow with vector search works!')
    console.log(`   Found ${knowledgeResults.length} relevant documents`)
    
    if (knowledgeResults.length > 0) {
      console.log('   Top results:')
      knowledgeResults.slice(0, 2).forEach((doc, idx) => {
        console.log(`     ${idx + 1}. "${doc.title}" (${(doc.similarity * 100).toFixed(1)}% similarity)`)
      })
    }

    return true

  } catch (err) {
    console.log('❌ Complete workflow test error:', err.message)
    return false
  }
}

async function runAPISchemaTests() {
  console.log('🚀 Starting API Schema Vector Tests...\n')

  const vectorFunctionWorks = await testAPISchemaVectorFunction()
  const fullWorkflowWorks = await testFullAIWorkflow()

  console.log('\n' + '═'.repeat(50))
  console.log('📊 API SCHEMA TEST RESULTS')
  console.log('═'.repeat(50))
  console.log(`Vector Function (api schema):  ${vectorFunctionWorks ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Complete AI Workflow:          ${fullWorkflowWorks ? '✅ PASS' : '❌ FAIL'}`)
  console.log('═'.repeat(50))

  if (vectorFunctionWorks && fullWorkflowWorks) {
    console.log('\n🎉 EXCELLENT! API Schema Vector Search is Working!')
    console.log('✅ Your AI integration is now fully functional')
    console.log('🚀 AI treatment suggestions will use semantic similarity search')
    console.log('\n📋 Next steps:')
    console.log('   1. Start your dev server: npm run dev')
    console.log('   2. Test AI features in your dentist dashboard')
    console.log('   3. Watch for successful vector search logs')
  } else {
    console.log('\n⚠️  Some tests failed')
    if (!vectorFunctionWorks) {
      console.log('❌ Vector function issue - check if SQL was run properly')
    }
    if (!fullWorkflowWorks) {
      console.log('❌ Workflow issue - but fallback should still work')
    }
    console.log('\n💡 Don\'t worry - your AI will still work with fallback!')
  }

  process.exit(vectorFunctionWorks && fullWorkflowWorks ? 0 : 1)
}

runAPISchemaTests().catch(error => {
  console.error('💥 Test suite crashed:', error)
  process.exit(1)
})