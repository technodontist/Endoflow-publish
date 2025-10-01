import { NextRequest, NextResponse } from 'next/server'
import { stopVoiceSessionAction } from '@/lib/actions/consultation'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, transcript } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const result = await stopVoiceSessionAction(sessionId, transcript)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      sessionId: result.data?.id,
      message: 'Voice session stopped successfully'
    })

  } catch (error) {
    console.error('Voice session stop API error:', error)
    return NextResponse.json(
      { error: 'Failed to stop voice session' },
      { status: 500 }
    )
  }
}