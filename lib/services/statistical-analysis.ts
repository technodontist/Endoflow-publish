/**
 * Statistical Analysis Service
 * Provides comprehensive statistical analysis for research projects
 * Supports descriptive statistics, distributions, and group comparisons
 */

export interface StatisticalResult {
  field: string
  dataType: 'numerical' | 'categorical'
  sampleSize: number
  statistics: {
    mean?: number
    median?: number
    mode?: number | string
    standardDeviation?: number
    variance?: number
    range?: { min: number; max: number }
    quartiles?: { q1: number; q2: number; q3: number }
    iqr?: number
    skewness?: number
    kurtosis?: number
    confidenceInterval95?: { lower: number; upper: number }
    // Categorical statistics
    frequency?: Record<string, number>
    percentages?: Record<string, number>
    mostCommon?: string
    leastCommon?: string
    uniqueValues?: number
  }
  interpretation: string[]
  warnings?: string[]
}

/**
 * Calculate mean (average) of numerical array
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * Calculate median (middle value) of numerical array
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

/**
 * Calculate mode (most frequent value) of array
 * Works for both numerical and categorical data
 */
export function calculateMode(values: (number | string)[]): number | string | null {
  if (values.length === 0) return null

  const frequency: Record<string, number> = {}

  values.forEach(value => {
    const key = String(value)
    frequency[key] = (frequency[key] || 0) + 1
  })

  let maxFreq = 0
  let mode: string | null = null

  Object.entries(frequency).forEach(([value, freq]) => {
    if (freq > maxFreq) {
      maxFreq = freq
      mode = value
    }
  })

  // Return as number if all values are numeric
  if (mode && !isNaN(Number(mode))) {
    return Number(mode)
  }

  return mode
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0

  const mean = calculateMean(values)
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = calculateMean(squaredDiffs)

  return Math.sqrt(variance)
}

/**
 * Calculate variance
 */
export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0

  const mean = calculateMean(values)
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))

  return calculateMean(squaredDiffs)
}

/**
 * Calculate quartiles (Q1, Q2/median, Q3)
 */
export function calculateQuartiles(values: number[]): { q1: number; q2: number; q3: number } {
  if (values.length === 0) return { q1: 0, q2: 0, q3: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const q2 = calculateMedian(sorted)

  const lowerHalf = sorted.slice(0, Math.floor(n / 2))
  const upperHalf = sorted.slice(Math.ceil(n / 2))

  const q1 = calculateMedian(lowerHalf)
  const q3 = calculateMedian(upperHalf)

  return { q1, q2, q3 }
}

/**
 * Calculate 95% confidence interval for mean
 */
export function calculateConfidenceInterval95(values: number[]): { lower: number; upper: number } {
  if (values.length === 0) return { lower: 0, upper: 0 }

  const mean = calculateMean(values)
  const sd = calculateStandardDeviation(values)
  const n = values.length

  // t-value for 95% CI (approximation for large samples)
  const tValue = 1.96
  const marginOfError = tValue * (sd / Math.sqrt(n))

  return {
    lower: parseFloat((mean - marginOfError).toFixed(2)),
    upper: parseFloat((mean + marginOfError).toFixed(2))
  }
}

/**
 * Calculate frequency distribution for categorical data
 */
export function calculateFrequencyDistribution(values: (string | number)[]): {
  frequency: Record<string, number>
  percentages: Record<string, number>
  mostCommon: string
  leastCommon: string
  uniqueValues: number
} {
  const frequency: Record<string, number> = {}

  values.forEach(value => {
    const key = String(value)
    frequency[key] = (frequency[key] || 0) + 1
  })

  const total = values.length
  const percentages: Record<string, number> = {}

  Object.entries(frequency).forEach(([key, count]) => {
    percentages[key] = parseFloat(((count / total) * 100).toFixed(2))
  })

  const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1])

  return {
    frequency,
    percentages,
    mostCommon: sorted[0]?.[0] || 'N/A',
    leastCommon: sorted[sorted.length - 1]?.[0] || 'N/A',
    uniqueValues: Object.keys(frequency).length
  }
}

/**
 * Calculate skewness (measure of asymmetry)
 */
export function calculateSkewness(values: number[]): number {
  if (values.length < 3) return 0

  const mean = calculateMean(values)
  const sd = calculateStandardDeviation(values)
  const n = values.length

  const cubedDiffs = values.map(val => Math.pow((val - mean) / sd, 3))
  const skewness = (n * calculateMean(cubedDiffs)) / ((n - 1) * (n - 2))

  return parseFloat(skewness.toFixed(4))
}

