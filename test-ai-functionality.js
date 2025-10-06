#!/usr/bin/env node

// Simple test script to check AI functionality
const { createClient } = require('@supabase/supabase-js')

async function testAIFunctionality() {
  console.log('🧪 Testing AI functionality...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase configuration missing')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  console.log('✅ Supabase client created')
  
  // Test 1: Check if search_treatment_protocols function exists
  console.log('\n🔍 Testing vector search function...')
  try {
    const { data, error } = await supabase
      .schema('api')
      .rpc('search_treatment_protocols', {
        query_embedding: new Array(768).fill(0.1), // Dummy embedding
        diagnosis_filter: ['test'],
        specialty_filter: 'endodontics',
        match_threshold: 0.5,
        match_count: 1
      })
    
    if (error) {
      console.error('❌ Vector search function error:', error.message)
    } else {
      console.log('✅ Vector search function exists and callable')
      console.log('📊 Results count:', data?.length || 0)
    }
  } catch (err) {
    console.error('❌ Vector search function test failed:', err.message)
  }
  
  // Test 2: Check medical knowledge table
  console.log('\n📚 Testing medical knowledge table...')
  try {
    const { data, error, count } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('id, title', { count: 'exact' })
      .limit(1)
    
    if (error) {
      console.error('❌ Medical knowledge table error:', error.message)
    } else {
      console.log(`✅ Medical knowledge table exists with ${count} records`)
      if (data && data.length > 0) {
        console.log('📖 Sample record:', data[0])
      }
    }
  } catch (err) {
    console.error('❌ Medical knowledge table test failed:', err.message)
  }
  
  // Test 3: Check Gemini API key
  console.log('\n🧠 Testing Gemini API key...')
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    console.log('✅ Gemini API key found')
    console.log('🔑 Key starts with:', geminiKey.substring(0, 10) + '...')
  } else {
    console.error('❌ Gemini API key not found')
  }
  
  console.log('\n🎯 Test completed!')
}

testAIFunctionality()