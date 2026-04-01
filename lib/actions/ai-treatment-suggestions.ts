'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'
import { revalidatePath } from 'next/cache'

export interface AISuggestion {
  treatment: string
  confidence: number
  reasoning: string
  sources: Array<{
    title: string
    journal: string
    year: number
    doi?: string
  }>
  alternativeTreatments?: string[]
  contraindications?: string[]
}

/**
 * Get AI treatment suggestion based on diagnosis
 * Uses RAG (Retrieval Augmented Generation) with medical knowledge base
 */
export async function getAITreatmentSuggestionAction(params: {
  diagnosis: string
  toothNumber: string
  dentistId?: string
  patientContext?: {
    age?: number
    medicalHistory?: string
    previousTreatments?: string
  }
  queryComplexity?: 'simple' | 'educational'
  conversationContext?: import('@/lib/services/medical-conversation-parser').ConversationContext
}) {
  try {
    // Verify user is authenticated dentist
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    if (user.role !== 'dentist' || user.status !== 'active') {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    // Determine RAG parameters based on query complexity
    const queryComplexity = params.queryComplexity || 'simple'
    const matchCount = queryComplexity === 'educational' ? 8 : 5
    const contentChars = queryComplexity === 'educational' ? 2000 : 1200

    console.log('🤖 [AI TREATMENT] Generating suggestion for:', {
      diagnosis: params.diagnosis,
      toothNumber: params.toothNumber,
      queryComplexity,
      matchCount,
      contentChars
    })

    // Check cache - only for exact same diagnosis+tooth+complexity combo
    // Cache is aggressive, so only use for identical queries within 24 hours
    const { data: cachedSuggestion } = await supabase
      .from('ai_suggestion_cache')
      .select('*')
      .eq('diagnosis', params.diagnosis)
      .eq('tooth_number', params.toothNumber)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cachedSuggestion && queryComplexity === 'simple') {
      // Only serve cache for simple queries — educational queries always get fresh results
      console.log('✅ [AI TREATMENT] Cache hit, returning cached suggestion')

      // Increment hit count
      await supabase
        .from('ai_suggestion_cache')
        .update({ hit_count: (cachedSuggestion.hit_count || 0) + 1 })
        .eq('id', cachedSuggestion.id)

      return {
        success: true,
        data: {
          treatment: cachedSuggestion.suggested_treatment,
          confidence: cachedSuggestion.confidence_score,
          reasoning: cachedSuggestion.reasoning,
          sources: cachedSuggestion.evidence_sources,
          alternativeTreatments: cachedSuggestion.alternative_treatments,
          contraindications: cachedSuggestion.contraindications
        } as AISuggestion,
        cached: true
      }
    }

    // Generate new suggestion using Google Gemini + Vector Search
    const startTime = Date.now()

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return { success: false, error: 'GEMINI_API_KEY not configured. Please add it to .env.local' }
    }

    // Step 1: Generate embedding for the diagnosis query using Gemini
    // Include conversation context for better RAG retrieval (comorbidities affect treatment choices)
    const txCC = params.conversationContext
    const conditionsText = txCC?.medicalHistory?.medical_conditions?.join(', ') || ''
    const allergiesText = txCC?.medicalHistory?.allergies?.join(', ') || ''
    const queryText = `Diagnosis: ${params.diagnosis}. Tooth: ${params.toothNumber}. ${
      conditionsText ? `Comorbidities: ${conditionsText}. ` : ''
    }${allergiesText ? `Allergies: ${allergiesText}. ` : ''}${
      params.patientContext ? `Patient context: Age ${params.patientContext.age}, History: ${params.patientContext.medicalHistory}` : ''
    }`

    console.log('🔮 [AI TREATMENT] Generating 3072-dim query embedding with OpenAI...')

    const { generateEmbedding3072 } = await import('@/lib/services/openai-embeddings')

    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding3072(queryText)
      console.log('✅ [AI TREATMENT] OpenAI 3072-dim query embedding generated')
    } catch (error) {
      console.error('❌ [AI TREATMENT] OpenAI embedding generation failed:', error)
      return { success: false, error: 'Failed to generate query embedding with OpenAI' }
    }

    // Step 2: Search medical knowledge base using hybrid search (vector + full-text)
    console.log('🔍 [AI TREATMENT] Searching medical knowledge with hybrid search...')

    let relevantKnowledge: any[] | null = null
    let searchSource = 'hybrid'

    // Try hybrid search first (vector + BM25 full-text with RRF fusion)
    try {
      const { data: hybridResults, error: hybridError } = await supabase
        .schema('api')
        .rpc('hybrid_search_medical_knowledge', {
          query_text: queryText,
          query_embedding: queryEmbedding,
          match_count: matchCount,
          vector_weight: 0.55,    // Slightly favor vector for treatment (semantic similarity matters more)
          fulltext_weight: 0.45,
          rrf_k: 60,
          specialty_filter: null,
          diagnosis_filter: null,
          treatment_filter: null
        })

      if (!hybridError && hybridResults && hybridResults.length > 0) {
        relevantKnowledge = hybridResults.map((doc: any) => ({
          ...doc,
          similarity: doc.hybrid_score || doc.vector_similarity || 0
        }))
        searchSource = 'hybrid'
        console.log(`✅ [AI TREATMENT] Hybrid search found ${relevantKnowledge!.length} results`)
      } else if (hybridError) {
        console.warn('⚠️ [AI TREATMENT] Hybrid search not available:', hybridError.message?.substring(0, 80))
      }
    } catch (hybridErr) {
      console.warn('⚠️ [AI TREATMENT] Hybrid search failed, trying vector-only...')
    }

    // Fallback to pure vector search if hybrid didn't work
    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      try {
        const { data: rpcResults, error: rpcError } = await supabase
          .schema('api')
          .rpc('search_treatment_protocols', {
            query_embedding: queryEmbedding,
            diagnosis_filter: null,
            specialty_filter: null,
            match_threshold: 0.3,
            match_count: matchCount
          })

        if (!rpcError && rpcResults && rpcResults.length > 0) {
          relevantKnowledge = rpcResults
          searchSource = 'vector_rpc'
          console.log(`✅ [AI TREATMENT] Vector search found ${rpcResults.length} results`)
        } else if (rpcError) {
          console.log('⚠️ [AI TREATMENT] Vector RPC not available:', rpcError.message?.substring(0, 80))
        }
      } catch (rpcErr) {
        console.log('⚠️ [AI TREATMENT] RPC call failed, using text fallback')
      }
    }

    // Last fallback: direct text query
    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      console.log('🔄 [AI TREATMENT] Using direct table query fallback...')

      const searchTerms = params.diagnosis.toLowerCase().split(/[\s,/]+/).filter(t => t.length > 2)
      const orFilters = searchTerms.map(term =>
        `title.ilike.%${term}%,content.ilike.%${term}%`
      ).join(',')

      const { data: textResults, error: textError } = await supabase
        .schema('api')
        .from('medical_knowledge')
        .select('id, title, content, source_type, specialty, authors, journal, publication_year, doi, url, topics, diagnosis_keywords, treatment_keywords')
        .or(orFilters)
        .not('content', 'is', null)
        .limit(matchCount)

      if (!textError && textResults && textResults.length > 0) {
        relevantKnowledge = textResults.map(doc => ({ ...doc, similarity: 0.6 }))
        searchSource = 'text_fallback'
        console.log(`✅ [AI TREATMENT] Text fallback found ${textResults.length} results`)
      } else {
        console.log('🔄 [AI TREATMENT] Text search empty, fetching recent documents...')
        const { data: recentDocs } = await supabase
          .schema('api')
          .from('medical_knowledge')
          .select('id, title, content, source_type, specialty, authors, journal, publication_year, doi, url, topics')
          .not('content', 'is', null)
          .order('created_at', { ascending: false })
          .limit(matchCount)

        if (recentDocs && recentDocs.length > 0) {
          relevantKnowledge = recentDocs.map(doc => ({ ...doc, similarity: 0.4 }))
          searchSource = 'recent_fallback'
          console.log(`✅ [AI TREATMENT] Fallback: using ${recentDocs.length} recent documents`)
        }
      }
    }

    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      console.warn('⚠️ [AI TREATMENT] No relevant medical knowledge found')
      return {
        success: false,
        error: 'No relevant medical knowledge found. Please upload textbooks/research papers to the knowledge base first.'
      }
    }

    console.log(`📚 [AI TREATMENT] Found ${relevantKnowledge.length} relevant documents`)

    // Step 3: Score and rank documents by quality + relevance
    const scoredDocs = relevantKnowledge.map((doc: any) => {
      // Quality score based on source type
      const sourceTypeWeights: Record<string, number> = {
        'guideline': 1.0,        // Clinical guidelines are gold standard
        'research_paper': 0.9,   // Peer-reviewed research
        'clinical_protocol': 0.85,
        'textbook': 0.8,
        'case_study': 0.6
      }
      const qualityWeight = sourceTypeWeights[doc.source_type] || 0.5

      // Recency bonus: newer papers get a slight boost
      const currentYear = new Date().getFullYear()
      const yearBonus = doc.publication_year
        ? Math.max(0, 1 - ((currentYear - doc.publication_year) / 30)) * 0.15
        : 0

      // Combined score: similarity * quality + recency bonus
      const combinedScore = (doc.similarity || 0.5) * qualityWeight + yearBonus
      return { ...doc, combinedScore, qualityWeight }
    })

    // Sort by combined score (best first)
    scoredDocs.sort((a: any, b: any) => b.combinedScore - a.combinedScore)

    // Build rich context with article metadata
    const context = scoredDocs.map((doc: any, idx: number) => {
      const evidenceLevel = doc.source_type === 'guideline' ? 'HIGH (Clinical Guideline)' :
        doc.source_type === 'research_paper' ? 'MODERATE-HIGH (Research Paper)' :
        doc.source_type === 'clinical_protocol' ? 'MODERATE (Protocol)' :
        doc.source_type === 'textbook' ? 'MODERATE (Textbook)' : 'LOW (Case Study)'

      return `[Source ${idx + 1}] Evidence Level: ${evidenceLevel}\n` +
        `Title: ${doc.title}\n` +
        `Authors: ${doc.authors || 'N/A'}\n` +
        `Journal: ${doc.journal || 'N/A'} (${doc.publication_year || 'N/A'})\n` +
        `DOI: ${doc.doi || 'N/A'}\n` +
        `Relevance: ${((doc.similarity || 0.5) * 100).toFixed(0)}% | Quality Score: ${(doc.combinedScore * 100).toFixed(0)}%\n` +
        `Content:\n${doc.content.substring(0, contentChars)}\n`
    }).join('\n' + '='.repeat(60) + '\n\n')

    console.log(`📊 [AI TREATMENT] Ranked ${scoredDocs.length} documents by quality+relevance`)

    // Step 3.5: Fetch clinical data from your practice (Phase 2 RAG)
    let clinicalContext = ''
    if (params.dentistId || user?.id) {
      try {
        const { getClinicalDataContext } = await import('@/lib/services/dental-rag-service')
        const clinicalData = await getClinicalDataContext({
          diagnosis: params.diagnosis,
          treatmentType: params.diagnosis, // Also search by treatment type
          toothNumber: params.toothNumber,
          dentistId: params.dentistId || user.id
        })

        if (clinicalData.treatmentOutcomes.length > 0 || clinicalData.recentConsultations.length > 0) {
          clinicalContext = '\n\n' + '═'.repeat(60) + '\n'
          clinicalContext += 'YOUR CLINIC DATA (from your practice records):\n'
          clinicalContext += '═'.repeat(60) + '\n\n'

          if (clinicalData.treatmentOutcomes.length > 0) {
            clinicalContext += 'Treatment Outcomes in Your Practice:\n'
            for (const outcome of clinicalData.treatmentOutcomes) {
              clinicalContext += `- ${outcome.treatmentType}: ${outcome.totalCases} cases, ${outcome.completedCases} completed (${outcome.successRate}% completion), avg ${outcome.avgVisits} visits\n`
            }
            clinicalContext += '\n'
          }

          if (clinicalData.recentConsultations.length > 0) {
            clinicalContext += `Recent Consultations with Similar Diagnosis (${clinicalData.recentConsultations.length} cases):\n`
            for (const c of clinicalData.recentConsultations.slice(0, 5)) {
              clinicalContext += `- [${c.date}] Dx: ${c.diagnosis} → Tx: ${c.treatmentPlan} (Prognosis: ${c.prognosis})\n`
            }
          }

          console.log(`🏥 [AI TREATMENT] Added clinical practice data: ${clinicalData.summary}`)
        }
      } catch (clinicalError) {
        console.warn('⚠️ [AI TREATMENT] Clinical data fetch failed (non-critical):', clinicalError)
      }
    }

    // Step 4: Call LLM for treatment recommendation
    console.log('🧠 [AI TREATMENT] Calling Claude for evidence-based recommendation...')

    const { generateTreatmentSuggestion } = await import('@/lib/services/gemini-ai')

    let suggestion: AISuggestion
    try {
      // Prepare medical context from vector search results + clinical data
      const medicalContext = scoredDocs.map((doc: any) => ({
        title: doc.title,
        content: doc.content + (clinicalContext || ''), // Append clinical data to first doc only
        authors: doc.authors,
        journal: doc.journal,
        year: doc.publication_year,
        doi: doc.doi
      }))

      // Add clinical context to the first document so it gets passed to the LLM
      if (clinicalContext && medicalContext.length > 0) {
        medicalContext[0].content = medicalContext[0].content + clinicalContext
      }

      suggestion = await generateTreatmentSuggestion({
        diagnosis: params.diagnosis,
        toothNumber: params.toothNumber,
        medicalContext,
        patientContext: params.patientContext,
        conversationContext: params.conversationContext
      })
    } catch (error) {
      console.error('❌ [AI TREATMENT] Gemini call failed:', error)
      return { success: false, error: 'Failed to generate AI recommendation with Gemini' }
    }

    const processingTime = Date.now() - startTime

    console.log('✅ [AI TREATMENT] Suggestion generated:', {
      treatment: suggestion.treatment,
      confidence: suggestion.confidence,
      processingTime: `${processingTime}ms`
    })

    // Step 5: Cache the suggestion
    await supabase
      .from('ai_suggestion_cache')
      .insert({
        diagnosis: params.diagnosis,
        tooth_number: params.toothNumber,
        patient_context: params.patientContext || {},
        suggested_treatment: suggestion.treatment,
        confidence_score: suggestion.confidence,
        reasoning: suggestion.reasoning,
        evidence_sources: suggestion.sources,
        alternative_treatments: suggestion.alternativeTreatments || [],
        contraindications: suggestion.contraindications || [],
        ai_model: 'gemini-2.5-flash',
        processing_time: processingTime
      })

    return {
      success: true,
      data: suggestion,
      cached: false,
      processingTime
    }

  } catch (error) {
    console.error('❌ [AI TREATMENT] Error:', error)
    return { success: false, error: 'Failed to generate treatment suggestion' }
  }
}

