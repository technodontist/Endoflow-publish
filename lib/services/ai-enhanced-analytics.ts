/**
 * AI-Enhanced Analytics Service
 * Combines statistical analysis with AI-generated insights for comprehensive research analytics
 */

import { 
  analyzeMultipleFields, 
  formatMultipleResultsForChat,
  type StatisticalResult 
} from './statistical-analysis'

export interface AIInsight {
  type: 'finding' | 'recommendation' | 'warning' | 'highlight'
  title: string
  description: string
  confidence: 'high' | 'medium' | 'low'
  relatedFields?: string[]
  icon?: string
}

export interface EnhancedAnalytics {
  // Statistical data
  statistics: {
    fields: StatisticalResult[]
    summary: string
    cohortSize: number
  }
  
  // AI-generated insights
  insights: {
    keyFindings: AIInsight[]
    recommendations: AIInsight[]
    patterns: AIInsight[]
    warnings: AIInsight[]
  }
  
  // Visual data for charts
  visualizations: {
    demographicCharts: any[]
    outcomeCharts: any[]
    trendCharts: any[]
  }
  
  // Metadata
  metadata: {
    generatedAt: string
    processingTime: number
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor'
    sampleSize: number
  }
}

/**
 * Generate AI-powered insights from statistical results
 */
export function generateAIInsights(
  statisticalResults: StatisticalResult[],
  cohortSize: number
): {
  keyFindings: AIInsight[]
  recommendations: AIInsight[]
  patterns: AIInsight[]
  warnings: AIInsight[]
} {
  const keyFindings: AIInsight[] = []
  const recommendations: AIInsight[] = []
  const patterns: AIInsight[] = []
  const warnings: AIInsight[] = []

  // Analyze each statistical result for insights
  statisticalResults.forEach(result => {
    if (result.dataType === 'numerical' && result.statistics) {
      const { mean, median, mode, standardDeviation, skewness, confidenceInterval95 } = result.statistics

      // High variability insight
      if (mean && standardDeviation) {
        const cv = (standardDeviation / mean) * 100
        if (cv > 40) {
          keyFindings.push({
            type: 'finding',
            title: `High Variability in ${result.field}`,
            description: `The ${result.field} shows significant variation (CV: ${cv.toFixed(1)}%), suggesting diverse patient responses or treatment outcomes.`,
            confidence: 'high',
            relatedFields: [result.field],
            icon: 'TrendingUp'
          })
          
          recommendations.push({
            type: 'recommendation',
            title: 'Consider Stratified Analysis',
            description: `Due to high variability in ${result.field}, consider segmenting patients into subgroups for more targeted insights.`,
            confidence: 'medium',
            relatedFields: [result.field],
            icon: 'Users'
          })
        }
      }

      // Skewed distribution insight
      if (skewness && Math.abs(skewness) > 1) {
        patterns.push({
          type: 'highlight',
          title: `${skewness > 0 ? 'Right' : 'Left'}-Skewed Distribution`,
          description: `${result.field} shows a ${skewness > 0 ? 'positive' : 'negative'} skew (${skewness.toFixed(2)}), indicating ${skewness > 0 ? 'more patients with lower values' : 'more patients with higher values'}.`,
          confidence: 'high',
          relatedFields: [result.field],
          icon: 'BarChart3'
        })
        
        recommendations.push({
          type: 'recommendation',
          title: 'Use Non-Parametric Tests',
          description: `For ${result.field}, consider using median and non-parametric statistical tests due to the skewed distribution.`,
          confidence: 'high',
          relatedFields: [result.field],
          icon: 'Brain'
        })
      }

      // Narrow confidence interval (precise estimate)
      if (mean && confidenceInterval95) {
        const ciWidth = confidenceInterval95.upper - confidenceInterval95.lower
        const relativeWidth = (ciWidth / mean) * 100
        
        if (relativeWidth < 20) {
          keyFindings.push({
            type: 'finding',
            title: `Precise Estimate for ${result.field}`,
            description: `The mean ${result.field} is ${mean.toFixed(1)} with a narrow 95% CI [${confidenceInterval95.lower}, ${confidenceInterval95.upper}], indicating high precision.`,
            confidence: 'high',
            relatedFields: [result.field],
            icon: 'Target'
          })
        }
      }

    } else if (result.dataType === 'categorical' && result.statistics) {
      const { frequency, percentages, mostCommon, uniqueValues } = result.statistics

      // Dominant category
      if (mostCommon && percentages) {
        const dominantPercentage = percentages[mostCommon]
        
        if (dominantPercentage > 70) {
          patterns.push({
            type: 'highlight',
            title: `Dominant Category in ${result.field}`,
            description: `${mostCommon} represents ${dominantPercentage}% of cases, showing strong concentration in this category.`,
            confidence: 'high',
            relatedFields: [result.field],
            icon: 'PieChart'
          })
          
          warnings.push({
            type: 'warning',
            title: 'Limited Variation',
            description: `${result.field} has limited variation with one dominant category. This may limit comparative analyses.`,
            confidence: 'medium',
            relatedFields: [result.field],
            icon: 'AlertCircle'
          })
        }
      }

      // High diversity
      if (uniqueValues && uniqueValues > 10) {
        patterns.push({
          type: 'highlight',
          title: `High Diversity in ${result.field}`,
          description: `Found ${uniqueValues} unique categories in ${result.field}, indicating diverse patient characteristics or treatments.`,
          confidence: 'high',
          relatedFields: [result.field],
          icon: 'Grid'
        })
      }
    }

    // Data quality warnings
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        warnings.push({
          type: 'warning',
          title: `Data Quality Concern: ${result.field}`,
          description: warning,
          confidence: 'high',
          relatedFields: [result.field],
          icon: 'AlertTriangle'
        })
      })
    }
  })

  // Sample size assessment
  if (cohortSize < 30) {
    warnings.push({
      type: 'warning',
      title: 'Small Sample Size',
      description: `With ${cohortSize} patients, statistical power is limited. Consider collecting more data for robust conclusions.`,
      confidence: 'high',
      icon: 'Users'
    })
    
    recommendations.push({
      type: 'recommendation',
      title: 'Increase Sample Size',
      description: 'Aim for at least 30-50 patients to improve statistical reliability and enable more advanced analyses.',
      confidence: 'high',
      icon: 'TrendingUp'
    })
  } else if (cohortSize >= 100) {
    keyFindings.push({
      type: 'finding',
      title: 'Robust Sample Size',
      description: `With ${cohortSize} patients, this cohort provides strong statistical power for reliable conclusions.`,
      confidence: 'high',
      icon: 'CheckCircle'
    })
  }

  // General recommendations based on overall analysis
  recommendations.push({
    type: 'recommendation',
    title: 'Longitudinal Tracking',
    description: 'Consider implementing regular follow-ups to track treatment outcomes over time and identify long-term patterns.',
    confidence: 'medium',
    icon: 'Calendar'
  })

  return {
    keyFindings: keyFindings.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
    patterns: patterns.slice(0, 5),
    warnings: warnings.slice(0, 5)
  }
}

