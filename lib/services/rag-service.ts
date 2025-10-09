/**
 * RAG (Retrieval-Augmented Generation) Service
 * Implements vector search over medical knowledge base for evidence-based AI responses
 *
 * Architecture:
 * 1. User Query → Generate embedding (Gemini)
 * 2. Vector search → Find relevant medical documents (Supabase pgvector)
 * 3. Combine → Query + Retrieved context + Patient data
 * 4. Generate → AI response with citations (Gemini)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbedding } from './gemini-ai'
import type { PatientMedicalContext } from '@/lib/actions/patient-context'

export interface RAGDocument {
  id: string
  title: string
  content: string
  source_type: string
  specialty: string
  authors?: string
  journal?: string
  publication_year?: number
  doi?: string
  url?: string
  similarity: number
  topics?: string[]
}

export interface RAGQueryParams {
  query: string
  diagnosisFilter?: string[]
  treatmentFilter?: string[]
  specialtyFilter?: string
  matchThreshold?: number
  matchCount?: number
  patientMedicalContext?: PatientMedicalContext // NEW: Optional patient context
}

export interface RAGResult {
  documents: RAGDocument[]
  queryEmbedding: number[]
  totalMatches: number
  patientContextIncluded?: boolean // NEW: Flag indicating patient context was used
}

/**
 * Perform RAG query: Convert query to embedding and search medical knowledge base
 * @param params - Query parameters with optional filters
 * @returns Retrieved documents with similarity scores
 */
export async function performRAGQuery(params: RAGQueryParams): Promise<RAGResult> {
  const {
    query,
    diagnosisFilter,
    treatmentFilter,
    specialtyFilter,
    matchThreshold = 0.7,
    matchCount = 5
  } = params

  console.log('🔍 [RAG] Performing RAG query:', {
    query: query.substring(0, 50) + '...',
    filters: { diagnosisFilter, treatmentFilter, specialtyFilter },
    matchThreshold,
    matchCount
  })

  try {
    // Step 1: Generate embedding for the query using Gemini
    console.log('🧠 [RAG] Generating query embedding...')
    const queryEmbedding = await generateEmbedding(query, 'RETRIEVAL_QUERY')

    // Step 2: Perform vector similarity search in Supabase
    console.log('📚 [RAG] Searching medical knowledge base...')
    const supabase = await createServiceClient()

    const { data: documents, error } = await supabase
      .schema('api')
      .rpc('search_treatment_protocols', {
        query_embedding: queryEmbedding,
        diagnosis_filter: diagnosisFilter || null,
        treatment_filter: treatmentFilter || null,
        specialty_filter: specialtyFilter || null,
        match_threshold: matchThreshold,
        match_count: matchCount
      })

    if (error) {
      console.error('❌ [RAG] Vector search error:', error)
      throw new Error(`Vector search failed: ${error.message}`)
    }

    console.log(`✅ [RAG] Found ${documents?.length || 0} relevant documents`)

    // Log if patient context was included
    if (params.patientMedicalContext) {
      console.log(`👤 [RAG] Patient medical context included for: ${params.patientMedicalContext.patientName}`)
    }

    return {
      documents: documents || [],
      queryEmbedding,
      totalMatches: documents?.length || 0,
      patientContextIncluded: !!params.patientMedicalContext
    }

  } catch (error) {
    console.error('❌ [RAG] Error in performRAGQuery:', error)
    throw error
  }
}

/**
 * Format retrieved documents into context for AI prompts
 * @param documents - Retrieved RAG documents
 * @param patientContext - Optional patient medical context to include
 * @returns Formatted string with numbered sources and patient context
 */
export function formatRAGContext(
  documents: RAGDocument[],
  patientContext?: PatientMedicalContext
): string {
  const sections: string[] = []

  // Add patient medical context first if provided (most important for AI)
  if (patientContext) {
    const { formatPatientMedicalContext } = require('@/lib/actions/patient-context')
    sections.push(formatPatientMedicalContext(patientContext))
    sections.push('\n\n')
  }

  // Add medical literature
  if (!documents || documents.length === 0) {
    sections.push('═══════════════════════════════════════════════════════════')
    sections.push('MEDICAL LITERATURE')
    sections.push('═══════════════════════════════════════════════════════════')
    sections.push('No relevant medical literature found in the knowledge base.')
  } else {
    sections.push('═══════════════════════════════════════════════════════════')
    sections.push('MEDICAL LITERATURE & RESEARCH EVIDENCE')
    sections.push('═══════════════════════════════════════════════════════════')
    sections.push('')
    
    const formattedDocs = documents.map((doc, index) => {
      const source = [
        doc.journal,
        doc.publication_year ? `(${doc.publication_year})` : null,
        doc.authors
      ].filter(Boolean).join(' ')

      return `[Source ${index + 1}]\n` +
             `Title: ${doc.title}\n` +
             `Type: ${doc.source_type}\n` +
             `Source: ${source || 'N/A'}\n` +
             `Similarity: ${(doc.similarity * 100).toFixed(1)}%\n` +
             `Content: ${doc.content.substring(0, 800)}...\n` +
             (doc.doi ? `DOI: ${doc.doi}\n` : '') +
             `---`
    }).join('\n\n')
    
    sections.push(formattedDocs)
  }

  return sections.join('\n')
}

