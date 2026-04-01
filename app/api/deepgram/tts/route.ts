import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Deepgram Aura TTS endpoint
 * Converts text to speech using Deepgram's Aura API.
 * Returns audio/mpeg stream for browser playback.
 *
 * Session 13: Phase 2 — Replace browser SpeechSynthesis with Deepgram Aura
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text, voice, speed } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const deepgramKey = process.env.DEEPGRAM_API_KEY
    if (!deepgramKey) {
      return NextResponse.json({ error: 'Deepgram not configured' }, { status: 500 })
    }

    // Use Deepgram Aura TTS REST API
    // Voice options: aura-asteria-en (female), aura-orion-en (male), aura-luna-en (female calm)
    const selectedVoice = voice || 'aura-asteria-en'

    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${selectedVoice}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [DEEPGRAM TTS] API error:', response.status, errorText)
      return NextResponse.json({ error: 'TTS generation failed' }, { status: response.status })
    }

    // Stream the audio back to the client
    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })

  } catch (error) {
    console.error('❌ [DEEPGRAM TTS] Error:', error)
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
  }
}
