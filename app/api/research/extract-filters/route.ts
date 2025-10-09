import { NextRequest, NextResponse } from 'next/server'
import { extractFiltersFromNaturalLanguage } from '@/lib/services/nl-filter-extractor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/research/extract-filters
 * 
 * Extracts structured filter criteria from natural language input
 * (voice transcript or typed text)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { input } = body

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid input' },
        { status: 400 }
      )
    }

    console.log('🔍 [EXTRACT FILTERS API] Processing input:', input.substring(0, 100))

    // Extract filters using AI
    const result = await extractFiltersFromNaturalLanguage(input)

    console.log('✅ [EXTRACT FILTERS API] Extraction complete:', {
      success: result.success,
      filterCount: result.filters.length,
      confidence: result.confidence
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [EXTRACT FILTERS API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        filters: [],
        originalText: '',
        confidence: 0,
        explanation: 'Server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
