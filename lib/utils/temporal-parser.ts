/**
 * Advanced Temporal Expression Parser for Appointment AI
 *
 * Handles complex date/time queries including:
 * - Absolute dates: "October 15, 2025", "2025-10-01"
 * - Relative dates: "last month", "next week", "tomorrow"
 * - Date ranges: "first week of October", "between Oct 1 and Oct 15"
 * - Month/Year references: "October", "November 2025", "Q4 2025"
 * - Partial specs: "next Monday morning", "this weekend"
 *
 * @module temporal-parser
 */

export interface DateRange {
  startDate: string  // ISO format YYYY-MM-DD
  endDate: string    // ISO format YYYY-MM-DD
  type: 'specific' | 'relative' | 'range' | 'recurring' | 'month' | 'quarter' | 'year'
  originalExpression: string
  confidence: number  // 0-1, how confident we are in the parse
}

/**
 * Month name to number mapping
 */
const MONTHS: Record<string, number> = {
  'january': 0, 'jan': 0,
  'february': 1, 'feb': 1,
  'march': 2, 'mar': 2,
  'april': 3, 'apr': 3,
  'may': 4,
  'june': 5, 'jun': 5,
  'july': 6, 'jul': 6,
  'august': 7, 'aug': 7,
  'september': 8, 'sep': 8, 'sept': 8,
  'october': 9, 'oct': 9,
  'november': 10, 'nov': 10,
  'december': 11, 'dec': 11
}

/**
 * Quarter to month range mapping
 */
const QUARTERS: Record<string, { start: number; end: number }> = {
  'q1': { start: 0, end: 2 },   // Jan-Mar
  'q2': { start: 3, end: 5 },   // Apr-Jun
  'q3': { start: 6, end: 8 },   // Jul-Sep
  'q4': { start: 9, end: 11 }   // Oct-Dec
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get the first and last day of a month
 */
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0) // Last day of month

  return {
    start: toISODate(startDate),
    end: toISODate(endDate)
  }
}

/**
 * Get the first and last day of a quarter
 */
function getQuarterRange(year: number, quarter: string): { start: string; end: string } {
  const q = QUARTERS[quarter.toLowerCase()]
  if (!q) {
    throw new Error(`Invalid quarter: ${quarter}`)
  }

  const startDate = new Date(year, q.start, 1)
  const endDate = new Date(year, q.end + 1, 0) // Last day of last month in quarter

  return {
    start: toISODate(startDate),
    end: toISODate(endDate)
  }
}

/**
 * Get the first and last day of a year
 */
function getYearRange(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  }
}

/**
 * Parse explicit date range: "between Oct 1 and Oct 15", "from Jan to March"
 */
function parseExplicitRange(query: string): DateRange | null {
  const lowerQuery = query.toLowerCase()

  // Pattern: "between X and Y"
  const betweenMatch = lowerQuery.match(/between\s+(.+?)\s+and\s+(.+?)(?:\s|$|,|\.|;)/i)
  if (betweenMatch) {
    const startExpr = betweenMatch[1].trim()
    const endExpr = betweenMatch[2].trim()

    // Try to parse both expressions
    const startRange = parseTemporalExpression(startExpr)
    const endRange = parseTemporalExpression(endExpr)

    if (startRange && endRange) {
      return {
        startDate: startRange.startDate,
        endDate: endRange.endDate,
        type: 'range',
        originalExpression: betweenMatch[0].trim(),
        confidence: 0.95
      }
    }
  }

  // Pattern: "from X to Y"
  const fromToMatch = lowerQuery.match(/from\s+(.+?)\s+to\s+(.+?)(?:\s|$|,|\.|;)/i)
  if (fromToMatch) {
    const startExpr = fromToMatch[1].trim()
    const endExpr = fromToMatch[2].trim()

    const startRange = parseTemporalExpression(startExpr)
    const endRange = parseTemporalExpression(endExpr)

    if (startRange && endRange) {
      return {
        startDate: startRange.startDate,
        endDate: endRange.endDate,
        type: 'range',
        originalExpression: fromToMatch[0].trim(),
        confidence: 0.95
      }
    }
  }

  return null
}

/**
 * Parse month reference: "October", "October 2025", "Oct"
 */
