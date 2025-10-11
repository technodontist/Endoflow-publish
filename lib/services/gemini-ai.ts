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
/**
 * Generate diagnosis suggestion based on symptoms and clinical findings
 * Uses Gemini with RAG from medical knowledge base
 */
export async function generateDiagnosisSuggestion(params: {
  symptoms: string[]
  painCharacteristics?: {
    quality?: string
    intensity?: number
    location?: string
    duration?: string
  }
  clinicalFindings?: string
  toothNumber?: string
  medicalContext: Array<{ title: string; content: string; journal?: string; year?: number; doi?: string }>
  patientContext?: {
    age?: number
    medicalHistory?: string
  }
}): Promise<{
  diagnosis: string
  confidence: number
  reasoning: string
  clinicalSignificance: string
  differentialDiagnoses: string[]
  recommendedTests?: string[]
  sources: Array<{ title: string; journal: string; year: number; doi?: string }>
}> {
  const { symptoms, painCharacteristics, clinicalFindings, toothNumber, medicalContext, patientContext } = params

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

  const systemInstruction = `You are an expert dental diagnostician AI assistant. Based on evidence from research papers and textbooks, provide diagnostic recommendations.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "diagnosis": "Primary diagnosis name",
  "confidence": 85,
  "reasoning": "Evidence-based explanation citing the research",
  "clinicalSignificance": "Clinical significance and prognosis",
  "differentialDiagnoses": ["Differential diagnosis 1", "Differential diagnosis 2", "Differential diagnosis 3"],
  "recommendedTests": ["Test 1", "Test 2"],
  "sources": [
    {"title": "Paper title", "journal": "Journal name", "year": 2023, "doi": "optional"}
  ]
}

Confidence score should be 0-100 based on evidence strength.`

  const painText = painCharacteristics
    ? `Pain Quality: ${painCharacteristics.quality || 'Not specified'}
Pain Intensity: ${painCharacteristics.intensity || 'Not specified'}/10
Pain Location: ${painCharacteristics.location || 'Not specified'}
Duration: ${painCharacteristics.duration || 'Not specified'}`
    : 'No pain characteristics provided'

  // Build user prompt differently based on whether we have medical context
  const userPrompt = medicalContext.length > 0
    ? `Based on this medical evidence:\n\n${context}\n\nProvide diagnostic recommendation for:
Symptoms: ${symptoms.join(', ')}
${painText}
Clinical Findings: ${clinicalFindings || 'Not provided'}
${toothNumber ? `Tooth Number: ${toothNumber}` : ''}
${
    patientContext
      ? `Patient Age: ${patientContext.age}\nMedical History: ${patientContext.medicalHistory}`
      : ''
  }

Focus on dental diagnoses from the predefined categories: Caries & Cavities, Pulpal Conditions, Periapical Conditions, Periodontal, Restorative, Developmental Anomalies, Traumatic Injuries, Wear & Erosion, Tooth Resorption, and Other Conditions.`
    : `Using your extensive knowledge of dental medicine, provide diagnostic recommendation for:

Symptoms: ${symptoms.join(', ')}
${painText}
Clinical Findings: ${clinicalFindings || 'Not provided'}
${toothNumber ? `Tooth Number: ${toothNumber}` : ''}
${
    patientContext
      ? `Patient Age: ${patientContext.age}\nMedical History: ${patientContext.medicalHistory}`
      : ''
  }

Focus on dental diagnoses from the predefined categories: Caries & Cavities, Pulpal Conditions, Periapical Conditions, Periodontal, Restorative, Developmental Anomalies, Traumatic Injuries, Wear & Erosion, Tooth Resorption, and Other Conditions.

Provide your best diagnostic recommendation based on dental medical knowledge and evidence-based guidelines.`

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
 * Helper function to calculate age from date of birth
 */
function calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

/**
 * Helper function to aggregate cohort data for better AI analysis
 */
function aggregateCohortData(cohortData: any[]): Record<string, any> {
  // Check if this is already aggregated data from analytics
  if (cohortData.length === 1 && cohortData[0]._isAggregateData) {
    const aggregateData = cohortData[0]
    const clinicalData = aggregateData.clinicalData || {}
    
    return {
      totalPatients: aggregateData.totalPatients || aggregateData.statistics?.totalPatients || 0,
      demographics: {
        ageDistribution: aggregateData.demographics?.reduce((acc: any, demo: any) => {
          acc[demo.ageGroup] = demo.count
          return acc
        }, {}) || {},
        genderDistribution: {}
      },
      clinical: {
        totalConsultations: clinicalData.totalConsultations || aggregateData.statistics?.totalConsultations || 0,
        totalTreatments: clinicalData.totalTreatments || aggregateData.treatmentDistribution?.reduce((sum: number, t: any) => sum + (t.count || 0), 0) || 0,
        totalAppointments: clinicalData.totalAppointments || aggregateData.statistics?.totalAppointments || 0,
        commonDiagnoses: clinicalData.diagnoses?.reduce((acc: any, d: any) => {
          acc[d.name] = d.count
          return acc
        }, {}) || {},
        commonTreatments: aggregateData.treatmentDistribution?.reduce((acc: any, t: any) => {
          if (t.treatmentType) acc[t.treatmentType] = t.count
          return acc
        }, {}) || {},
        treatmentOutcomes: clinicalData.outcomes?.reduce((acc: any, o: any) => {
          acc[o.name] = o.count
          return acc
        }, {}) || {},
        topDiagnoses: clinicalData.diagnoses?.map((d: any) => ({
          name: d.name,
          count: d.count,
          percentage: aggregateData.totalPatients > 0 ? `${((d.count / aggregateData.totalPatients) * 100).toFixed(1)}%` : 'N/A'
        })) || [],
        topTreatments: aggregateData.treatmentDistribution?.map((t: any) => ({
          name: t.treatmentType,
          count: t.count,
          percentage: t.percentage ? `${t.percentage}%` : 'N/A'
        })) || []
      }
    }
  }
  
  // Otherwise, process individual patient records
  const stats: Record<string, any> = {
    totalPatients: cohortData.length,
    demographics: {
      ageDistribution: {},
      genderDistribution: {}
    },
    clinical: {
      totalConsultations: 0,
      totalTreatments: 0,
      totalAppointments: 0,
      commonDiagnoses: {},
      commonTreatments: {},
      treatmentOutcomes: {}
    }
  }

  cohortData.forEach(patient => {
    // Age distribution
    const age = calculateAge(patient.dateOfBirth || patient.date_of_birth)
    if (age !== null) {
      const ageGroup = age < 18 ? '<18' : age < 35 ? '18-34' : age < 50 ? '35-49' : age < 65 ? '50-64' : '65+'
      stats.demographics.ageDistribution[ageGroup] = (stats.demographics.ageDistribution[ageGroup] || 0) + 1
    }

    // Clinical data aggregation
    if (patient.consultations) {
      stats.clinical.totalConsultations += patient.consultations.length

      // Extract diagnoses from consultations
      patient.consultations.forEach((consultation: any) => {
        if (consultation.diagnosis) {
          try {
            const diagnosisData = typeof consultation.diagnosis === 'string'
              ? JSON.parse(consultation.diagnosis)
              : consultation.diagnosis

            if (diagnosisData.primaryDiagnosis) {
              stats.clinical.commonDiagnoses[diagnosisData.primaryDiagnosis] =
                (stats.clinical.commonDiagnoses[diagnosisData.primaryDiagnosis] || 0) + 1
            }
          } catch (e) {
            // Skip if diagnosis is not parseable
          }
        }
      })
    }

    if (patient.treatments) {
      stats.clinical.totalTreatments += patient.treatments.length

      // Treatment types and outcomes (handle both snake_case and camelCase)
      patient.treatments.forEach((treatment: any) => {
        const treatmentType = treatment.treatment_type || treatment.treatmentType
        if (treatmentType) {
          stats.clinical.commonTreatments[treatmentType] =
            (stats.clinical.commonTreatments[treatmentType] || 0) + 1
        }

        if (treatment.status) {
          stats.clinical.treatmentOutcomes[treatment.status] =
            (stats.clinical.treatmentOutcomes[treatment.status] || 0) + 1
        }
      })
    }

    if (patient.appointments) {
      stats.clinical.totalAppointments += patient.appointments.length
    }
  })

  // Convert to percentages and top items for better analysis
  const formatTopItems = (obj: Record<string, number>, limit = 5) => {
    return Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key, value]) => ({
        name: key,
        count: value,
        percentage: ((value / cohortData.length) * 100).toFixed(1) + '%'
      }))
  }

  stats.clinical.topDiagnoses = formatTopItems(stats.clinical.commonDiagnoses)
  stats.clinical.topTreatments = formatTopItems(stats.clinical.commonTreatments)

  return stats
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

  // Aggregate cohort data to reduce token usage and provide better context
  const aggregateData = aggregateCohortData(cohortData)

  // Use actual patient count from aggregate data, not array length
  const actualPatientCount = aggregateData.totalPatients || cohortData.length

  // Prepare cohort data summary
  const cohortSummary = {
    totalPatients: actualPatientCount,
    aggregatedStats: aggregateData,
    sampleData: cohortData.slice(0, 5).map(patient => ({
      // Include only relevant fields, exclude sensitive data
      id: patient.id || patient.patient_id,
      age: calculateAge(patient.dateOfBirth || patient.date_of_birth),
      hasConsultations: patient.consultations?.length > 0,
      hasTreatments: patient.treatments?.length > 0,
      hasAppointments: patient.appointments?.length > 0
    })),
    dataFields: cohortData.length > 0 ? Object.keys(cohortData[0]).filter(k =>
      !['email', 'phone', 'emergency_contact_phone', 'emergency_contact_name'].includes(k)
    ) : []
  }

  const systemInstruction = `You are a clinical research analyst for a dental clinic specializing in endodontics.
You analyze patient data to provide clear, actionable insights.

RESPONSE RULES:
1. Be DIRECT and SPECIFIC - answer the question with actual data (names, numbers, dates)
2. Do NOT mention data sources, tables, sections, or technical details (e.g., don't say "based on the provided data", "looking at the records", "TOP TREATMENTS section", etc.)
3. If asked to list patients, just list them with their details
4. If asked about counts, give the number and list who/what
5. Keep responses concise and conversational
6. "Final patient" or "last patient" means the highest patient number

EXAMPLES:
Bad: "Based on the provided data in the DETAILED PATIENT RECORDS section, there are 3 Root Canal Treatments. Looking at the TOP TREATMENTS..."
Good: "3 Root Canal Treatments have been performed on: karan q, alok a, and patient 4."

Bad: "Analysis of the patient cohort reveals..."
Good: "You have treated 20 patients with 64 total consultations."

Always structure your response as JSON in this format:
{
  "summary": "Direct, specific answer to the question without mentioning data sources",
  "insights": ["Key finding 1", "Key finding 2", ...],
  "statistics": {
    "metric": "value"
  },
  "recommendations": ["Action 1", "Action 2", ...]
}`

  // Build detailed patient records for AI analysis
  const detailedPatients = cohortData.map((patient, idx) => {
    const age = calculateAge(patient.dateOfBirth || patient.date_of_birth)
    const name = `${patient.first_name || patient.firstName || 'Unknown'} ${patient.last_name || patient.lastName || ''}`
    
    // Extract diagnoses from consultations
    const diagnoses: string[] = []
    patient.consultations?.forEach((c: any) => {
      if (c.diagnosis) {
        try {
          const diagData = typeof c.diagnosis === 'string' ? JSON.parse(c.diagnosis) : c.diagnosis

          // Handle different diagnosis formats
          if (Array.isArray(diagData)) {
            // Format: ["Pulpitis", "Root canal needed"]
            diagnoses.push(...diagData.filter((d: any) => typeof d === 'string'))
          } else if (diagData.primaryDiagnosis) {
            // Format: {primaryDiagnosis: "...", ...}
            diagnoses.push(diagData.primaryDiagnosis)
          } else if (typeof diagData === 'string') {
            // Format: "Pulpitis"
            diagnoses.push(diagData)
          }
        } catch (e) {
          // If it's already a plain string (not JSON), use it
          if (typeof c.diagnosis === 'string' && !c.diagnosis.startsWith('[') && !c.diagnosis.startsWith('{')) {
            diagnoses.push(c.diagnosis)
          }
        }
      }
    })

    // Extract tooth-level diagnoses (CRITICAL for detailed dental analysis)
    const toothDiagnoses = patient.toothDiagnoses?.map((td: any) => ({
      tooth: td.tooth_number || td.toothNumber,
      diagnosis: td.primary_diagnosis || td.primaryDiagnosis,
      status: td.status,
      details: td.diagnosis_details || td.diagnosisDetails,
      treatment: td.recommended_treatment || td.recommendedTreatment,
      priority: td.treatment_priority || td.treatmentPriority
    })) || []
    
    // Extract treatments
    const treatments = patient.treatments?.map((t: any) => ({
      type: t.treatment_type || t.treatmentType || 'Unknown',
      status: t.status || 'Unknown',
      outcome: t.outcome || 'N/A',
      date: t.completion_date || t.completionDate || t.created_at || 'N/A'
    })) || []
    
    // Extract appointments
    const appointments = patient.appointments?.map((a: any) => ({
      type: a.appointment_type || a.appointmentType || 'Unknown',
      status: a.status || 'Unknown',
      date: a.scheduled_date || a.scheduledDate || a.created_at || 'N/A'
    })) || []
    
    return {
      patientNumber: idx + 1,
      name,
      age: age || 'Unknown',
      consultationsCount: patient.consultations?.length || 0,
      treatmentsCount: patient.treatments?.length || 0,
      appointmentsCount: patient.appointments?.length || 0,
      toothDiagnosesCount: patient.toothDiagnoses?.length || 0,
      diagnoses,
      toothDiagnoses,
      treatments,
      appointments,
      medicalHistory: patient.medical_history_summary || patient.medicalHistorySummary || 'None recorded'
    }
  })

  // Debug: Log first patient's data structure
  if (cohortData.length > 0) {
    console.log('🔍 [DEBUG] Sample patient data structure:', JSON.stringify({
      hasConsultations: !!cohortData[0].consultations,
      consultationsCount: cohortData[0].consultations?.length || 0,
      hasTreatments: !!cohortData[0].treatments,
      treatmentsCount: cohortData[0].treatments?.length || 0,
      hasAppointments: !!cohortData[0].appointments,
      appointmentsCount: cohortData[0].appointments?.length || 0,
      hasToothDiagnoses: !!cohortData[0].toothDiagnoses,
      toothDiagnosesCount: cohortData[0].toothDiagnoses?.length || 0,
      sampleTreatment: cohortData[0].treatments?.[0] || null,
      sampleConsultation: cohortData[0].consultations?.[0] ? {
        hasDiagnosis: !!cohortData[0].consultations[0].diagnosis,
        diagnosisType: typeof cohortData[0].consultations[0].diagnosis
      } : null,
      sampleToothDiagnosis: cohortData[0].toothDiagnoses?.[0] || null
    }, null, 2))
  }
  
  console.log('🔍 [DEBUG] Detailed patients extracted:', detailedPatients.length)
  console.log('🔍 [DEBUG] First detailed patient:', JSON.stringify(detailedPatients[0], null, 2))

  const userPrompt = `Analyze the following patient cohort data and answer this research question:

QUESTION: ${query}

COHORT STATISTICS:
- Total Patients: ${cohortSummary.totalPatients}

DEMOGRAPHICS:
${JSON.stringify(cohortSummary.aggregatedStats.demographics, null, 2)}

CLINICAL DATA SUMMARY:
- Total Consultations: ${cohortSummary.aggregatedStats.clinical.totalConsultations}
- Total Treatments: ${cohortSummary.aggregatedStats.clinical.totalTreatments}
- Total Appointments: ${cohortSummary.aggregatedStats.clinical.totalAppointments}

TOP DIAGNOSES:
${cohortSummary.aggregatedStats.clinical.topDiagnoses?.map((d: any) => `- ${d.name}: ${d.count} patients (${d.percentage})`).join('\n') || 'No diagnosis data available'}

TOP TREATMENTS:
${cohortSummary.aggregatedStats.clinical.topTreatments?.map((t: any) => `- ${t.name}: ${t.count} treatments (${t.percentage})`).join('\n') || 'No treatment data available'}

TREATMENT OUTCOMES:
${Object.entries(cohortSummary.aggregatedStats.clinical.treatmentOutcomes || {}).map(([status, count]) => `- ${status}: ${count}`).join('\n') || 'No outcome data available'}

DETAILED PATIENT RECORDS (showing all ${detailedPatients.length} patients):
${detailedPatients.map(p => `
Patient #${p.patientNumber}: ${p.name}
- Age: ${p.age}
- Consultations: ${p.consultationsCount} | Treatments: ${p.treatmentsCount} | Appointments: ${p.appointmentsCount} | Tooth Diagnoses: ${p.toothDiagnosesCount}
- General Diagnoses: ${p.diagnoses.length > 0 ? p.diagnoses.join(', ') : 'None recorded'}
- Tooth-Level Diagnoses: ${p.toothDiagnoses.length > 0 ? p.toothDiagnoses.map((td: any) => `Tooth ${td.tooth}: ${td.diagnosis || td.status}${td.treatment ? ` (Treatment: ${td.treatment})` : ''}`).join(' | ') : 'None recorded'}
- Recent Treatments: ${p.treatments.slice(0, 3).map(t => `${t.type} (${t.status})`).join(', ') || 'None'}
- Recent Appointments: ${p.appointments.slice(0, 3).map(a => `${a.type} - ${a.status}`).join(', ') || 'None'}
- Medical History: ${p.medicalHistory}`).join('\n')}

Provide a comprehensive analysis with statistical insights, trends, and evidence-based clinical recommendations. When answering questions about specific patients (like "final patient", "last patient", or "patient X"), reference the DETAILED PATIENT RECORDS above.`
  
  console.log('🔍 [DEBUG] User prompt (first 2000 chars):', userPrompt.substring(0, 2000))

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
 * Analyze patient cohort with RAG (Retrieval-Augmented Generation)
 * Combines patient data analysis with evidence from medical literature
 * @param cohortData - Array of patient records
 * @param query - Research question
 * @param ragContext - Retrieved medical knowledge context
 * @param hasEvidence - Whether RAG found relevant evidence
 * @returns Structured research insights with evidence citations
 */
