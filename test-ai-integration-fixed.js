/**
 * Complete AI Integration Test
 * Tests all components after database setup
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

console.log('🧪 Complete AI Integration Test\n')
console.log('═'.repeat(50))

async function testDatabaseTables() {
  console.log('\n📊 [TEST 1] Database Tables')
  console.log('─'.repeat(30))

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('❌ Missing Supabase credentials')
    return false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const tables = [
    'research_ai_conversations',
    'medical_knowledge', 
    'ai_suggestion_cache'
  ]

  let allTablesExist = true

  for (const table of tables) {
    try {
      const { error } = await supabase
        .schema('api')
        .from(table)
        .select('count')
        .limit(1)

      if (error) {
        console.log(`❌ Table api.${table}: ${error.message}`)
        allTablesExist = false
      } else {
        console.log(`✅ Table api.${table}: Accessible`)
      }
    } catch (err) {
      console.log(`❌ Table api.${table}: ${err.message}`)
      allTablesExist = false
    }
  }

  return allTablesExist
}

async function testVectorFunction() {
  console.log('\n🔍 [TEST 2] Vector Search Function')
  console.log('─'.repeat(30))

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Generate a test embedding
    const testEmbedding = Array(768).fill(0).map(() => Math.random() - 0.5)
    
    const { data, error } = await supabase.rpc('search_treatment_protocols', {
      query_embedding: testEmbedding,
      match_threshold: 0.1,
      match_count: 3
    })

    if (error) {
      console.log(`❌ Vector function: ${error.message}`)
      return false
    }

    console.log(`✅ Vector search function: Working (${data.length} results)`)
    return true
  } catch (err) {
    console.log(`❌ Vector function: ${err.message}`)
    return false
  }
}

async function testGeminiIntegration() {
  console.log('\n🧠 [TEST 3] Gemini AI Integration')
  console.log('─'.repeat(30))

  if (!GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY not configured')
    return false
  }

  try {
    // Test embedding generation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: 'Test embedding for irreversible pulpitis' }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768
        })
      }
    )

    if (!response.ok) {
      console.log(`❌ Gemini API: HTTP ${response.status}`)
      return false
    }

    const data = await response.json()
    const embedding = data.embedding.values

    if (embedding.length === 768) {
      console.log('✅ Gemini embeddings: Working (768 dimensions)')
      
      // Test chat completion
      const chatResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: 'What is the success rate of root canal treatment? (One sentence)' }]
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 50 }
          })
        }
      )

      if (chatResponse.ok) {
        const chatData = await chatResponse.json()
        const responseText = chatData.candidates[0].content.parts[0].text
        console.log('✅ Gemini chat: Working')
        console.log(`   Response: "${responseText.substring(0, 80)}..."`)
        return true
      } else {
        console.log('❌ Gemini chat: Failed')
        return false
      }
    } else {
      console.log(`❌ Gemini embeddings: Wrong dimensions (${embedding.length})`)
      return false
    }
  } catch (err) {
    console.log(`❌ Gemini integration: ${err.message}`)
    return false
  }
}

async function testMedicalKnowledge() {
  console.log('\n📚 [TEST 4] Medical Knowledge Base')
  console.log('─'.repeat(30))

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const { data, error } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('id, title, embedding')

    if (error) {
      console.log(`❌ Medical knowledge query: ${error.message}`)
      return false
    }

    const total = data.length
    const withEmbeddings = data.filter(item => item.embedding !== null).length

    console.log(`✅ Medical knowledge: ${total} entries`)
    console.log(`   With embeddings: ${withEmbeddings}/${total}`)

    if (withEmbeddings === 0) {
      console.log('⚠️  Run: node generate-medical-embeddings.js')
      return false
    }

    return withEmbeddings > 0
  } catch (err) {
    console.log(`❌ Medical knowledge: ${err.message}`)
    return false
  }
}

async function testCompleteFlow() {
  console.log('\n🔄 [TEST 5] Complete AI Flow')
  console.log('─'.repeat(30))

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Simulate the full treatment suggestion flow
    const queryText = "Diagnosis: Irreversible pulpitis. Tooth: 24."
    
    // Step 1: Generate query embedding
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: queryText }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768
        })
      }
    )

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate query embedding')
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.embedding.values

    // Step 2: Search medical knowledge
    const { data: knowledgeData, error: searchError } = await supabase
      .rpc('search_treatment_protocols', {
        query_embedding: queryEmbedding,
        diagnosis_filter: ['irreversible_pulpitis'],
        specialty_filter: 'endodontics',
        match_threshold: 0.1,
        match_count: 3
      })

    if (searchError) {
      throw new Error(`Vector search failed: ${searchError.message}`)
    }

    console.log(`✅ Vector search: Found ${knowledgeData.length} relevant documents`)

    if (knowledgeData.length > 0) {
      console.log(`   Top result: "${knowledgeData[0].title}" (${(knowledgeData[0].similarity * 100).toFixed(1)}% similarity)`)
      
      // Step 3: Test AI cache
      const { error: cacheError } = await supabase
        .schema('api')
        .from('ai_suggestion_cache')
        .insert({
          diagnosis: 'Irreversible pulpitis',
          tooth_number: '24',
          suggested_treatment: 'Root canal treatment with rotary instrumentation',
          confidence_score: 85,
          reasoning: 'Test reasoning from integration test',
          evidence_sources: [{ title: 'Test Paper', journal: 'Test Journal', year: 2024 }],
          ai_model: 'gemini-2.0-flash',
          processing_time: 150
        })

      if (cacheError) {
        console.log(`⚠️  Cache insert: ${cacheError.message}`)
      } else {
        console.log('✅ Cache insert: Working')
      }

      return true
    } else {
      console.log('❌ No relevant medical knowledge found')
      return false
    }

  } catch (err) {
    console.log(`❌ Complete flow: ${err.message}`)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting Complete AI Integration Tests...\n')

  const results = {
    database: await testDatabaseTables(),
    vectorFunction: await testVectorFunction(),
    gemini: await testGeminiIntegration(),
    medicalKnowledge: await testMedicalKnowledge(),
    completeFlow: await testCompleteFlow()
  }

  console.log('\n' + '═'.repeat(50))
  console.log('📊 TEST RESULTS SUMMARY')
  console.log('═'.repeat(50))
  console.log(`Database Tables:     ${results.database ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Vector Function:     ${results.vectorFunction ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Gemini Integration:  ${results.gemini ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Medical Knowledge:   ${results.medicalKnowledge ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Complete AI Flow:    ${results.completeFlow ? '✅ PASS' : '❌ FAIL'}`)
  console.log('═'.repeat(50))

  const allPassed = Object.values(results).every(result => result === true)
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED!')
    console.log('✅ Your AI integration is fully functional!')
    console.log('🚀 AI treatment suggestions should now work in your app')
  } else {
    console.log('\n⚠️  SOME TESTS FAILED')
    console.log('❌ Please address the failing components before using AI features')
    
    if (!results.database) {
      console.log('\n📋 To fix database issues:')
      console.log('   1. Run the SQL script: ai_database_setup.sql in Supabase SQL Editor')
      console.log('   2. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local')
    }
    
    if (!results.medicalKnowledge) {
      console.log('\n📋 To fix medical knowledge:')
      console.log('   1. Ensure the database setup completed successfully')
      console.log('   2. Run: node generate-medical-embeddings.js')
    }
  }

  console.log('\n')
  process.exit(allPassed ? 0 : 1)
}

runAllTests().catch(error => {
  console.error('💥 Test suite crashed:', error)
  process.exit(1)
})