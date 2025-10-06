'use server'

import { createServiceClient } from '@/lib/supabase/server'
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
  patientContext?: {
    age?: number
    medicalHistory?: string
    previousTreatments?: string
  }
}) {
  try {
    const supabase = await createServiceClient()

    // Verify user is authenticated dentist
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { success: false, error: 'Access denied' }
    }

    console.log('🤖 [AI TREATMENT] Generating suggestion for:', {
      diagnosis: params.diagnosis,
      toothNumber: params.toothNumber
    })

    // Check cache first
    const { data: cachedSuggestion } = await supabase
      .from('ai_suggestion_cache')
      .select('*')
      .eq('diagnosis', params.diagnosis)
      .eq('tooth_number', params.toothNumber)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cachedSuggestion) {
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
    const queryText = `Diagnosis: ${params.diagnosis}. Tooth: ${params.toothNumber}. ${
      params.patientContext ? `Patient context: Age ${params.patientContext.age}, History: ${params.patientContext.medicalHistory}` : ''
    }`

    console.log('🔮 [AI TREATMENT] Generating 768-dim query embedding with Gemini...')

    const { generateEmbedding } = await import('@/lib/services/gemini-ai')

    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(queryText, 'RETRIEVAL_QUERY')
      console.log('✅ [AI TREATMENT] Gemini query embedding generated')
    } catch (error) {
      console.error('❌ [AI TREATMENT] Gemini embedding generation failed:', error)
      return { success: false, error: 'Failed to generate query embedding with Gemini' }
    }

    // Step 2: Search medical knowledge base using vector similarity (with api schema)
    const diagnosisKeywords = [params.diagnosis.toLowerCase().replace(/\s+/g, '_')]

    console.log('🔍 [AI TREATMENT] Searching medical knowledge with vector similarity...')

    let relevantKnowledge: any[] | null = null
    let searchSource = 'vector'

    const { data: vectorResults, error: searchError } = await supabase
      .schema('api')
      .rpc('search_treatment_protocols', {
        query_embedding: queryEmbedding,
        diagnosis_filter: diagnosisKeywords,
        specialty_filter: 'endodontics',
        match_threshold: 0.5,
        match_count: 5
      })

    if (searchError) {
      console.error('❌ [AI TREATMENT] Vector search failed:', searchError)
      console.log('💡 [AI TREATMENT] Falling back to direct query...')
      
      // Fallback to direct query if vector search fails
      const { data: fallbackKnowledge, error: fallbackError } = await supabase
        .schema('api')
        .from('medical_knowledge')
        .select('*')
        .not('embedding', 'is', null)
        .limit(5)

      if (fallbackError) {
        return { success: false, error: 'Failed to search medical knowledge base' }
      }
      
      relevantKnowledge = fallbackKnowledge
      searchSource = 'fallback'
    } else {
      relevantKnowledge = vectorResults
      console.log(`✅ [AI TREATMENT] Vector search successful with ${vectorResults?.length || 0} results`)
    }

    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      console.warn('⚠️ [AI TREATMENT] No relevant medical knowledge found')
      return {
        success: false,
        error: 'No relevant medical knowledge found. Please upload textbooks/research papers to the knowledge base first.'
      }
    }

    console.log(`📚 [AI TREATMENT] Found ${relevantKnowledge.length} relevant documents`)

    // Step 3: Build context from retrieved documents
    const context = relevantKnowledge.map((doc: any) =>
      `Title: ${doc.title}\n` +
      `Source: ${doc.journal || 'N/A'} (${doc.publication_year || 'N/A'})\n` +
      `Content: ${doc.content.substring(0, 1500)}...\n`
    ).join('\n---\n\n')

    // Step 4: Call Gemini for treatment recommendation
    console.log('🧠 [AI TREATMENT] Calling Gemini 1.5 Flash for recommendation...')

    const { generateTreatmentSuggestion } = await import('@/lib/services/gemini-ai')

    let suggestion: AISuggestion
    try {
      // Prepare medical context from vector search results
      const medicalContext = relevantKnowledge.map((doc: any) => ({
        title: doc.title,
        content: doc.content,
        journal: doc.journal,
        year: doc.publication_year,
        doi: doc.doi
      }))

      suggestion = await generateTreatmentSuggestion({
        diagnosis: params.diagnosis,
        toothNumber: params.toothNumber,
        medicalContext,
        patientContext: params.patientContext
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
        ai_model: 'gemini-1.5-flash',
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
    const supabase = await createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

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
    const supabase = await createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

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