function parseMonthReference(query: string): DateRange | null {
  const lowerQuery = query.toLowerCase()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Pattern: "October 2025", "Oct 2025"
  for (const [monthName, monthNum] of Object.entries(MONTHS)) {
    const monthYearPattern = new RegExp(`\\b${monthName}\\s+(\\d{4})\\b`, 'i')
    const match = lowerQuery.match(monthYearPattern)

    if (match) {
      const year = parseInt(match[1])
      const range = getMonthRange(year, monthNum)

      return {
        startDate: range.start,
        endDate: range.end,
        type: 'month',
        originalExpression: match[0],
        confidence: 0.98
      }
    }
  }

  // Pattern: Just "October", "Oct" (infer year based on context)
  for (const [monthName, monthNum] of Object.entries(MONTHS)) {
    const monthPattern = new RegExp(`\\b${monthName}\\b`, 'i')

    if (monthPattern.test(lowerQuery)) {
      // Determine year: if mentioned month is in the past this year, use current year
      // If it's in the future or current month, use current year
      let year = currentYear

      // If we're past the mentioned month, check context for "last" keyword
      if (monthNum < currentMonth && lowerQuery.includes('last')) {
        year = currentYear // Already past, use current year
      } else if (monthNum < currentMonth && !lowerQuery.includes('next')) {
        // If month is in past and no "next" keyword, could be last year or current year
        // Default to current year (more common to query recent past)
        year = currentYear
      } else if (monthNum > currentMonth && lowerQuery.includes('next')) {
        // "next October" when we're in October 2025 means October 2026
        year = currentYear + 1
      }

      const range = getMonthRange(year, monthNum)

      return {
        startDate: range.start,
        endDate: range.end,
        type: 'month',
        originalExpression: monthName,
        confidence: 0.90
      }
    }
  }

  return null
}

/**
 * Parse quarter reference: "Q4 2025", "Q1", "fourth quarter"
 */
function parseQuarterReference(query: string): DateRange | null {
  const lowerQuery = query.toLowerCase()
  const now = new Date()
  const currentYear = now.getFullYear()

  // Pattern: "Q4 2025", "Q1 2025"
  const qYearMatch = lowerQuery.match(/q([1-4])\s+(\d{4})/i)
  if (qYearMatch) {
    const quarter = `q${qYearMatch[1]}`
    const year = parseInt(qYearMatch[2])
    const range = getQuarterRange(year, quarter)

    return {
      startDate: range.start,
      endDate: range.end,
      type: 'quarter',
      originalExpression: qYearMatch[0],
      confidence: 0.98
    }
  }

  // Pattern: Just "Q4", "Q1" (use current year)
  const qMatch = lowerQuery.match(/q([1-4])\b/i)
  if (qMatch) {
    const quarter = `q${qMatch[1]}`
    const range = getQuarterRange(currentYear, quarter)

    return {
      startDate: range.start,
      endDate: range.end,
      type: 'quarter',
      originalExpression: qMatch[0],
      confidence: 0.95
    }
  }

  return null
}

/**
 * Parse year reference: "2025", "this year", "last year", "next year"
 */
function parseYearReference(query: string): DateRange | null {
  const lowerQuery = query.toLowerCase()
  const now = new Date()
  const currentYear = now.getFullYear()

  // Pattern: "this year"
  if (lowerQuery.includes('this year')) {
    const range = getYearRange(currentYear)
    return {
      startDate: range.start,
      endDate: range.end,
      type: 'year',
      originalExpression: 'this year',
      confidence: 0.98
    }
  }

  // Pattern: "last year"
  if (lowerQuery.includes('last year')) {
    const range = getYearRange(currentYear - 1)
    return {
      startDate: range.start,
      endDate: range.end,
      type: 'year',
      originalExpression: 'last year',
      confidence: 0.98
    }
  }

  // Pattern: "next year"
  if (lowerQuery.includes('next year')) {
    const range = getYearRange(currentYear + 1)
    return {
      startDate: range.start,
      endDate: range.end,
      type: 'year',
      originalExpression: 'next year',
      confidence: 0.98
    }
  }

  // Pattern: Explicit year "2025", "2024"
  const yearMatch = lowerQuery.match(/\b(20\d{2})\b/)
  if (yearMatch) {
    const year = parseInt(yearMatch[1])
    const range = getYearRange(year)

    return {
      startDate: range.start,
      endDate: range.end,
      type: 'year',
      originalExpression: yearMatch[1],
      confidence: 0.95
    }
  }

  return null
}

/**
 * Parse relative date: "last month", "next week", "yesterday"
 */