/**
 * Assess overall data quality
 */
export function assessDataQuality(results: StatisticalResult[], cohortSize: number): 'excellent' | 'good' | 'fair' | 'poor' {
  let score = 100

  // Penalize for small sample size
  if (cohortSize < 10) score -= 40
  else if (cohortSize < 30) score -= 20
  else if (cohortSize < 50) score -= 10

  // Penalize for warnings
  const totalWarnings = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0)
  score -= totalWarnings * 5

  // Penalize for missing data
  const fieldsWithLowSampleSize = results.filter(r => r.sampleSize < cohortSize * 0.8).length
  score -= fieldsWithLowSampleSize * 10

  if (score >= 90) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

/**
 * Generate visualizations data from statistical results
 */
export function generateVisualizationData(results: StatisticalResult[], cohortData: any[]) {
  const demographicCharts: any[] = []
  const outcomeCharts: any[] = []
  const trendCharts: any[] = []

  results.forEach(result => {
    if (result.field.toLowerCase().includes('age') && result.dataType === 'numerical') {
      // Age distribution
      demographicCharts.push({
        type: 'histogram',
        title: 'Age Distribution',
        field: result.field,
        data: generateAgeHistogram(cohortData, result.field)
      })
    }

    if (result.field.toLowerCase().includes('gender') && result.dataType === 'categorical') {
      // Gender distribution
      demographicCharts.push({
        type: 'pie',
        title: 'Gender Distribution',
        field: result.field,
        data: Object.entries(result.statistics.frequency || {}).map(([name, value]) => ({ name, value }))
      })
    }

    if (result.field.toLowerCase().includes('outcome') && result.dataType === 'categorical') {
      // Outcome distribution
      outcomeCharts.push({
        type: 'pie',
        title: 'Treatment Outcomes',
        field: result.field,
        data: Object.entries(result.statistics.frequency || {}).map(([name, value]) => ({ name, value }))
      })
    }
  })

  return {
    demographicCharts,
    outcomeCharts,
    trendCharts
  }
}

/**
 * Helper to generate age histogram data
 */
function generateAgeHistogram(cohortData: any[], ageField: string) {
  const ages = cohortData
    .map(item => {
      const keys = ageField.split('.')
      let value = item
      for (const key of keys) {
        value = value?.[key]
      }
      return Number(value)
    })
    .filter(age => !isNaN(age) && age > 0)

  const bins = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-30', min: 21, max: 30 },
    { range: '31-40', min: 31, max: 40 },
    { range: '41-50', min: 41, max: 50 },
    { range: '51-60', min: 51, max: 60 },
    { range: '61-70', min: 61, max: 70 },
    { range: '70+', min: 71, max: 120 }
  ]

  return bins.map(bin => ({
    range: bin.range,
    count: ages.filter(age => age >= bin.min && age <= bin.max).length,
    fill: `hsl(${180 + bin.min}, 70%, 50%)`
  }))
}

/**
 * Main function: Generate comprehensive enhanced analytics
 */
export async function generateEnhancedAnalytics(
  cohortData: any[],
  projectId?: string
): Promise<EnhancedAnalytics> {
  const startTime = Date.now()

  // Step 1: Run statistical analysis on key fields
  const fieldsToAnalyze = ['age', 'gender', 'condition', 'outcome', 'treatment']
  const availableFields = fieldsToAnalyze.filter(field => {
    return cohortData.some(record => record[field] !== undefined && record[field] !== null)
  })

  const statisticalResults = analyzeMultipleFields(cohortData, availableFields)
  const statisticalSummary = formatMultipleResultsForChat(statisticalResults)

  // Step 2: Generate AI insights
  const insights = generateAIInsights(statisticalResults, cohortData.length)

  // Step 3: Generate visualizations
  const visualizations = generateVisualizationData(statisticalResults, cohortData)

  // Step 4: Assess data quality
  const dataQuality = assessDataQuality(statisticalResults, cohortData.length)

  const processingTime = Date.now() - startTime

  return {
    statistics: {
      fields: statisticalResults,
      summary: statisticalSummary,
      cohortSize: cohortData.length
    },
    insights,
    visualizations,
    metadata: {
      generatedAt: new Date().toISOString(),
      processingTime,
      dataQuality,
      sampleSize: cohortData.length
    }
  }
}
