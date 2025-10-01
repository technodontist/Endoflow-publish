import { NextRequest, NextResponse } from 'next/server'
import { startVoiceSessionAction } from '@/lib/actions/consultation'

export async function POST(request: NextRequest) {
  try {
    const { consultationId, sectionId } = await request.json()

    if (!consultationId || !sectionId) {
      return NextResponse.json(
        { error: 'Consultation ID and section ID are required' },
        { status: 400 }
      )
    }

    const result = await startVoiceSessionAction(consultationId, sectionId)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      sessionId: result.data?.id,
      message: 'Voice session started successfully'
    })

  } catch (error) {
    console.error('Voice session start API error:', error)
    return NextResponse.json(
      { error: 'Failed to start voice session' },
      { status: 500 }
    )
  }
}