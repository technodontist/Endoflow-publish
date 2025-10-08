import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { 
  analyzeField, 
  analyzeMultipleFields, 
  detectDataType,
  formatMultipleResultsForChat,
  formatStatisticalResultForAI,
  type StatisticalResult 
} from '@/lib/services/statistical-analysis'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('🔒 [STATISTICAL-ANALYSIS] Authentication failed:', { authError, hasUser: !!user })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a dentist
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
    const { 
      projectId, 
      cohortData, 
      fields, 
      field, 
      analysisType = 'comprehensive',
      dataType,
      formatForChat = true 
    } = body

    const startTime = Date.now()

    console.log('📊 [STATISTICAL-ANALYSIS] Processing statistical analysis request:', {
      projectId,
      analysisType,
      fieldCount: fields?.length || (field ? 1 : 0),
      cohortSize: cohortData?.length || 0,
      formatForChat
    })

    // Validate input data
    if (!cohortData || !Array.isArray(cohortData) || cohortData.length === 0) {
      return NextResponse.json({ 
        error: 'No cohort data provided or empty dataset',
        success: false 
      }, { status: 400 })
    }

    let results: StatisticalResult[] = []
    let analysisReport = ''

    try {
      switch (analysisType) {
        case 'single_field':
          if (!field) {
            throw new Error('Field parameter required for single field analysis')
          }
          
          const detectedDataType = dataType || detectDataType(cohortData, field)
          const singleResult = analyzeField(cohortData, field, detectedDataType)
          results = [singleResult]
          
          analysisReport = formatForChat 
            ? formatMultipleResultsForChat([singleResult])
            : formatStatisticalResultForAI(singleResult)
          
          console.log(`✅ [STATISTICAL-ANALYSIS] Single field analysis completed for: ${field}`)
          break

        case 'multiple_fields':
          if (!fields || !Array.isArray(fields) || fields.length === 0) {
            throw new Error('Fields array required for multiple field analysis')
          }
          
          results = analyzeMultipleFields(cohortData, fields)
          
          analysisReport = formatForChat 
            ? formatMultipleResultsForChat(results)
            : results.map(r => formatStatisticalResultForAI(r)).join('\n\n')
          
          console.log(`✅ [STATISTICAL-ANALYSIS] Multiple field analysis completed for ${fields.length} fields`)
          break

        case 'comprehensive':
        default:
          // Auto-detect interesting fields to analyze
          const sampleRecord = cohortData[0]
          const autoFields = detectInterestingFields(sampleRecord)
          
          results = analyzeMultipleFields(cohortData, autoFields)
          
          analysisReport = formatForChat 
            ? formatMultipleResultsForChat(results)
            : results.map(r => formatStatisticalResultForAI(r)).join('\n\n')
          
          console.log(`✅ [STATISTICAL-ANALYSIS] Comprehensive analysis completed for ${autoFields.length} auto-detected fields`)
          break
      }

      const processingTime = Date.now() - startTime

      // Generate summary statistics
      const summary = generateAnalysisSummary(results, cohortData.length)

      console.log('✅ [STATISTICAL-ANALYSIS] Analysis complete:', {
        fieldsAnalyzed: results.length,
        totalSampleSize: cohortData.length,
        processingTime: `${processingTime}ms`
      })

      return NextResponse.json({
        success: true,
        analysis: {
          type: 'statistical_analysis',
          fields: results,
          summary,
          report: analysisReport,
          cohortSize: cohortData.length,
          fieldsAnalyzed: results.length
        },
        processingTime,
        source: 'statistical_analysis',
        timestamp: new Date().toISOString()
      })

    } catch (analysisError) {
      console.error('❌ [STATISTICAL-ANALYSIS] Analysis error:', analysisError)
      
      return NextResponse.json({
        success: false,
        error: `Statistical analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`,
        analysis: {
          type: 'statistical_analysis_error',
          report: `**Error:** Unable to complete statistical analysis.\n\n${analysisError instanceof Error ? analysisError.message : 'Unknown error occurred during analysis.'}\n\nPlease check your data format and try again.`,
          cohortSize: cohortData?.length || 0,
          fieldsAnalyzed: 0
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ [STATISTICAL-ANALYSIS] Server error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        success: false 
      },
      { status: 500 }
    )
  }
}

