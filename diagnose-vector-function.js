/**
 * Diagnose Vector Function Issues
 * Check what's preventing the vector function from working
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Diagnosing Vector Function Issues...\n')

async function diagnoseVectorFunction() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Check if pgvector extension exists
  console.log('🔧 [CHECK 1] pgvector extension...')
  try {
    const { data, error } = await supabase.rpc('exec', {
      sql: "SELECT * FROM pg_extension WHERE extname = 'vector';"
    })
    
    if (error) {
      console.log('❌ Cannot check extensions via RPC')
    } else {
      console.log('✅ Extension check completed')
    }
  } catch (err) {
    console.log('⚠️  Cannot check extensions programmatically')
  }

  // 2. Check if api schema exists
  console.log('\n🗂️  [CHECK 2] API schema access...')
  try {
    const { data, error } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('count')
      .limit(1)

    if (error) {
      console.log('❌ API schema access failed:', error.message)
    } else {
      console.log('✅ API schema accessible')
    }
  } catch (err) {
    console.log('❌ API schema error:', err.message)
  }

  // 3. Try calling the function with full schema name
  console.log('\n🔍 [CHECK 3] Function with api schema prefix...')
  try {
    const testEmbedding = Array(768).fill(0.1) // Simple test embedding
    
    const { data, error } = await supabase.rpc('search_treatment_protocols', {
      query_embedding: testEmbedding,
      match_threshold: 0.1,
      match_count: 3
    }, { schema: 'api' })

    if (error) {
      console.log('❌ Function call with api schema failed:', error.message)
    } else {
      console.log('✅ Function works with api schema!')
      console.log(`   Found ${data.length} results`)
    }
  } catch (err) {
    console.log('❌ Function call error:', err.message)
  }

  // 4. Try different approach - check if function exists at all
  console.log('\n📋 [CHECK 4] Alternative vector search approach...')
  try {
    // Try a direct SQL query instead of RPC
    const testEmbedding = `[${Array(768).fill(0.1).join(',')}]`
    
    const { data, error } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('id, title, embedding')
      .not('embedding', 'is', null)
      .limit(3)

    if (error) {
      console.log('❌ Direct medical knowledge query failed:', error.message)
    } else {
      console.log('✅ Direct query works!')
      console.log(`   Found ${data.length} entries with embeddings`)
      
      // Try manual similarity calculation
      if (data.length > 0) {
        console.log('   First entry has embedding:', data[0].embedding ? 'Yes' : 'No')
        console.log('   Title:', data[0].title)
      }
    }
  } catch (err) {
    console.log('❌ Direct query error:', err.message)
  }

  // 5. Test Gemini service directly
  console.log('\n🤖 [CHECK 5] Gemini service integration...')
  try {
    const { generateTreatmentSuggestion } = require('./lib/services/gemini-ai')
    
    // Test with minimal data (bypassing vector search)
    const testMedicalContext = [
      {
        title: 'Test Medical Knowledge',
        content: 'Root canal treatment is effective for irreversible pulpitis.',
        journal: 'Test Journal',
        year: 2024
      }
    ]
    
    const suggestion = await generateTreatmentSuggestion({
      diagnosis: 'Irreversible pulpitis',
      toothNumber: '24',
      medicalContext: testMedicalContext,
      patientContext: { age: 35 }
    })
    
    console.log('✅ Gemini treatment suggestion works!')
    console.log('   Treatment:', suggestion.treatment)
    console.log('   Confidence:', suggestion.confidence)
    
  } catch (err) {
    console.log('❌ Gemini service error:', err.message)
  }

  // 6. Check if the issue is in the AI treatment action
  console.log('\n🔧 [CHECK 6] AI treatment action workflow...')
  try {
    // Let's see what happens when we bypass the vector search
    console.log('   Testing vector search bypass...')
    
    // We can test if the issue is specifically the RPC call
    const testEmbedding = Array(768).fill(0.1)
    
    // Try raw SQL approach
    const rawQuery = `
      SELECT id, title, content, specialty, authors, journal, publication_year
      FROM api.medical_knowledge 
      WHERE embedding IS NOT NULL 
      LIMIT 3
    `
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: rawQuery })
    
    if (error) {
      console.log('❌ Raw SQL execution failed:', error.message)
      console.log('   This suggests exec_sql RPC is not available')
    } else {
      console.log('✅ Raw SQL works - data available for AI')
    }
    
  } catch (err) {
    console.log('❌ AI action workflow test error:', err.message)
  }

  console.log('\n🎯 DIAGNOSIS SUMMARY:')
  console.log('═'.repeat(50))
  console.log('Based on the checks above, the likely issue is:')
  console.log('1. Vector function may not be created in the right schema')
  console.log('2. RPC calls may need different approach')
  console.log('3. pgvector extension may not be enabled')
  console.log('\n📋 RECOMMENDED FIXES:')
  console.log('1. Run this in Supabase SQL Editor:')
  console.log('   CREATE EXTENSION IF NOT EXISTS vector;')
  console.log('2. Ensure function is in api schema (not public)')
  console.log('3. Check if RPC permissions are granted')
}

diagnoseVectorFunction().catch(error => {
  console.error('💥 Diagnosis failed:', error)
  process.exit(1)
})