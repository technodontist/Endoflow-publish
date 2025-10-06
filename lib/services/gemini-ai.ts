/**
 * Google Gemini AI Service
 * Provides embedding generation and chat completion using Gemini API
 * Replaces OpenAI for cost optimization (99.8% cost reduction)
 * Using direct REST API calls for better compatibility
 */

/**
 * Generate embedding for text using gemini-embedding-001
 * @param text - Text to embed
 * @param taskType - Type of embedding task (default: RETRIEVAL_DOCUMENT)
 * @returns 768-dimensional embedding vector
 */
export async function generateEmbedding(
  text: string,
  taskType: 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING' | 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured')
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: text }]
          },
          taskType: taskType,
          outputDimensionality: 768
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [GEMINI] Embedding API error:', errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const embedding = data.embedding.values

    // Normalize embedding for cosine similarity
    const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0))
    const normalized = embedding.map((val: number) => val / norm)

    return normalized
  } catch (error) {
    console.error('❌ [GEMINI] Embedding generation failed:', error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate batch embeddings for multiple texts
 * @param texts - Array of texts to embed
 * @param taskType - Type of embedding task
 * @returns Array of 768-dimensional embedding vectors
 */
export async function generateBatchEmbeddings(
  texts: string[],
  taskType: 'SEMANTIC_SIMILARITY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  // For now, process sequentially (Gemini API doesn't support true batch)
  // Can optimize with Promise.all later if rate limits allow
  const embeddings: number[][] = []

  for (const text of texts) {
    const embedding = await generateEmbedding(text, taskType)
    embeddings.push(embedding)
  }

  return embeddings
}

export interface GeminiChatMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export interface GeminiChatOptions {
  model?: 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash'
  temperature?: number
  maxOutputTokens?: number
  systemInstruction?: string
  responseFormat?: 'json' | 'text'
}

/**
 * Generate chat completion using Gemini
 * @param messages - Conversation history
 * @param options - Generation options
 * @returns AI-generated response
 */
export async function generateChatCompletion(
  messages: GeminiChatMessage[],
  options: GeminiChatOptions = {}
): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured')
    }

    const {
      model = 'gemini-2.0-flash',
      temperature = 0.3,
      maxOutputTokens = 4096,
      systemInstruction,
      responseFormat = 'text'
    } = options

    // Build request body
    const requestBody: any = {
      contents: messages.map(msg => ({
        role: msg.role,
        parts: msg.parts
      })),
      generationConfig: {
        temperature,
        maxOutputTokens
      }
    }

    if (responseFormat === 'json') {
      requestBody.generationConfig.responseMimeType = 'application/json'
    }

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [GEMINI] Chat API error:', errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const responseText = data.candidates[0].content.parts[0].text

    return responseText
  } catch (error) {
    console.error('❌ [GEMINI] Chat completion failed:', error)
    throw new Error(`Failed to generate chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate treatment suggestion using Gemini with RAG context
 * @param diagnosis - Primary diagnosis
 * @param toothNumber - Tooth number
 * @param medicalContext - Retrieved medical knowledge from vector search
 * @param patientContext - Patient-specific information
 * @returns Structured AI treatment suggestion
 */
export async function generateTreatmentSuggestion(params: {
  diagnosis: string
  toothNumber: string
  medicalContext: Array<{ title: string; content: string; journal?: string; year?: number; doi?: string }>
  patientContext?: {
    age?: number
    medicalHistory?: string
    previousTreatments?: string
  }
}): Promise<{
  treatment: string
  confidence: number
  reasoning: string
  sources: Array<{ title: string; journal: string; year: number; doi?: string }>
  alternativeTreatments?: string[]
  contraindications?: string[]
}> {
  const { diagnosis, toothNumber, medicalContext, patientContext } = params

  // Build context from retrieved medical knowledge
  const context = medicalContext
    .map(
      (doc, idx) =>
        `[Source ${idx + 1}]\n` +
        `Title: ${doc.title}\n` +
        `Journal: ${doc.journal || 'N/A'} (${doc.year || 'N/A'})\n` +
        `Content: ${doc.content.substring(0, 1500)}...\n`
    )
    .join('\n---\n\n')

  const systemInstruction = `You are an expert endodontist AI assistant. Based on evidence from research papers and textbooks, provide treatment recommendations.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "treatment": "Primary treatment name",
  "confidence": 85,
  "reasoning": "Evidence-based explanation citing the research",
  "sources": [
    {"title": "Paper title", "journal": "Journal name", "year": 2023, "doi": "optional"}
  ],
  "alternativeTreatments": ["Alternative 1", "Alternative 2"],
  "contraindications": ["Contraindication 1", "Contraindication 2"]
}

Confidence score should be 0-100 based on evidence strength.`

  const userPrompt = `Based on this medical evidence:\n\n${context}\n\nProvide treatment recommendation for:\nDiagnosis: ${diagnosis}\nTooth Number: ${toothNumber}\n${
    patientContext
      ? `Patient Age: ${patientContext.age}\nMedical History: ${patientContext.medicalHistory}`
      : ''
  }`

  const messages: GeminiChatMessage[] = [
    {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  ]

  const responseText = await generateChatCompletion(messages, {
    model: 'gemini-2.0-flash',
    temperature: 0.3,
    systemInstruction,
    responseFormat: 'json'
  })

  // Parse JSON response
  try {
    const suggestion = JSON.parse(responseText)
    return suggestion
  } catch (parseError) {
    console.error('❌ [GEMINI] Failed to parse JSON response:', responseText)
    throw new Error('AI returned invalid JSON format')
  }
}

/**
 * Analyze patient cohort data for research insights
 * @param cohortData - Array of patient records
 * @param query - Research question
 * @returns Structured research insights
 */
export async function analyzePatientCohort(params: {
  cohortData: any[]
  query: string
}): Promise<{
  summary: string
  insights: string[]
  statistics: Record<string, any>
  recommendations: string[]
  visualizations?: Array<{ type: string; title: string; data: any }>
}> {
  const { cohortData, query } = params

  // Prepare cohort data summary
  const cohortSummary = {
    totalPatients: cohortData.length,
    sampleData: cohortData.slice(0, 10), // First 10 records for context
    dataFields: cohortData.length > 0 ? Object.keys(cohortData[0]) : []
  }

  const systemInstruction = `You are a clinical research analyst for a dental clinic specializing in endodontics.
You have access to a patient database with clinical data including appointments, treatments, diagnoses, and outcomes.

Your role is to:
1. Analyze patient cohort data and provide statistical insights
2. Identify clinical trends and patterns
3. Compare treatment outcomes
4. Make evidence-based recommendations
5. Present findings in a clear, professional format

IMPORTANT: You are analyzing REAL PATIENT DATA from the clinic database, not medical literature. Focus on statistical analysis and clinical insights from the provided data.

Always structure your response as JSON in this format:
{
  "summary": "Brief overview of findings",
  "insights": ["Insight 1", "Insight 2", ...],
  "statistics": {
    "key_metric_1": "value",
    "key_metric_2": "value"
  },
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "visualizations": [
    {"type": "bar_chart", "title": "Chart title", "data": {...}}
  ]
}`

  const userPrompt = `Analyze the following patient cohort data and answer this research question:

QUESTION: ${query}

COHORT DATA:
- Total Patients: ${cohortSummary.totalPatients}
- Data Fields: ${cohortSummary.dataFields.join(', ')}
${cohortSummary.totalPatients > 0 ? `\nSample Records (first 10):\n${JSON.stringify(cohortSummary.sampleData, null, 2)}` : ''}

Provide a comprehensive analysis with statistical insights, trends, and clinical recommendations.`

  const messages: GeminiChatMessage[] = [
    {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  ]

  const responseText = await generateChatCompletion(messages, {
    model: 'gemini-2.0-flash',
    temperature: 0.3,
    systemInstruction,
    responseFormat: 'json'
  })

  // Parse JSON response
  try {
    const analysis = JSON.parse(responseText)
    return analysis
  } catch (parseError) {
    console.error('❌ [GEMINI] Failed to parse JSON response:', responseText)
    throw new Error('AI returned invalid JSON format')
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Similarity score (0-1)
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimension')
  }

  const dotProduct = embedding1.reduce((sum, val, idx) => sum + val * embedding2[idx], 0)
  const norm1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0))
  const norm2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0))

  return dotProduct / (norm1 * norm2)
}
