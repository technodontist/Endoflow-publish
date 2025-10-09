import { NextRequest, NextResponse } from 'next/server'
import { analyzeAppointmentConversation } from '@/lib/services/appointment-conversation-parser'

// This endpoint processes voice recordings for appointment scheduling
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const transcript = formData.get('transcript') as string
    const audioFile = formData.get('audio') as File

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      )
    }

    console.log(`🎤 [APPOINTMENT VOICE] Processing transcript: "${transcript.substring(0, 100)}..."`)

    // Process transcript using Gemini AI to extract appointment details
    const appointmentData = await analyzeAppointmentConversation(transcript)

    console.log(`✅ [APPOINTMENT VOICE] Successfully extracted appointment data with ${appointmentData.confidence}% confidence`)

    return NextResponse.json({
      success: true,
      appointmentData,
      message: 'Appointment data extracted successfully'
    })

  } catch (error) {
    console.error('❌ [APPOINTMENT VOICE] Processing error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process appointment transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
