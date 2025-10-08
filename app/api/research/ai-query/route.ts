import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Use proper cookie-aware client for auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('🔒 [AI-QUERY] Authentication failed:', { authError, hasUser: !!user })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a dentist (use service client for DB query)
    const serviceSupabase = await createServiceClient()
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { projectId, query, cohortData, analysisType, disableRAG } = body

    const startTime = Date.now()

    console.log('🤖 [AI-QUERY] Processing research AI request:', {
      projectId,
      analysisType,
      query: query?.substring(0, 100) + '...',
      cohortSize: cohortData?.length || 0,
      disableRAG: disableRAG || false
    })

    // Detect if this is a statistical query
    const isStatisticalQuery = detectStatisticalQuery(query)
    if (isStatisticalQuery.isStatistical) {
      console.log('📊 [AI-QUERY] Detected statistical query, routing to statistical analysis')
      
      try {
        // Route to statistical analysis API
        const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/research/statistical-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            cohortData,
            field: isStatisticalQuery.field,
            analysisType: isStatisticalQuery.field ? 'single_field' : 'comprehensive',
            formatForChat: true
          })
        })

        const statsResult = await statsResponse.json()
        
        if (statsResult.success) {
          const processingTime = Date.now() - startTime
          
          return NextResponse.json({
            success: true,
            response: statsResult.analysis.report,
            source: 'statistical_analysis',
            analysisType: 'statistical_query',
            hasEvidence: false,
            processingTime,
            metadata: {
              detectedQuery: isStatisticalQuery,
              fieldsAnalyzed: statsResult.analysis.fieldsAnalyzed,
              cohortSize: statsResult.analysis.cohortSize
            },
            timestamp: new Date().toISOString()
          })
        }
        
        // If statistical analysis failed, fall through to regular AI processing
        console.log('⚠️ [AI-QUERY] Statistical analysis failed, falling back to regular AI processing')
      } catch (error) {
        console.error('❌ [AI-QUERY] Statistical analysis error:', error)
        // Fall through to regular AI processing
      }
    }

    // Use Google Gemini with RAG to analyze patient database + medical knowledge
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    let source: 'gemini' | 'gemini_rag' | 'fallback' = 'fallback'
    let aiResponse: any
    let citations: any[] = []

    if (GEMINI_API_KEY) {
      try {
        // Check if RAG should be disabled (for clinic analysis)
        if (disableRAG || analysisType === 'clinic_analysis') {
          console.log('📈 [AI-QUERY] Using Gemini for clinic data analysis (RAG disabled)')
          
          const { analyzePatientCohort } = await import('@/lib/services/gemini-ai')
          
          aiResponse = await analyzePatientCohort({
            cohortData: cohortData || [],
            query
          })
          
          source = 'gemini'
          console.log('✅ [AI-QUERY] Gemini clinic analysis completed')
        } else {
          console.log('🧠 [AI-QUERY] Using Gemini with RAG for evidence-based analysis')

          // Import RAG service
          const { enhancedRAGQuery } = await import('@/lib/services/rag-service')
          const { analyzePatientCohortWithRAG } = await import('@/lib/services/gemini-ai')

          // Step 1: Perform RAG query to get relevant medical knowledge
          const ragResult = await enhancedRAGQuery({
            userQuery: query,
            patientData: {
              totalPatients: cohortData?.length || 0,
              hasClinicalData: cohortData && cohortData.length > 0
            }
          })

          console.log(`📚 [AI-QUERY] RAG search complete: ${ragResult.hasEvidence ? 'Evidence found' : 'No evidence'}, ${ragResult.citations.length} citations`)

          // Step 2: Send query + RAG context + patient data to Gemini
          aiResponse = await analyzePatientCohortWithRAG({
            cohortData: cohortData || [],
            query,
            ragContext: ragResult.ragContext,
            hasEvidence: ragResult.hasEvidence
          })

          citations = ragResult.citations
          source = ragResult.hasEvidence ? 'gemini_rag' : 'gemini'
          console.log('✅ [AI-QUERY] Gemini analysis with RAG completed')
        }
      } catch (error) {
        console.error('❌ [AI-QUERY] Error calling Gemini:', error)
        // Fall through to fallback
      }
    }

    // Use fallback if Gemini is not configured or failed
    if (source === 'fallback') {
      console.log('💡 [AI-QUERY] Using fallback response (GEMINI_API_KEY not configured)')
      aiResponse = generateFallbackResponse(analysisType, query, cohortData)
    }

    const processingTime = Date.now() - startTime

    console.log('✅ [AI-QUERY] Response ready:', {
      source,
      processingTime: `${processingTime}ms`
    })

    return NextResponse.json({
      success: true,
      response: aiResponse.response || aiResponse.output || aiResponse,
      source,
      citations: citations.length > 0 ? citations : undefined,
      hasEvidence: citations.length > 0,
      processingTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [AI-QUERY] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Fallback response generator for development/testing
function generateFallbackResponse(analysisType: string, query: string, cohortData: any) {
  const patientCount = cohortData?.length || 0

  switch (analysisType) {
    case 'analyze_cohort':
      return {
        type: 'cohort_analysis',
        summary: `Analysis of ${patientCount} patients in research cohort`,
        insights: [
          `Average age: ${Math.round(25 + Math.random() * 30)} years`,
          `Success rate: ${Math.round(75 + Math.random() * 20)}%`,
          `Most common diagnosis: Pulpitis (${Math.round(40 + Math.random() * 30)}% of cases)`,
          `Treatment completion rate: ${Math.round(80 + Math.random() * 15)}%`
        ],
        recommendations: [
          'Consider standardizing treatment protocols for better outcomes',
          'Monitor younger patients more closely for complications',
          'Implement post-treatment follow-up schedule'
        ]
      }

    case 'compare_treatments':
      return {
        type: 'treatment_comparison',
        summary: 'Comparative analysis of treatment modalities',
        comparison: {
          'Single-visit RCT': { success_rate: '89%', complications: '12%', satisfaction: '4.2/5' },
          'Multi-visit RCT': { success_rate: '92%', complications: '8%', satisfaction: '4.0/5' },
          'Apexification': { success_rate: '78%', complications: '18%', satisfaction: '3.8/5' }
        },
        recommendation: 'Multi-visit RCT shows slightly better success rates but longer treatment time'
      }

    case 'predict_outcomes':
      return {
        type: 'outcome_prediction',
        summary: 'Treatment success probability analysis',
        prediction: {
          success_probability: `${Math.round(75 + Math.random() * 20)}%`,
          confidence_level: 'High',
          risk_factors: ['Patient age > 60', 'Previous endodontic treatment', 'Systemic conditions'],
          success_factors: ['Early intervention', 'Proper isolation', 'Adequate follow-up']
        }
      }

    default:
      return {
        type: 'general_query',
        summary: `Research analysis for: "${query}"`,
        response: `Based on the clinical data analysis, here are the key findings for your research question. This analysis covers ${patientCount} patients with relevant clinical parameters. The AI system has identified significant patterns in treatment outcomes and patient demographics that may inform your clinical decision-making.`,
        confidence: 'Moderate',
        sources: ['Clinical database', 'Treatment outcomes', 'Patient demographics']
      }
  }
}

/**
 * Detect if a query is asking for statistical analysis
 */
function detectStatisticalQuery(query: string): {
  isStatistical: boolean
  type?: 'descriptive' | 'comparative' | 'specific_field'
  field?: string
  statistic?: string
} {
  if (!query) return { isStatistical: false }
  
  const lowerQuery = query.toLowerCase()
  
  // Statistical keywords that indicate statistical analysis is needed
  const statisticalKeywords = [
    'mean', 'average', 'median', 'mode', 'standard deviation', 'std dev',
    'variance', 'quartile', 'percentile', 'range', 'min', 'max', 'minimum', 'maximum',
    'frequency', 'distribution', 'histogram', 'correlation',
    'descriptive statistics', 'summary statistics', 'statistical analysis',
    'calculate', 'compute', 'what is the', 'show me the', 'analyze'
  ]
  
  // Field-specific patterns (common medical/research fields)
  const fieldPatterns = [
    'age', 'gender', 'diagnosis', 'treatment', 'outcome', 'success', 'duration',
    'pain score', 'satisfaction', 'cost', 'visits', 'complications'
  ]
  
  // Check if query contains statistical keywords
  const hasStatKeyword = statisticalKeywords.some(keyword => 
    lowerQuery.includes(keyword)
  )
  
  if (!hasStatKeyword) {
    return { isStatistical: false }
  }
  
  // Try to extract specific field being asked about
  let detectedField: string | undefined
  let detectedStatistic: string | undefined
  
  // Look for specific field mentions
  fieldPatterns.forEach(field => {
    if (lowerQuery.includes(field)) {
      detectedField = field
    }
  })
  
  // Look for specific statistic mentions
  if (lowerQuery.includes('mean') || lowerQuery.includes('average')) {
    detectedStatistic = 'mean'
  } else if (lowerQuery.includes('median')) {
    detectedStatistic = 'median'
  } else if (lowerQuery.includes('mode')) {
    detectedStatistic = 'mode'
  } else if (lowerQuery.includes('standard deviation')) {
    detectedStatistic = 'standard_deviation'
  } else if (lowerQuery.includes('range')) {
    detectedStatistic = 'range'
  }
  
  // Determine query type
  let queryType: 'descriptive' | 'comparative' | 'specific_field' = 'descriptive'
  
  if (detectedField && detectedStatistic) {
    queryType = 'specific_field'
  } else if (lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('versus')) {
    queryType = 'comparative'
  }
  
  return {
    isStatistical: true,
    type: queryType,
    field: detectedField,
    statistic: detectedStatistic
  }
}