function parseRelativeDate(query: string): DateRange | null {
  const lowerQuery = query.toLowerCase()
  const now = new Date()

  // "last month"
  if (lowerQuery.includes('last month')) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const range = getMonthRange(lastMonth.getFullYear(), lastMonth.getMonth())

    return {
      startDate: range.start,
      endDate: range.end,
      type: 'relative',
      originalExpression: 'last month',
      confidence: 0.98
    }
  }

  // "this month" or "current month"
  if (lowerQuery.includes('this month') || lowerQuery.includes('current month')) {
    const range = getMonthRange(now.getFullYear(), now.getMonth())

    return {
      startDate: range.start,
      endDate: range.end,
      type: 'relative',
      originalExpression: 'this month',
      confidence: 0.98
    }
  }

  // "next month"
  if (lowerQuery.includes('next month')) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const range = getMonthRange(nextMonth.getFullYear(), nextMonth.getMonth())

    return {
      startDate: range.start,
      endDate: range.end,
      type: 'relative',
      originalExpression: 'next month',
      confidence: 0.98
    }
  }

  // "last week"
  if (lowerQuery.includes('last week')) {
    const lastWeekStart = new Date(now)
    lastWeekStart.setDate(now.getDate() - now.getDay() - 7) // Sunday of last week
    const lastWeekEnd = new Date(lastWeekStart)
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6) // Saturday of last week

    return {
      startDate: toISODate(lastWeekStart),
      endDate: toISODate(lastWeekEnd),
      type: 'relative',
      originalExpression: 'last week',
      confidence: 0.95
    }
  }

  // "this week" or "current week"
  if (lowerQuery.includes('this week') || lowerQuery.includes('current week')) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay()) // Sunday of this week
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // Saturday of this week

    return {
      startDate: toISODate(weekStart),
      endDate: toISODate(weekEnd),
      type: 'relative',
      originalExpression: 'this week',
      confidence: 0.95
    }
  }

  // "next week"
  if (lowerQuery.includes('next week')) {
    const nextWeekStart = new Date(now)
    nextWeekStart.setDate(now.getDate() - now.getDay() + 7) // Sunday of next week
    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6) // Saturday of next week

    return {
      startDate: toISODate(nextWeekStart),
      endDate: toISODate(nextWeekEnd),
      type: 'relative',
      originalExpression: 'next week',
      confidence: 0.95
    }
  }

  // "yesterday"
  if (lowerQuery.includes('yesterday')) {
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const dateStr = toISODate(yesterday)

    return {
      startDate: dateStr,
      endDate: dateStr,
      type: 'specific',
      originalExpression: 'yesterday',
      confidence: 0.98
    }
  }

  // "tomorrow"
  if (lowerQuery.includes('tomorrow')) {
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const dateStr = toISODate(tomorrow)

    return {
      startDate: dateStr,
      endDate: dateStr,
      type: 'specific',
      originalExpression: 'tomorrow',
      confidence: 0.98
    }
  }

  // "today"
  if (lowerQuery.includes('today')) {
    const dateStr = toISODate(now)

    return {
      startDate: dateStr,
      endDate: dateStr,
      type: 'specific',
      originalExpression: 'today',
      confidence: 0.98
    }
  }

  // "last 7 days", "past 7 days"
  const last7Match = lowerQuery.match(/(?:last|past)\s+(\d+)\s+days?/)
  if (last7Match) {
    const days = parseInt(last7Match[1])
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - days)

    return {
      startDate: toISODate(startDate),
      endDate: toISODate(now),
      type: 'relative',
      originalExpression: last7Match[0],
      confidence: 0.95
    }
  }

  // "next 7 days", "next 30 days"
  const next7Match = lowerQuery.match(/next\s+(\d+)\s+days?/)
  if (next7Match) {
    const days = parseInt(next7Match[1])
    const endDate = new Date(now)
    endDate.setDate(now.getDate() + days)

    return {
      startDate: toISODate(now),
      endDate: toISODate(endDate),
      type: 'relative',
      originalExpression: next7Match[0],
      confidence: 0.95
    }
  }

  return null
}

/**
 * Parse week-of-month reference: "first week of October", "last week of December"
 */