export async function analyzePatientCohortWithRAG(params: {
  cohortData: any[]
  query: string
  ragContext: string
  hasEvidence: boolean
}): Promise<{
  summary: string
  insights: string[]
  statistics: Record<string, any>
  recommendations: string[]
  evidenceBased: boolean
  visualizations?: Array<{ type: string; title: string; data: any }>
}> {
  const { cohortData, query, ragContext, hasEvidence } = params

  // Aggregate cohort data
  const aggregateData = aggregateCohortData(cohortData)

  // Use actual patient count from aggregate data, not array length
  const actualPatientCount = aggregateData.totalPatients || cohortData.length

  // Prepare cohort data summary
  const cohortSummary = {
    totalPatients: actualPatientCount,
    aggregatedStats: aggregateData,
    sampleData: cohortData.slice(0, 5).map(patient => ({
      id: patient.id || patient.patient_id,
      age: calculateAge(patient.dateOfBirth || patient.date_of_birth),
      hasConsultations: patient.consultations?.length > 0,
      hasTreatments: patient.treatments?.length > 0,
      hasAppointments: patient.appointments?.length > 0
    })),
    dataFields: cohortData.length > 0 ? Object.keys(cohortData[0]).filter(k =>
      !['email', 'phone', 'emergency_contact_phone', 'emergency_contact_name'].includes(k)
    ) : []
  }

  const systemInstruction = `You are a clinical research analyst for a dental clinic specializing in endodontics.
You have access to:
1. A patient database with clinical data (appointments, treatments, diagnoses, outcomes)
2. Medical literature and research papers from the knowledge base

Your role is to provide EVIDENCE-BASED analysis by:
1. Analyzing patient cohort data for statistical insights
2. ${hasEvidence ? 'Referencing relevant medical literature to support findings' : 'Using clinical expertise when no literature is available'}
3. Identifying clinical trends and patterns
4. Comparing treatment outcomes
5. Making evidence-based recommendations with citations

${hasEvidence ? `IMPORTANT: You have access to medical literature below. CITE these sources using [Source X] notation when making clinical claims.` : 'NOTE: No medical literature was found for this query. Provide analysis based on the patient data only.'}

Always structure your response as JSON in this format:
{
  "summary": "Brief overview of findings ${hasEvidence ? 'with evidence citations' : ''}",
  "insights": ["Insight 1 ${hasEvidence ? '[Source X]' : ''}", "Insight 2", ...],
  "statistics": {
    "key_metric_1": "value",
    "key_metric_2": "value"
  },
  "recommendations": ["Evidence-based recommendation 1 ${hasEvidence ? '[Source X]' : ''}", ...],
  "evidenceBased": ${hasEvidence},
  "visualizations": [
    {"type": "bar_chart", "title": "Chart title", "data": {...}}
  ]
}`

  let userPrompt = `Analyze the following patient cohort data and answer this research question:

QUESTION: ${query}

COHORT STATISTICS:
- Total Patients: ${cohortSummary.totalPatients}

DEMOGRAPHICS:
${JSON.stringify(cohortSummary.aggregatedStats.demographics, null, 2)}

CLINICAL DATA:
- Total Consultations: ${cohortSummary.aggregatedStats.clinical.totalConsultations}
- Total Treatments: ${cohortSummary.aggregatedStats.clinical.totalTreatments}
- Total Appointments: ${cohortSummary.aggregatedStats.clinical.totalAppointments}

TOP DIAGNOSES:
${cohortSummary.aggregatedStats.clinical.topDiagnoses?.map((d: any) => `- ${d.name}: ${d.count} patients (${d.percentage})`).join('\n') || 'No diagnosis data available'}

TOP TREATMENTS:
${cohortSummary.aggregatedStats.clinical.topTreatments?.map((t: any) => `- ${t.name}: ${t.count} treatments (${t.percentage})`).join('\n') || 'No treatment data available'}

TREATMENT OUTCOMES:
${Object.entries(cohortSummary.aggregatedStats.clinical.treatmentOutcomes || {}).map(([status, count]) => `- ${status}: ${count}`).join('\n') || 'No outcome data available'}
`

  // Add RAG context if evidence was found
  if (hasEvidence && ragContext) {
    userPrompt += `\n\n=== MEDICAL LITERATURE EVIDENCE ===\n\n${ragContext}\n\n=== END OF EVIDENCE ===\n\n`
    userPrompt += `Provide a comprehensive analysis citing the medical literature above where relevant. Use [Source 1], [Source 2], etc. to reference specific evidence.`
  } else {
    userPrompt += `\n\nProvide a comprehensive analysis with statistical insights, trends, and clinical recommendations based on this patient cohort data.`
  }

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
    return {
      ...analysis,
      evidenceBased: hasEvidence
    }
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

/**
 * Interpret statistical results using AI to provide clinical insights
 * @param statisticalResults - Results from statistical analysis
 * @param cohortContext - Information about the patient cohort
 * @param query - Original research query
 * @returns AI-generated interpretation with clinical insights
 */
export async function interpretStatisticalResults(params: {
  statisticalResults: any
  cohortContext: {
    totalPatients: number
    fields: string[]
    analysisType: string
  }
  query?: string
}): Promise<{
  summary: string
  clinicalInsights: string[]
  recommendations: string[]
  significance: string[]
  limitations: string[]
}> {
  const { statisticalResults, cohortContext, query } = params

  const systemInstruction = `You are a clinical research statistician specializing in endodontics.
Your role is to interpret statistical analysis results and provide actionable clinical insights.

Guidelines:
1. Explain what the statistics mean in clinical terms
2. Identify statistically significant patterns
3. Provide evidence-based recommendations
4. Note any limitations or concerns about the analysis
5. Use medical terminology appropriately but keep explanations clear

Always respond in JSON format:
{
  "summary": "Brief overview of the statistical findings",
  "clinicalInsights": ["Insight 1", "Insight 2", ...],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "significance": ["Significant finding 1", "Significant finding 2", ...],
  "limitations": ["Limitation 1", "Limitation 2", ...]
}`

  const userPrompt = `Interpret the following statistical analysis results:

ORIGINAL QUERY: ${query || 'General statistical analysis'}

COHORT CONTEXT:
- Total Patients: ${cohortContext.totalPatients}
- Fields Analyzed: ${cohortContext.fields.join(', ')}
- Analysis Type: ${cohortContext.analysisType}

STATISTICAL RESULTS:
${JSON.stringify(statisticalResults, null, 2)}

Provide a clinical interpretation of these statistical findings, focusing on:
1. What these numbers mean for patient care
2. Any statistically significant patterns
3. Clinical recommendations based on the findings
4. Potential limitations of the analysis

Be specific about which statistics support each insight and recommendation.`

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

  try {
    const interpretation = JSON.parse(responseText)
    return interpretation
  } catch (parseError) {
    console.error('❌ [GEMINI] Failed to parse statistical interpretation response:', responseText)
    throw new Error('AI returned invalid JSON format for statistical interpretation')
  }
}

/**
 * Generate clinical insights from descriptive statistics
 * @param stats - Descriptive statistics for a field
 * @param fieldName - Name of the analyzed field
 * @param dataType - Type of data (numerical or categorical)
 * @returns Clinical interpretation
 */
export async function interpretFieldStatistics(params: {
  stats: any
  fieldName: string
  dataType: 'numerical' | 'categorical'
  sampleSize: number
}): Promise<{
  interpretation: string
  clinicalRelevance: string
  recommendations: string[]
}> {
  const { stats, fieldName, dataType, sampleSize } = params

  const systemInstruction = `You are a clinical statistician interpreting medical research data.
Provide clear, actionable insights about statistical findings.

Respond in JSON format:
{
  "interpretation": "What the statistics show",
  "clinicalRelevance": "Why this matters clinically",
  "recommendations": ["Action 1", "Action 2", ...]
}`

  const userPrompt = `Interpret these ${dataType} statistics for the field "${fieldName}":

Sample Size: ${sampleSize}
Statistics:
${JSON.stringify(stats, null, 2)}

Provide:
1. A clear interpretation of what these numbers mean
2. The clinical relevance of these findings
3. Specific recommendations based on the results`

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

  try {
    const interpretation = JSON.parse(responseText)
    return interpretation
  } catch (parseError) {
    console.error('❌ [GEMINI] Failed to parse field statistics interpretation:', responseText)
    throw new Error('AI returned invalid JSON format for field statistics interpretation')
  }
}