/**
 * Calculate kurtosis (measure of tailedness)
 */
export function calculateKurtosis(values: number[]): number {
  if (values.length < 4) return 0

  const mean = calculateMean(values)
  const sd = calculateStandardDeviation(values)
  const n = values.length

  const fourthPowerDiffs = values.map(val => Math.pow((val - mean) / sd, 4))
  const kurtosis = (n * (n + 1) * calculateMean(fourthPowerDiffs)) /
                   ((n - 1) * (n - 2) * (n - 3))

  return parseFloat(kurtosis.toFixed(4))
}

/**
 * Perform comprehensive statistical analysis on a dataset field
 */
export function analyzeField(
  data: any[],
  fieldPath: string,
  dataType: 'numerical' | 'categorical' = 'numerical'
): StatisticalResult {
  // Extract field values from data
  const values = data
    .map(item => {
      // Support nested field paths (e.g., "patient.age")
      const keys = fieldPath.split('.')
      let value = item
      for (const key of keys) {
        value = value?.[key]
      }
      return value
    })
    .filter(val => val !== null && val !== undefined && val !== '')

  if (values.length === 0) {
    return {
      field: fieldPath,
      dataType,
      sampleSize: 0,
      statistics: {},
      interpretation: ['No data available for analysis'],
      warnings: ['Insufficient data for statistical analysis']
    }
  }

  const sampleSize = values.length
  const interpretation: string[] = []
  const warnings: string[] = []

  if (sampleSize < 5) {
    warnings.push('Small sample size (n < 5) may produce unreliable statistics')
  }

  if (dataType === 'numerical') {
    // Convert to numbers
    const numericValues = values
      .map(v => Number(v))
      .filter(v => !isNaN(v))

    if (numericValues.length === 0) {
      return {
        field: fieldPath,
        dataType,
        sampleSize,
        statistics: {},
        interpretation: ['No valid numeric data found'],
        warnings: ['Field contains non-numeric values']
      }
    }

    const mean = calculateMean(numericValues)
    const median = calculateMedian(numericValues)
    const mode = calculateMode(numericValues) as number
    const sd = calculateStandardDeviation(numericValues)
    const variance = calculateVariance(numericValues)
    const range = { min: Math.min(...numericValues), max: Math.max(...numericValues) }
    const quartiles = calculateQuartiles(numericValues)
    const iqr = quartiles.q3 - quartiles.q1
    const ci95 = calculateConfidenceInterval95(numericValues)
    const skewness = calculateSkewness(numericValues)
    const kurtosis = calculateKurtosis(numericValues)

    // Generate interpretations
    interpretation.push(`Sample size: n=${sampleSize}`)
    interpretation.push(`Mean: ${mean.toFixed(2)} (average value)`)
    interpretation.push(`Median: ${median.toFixed(2)} (middle value)`)
    interpretation.push(`Mode: ${mode} (most frequent value)`)
    interpretation.push(`Standard deviation: ±${sd.toFixed(2)} (spread around mean)`)
    interpretation.push(`Range: ${range.min} to ${range.max}`)
    interpretation.push(`95% Confidence Interval: [${ci95.lower}, ${ci95.upper}]`)

    // Assess distribution shape
    if (Math.abs(skewness) < 0.5) {
      interpretation.push('Distribution is approximately symmetric')
    } else if (skewness > 0.5) {
      interpretation.push('Distribution is positively skewed (right tail)')
    } else {
      interpretation.push('Distribution is negatively skewed (left tail)')
    }

    // Compare mean vs median
    const meanMedianDiff = Math.abs(mean - median)
    if (meanMedianDiff / mean > 0.1) {
      interpretation.push('Large mean-median difference suggests non-normal distribution')
    }

    // Assess variability
    const cv = (sd / mean) * 100 // Coefficient of variation
    if (cv < 15) {
      interpretation.push('Low variability in data (CV < 15%)')
    } else if (cv > 30) {
      interpretation.push('High variability in data (CV > 30%)')
    }

    return {
      field: fieldPath,
      dataType,
      sampleSize,
      statistics: {
        mean: parseFloat(mean.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        mode,
        standardDeviation: parseFloat(sd.toFixed(2)),
        variance: parseFloat(variance.toFixed(2)),
        range,
        quartiles,
        iqr: parseFloat(iqr.toFixed(2)),
        skewness,
        kurtosis,
        confidenceInterval95: ci95
      },
      interpretation,
      warnings: warnings.length > 0 ? warnings : undefined
    }

  } else {
    // Categorical data analysis
    const freqDist = calculateFrequencyDistribution(values)

    interpretation.push(`Sample size: n=${sampleSize}`)
    interpretation.push(`Unique categories: ${freqDist.uniqueValues}`)
    interpretation.push(`Most common: ${freqDist.mostCommon} (${freqDist.frequency[freqDist.mostCommon]} occurrences, ${freqDist.percentages[freqDist.mostCommon]}%)`)
    interpretation.push(`Least common: ${freqDist.leastCommon} (${freqDist.frequency[freqDist.leastCommon]} occurrences, ${freqDist.percentages[freqDist.leastCommon]}%)`)

    // Distribution balance
    const percentageValues = Object.values(freqDist.percentages)
    const maxPercentage = Math.max(...percentageValues)

    if (maxPercentage > 70) {
      interpretation.push('Highly skewed distribution: one category dominates')
    } else if (maxPercentage < 40) {
      interpretation.push('Well-balanced distribution across categories')
    }

    return {
      field: fieldPath,
      dataType,
      sampleSize,
      statistics: {
        mode: freqDist.mostCommon,
        frequency: freqDist.frequency,
        percentages: freqDist.percentages,
        mostCommon: freqDist.mostCommon,
        leastCommon: freqDist.leastCommon,
        uniqueValues: freqDist.uniqueValues
      },
      interpretation,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }
}

/**
 * Compare two groups using independent samples t-test (simplified)
 */
export function compareGroups(
  group1: number[],
  group2: number[],
  group1Name = 'Group 1',
  group2Name = 'Group 2'
): {
  group1Stats: { mean: number; sd: number; n: number }
  group2Stats: { mean: number; sd: number; n: number }
  meanDifference: number
  interpretation: string[]
} {
  const mean1 = calculateMean(group1)
  const mean2 = calculateMean(group2)
  const sd1 = calculateStandardDeviation(group1)
  const sd2 = calculateStandardDeviation(group2)

  const meanDiff = mean1 - mean2

  const interpretation: string[] = []
  interpretation.push(`${group1Name}: Mean = ${mean1.toFixed(2)}, SD = ${sd1.toFixed(2)}, n = ${group1.length}`)
  interpretation.push(`${group2Name}: Mean = ${mean2.toFixed(2)}, SD = ${sd2.toFixed(2)}, n = ${group2.length}`)
  interpretation.push(`Mean difference: ${meanDiff.toFixed(2)}`)

  if (Math.abs(meanDiff) < 1) {
    interpretation.push('Groups have very similar means')
  } else if (Math.abs(meanDiff) > sd1 && Math.abs(meanDiff) > sd2) {
    interpretation.push('Large difference between groups (> 1 SD)')
  }

  return {
    group1Stats: { mean: parseFloat(mean1.toFixed(2)), sd: parseFloat(sd1.toFixed(2)), n: group1.length },
    group2Stats: { mean: parseFloat(mean2.toFixed(2)), sd: parseFloat(sd2.toFixed(2)), n: group2.length },
    meanDifference: parseFloat(meanDiff.toFixed(2)),
    interpretation
  }
}

/**
 * Format statistical result for AI prompt context
 */
export function formatStatisticalResultForAI(result: StatisticalResult): string {
  let output = `Statistical Analysis for: ${result.field}\n`
  output += `Data Type: ${result.dataType}\n`
  output += `Sample Size: n=${result.sampleSize}\n\n`

  if (result.dataType === 'numerical' && result.statistics) {
    output += `Descriptive Statistics:\n`
    output += `- Mean: ${result.statistics.mean}\n`
    output += `- Median: ${result.statistics.median}\n`
    output += `- Mode: ${result.statistics.mode}\n`
    output += `- Standard Deviation: ${result.statistics.standardDeviation}\n`
    output += `- Range: ${result.statistics.range?.min} to ${result.statistics.range?.max}\n`
    output += `- 95% CI: [${result.statistics.confidenceInterval95?.lower}, ${result.statistics.confidenceInterval95?.upper}]\n`
    output += `- Skewness: ${result.statistics.skewness}\n`
    output += `- Kurtosis: ${result.statistics.kurtosis}\n\n`
  } else if (result.dataType === 'categorical' && result.statistics) {
    output += `Frequency Distribution:\n`
    Object.entries(result.statistics.frequency || {}).forEach(([category, count]) => {
      const percentage = result.statistics.percentages?.[category] || 0
      output += `- ${category}: ${count} (${percentage}%)\n`
    })
    output += `\nMost common: ${result.statistics.mostCommon}\n`
    output += `Unique values: ${result.statistics.uniqueValues}\n\n`
  }

  output += `Interpretation:\n`
  result.interpretation.forEach(line => {
    output += `- ${line}\n`
  })

  if (result.warnings && result.warnings.length > 0) {
    output += `\nWarnings:\n`
    result.warnings.forEach(warning => {
      output += `⚠️ ${warning}\n`
    })
  }

  return output
}

/**
 * Auto-detect whether a field should be treated as numerical or categorical
 */
export function detectDataType(data: any[], fieldPath: string): 'numerical' | 'categorical' {
  const values = data
    .map(item => {
      const keys = fieldPath.split('.')
      let value = item
      for (const key of keys) {
        value = value?.[key]
      }
      return value
    })
    .filter(val => val !== null && val !== undefined && val !== '')
    .slice(0, 50) // Sample first 50 values

  if (values.length === 0) return 'categorical'

  const numericCount = values.filter(val => !isNaN(Number(val))).length
  const numericRatio = numericCount / values.length

  return numericRatio > 0.7 ? 'numerical' : 'categorical'
}

/**
 * Run comprehensive analysis on multiple fields
 */
export function analyzeMultipleFields(
  data: any[],
  fields: string[]
): StatisticalResult[] {
  return fields.map(field => {
    const dataType = detectDataType(data, field)
    return analyzeField(data, field, dataType)
  })
}

/**
 * Format multiple statistical results for display in chat
 */
export function formatMultipleResultsForChat(results: StatisticalResult[]): string {
  let output = '# 📊 Statistical Analysis Results\n\n'

  results.forEach((result, index) => {
    output += `## ${index + 1}. ${result.field}\n`
    output += `**Data Type:** ${result.dataType} | **Sample Size:** ${result.sampleSize}\n\n`

    if (result.dataType === 'numerical' && result.statistics) {
      output += '**Central Tendency:**\n'
      output += `• Mean: ${result.statistics.mean}\n`
      output += `• Median: ${result.statistics.median}\n`
      output += `• Mode: ${result.statistics.mode}\n\n`

      output += '**Variability:**\n'
      output += `• Standard Deviation: ±${result.statistics.standardDeviation}\n`
      output += `• Range: ${result.statistics.range?.min} to ${result.statistics.range?.max}\n`
      output += `• IQR: ${result.statistics.iqr} (Q1: ${result.statistics.quartiles?.q1}, Q3: ${result.statistics.quartiles?.q3})\n\n`
      
      output += '**Distribution:**\n'
      output += `• 95% CI: [${result.statistics.confidenceInterval95?.lower}, ${result.statistics.confidenceInterval95?.upper}]\n`
      if (result.statistics.skewness !== undefined) {
        output += `• Skewness: ${result.statistics.skewness} (${Math.abs(result.statistics.skewness) < 0.5 ? 'symmetric' : result.statistics.skewness > 0 ? 'right-skewed' : 'left-skewed'})\n`
      }
    } else if (result.dataType === 'categorical' && result.statistics) {
      output += `**Mode:** ${result.statistics.mostCommon} (most common)\n\n`
      
      output += '**Distribution:**\n'
      Object.entries(result.statistics.frequency || {})
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5) // Show top 5 categories
        .forEach(([category, count]) => {
          const percentage = result.statistics.percentages?.[category] || 0
          output += `• ${category}: ${count} cases (${percentage}%)\n`
        })
      
      if (Object.keys(result.statistics.frequency || {}).length > 5) {
        output += `• ... and ${Object.keys(result.statistics.frequency || {}).length - 5} more categories\n`
      }
      
      output += `\n**Unique Values:** ${result.statistics.uniqueValues}\n`
    }

    if (result.warnings && result.warnings.length > 0) {
      output += '\n**⚠️ Warnings:**\n'
      result.warnings.forEach(warning => {
        output += `• ${warning}\n`
      })
    }

    output += '\n---\n\n'
  })

  return output
}
