/**
 * Test RAG (Retrieval-Augmented Generation) System
 * Verifies vector search, embedding generation, and medical knowledge retrieval
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pxpfbeqlqqrjpkiqlxmi.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU'
const GEMINI_API_KEY = 'AIzaSyDWpUU2GkXSMNxrn-CanK0Si4Gq3Ko2ZM4'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testRAGSystem() {
  console.log('🧪 Testing RAG System Implementation\n')
  console.log('=' .repeat(80))

  // Test 1: Check medical knowledge base
  console.log('\n📚 Test 1: Checking Medical Knowledge Base...')
  const { data: documents, error: docError, count } = await supabase
    .schema('api')
    .from('medical_knowledge')
    .select('id, title, source_type, specialty', { count: 'exact' })
    .limit(10)

  if (docError) {
    console.error('❌ Error:', docError.message)
    return
  }

  console.log(`✅ Found ${count} documents in knowledge base`)
  if (documents && documents.length > 0) {
    console.log('\nSample documents:')
    documents.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.title}`)
      console.log(`     Type: ${doc.source_type} | Specialty: ${doc.specialty}`)
    })
  } else {
    console.log('⚠️  No documents found. Upload research papers via the UI.')
  }

  // Test 2: Generate embedding using Gemini
  console.log('\n\n🧠 Test 2: Testing Gemini Embedding Generation...')
  const testQuery = 'What is the success rate of root canal treatment?'
  console.log(`Query: "${testQuery}"`)

  try {
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: testQuery }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768
        })
      }
    )

    if (!embeddingResponse.ok) {
      console.error('❌ Gemini API error:', embeddingResponse.status)
      return
    }

    const embeddingData = await embeddingResponse.json()
    const embedding = embeddingData.embedding.values

    console.log('✅ Embedding generated successfully')
    console.log(`   Dimensions: ${embedding.length}`)
    console.log(`   Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(3)).join(', ')}, ...]`)

    // Test 3: Vector similarity search
    if (count > 0) {
      console.log('\n\n🔍 Test 3: Testing Vector Similarity Search...')
      console.log('Searching for relevant medical documents...')

      const { data: searchResults, error: searchError } = await supabase
        .schema('api')
        .rpc('search_treatment_protocols', {
          query_embedding: embedding,
          diagnosis_filter: null,
          treatment_filter: null,
          specialty_filter: null,
          match_threshold: 0.5, // Lower threshold for testing
          match_count: 5
        })

      if (searchError) {
        console.error('❌ Vector search error:', searchError.message)
        console.log('💡 Make sure the function is created. Run the migration SQL.')
        return
      }

      if (searchResults && searchResults.length > 0) {
        console.log(`✅ Found ${searchResults.length} relevant documents\n`)
        searchResults.forEach((doc, idx) => {
          console.log(`${idx + 1}. ${doc.title}`)
          console.log(`   Similarity: ${(doc.similarity * 100).toFixed(1)}%`)
          console.log(`   Type: ${doc.source_type}`)
          console.log(`   Content: ${doc.content.substring(0, 100)}...`)
          console.log()
        })
      } else {
        console.log('⚠️  No relevant documents found (similarity threshold may be too high)')
        console.log('   Try lowering the match_threshold or upload more documents')
      }
    } else {
      console.log('\n⏭️  Skipping vector search test (no documents in knowledge base)')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    return
  }

  // Test 4: Check vector function exists
  console.log('\n📝 Test 4: Checking Database Functions...')

  const { data: functions, error: fnError } = await supabase
    .rpc('search_treatment_protocols', {
      query_embedding: new Array(768).fill(0),
      diagnosis_filter: null,
      treatment_filter: null,
      specialty_filter: null,
      match_threshold: 0.7,
      match_count: 1
    })

  if (fnError) {
    console.error('❌ Function not found:', fnError.message)
    console.log('💡 Run the migration: lib/db/migrations/add_medical_knowledge_vector_store.sql')
  } else {
    console.log('✅ search_treatment_protocols() function exists')
  }

  // Test 5: Check indexes
  console.log('\n\n🗂️  Test 5: Checking Database Indexes...')
  const { data: indexes, error: idxError } = await supabase
    .rpc('pg_indexes')
    .eq('tablename', 'medical_knowledge')

  if (!idxError && indexes) {
    console.log(`✅ Found ${indexes.length} indexes on medical_knowledge table`)
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 Test Summary:\n')
  console.log(`✅ Knowledge Base: ${count} documents`)
  console.log(`✅ Gemini Embeddings: Working`)
  console.log(`✅ Vector Search: ${searchError ? 'Needs setup' : 'Working'}`)
  console.log(`✅ Database Functions: ${fnError ? 'Needs migration' : 'Working'}`)

  console.log('\n🎯 Next Steps:')
  if (count === 0) {
    console.log('   1. Upload research papers via Medical Knowledge Uploader UI')
    console.log('   2. Login as dentist → Medical Knowledge Uploader')
    console.log('   3. Add 3-5 research papers or clinical protocols')
  } else {
    console.log('   1. ✅ Knowledge base has documents')
    console.log('   2. Test RAG chatbot in Research Projects tab')
    console.log('   3. Ask: "What does the literature say about RCT success rates?"')
  }

  console.log('\n📚 Documentation:')
  console.log('   - Full Guide: RAG_SYSTEM_COMPLETE_GUIDE.md')
  console.log('   - Quick Start: RESEARCH_AI_QUICK_START.md')

  console.log('\n🎉 RAG System Test Complete!')
}

// Run the test
testRAGSystem().catch(console.error)
