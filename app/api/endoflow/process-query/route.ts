import { NextRequest, NextResponse } from 'next/server'
import { processEndoFlowQuery } from '@/lib/actions/endoflow-master'

/**
 * POST /api/endoflow/process-query
 * Process natural language queries through EndoFlow Master AI
 *
 * Body: {
 *   query: string
 *   conversationId?: string | null
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, conversationId, language, isVoiceInput } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    console.log('🎭 [API] Processing EndoFlow query:', query)

    const result = await processEndoFlowQuery({
      query,
      conversationId: conversationId || null,
      language: language || 'en-US',
      isVoiceInput: isVoiceInput ?? true,
    })

    if (!result.success) {
      // Session 15: Include agentResponses even on failure — may contain candidate data
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to process query',
          agentResponses: (result as any).agentResponses,
          actionCommand: (result as any).actionCommand,
        },
        { status: 200 } // 200 not 500 — this is a "no result" not a server error
      )
    }

    return NextResponse.json({
      success: true,
      response: result.response,
      conversationId: result.conversationId,
      intent: result.intent,
      suggestions: result.suggestions,
      agentResponses: result.agentResponses,
      actionCommand: result.actionCommand,
      error: result.error,
    })

  } catch (error) {
    console.error('❌ [API] EndoFlow query error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/endoflow/process-query
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'EndoFlow Master AI',
    version: '1.0.0',
    capabilities: [
      'clinical_research',
      'appointment_scheduling',
      'treatment_planning',
      'patient_inquiry',
      'general_question'
    ]
  })
}