/**
 * Clear AI suggestion cache for specific diagnosis
 */
export async function clearAISuggestionCacheAction(diagnosis?: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createServiceClient()

    let query = supabase.from('ai_suggestion_cache').delete()

    if (diagnosis) {
      query = query.eq('diagnosis', diagnosis)
    } else {
      // Clear expired cache entries
      query = query.lt('expires_at', new Date().toISOString())
    }

    const { error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    console.log('✅ [AI TREATMENT] Cache cleared')

    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('❌ [AI TREATMENT] Cache clear error:', error)
    return { success: false, error: 'Failed to clear cache' }
  }
}

/**
 * Get AI suggestion cache statistics
 */
export async function getAICacheStatsAction() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createServiceClient()

    const { data: cacheEntries } = await supabase
      .from('ai_suggestion_cache')
      .select('*')

    if (!cacheEntries) {
      return { success: true, data: { total: 0, active: 0, expired: 0, totalHits: 0 } }
    }

    const now = new Date()
    const stats = {
      total: cacheEntries.length,
      active: cacheEntries.filter(e => new Date(e.expires_at) > now).length,
      expired: cacheEntries.filter(e => new Date(e.expires_at) <= now).length,
      totalHits: cacheEntries.reduce((sum, e) => sum + (e.hit_count || 0), 0)
    }

    return { success: true, data: stats }

  } catch (error) {
    console.error('❌ [AI TREATMENT] Cache stats error:', error)
    return { success: false, error: 'Failed to fetch cache statistics' }
  }
}
