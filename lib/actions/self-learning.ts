'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'
import { performRAGQuery, formatRAGContext, extractCitations } from '@/lib/services/rag-service'
import { generateChatCompletion, type GeminiChatMessage } from '@/lib/services/gemini-ai'
import { getPatientFullContext, formatPatientMedicalContext, type PatientMedicalContext } from './patient-context'

export interface TreatmentOption {
  name: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  duration: string
  successRate: string
  sources: Array<{
    title: string
    journal?: string
    year?: number
    doi?: string
  }>
}

export interface LearningStep {
  stepNumber: number
  title: string
  description: string
  keyPoints: string[]
  warnings?: string[]
  tips?: string[]
  sources?: string[]
}

/**
 * Search for treatment options based on a diagnosis or condition
 * Uses RAG to find relevant research papers and extract treatment protocols
 */
export async function searchTreatmentOptionsAction(
  diagnosis: string,
  patientContext?: {
    patientId?: string
    patientName?: string
    toothNumber?: string
    diagnosis?: string
    treatment?: string
  }
) {
  try {
    // Verify user authentication
    const user = await getCurrentUser()
    if (!user || user.role !== 'dentist' || user.status !== 'active') {
      return { success: false, error: 'Only active dentists can access self-learning features' }
    }

    console.log('🔍 [SELF-LEARNING] Searching treatment options for:', diagnosis)

    // Fetch complete patient medical context if patient is linked
    let patientMedicalContext: PatientMedicalContext | undefined
    
    if (patientContext?.patientId) {
      console.log('👤 [SELF-LEARNING] Fetching complete patient medical context...')
      const contextResult = await getPatientFullContext(patientContext.patientId)
      
      if (contextResult.success && contextResult.data) {
        patientMedicalContext = contextResult.data
        console.log(`✅ [SELF-LEARNING] Loaded patient context: ${patientMedicalContext.summary.totalConsultations} consultations, ${patientMedicalContext.summary.activeIssues} active issues`)
      } else {
        console.log('⚠️ [SELF-LEARNING] Could not load patient context:', contextResult.error)
      }
    }

    // Construct search query focusing on treatments for the diagnosis
    const searchQuery = `Treatment options and protocols for ${diagnosis}. Include therapeutic approaches, procedures, success rates, and clinical guidelines.`

    // Perform RAG search with treatment focus AND patient context
    const ragResult = await performRAGQuery({
      query: searchQuery,
      diagnosisFilter: [diagnosis.toLowerCase().replace(/\s+/g, '_')],
      matchThreshold: 0.5,
      matchCount: 10,
      patientMedicalContext // Include patient context in RAG query
    })

    if (ragResult.totalMatches === 0) {
      console.log('⚠️ [SELF-LEARNING] No treatment protocols found in knowledge base')
      return {
        success: true,
        data: {
          treatments: [],
          message: 'No treatment protocols found. Upload relevant research papers to see treatment options.'
        }
      }
    }

    console.log(`✅ [SELF-LEARNING] Found ${ragResult.totalMatches} relevant documents`)

    // Use Gemini to extract treatment options from the retrieved documents
    // Patient context is automatically included in formatRAGContext if available
    const context = formatRAGContext(ragResult.documents, patientMedicalContext)
    
    // Build enhanced AI instruction based on whether patient context exists
    const patientInfo = patientMedicalContext ? `

⚠️ CRITICAL: PATIENT-SPECIFIC CONTEXT PROVIDED
You have access to this patient's complete medical history above.
Your response MUST be tailored to:
- Patient: ${patientMedicalContext.patientName}
- Medical History: ${patientMedicalContext.medicalHistory.allergies.length > 0 ? 'ALLERGIES PRESENT' : 'No allergies'}
- Active Issues: ${patientMedicalContext.summary.activeIssues} diagnoses
- Previous Treatments: ${patientMedicalContext.completedTreatments.length} completed
- Pending Treatments: ${patientMedicalContext.summary.pendingTreatments}

IMPORTANT:
1. Consider the patient's medical history, allergies, and contraindications
2. Reference previous treatments and their outcomes
3. Align with existing treatment plans when appropriate
4. Provide patient-specific warnings and considerations` : ''

    const systemInstruction = `You are a dental treatment expert extracting treatment options from medical literature.
Analyze the provided research papers and identify distinct treatment protocols for the given diagnosis.${patientInfo}

For each treatment, extract:
- Name: The specific treatment or procedure name
- Description: Brief clinical description (1-2 sentences)
- Difficulty: Classify as beginner, intermediate, or advanced based on complexity
- Duration: Typical procedure duration (estimate if not explicitly stated)
- Success Rate: Clinical success rate (extract from studies or note "varies")

Return ONLY valid JSON array format:
[
  {
    "name": "Treatment Name",
    "description": "Brief description",
    "difficulty": "beginner|intermediate|advanced",
    "duration": "X-Y minutes",
    "successRate": "XX%",
    "sourceIndices": [1, 2]
  }
]

Guidelines:
- Extract 2-5 distinct treatment options
- Base difficulty on technical complexity and clinical experience required
- Include both conservative and invasive options when available
- Reference source indices where evidence was found
- If success rates aren't explicitly stated, use "varies" or "case dependent"${patientContext?.patientName ? '\n- Tailor recommendations to the specific patient case provided' : ''}`

    const userPrompt = `Extract treatment options for: ${diagnosis}\n\nMedical Literature:\n${context}`

    const messages: GeminiChatMessage[] = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ]

    const responseText = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.2,
      systemInstruction,
      responseFormat: 'json'
    })

    // Parse AI response
    const treatments = JSON.parse(responseText)
    const citations = extractCitations(ragResult.documents)

    // Map treatments to include source details
    const treatmentOptions: TreatmentOption[] = treatments.map((t: any) => ({
      name: t.name,
      description: t.description,
      difficulty: t.difficulty,
      duration: t.duration,
      successRate: t.successRate,
      sources: (t.sourceIndices || []).map((idx: number) => {
        const citation = citations[idx - 1]
        return citation ? {
          title: citation.title,
          journal: citation.journal,
          year: citation.year,
          doi: citation.doi
        } : null
      }).filter(Boolean)
    }))

    console.log(`✅ [SELF-LEARNING] Extracted ${treatmentOptions.length} treatment options`)

    return {
      success: true,
      data: {
        treatments: treatmentOptions,
        totalSources: ragResult.totalMatches
      }
    }

  } catch (error) {
    console.error('❌ [SELF-LEARNING] Error searching treatments:', error)
    return {
      success: false,
      error: 'Failed to search treatment options'
    }
  }
}

