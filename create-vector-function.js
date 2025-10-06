/**
 * Create Vector Search Function
 * Creates the missing search_treatment_protocols function
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Creating Vector Search Function...\n')

async function createVectorFunction() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Create the vector search function
  const functionSQL = `
    CREATE OR REPLACE FUNCTION api.search_treatment_protocols (
        query_embedding vector(768),
        diagnosis_filter TEXT[] DEFAULT NULL,
        treatment_filter TEXT[] DEFAULT NULL,
        specialty_filter TEXT DEFAULT NULL,
        match_threshold FLOAT DEFAULT 0.5,
        match_count INTEGER DEFAULT 5
    )
    RETURNS TABLE (
        id UUID,
        title TEXT,
        content TEXT,
        source_type TEXT,
        specialty TEXT,
        authors TEXT,
        journal TEXT,
        publication_year INTEGER,
        doi TEXT,
        url TEXT,
        similarity FLOAT,
        topics TEXT[]
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
        RETURN QUERY
        SELECT
            mk.id,
            mk.title,
            mk.content,
            mk.source_type,
            mk.specialty,
            mk.authors,
            mk.journal,
            mk.publication_year,
            mk.doi,
            mk.url,
            1 - (mk.embedding <=> query_embedding) AS similarity,
            mk.topics
        FROM api.medical_knowledge mk
        WHERE
            mk.embedding IS NOT NULL
            AND 1 - (mk.embedding <=> query_embedding) > match_threshold
            AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
            AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
            AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
        ORDER BY mk.embedding <=> query_embedding
        LIMIT match_count;
    END;
    $$;
  `

  console.log('📊 Creating vector search function...')

  try {
    // Try to execute the function creation SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: functionSQL
    })

    if (error) {
      console.log('⚠️  exec_sql RPC not available, trying alternative approach...')
      
      // Try creating a simple test function first to see if we can create functions at all
      const simpleTestSQL = `
        CREATE OR REPLACE FUNCTION api.test_function() 
        RETURNS TEXT 
        LANGUAGE plpgsql 
        AS $$ 
        BEGIN 
          RETURN 'Function creation works!'; 
        END; 
        $$;
      `
      
      const { error: testError } = await supabase.rpc('exec_sql', {
        sql_query: simpleTestSQL
      })

      if (testError) {
        console.error('❌ Cannot create functions via RPC:', testError.message)
        console.log('\n📋 MANUAL SETUP REQUIRED:')
        console.log('──────────────────────────────────────────────────')
        console.log('Please run this SQL in your Supabase SQL Editor:')
        console.log(functionSQL)
        console.log('──────────────────────────────────────────────────')
        console.log('Or run the file: fix_vector_search.sql')
        process.exit(1)
      } else {
        console.log('✅ Test function created, but main function creation failed')
        console.log('❌ Error:', error.message)
        process.exit(1)
      }
    } else {
      console.log('✅ Vector search function created successfully!')
    }

    // Grant permissions
    const grantSQL = `
      GRANT EXECUTE ON FUNCTION api.search_treatment_protocols TO authenticated;
      GRANT EXECUTE ON FUNCTION api.search_treatment_protocols TO service_role;
    `

    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql_query: grantSQL
    })

    if (grantError) {
      console.log('⚠️  Grant permissions may need to be set manually')
    } else {
      console.log('✅ Permissions granted')
    }

  } catch (err) {
    console.error('❌ Error creating function:', err.message)
    console.log('\n📋 MANUAL SETUP REQUIRED:')
    console.log('Please run the SQL file: fix_vector_search.sql in Supabase SQL Editor')
    process.exit(1)
  }

  // Test the function
  console.log('\n🧪 Testing vector search function...')
  try {
    const testEmbedding = Array(768).fill(0).map(() => Math.random() - 0.5)
    
    const { data, error: testError } = await supabase.rpc('search_treatment_protocols', {
      query_embedding: testEmbedding,
      match_threshold: 0.1,
      match_count: 3
    })

    if (testError) {
      console.log('❌ Function test failed:', testError.message)
      process.exit(1)
    }

    console.log(`✅ Function test passed! Found ${data.length} results`)
    console.log('🎉 AI Integration is now ready!')

  } catch (err) {
    console.error('❌ Function test error:', err.message)
    process.exit(1)
  }
}

createVectorFunction().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})