/**
 * Extract citations from retrieved documents for response footnotes
 * @param documents - Retrieved RAG documents
 * @returns Array of citation objects
 */
export function extractCitations(documents: RAGDocument[]): Array<{
  index: number
  title: string
  authors?: string
  journal?: string
  year?: number
  doi?: string
  url?: string
}> {
  return documents.map((doc, index) => ({
    index: index + 1,
    title: doc.title,
    authors: doc.authors,
    journal: doc.journal,
    year: doc.publication_year,
    doi: doc.doi,
    url: doc.url
  }))
}

/**
 * Check if medical knowledge base has sufficient data
 * @returns true if knowledge base has documents
 */
export async function checkKnowledgeBaseStatus(): Promise<{
  hasDocuments: boolean
  documentCount: number
  hasMedicalContent: boolean
}> {
  try {
    const supabase = await createServiceClient()

    const { count, error } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('❌ [RAG] Error checking knowledge base:', error)
      return { hasDocuments: false, documentCount: 0, hasMedicalContent: false }
    }

    const documentCount = count || 0
    const hasMedicalContent = documentCount > 0

    console.log(`📊 [RAG] Knowledge base status: ${documentCount} documents`)

    return {
      hasDocuments: documentCount > 0,
      documentCount,
      hasMedicalContent
    }

  } catch (error) {
    console.error('❌ [RAG] Error in checkKnowledgeBaseStatus:', error)
    return { hasDocuments: false, documentCount: 0, hasMedicalContent: false }
  }
}

/**
 * Enhanced RAG query that combines medical knowledge with patient data analysis
 * This is the core RAG function for the research AI chatbot
 *
 * @param userQuery - User's research question
 * @param patientData - Aggregated patient cohort statistics
 * @returns Context-enriched data for Gemini AI
 */
export async function enhancedRAGQuery(params: {
  userQuery: string
  patientData?: any
  diagnosisContext?: string[]
  treatmentContext?: string[]
}): Promise<{
  ragContext: string
  citations: any[]
  hasEvidence: boolean
  patientContext: string
}> {
  const { userQuery, patientData, diagnosisContext, treatmentContext } = params

  console.log('🚀 [RAG] Enhanced RAG query initiated')

  // Step 1: Check if query is medical/clinical in nature
  const isClinicalQuery = detectClinicalQuery(userQuery)

  if (!isClinicalQuery) {
    console.log('💡 [RAG] Non-clinical query detected, skipping RAG')
    return {
      ragContext: '',
      citations: [],
      hasEvidence: false,
      patientContext: formatPatientContext(patientData)
    }
  }

  // Step 2: Perform RAG search
  try {
    const ragResult = await performRAGQuery({
      query: userQuery,
      diagnosisFilter: diagnosisContext,
      treatmentFilter: treatmentContext,
      matchThreshold: 0.5, // Lower threshold to catch more relevant documents
      matchCount: 5
    })

    // Step 3: Format results
    const ragContext = formatRAGContext(ragResult.documents)
    const citations = extractCitations(ragResult.documents)
    const hasEvidence = ragResult.totalMatches > 0

    console.log(`✅ [RAG] Enhanced query complete: ${ragResult.totalMatches} sources found`)

    return {
      ragContext,
      citations,
      hasEvidence,
      patientContext: formatPatientContext(patientData)
    }

  } catch (error) {
    console.error('❌ [RAG] Enhanced RAG query failed:', error)
    // Return without RAG context if search fails
    return {
      ragContext: '',
      citations: [],
      hasEvidence: false,
      patientContext: formatPatientContext(patientData)
    }
  }
}

/**
 * Detect if a query is clinical/medical in nature
 * @param query - User query
 * @returns true if query contains clinical keywords
 */
function detectClinicalQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  
  // Skip RAG only for obvious non-clinical queries
  const nonClinicalKeywords = [
    'hello', 'hi', 'hey', 'thanks', 'thank you',
    'how are you', 'good morning', 'good afternoon',
    'who are you', 'what can you do'
  ]
  
  // If query is a greeting/general chat, skip RAG
  if (nonClinicalKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return false
  }
  
  // Otherwise, assume it might be clinical and try RAG
  // This ensures we search for:
  // - Specific medical terms (wolters, classification, etc.)
  // - Research questions
  // - Treatment queries
  // - Any dental/medical content
  return true
}

/**
 * Format patient data into context string
 * @param patientData - Aggregated patient statistics
 * @returns Formatted patient context string
 */
function formatPatientContext(patientData: any): string {
  if (!patientData) {
    return 'No patient data available for this analysis.'
  }

  // Format patient statistics for AI context
  return `Patient Database Context:\n` +
         `- Total Patients: ${patientData.totalPatients || 'Unknown'}\n` +
         `- Clinical Data Available: ${patientData.hasClinicalData ? 'Yes' : 'No'}`
}