/**
 * Get detailed step-by-step procedure for a specific treatment
 * Uses RAG to find detailed clinical protocols and procedures
 */
export async function getTreatmentStepsAction(
  treatmentName: string,
  diagnosis?: string,
  patientContext?: {
    patientId?: string
    patientName?: string
    toothNumber?: string
    diagnosis?: string
    treatment?: string
  }
) {
  try {
    // Verify user authentication
    const user = await getCurrentUser()
    if (!user || user.role !== 'dentist' || user.status !== 'active') {
      return { success: false, error: 'Only active dentists can access self-learning features' }
    }

    console.log('📖 [SELF-LEARNING] Getting steps for treatment:', treatmentName)

    // Fetch complete patient medical context if patient is linked
    let patientMedicalContext: PatientMedicalContext | undefined
    
    if (patientContext?.patientId) {
      console.log('👤 [SELF-LEARNING] Fetching complete patient medical context...')
      const contextResult = await getPatientFullContext(patientContext.patientId)
      
      if (contextResult.success && contextResult.data) {
        patientMedicalContext = contextResult.data
        console.log(`✅ [SELF-LEARNING] Loaded patient context for procedure steps`)
      }
    }

    // Construct detailed search query for procedure steps
    const searchQuery = `Detailed step-by-step clinical protocol and procedure for ${treatmentName}${diagnosis ? ` in treating ${diagnosis}` : ''}. Include preparation, execution steps, materials, techniques, warnings, and best practices.`

    // Perform RAG search focused on procedural details with patient context
    const ragResult = await performRAGQuery({
      query: searchQuery,
      treatmentFilter: [treatmentName.toLowerCase().replace(/\s+/g, '_')],
      diagnosisFilter: diagnosis ? [diagnosis.toLowerCase().replace(/\s+/g, '_')] : undefined,
      matchThreshold: 0.5,
      matchCount: 8,
      patientMedicalContext // Include patient context
    })

    if (ragResult.totalMatches === 0) {
      console.log('⚠️ [SELF-LEARNING] No detailed protocols found')
      return {
        success: true,
        data: {
          steps: [],
          message: 'No detailed procedure found. Upload relevant clinical protocols for step-by-step guidance.'
        }
      }
    }

    console.log(`✅ [SELF-LEARNING] Found ${ragResult.totalMatches} relevant protocols`)

    // Use Gemini to extract structured steps from the literature
    // Patient context is automatically included in formatRAGContext
    const context = formatRAGContext(ragResult.documents, patientMedicalContext)
    
    // Build enhanced patient-specific instruction
    const patientInfo = patientMedicalContext ? `

⚠️ CRITICAL: PATIENT-SPECIFIC PROCEDURE GUIDANCE
You have this patient's complete medical history above.
Tailor the procedure steps specifically for:
- Patient: ${patientMedicalContext.patientName}
- Medical Alerts: ${patientMedicalContext.medicalHistory.allergies.length > 0 ? 'CHECK ALLERGIES' : 'None'}
- Contraindications: ${patientMedicalContext.medicalHistory.contraindications.length > 0 ? 'PRESENT - SEE ABOVE' : 'None'}
- Previous Similar Treatments: ${patientMedicalContext.completedTreatments.length} completed

Modify steps to account for:
1. Patient's specific medical conditions and medications
2. Previous treatment outcomes and complications
3. Known allergies and contraindications
4. Current active diagnoses and treatment plans` : ''

    const systemInstruction = `You are a dental procedure expert creating step-by-step clinical guides from research literature.
Analyze the provided medical papers and extract a comprehensive, sequential procedure protocol.${patientInfo}

Return ONLY valid JSON array of steps:
[
  {
    "stepNumber": 1,
    "title": "Step Title",
    "description": "What to do in this step (1-2 sentences)",
    "keyPoints": ["Action 1", "Action 2", "Action 3"],
    "warnings": ["Warning 1", "Warning 2"],
    "tips": ["Tip 1", "Tip 2"],
    "sourceIndices": [1, 2]
  }
]

Guidelines:
- Extract 5-10 sequential steps that cover the complete procedure
- Each step should be actionable and specific
- Include 3-5 key points per step
- Add warnings for critical safety/clinical concerns
- Add tips for best practices and expert techniques
- Reference source indices for evidence
- Maintain clinical accuracy and proper terminology
- Order steps logically from preparation to completion`

    const userPrompt = `Create step-by-step procedure guide for: ${treatmentName}\n\nMedical Literature:\n${context}`

    const messages: GeminiChatMessage[] = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ]

    const responseText = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.2,
      systemInstruction,
      responseFormat: 'json'
    })

    // Parse and format steps
    const steps: LearningStep[] = JSON.parse(responseText)
    const citations = extractCitations(ragResult.documents)

    // Add source titles to steps
    const stepsWithSources = steps.map(step => ({
      ...step,
      sources: (step.sourceIndices || []).map((idx: number) => {
        const citation = citations[idx - 1]
        return citation ? `${citation.title} ${citation.journal ? `(${citation.journal})` : ''}` : null
      }).filter(Boolean)
    }))

    console.log(`✅ [SELF-LEARNING] Extracted ${steps.length} procedural steps`)

    return {
      success: true,
      data: {
        steps: stepsWithSources,
        treatmentName,
        totalSources: ragResult.totalMatches,
        citations
      }
    }

  } catch (error) {
    console.error('❌ [SELF-LEARNING] Error getting treatment steps:', error)
    return {
      success: false,
      error: 'Failed to get treatment steps'
    }
  }
}

