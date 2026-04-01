'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'

export interface AIDiagnosisSuggestion {
  diagnosis: string
  confidence: number
  reasoning: string
  clinicalSignificance: string
  differentialDiagnoses: string[]
  recommendedTests?: string[]
  sources: Array<{
    title: string
    journal: string
    year: number
    doi?: string
  }>
}

/**
 * Get AI diagnosis suggestions based on symptoms and clinical findings
 * Uses RAG (Retrieval Augmented Generation) with medical knowledge base
 */
export async function getAIDiagnosisSuggestionAction(params: {
  symptoms: string[]
  painCharacteristics?: {
    quality?: string
    intensity?: number
    location?: string
    duration?: string
  }
  clinicalFindings?: string
  toothNumber?: string
  patientContext?: {
    age?: number
    medicalHistory?: string
  }
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

    console.log('🤖 [AI DIAGNOSIS] Generating suggestion for symptoms:', params.symptoms)

    // Build query text from symptoms and clinical data
    const symptomText = params.symptoms.join(', ')
    const painText = params.painCharacteristics
      ? `Pain: ${params.painCharacteristics.quality || ''} ${params.painCharacteristics.intensity ? `(${params.painCharacteristics.intensity}/10)` : ''} in ${params.painCharacteristics.location || 'tooth'}`
      : ''
    const clinicalText = params.clinicalFindings || ''
    const toothText = params.toothNumber ? `Tooth ${params.toothNumber}` : ''

    const contextKey = params.conversationContext?.chiefComplaint?.primary_complaint?.substring(0, 40) || ''
    const cacheKey = `${symptomText}_${painText}_${toothText}_${contextKey}`.substring(0, 200)

    // Check cache first
    const { data: cachedSuggestion } = await supabase
      .from('ai_diagnosis_cache')
      .select('*')
      .eq('symptoms_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cachedSuggestion) {
      console.log('✅ [AI DIAGNOSIS] Cache hit, returning cached suggestion')

      // Increment hit count
      await supabase
        .from('ai_diagnosis_cache')
        .update({ hit_count: (cachedSuggestion.hit_count || 0) + 1 })
        .eq('id', cachedSuggestion.id)

      return {
        success: true,
        data: {
          diagnosis: cachedSuggestion.suggested_diagnosis,
          confidence: cachedSuggestion.confidence_score,
          reasoning: cachedSuggestion.reasoning,
          clinicalSignificance: cachedSuggestion.clinical_significance,
          differentialDiagnoses: cachedSuggestion.differential_diagnoses,
          recommendedTests: cachedSuggestion.recommended_tests,
          sources: cachedSuggestion.evidence_sources
        } as AIDiagnosisSuggestion,
        cached: true
      }
    }

    // Generate new suggestion using Google Gemini + Vector Search
    const startTime = Date.now()

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return { success: false, error: 'GEMINI_API_KEY not configured. Please add it to .env.local' }
    }

    // Step 1: Generate embedding for the symptom query using Gemini
    // Include conversation context for richer RAG retrieval
    const ccContext = params.conversationContext
    const contextText = ccContext
      ? `Chief complaint: ${ccContext.chiefComplaint?.primary_complaint || ''}. ` +
        `${ccContext.medicalHistory?.medical_conditions?.length ? `Medical conditions: ${ccContext.medicalHistory.medical_conditions.join(', ')}. ` : ''}` +
        `${ccContext.hopi?.associated_symptoms?.length ? `Associated symptoms: ${ccContext.hopi.associated_symptoms.join(', ')}.` : ''}`
      : ''
    const queryText = `Symptoms: ${symptomText}. ${painText}. ${clinicalText}. ${toothText}. ${contextText} ${
      params.patientContext ? `Patient: Age ${params.patientContext.age}, History: ${params.patientContext.medicalHistory}` : ''
    }`

    console.log('🔮 [AI DIAGNOSIS] Generating 3072-dim query embedding with OpenAI...')

    const { generateEmbedding3072 } = await import('@/lib/services/openai-embeddings')

    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding3072(queryText)
      console.log('✅ [AI DIAGNOSIS] OpenAI 3072-dim query embedding generated')
    } catch (error) {
      console.error('❌ [AI DIAGNOSIS] OpenAI embedding generation failed:', error)
      return { success: false, error: 'Failed to generate query embedding with OpenAI' }
    }

    // Step 2: Search medical knowledge base using hybrid search (vector + full-text)
    console.log('🔍 [AI DIAGNOSIS] Searching medical knowledge with hybrid search...')

    let relevantKnowledge: any[] | null = null
    let searchSource = 'hybrid'

    // Try hybrid search first (vector + BM25 full-text with RRF fusion)
    try {
      const { data: hybridResults, error: hybridError } = await supabase
        .schema('api')
        .rpc('hybrid_search_medical_knowledge', {
          query_text: queryText,
          query_embedding: queryEmbedding,
          match_count: 10,
          vector_weight: 0.5,     // Equal weight for diagnosis — keywords matter as much as semantics
          fulltext_weight: 0.5,
          rrf_k: 60,
          specialty_filter: 'endodontics',
          diagnosis_filter: null,
          treatment_filter: null
        })

      if (!hybridError && hybridResults && hybridResults.length > 0) {
        relevantKnowledge = hybridResults.map((doc: any) => ({
          ...doc,
          similarity: doc.hybrid_score || doc.vector_similarity || 0
        }))
        searchSource = 'hybrid'
        console.log(`✅ [AI DIAGNOSIS] Hybrid search found ${relevantKnowledge!.length} results`)
      } else if (hybridError) {
        console.warn('⚠️ [AI DIAGNOSIS] Hybrid search not available:', hybridError.message?.substring(0, 80))
      }
    } catch (hybridErr) {
      console.warn('⚠️ [AI DIAGNOSIS] Hybrid search failed, trying vector-only...')
    }

    // Fallback to pure vector search if hybrid didn't work
    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      const { data: vectorResults, error: searchError } = await supabase
        .schema('api')
        .rpc('search_treatment_protocols', {
          query_embedding: queryEmbedding,
          diagnosis_filter: null,
          treatment_filter: null,
          specialty_filter: 'endodontics',
          match_threshold: 0.3,
          match_count: 10
        })

      if (!searchError && vectorResults && vectorResults.length > 0) {
        relevantKnowledge = vectorResults
        searchSource = 'vector'
        console.log(`✅ [AI DIAGNOSIS] Vector search found ${vectorResults.length} results`)
      } else if (searchError) {
        console.error('❌ [AI DIAGNOSIS] Vector search failed:', searchError)
      }
    }

    // Last fallback: direct text query
    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      console.log('💡 [AI DIAGNOSIS] Falling back to direct text query...')
      const { data: fallbackKnowledge, error: fallbackError } = await supabase
        .schema('api')
        .from('medical_knowledge')
        .select('*')
        .not('embedding', 'is', null)
        .or(
          `source_type.eq.diagnostic_protocol,` +
          `source_type.eq.textbook,` +
          `source_type.eq.research_paper,` +
          `content.ilike.%symptom%,` +
          `content.ilike.%diagnosis%,` +
          `content.ilike.%clinical sign%`
        )
        .limit(10)

      if (fallbackError) {
        console.error('❌ [AI DIAGNOSIS] Fallback query also failed:', fallbackError)
        return { success: false, error: 'Failed to search medical knowledge base' }
      }

      relevantKnowledge = fallbackKnowledge
      searchSource = 'text_fallback'
      console.log(`🔄 [AI DIAGNOSIS] Text fallback found ${fallbackKnowledge?.length || 0} documents`)
    }

    if (!relevantKnowledge || relevantKnowledge.length === 0) {
      console.warn('⚠️ [AI DIAGNOSIS] No relevant medical knowledge found in database')
      console.log('💡 [AI DIAGNOSIS] Using Gemini-only mode (no RAG context)')
      
      // Use Gemini directly without RAG context as final fallback
      // This is similar to how GPT-4 medical diagnosis works
      try {
        const { generateDiagnosisSuggestion } = await import('@/lib/services/gemini-ai')
        
        const suggestion = await generateDiagnosisSuggestion({
          symptoms: params.symptoms,
          painCharacteristics: params.painCharacteristics,
          clinicalFindings: params.clinicalFindings,
          toothNumber: params.toothNumber,
          medicalContext: [], // No RAG context, pure AI knowledge
          patientContext: params.patientContext,
          conversationContext: params.conversationContext
        })
        
        const processingTime = Date.now() - startTime
        
        console.log('✅ [AI DIAGNOSIS] Gemini-only suggestion generated:', {
          diagnosis: suggestion.diagnosis,
          confidence: suggestion.confidence - 10, // Reduce confidence slightly for no-RAG
          processingTime: `${processingTime}ms`
        })
        
        // Still cache it for future use
        await supabase
          .from('ai_diagnosis_cache')
          .insert({
            symptoms_key: cacheKey,
            symptoms: params.symptoms,
            pain_characteristics: params.painCharacteristics || {},
            clinical_findings: params.clinicalFindings,
            tooth_number: params.toothNumber,
            patient_context: params.patientContext || {},
            suggested_diagnosis: suggestion.diagnosis,
            confidence_score: Math.max(60, suggestion.confidence - 10), // Lower confidence for no-RAG
            reasoning: suggestion.reasoning + ' (Note: Generated without medical literature context)',
            clinical_significance: suggestion.clinicalSignificance,
            differential_diagnoses: suggestion.differentialDiagnoses || [],
            recommended_tests: suggestion.recommendedTests || [],
            evidence_sources: suggestion.sources,
            ai_model: 'gemini-2.5-flash-no-rag',
            processing_time: processingTime
          })
        
        return {
          success: true,
          data: {
            ...suggestion,
            confidence: Math.max(60, suggestion.confidence - 10) // Reduce confidence for no-RAG
          },
          cached: false,
          processingTime,
          warning: 'Generated without medical literature context. Consider uploading diagnostic textbooks for better accuracy.'
        }
      } catch (geminiError) {
        console.error('❌ [AI DIAGNOSIS] Gemini-only fallback also failed:', geminiError)
        return {
          success: false,
          error: 'No relevant medical knowledge found. Please upload textbooks/research papers to the knowledge base first.'
        }
      }
    }

    console.log(`📚 [AI DIAGNOSIS] Found ${relevantKnowledge.length} relevant documents`)

    // Step 3: Call Gemini for diagnosis recommendation
    console.log('🧠 [AI DIAGNOSIS] Calling Gemini 2.5 Flash for diagnostic recommendation...')

    const { generateDiagnosisSuggestion } = await import('@/lib/services/gemini-ai')

    let suggestion: AIDiagnosisSuggestion
    try {
      // Prepare medical context from vector search results
      const medicalContext = relevantKnowledge.map((doc: any) => ({
        title: doc.title,
        content: doc.content,
        journal: doc.journal,
        year: doc.publication_year,
        doi: doc.doi
      }))

      suggestion = await generateDiagnosisSuggestion({
        symptoms: params.symptoms,
        painCharacteristics: params.painCharacteristics,
        clinicalFindings: params.clinicalFindings,
        toothNumber: params.toothNumber,
        medicalContext,
        patientContext: params.patientContext,
        conversationContext: params.conversationContext
      })
    } catch (error) {
      console.error('❌ [AI DIAGNOSIS] Gemini call failed:', error)
      return { success: false, error: 'Failed to generate AI diagnostic recommendation with Gemini' }
    }

    const processingTime = Date.now() - startTime

    console.log('✅ [AI DIAGNOSIS] Suggestion generated:', {
      diagnosis: suggestion.diagnosis,
      confidence: suggestion.confidence,
      processingTime: `${processingTime}ms`
    })

    // Step 4: Cache the suggestion
    await supabase
      .from('ai_diagnosis_cache')
      .insert({
        symptoms_key: cacheKey,
        symptoms: params.symptoms,
        pain_characteristics: params.painCharacteristics || {},
        clinical_findings: params.clinicalFindings,
        tooth_number: params.toothNumber,
        patient_context: params.patientContext || {},
        suggested_diagnosis: suggestion.diagnosis,
        confidence_score: suggestion.confidence,
        reasoning: suggestion.reasoning,
        clinical_significance: suggestion.clinicalSignificance,
        differential_diagnoses: suggestion.differentialDiagnoses || [],
        recommended_tests: suggestion.recommendedTests || [],
        evidence_sources: suggestion.sources,
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
    console.error('❌ [AI DIAGNOSIS] Error:', error)
    return { success: false, error: 'Failed to generate diagnosis suggestion' }
  }
}