/**
 * Auto-detect fields that are likely interesting for statistical analysis
 */
function detectInterestingFields(sampleRecord: any): string[] {
  const interestingFields: string[] = []
  
  // Common medical/research fields to look for
  const commonFields = [
    'age', 'patient.age', 'demographics.age',
    'gender', 'patient.gender', 'demographics.gender',
    'diagnosis', 'primary_diagnosis', 'condition',
    'treatment', 'treatment_type', 'procedure',
    'outcome', 'success', 'result',
    'duration', 'treatment_duration', 'followup_duration',
    'pain_score', 'satisfaction_score', 'quality_score',
    'complications', 'adverse_events',
    'cost', 'treatment_cost',
    'visits', 'appointment_count'
  ]

  function exploreObject(obj: any, prefix = '') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key]
        const fullKey = prefix ? `${prefix}.${key}` : key
        
        // Check if this field matches common patterns
        const isInteresting = commonFields.some(pattern => 
          fullKey.toLowerCase().includes(pattern.toLowerCase()) ||
          key.toLowerCase().includes(pattern.toLowerCase())
        )
        
        if (isInteresting && (typeof value === 'number' || typeof value === 'string')) {
          interestingFields.push(fullKey)
        }
        
        // Recursively explore nested objects (max 2 levels deep)
        if (typeof value === 'object' && value !== null && !prefix.includes('.')) {
          exploreObject(value, fullKey)
        }
      }
    }
  }

  exploreObject(sampleRecord)
  
  // Fallback: if no common fields found, analyze top-level numeric and string fields
  if (interestingFields.length === 0) {
    Object.keys(sampleRecord).forEach(key => {
      const value = sampleRecord[key]
      if (typeof value === 'number' || typeof value === 'string') {
        interestingFields.push(key)
      }
    })
  }
  
  // Limit to most relevant fields to avoid overwhelming the analysis
  return interestingFields.slice(0, 10)
}

/**
 * Generate a high-level summary of the statistical analysis
 */
function generateAnalysisSummary(results: StatisticalResult[], totalSamples: number): {
  overview: string
  keyFindings: string[]
  recommendations: string[]
} {
  const numericalFields = results.filter(r => r.dataType === 'numerical')
  const categoricalFields = results.filter(r => r.dataType === 'categorical')
  
  const keyFindings: string[] = []
  const recommendations: string[] = []

  // Overview
  const overview = `Statistical analysis of ${totalSamples} records across ${results.length} fields (${numericalFields.length} numerical, ${categoricalFields.length} categorical)`

  // Identify key findings
  numericalFields.forEach(field => {
    if (field.statistics.mean !== undefined && field.statistics.standardDeviation !== undefined) {
      const cv = (field.statistics.standardDeviation / field.statistics.mean) * 100
      if (cv > 50) {
        keyFindings.push(`High variability in ${field.field} (CV: ${cv.toFixed(1)}%)`)
      }
    }

    if (field.warnings && field.warnings.length > 0) {
      keyFindings.push(`Data quality concern in ${field.field}: ${field.warnings[0]}`)
    }
  })

  categoricalFields.forEach(field => {
    if (field.statistics.frequency) {
      const categories = Object.keys(field.statistics.frequency)
      if (categories.length === 1) {
        keyFindings.push(`${field.field} has no variation (single category)`)
      } else if (categories.length > 10) {
        keyFindings.push(`${field.field} has high diversity (${categories.length} categories)`)
      }
    }
  })

  // Generate recommendations
  if (totalSamples < 30) {
    recommendations.push('Consider collecting more data for more reliable statistical inference')
  }

  if (results.some(r => r.warnings && r.warnings.length > 0)) {
    recommendations.push('Review data quality warnings and consider data cleaning')
  }

  if (numericalFields.some(f => f.statistics.skewness && Math.abs(f.statistics.skewness) > 1)) {
    recommendations.push('Some distributions are highly skewed - consider non-parametric tests')
  }

  if (keyFindings.length === 0) {
    keyFindings.push('All analyzed fields show normal statistical patterns')
  }

  if (recommendations.length === 0) {
    recommendations.push('Data appears suitable for standard statistical analysis')
  }

  return {
    overview,
    keyFindings: keyFindings.slice(0, 5), // Limit to top 5 findings
    recommendations: recommendations.slice(0, 3) // Limit to top 3 recommendations
  }
}