function parseWeekOfMonth(query: string): DateRange | null {
  const lowerQuery = query.toLowerCase()

  // Pattern: "first/second/third/fourth/last week of October"
  const weekOfMonthMatch = lowerQuery.match(/(first|second|third|fourth|last)\s+week\s+of\s+(\w+)/)
  if (weekOfMonthMatch) {
    const weekIndicator = weekOfMonthMatch[1]
    const monthName = weekOfMonthMatch[2]

    const monthNum = MONTHS[monthName]
    if (monthNum === undefined) return null

    const now = new Date()
    const year = now.getFullYear()

    // Get the first day of the month
    const monthStart = new Date(year, monthNum, 1)

    let weekStart: Date
    let weekEnd: Date

    if (weekIndicator === 'first') {
      weekStart = monthStart
      weekEnd = new Date(monthStart)
      weekEnd.setDate(monthStart.getDate() + 6)
    } else if (weekIndicator === 'last') {
      // Get last day of month
      const monthEnd = new Date(year, monthNum + 1, 0)
      weekEnd = monthEnd
      weekStart = new Date(monthEnd)
      weekStart.setDate(monthEnd.getDate() - 6)
    } else {
      // Second, third, fourth week
      const weekNum = weekIndicator === 'second' ? 1 : weekIndicator === 'third' ? 2 : 3
      weekStart = new Date(monthStart)
      weekStart.setDate(monthStart.getDate() + (weekNum * 7))
      weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
    }

    return {
      startDate: toISODate(weekStart),
      endDate: toISODate(weekEnd),
      type: 'range',
      originalExpression: weekOfMonthMatch[0],
      confidence: 0.90
    }
  }

  return null
}

/**
 * Parse ISO date format: "2025-10-15", "2025-10"
 */
function parseISODate(query: string): DateRange | null {
  // Full ISO date: YYYY-MM-DD
  const fullISOMatch = query.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (fullISOMatch) {
    const dateStr = fullISOMatch[0]

    return {
      startDate: dateStr,
      endDate: dateStr,
      type: 'specific',
      originalExpression: dateStr,
      confidence: 0.99
    }
  }

  // Partial ISO date: YYYY-MM (interpret as full month)
  const partialISOMatch = query.match(/\b(\d{4})-(\d{2})\b/)
  if (partialISOMatch) {
    const year = parseInt(partialISOMatch[1])
    const month = parseInt(partialISOMatch[2]) - 1 // JS months are 0-indexed
    const range = getMonthRange(year, month)

    return {
      startDate: range.start,
      endDate: range.end,
      type: 'month',
      originalExpression: partialISOMatch[0],
      confidence: 0.95
    }
  }

  return null
}

/**
 * Main temporal expression parser
 * Attempts multiple parsing strategies in order of specificity
 */
export function parseTemporalExpression(query: string): DateRange | null {
  if (!query || typeof query !== 'string') {
    return null
  }

  try {
    // 1. Try explicit range first (highest specificity)
    const explicitRange = parseExplicitRange(query)
    if (explicitRange) return explicitRange

    // 2. Try ISO date format (very specific)
    const isoDate = parseISODate(query)
    if (isoDate) return isoDate

    // 3. Try quarter reference
    const quarter = parseQuarterReference(query)
    if (quarter) return quarter

    // 4. Try year reference
    const year = parseYearReference(query)
    if (year) return year

    // 5. Try month reference
    const month = parseMonthReference(query)
    if (month) return month

    // 6. Try week-of-month reference
    const weekOfMonth = parseWeekOfMonth(query)
    if (weekOfMonth) return weekOfMonth

    // 7. Try relative date (last, this, next)
    const relativeDate = parseRelativeDate(query)
    if (relativeDate) return relativeDate

    // No match found
    return null

  } catch (error) {
    console.error('⚠️ [TEMPORAL PARSER] Error:', error)
    return null
  }
}

/**
 * Extract patient name from query
 * Looks for patterns like "for John Doe", "patient Sarah", "John's appointments"
 */
export function extractPatientName(query: string): string | null {
  if (!query) return null

  // Pattern: "for [Name]", "patient [Name]"
  const forMatch = query.match(/(?:for|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
  if (forMatch) {
    return forMatch[1].trim()
  }

  // Pattern: "[Name]'s appointments"
  const possessiveMatch = query.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\s+(?:appointments?|schedule)/i)
  if (possessiveMatch) {
    return possessiveMatch[1].trim()
  }

  return null
}

/**
 * Determine if query is asking for count/statistics
 */
export function isCountQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  return (
    lowerQuery.includes('how many') ||
    lowerQuery.includes('count') ||
    lowerQuery.includes('number of') ||
    lowerQuery.includes('total')
  )
}

/**
 * Determine query direction (past, future, or all)
 */
export function determineQueryDirection(query: string): 'past' | 'future' | 'all' {
  const lowerQuery = query.toLowerCase()

  if (lowerQuery.includes('past') ||
      lowerQuery.includes('previous') ||
      lowerQuery.includes('last') ||
      lowerQuery.includes('had') ||
      lowerQuery.includes('completed')) {
    return 'past'
  }

  if (lowerQuery.includes('upcoming') ||
      lowerQuery.includes('next') ||
      lowerQuery.includes('future') ||
      lowerQuery.includes('scheduled')) {
    return 'future'
  }

  return 'all'
}
