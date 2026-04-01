import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/services/gemini-ai'

export async function GET() {
  try {
    const supabase = await createServiceClient()
    const testQuery = 'irreversible pulpitis root canal treatment endodontics'

    // Step 1: Generate embedding
    console.log('🧪 [HYBRID TEST] Generating embedding for test query...')
    const queryEmbedding = await generateEmbedding(testQuery, 'RETRIEVAL_QUERY')
    console.log('✅ [HYBRID TEST] Embedding generated, dimensions:', queryEmbedding.length)

    // Step 2: Try hybrid search
    console.log('🧪 [HYBRID TEST] Calling hybrid_search_medical_knowledge...')
    const { data: hybridResults, error: hybridError } = await supabase
      .schema('api')
      .rpc('hybrid_search_medical_knowledge', {
        query_text: testQuery,
        query_embedding: queryEmbedding,
        match_count: 5,
        vector_weight: 0.5,
        fulltext_weight: 0.5,
        rrf_k: 60,
        specialty_filter: null,
        diagnosis_filter: null,
        treatment_filter: null
      })

    // Step 3: Try vector-only search for comparison
    console.log('🧪 [HYBRID TEST] Calling search_treatment_protocols (vector-only)...')
    const { data: vectorResults, error: vectorError } = await supabase
      .schema('api')
      .rpc('search_treatment_protocols', {
        query_embedding: queryEmbedding,
        diagnosis_filter: null,
        treatment_filter: null,
        specialty_filter: null,
        match_threshold: 0.3,
        match_count: 5
      })

    // Step 4: Check if search_vector column exists
    const { data: columnCheck, error: columnError } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('id, title, search_vector')
      .limit(1)

    return NextResponse.json({
      test: 'hybrid_search',
      query: testQuery,
      embeddingDimensions: queryEmbedding.length,
      hybrid: {
        success: !hybridError,
        error: hybridError?.message || null,
        resultCount: hybridResults?.length || 0,
        results: hybridResults?.map((r: any) => ({
          title: r.title?.substring(0, 80),
          vector_similarity: r.vector_similarity,
          fulltext_rank: r.fulltext_rank,
          hybrid_score: r.hybrid_score,
          source_type: r.source_type
        })) || []
      },
      vectorOnly: {
        success: !vectorError,
        error: vectorError?.message || null,
        resultCount: vectorResults?.length || 0,
        results: vectorResults?.map((r: any) => ({
          title: r.title?.substring(0, 80),
          similarity: r.similarity,
          source_type: r.source_type
        })) || []
      },
      searchVectorColumn: {
        exists: !columnError,
        error: columnError?.message || null,
        hasData: columnCheck && columnCheck.length > 0 ? !!columnCheck[0].search_vector : false
      }
    })
  } catch (error: any) {
    console.error('❌ [HYBRID TEST] Error:', error)
    return NextResponse.json({
      test: 'hybrid_search',
      error: error.message,
      stack: error.stack?.substring(0, 300)
    }, { status: 500 })
  }
}
