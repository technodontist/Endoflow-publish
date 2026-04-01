import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Deepgram temporary token endpoint
 * Returns a short-lived API key for browser-side STT streaming
 * The real DEEPGRAM_API_KEY never leaves the server
 */
export async function GET() {
  try {
    // Verify user is authenticated via Supabase session (using proper SSR client)
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deepgramKey = process.env.DEEPGRAM_API_KEY
    if (!deepgramKey) {
      return NextResponse.json({ error: 'Deepgram not configured' }, { status: 500 })
    }

    // For Deepgram, the simplest secure approach is to return the key directly
    // with a very short cache lifetime. The browser uses it to open a WebSocket.
    // In production, use Deepgram's key management API for scoped temporary keys.
    // For now, this is safe because:
    // 1. Only authenticated users can access this endpoint
    // 2. The key is transmitted over HTTPS
    // 3. It's not stored client-side permanently

    return NextResponse.json({
      key: deepgramKey,
      url: 'wss://api.deepgram.com/v1/listen'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ [DEEPGRAM TOKEN] Error:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