/**
 * Ask a specific question about treatments, procedures, or techniques
 * Uses RAG + AI to provide evidence-based answers
 */
export async function askTreatmentQuestionAction(
  question: string,
  patientContext?: {
    patientId?: string
    patientName?: string
    toothNumber?: string
    diagnosis?: string
    treatment?: string
  }
) {
  try {
    // Verify user authentication
    const user = await getCurrentUser()
    if (!user || user.role !== 'dentist' || user.status !== 'active') {
      return { success: false, error: 'Only active dentists can access self-learning features' }
    }

    console.log('💬 [SELF-LEARNING] Processing question:', question.substring(0, 100))

    // Fetch complete patient medical context if patient is linked
    let patientMedicalContext: PatientMedicalContext | undefined
    
    if (patientContext?.patientId) {
      console.log('👤 [SELF-LEARNING] Fetching complete patient medical context...')
      const contextResult = await getPatientFullContext(patientContext.patientId)
      
      if (contextResult.success && contextResult.data) {
        patientMedicalContext = contextResult.data
        console.log(`✅ [SELF-LEARNING] Loaded patient context for question answering`)
      }
    }

    // Perform RAG search based on the question with patient context
    const ragResult = await performRAGQuery({
      query: question,
      matchThreshold: 0.5,
      matchCount: 5,
      patientMedicalContext // Include patient context
    })

    const hasEvidence = ragResult.totalMatches > 0
    console.log(`📚 [SELF-LEARNING] RAG search: ${hasEvidence ? 'Evidence found' : 'No evidence'}, ${ragResult.totalMatches} documents`)

    // Build enhanced patient-specific instruction
    const patientInfo = patientMedicalContext ? `

⚠️ CRITICAL: PATIENT-SPECIFIC QUESTION
This question relates to a specific patient whose complete medical history is provided above.

Patient: ${patientMedicalContext.patientName}
Consultation History: ${patientMedicalContext.summary.totalConsultations} visits
Active Issues: ${patientMedicalContext.summary.activeIssues}
Pending Treatments: ${patientMedicalContext.summary.pendingTreatments}
Medical Alerts: ${patientMedicalContext.medicalHistory.allergies.length > 0 || patientMedicalContext.medicalHistory.contraindications.length > 0 ? 'YES - SEE ABOVE' : 'None'}

IMPORTANT:
1. Answer the question in the context of THIS SPECIFIC PATIENT
2. Reference the patient's medical history, previous treatments, and current conditions
3. Provide patient-specific warnings based on their allergies and contraindications
4. Consider their treatment history when making recommendations
5. Align with their existing treatment plan when appropriate` : ''

    // Build system instruction for conversational response
    const systemInstruction = `You are an expert dental educator helping dentists learn treatment procedures.
Provide clear, evidence-based answers using the medical literature provided.${patientInfo}

Guidelines:
1. Answer the specific question directly and comprehensively
2. Structure your response with:
   - Direct answer to the question
   - Step-by-step guidance (if applicable)
   - Clinical considerations and best practices
   - Success factors and evidence
3. ${hasEvidence ? 'Cite sources using [Source 1], [Source 2], etc.' : 'Provide general clinical guidance'}
4. Use professional but accessible language
5. Include practical tips and warnings when relevant
6. Format with markdown for readability (bold, bullets, etc.)`

    let userPrompt = `Question: ${question}\n\n`

    if (hasEvidence || patientMedicalContext) {
      // Include both medical literature and patient context
      const context = formatRAGContext(ragResult.documents, patientMedicalContext)
      userPrompt += `Context for answering:\n${context}\n\n`
      
      if (patientMedicalContext) {
        userPrompt += `Provide a comprehensive, patient-specific answer that considers the patient's complete medical history and current situation. Cite medical literature where available.`
      } else {
        userPrompt += `Provide a comprehensive answer citing the medical literature above.`
      }
    } else {
      userPrompt += `Provide a comprehensive answer based on general dental clinical knowledge and best practices.`
    }

    const messages: GeminiChatMessage[] = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ]

    const answer = await generateChatCompletion(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      systemInstruction
    })

    const citations = hasEvidence ? extractCitations(ragResult.documents) : []

    console.log(`✅ [SELF-LEARNING] Generated answer (${answer.length} chars)`)

    return {
      success: true,
      data: {
        answer,
        citations,
        hasEvidence,
        sourceCount: ragResult.totalMatches
      }
    }

  } catch (error) {
    console.error('❌ [SELF-LEARNING] Error answering question:', error)
    return {
      success: false,
      error: 'Failed to process question'
    }
  }
}

/**
 * Get related topics and suggested questions based on a diagnosis or treatment
 */
export async function getSuggestedTopicsAction(context: string) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'dentist' || user.status !== 'active') {
      return { success: false, error: 'Unauthorized' }
    }

    // Quick search to get related content
    const ragResult = await performRAGQuery({
      query: context,
      matchThreshold: 0.6,
      matchCount: 5
    })

    if (ragResult.totalMatches === 0) {
      return {
        success: true,
        data: {
          suggestions: [],
          topics: []
        }
      }
    }

    // Extract topics and treatment keywords from matched documents
    const topics = new Set<string>()
    const treatments = new Set<string>()

    ragResult.documents.forEach(doc => {
      doc.topics?.forEach(topic => topics.add(topic))
    })

    return {
      success: true,
      data: {
        topics: Array.from(topics).slice(0, 8),
        relatedTreatments: Array.from(treatments).slice(0, 6)
      }
    }

  } catch (error) {
    console.error('❌ [SELF-LEARNING] Error getting suggestions:', error)
    return { success: false, error: 'Failed to get suggestions' }
  }
}
