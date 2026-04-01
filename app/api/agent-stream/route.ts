/**
 * Agent Stream SSE Endpoint
 *
 * Session 14: Streams conductor step updates to the sidebar UI via
 * Server-Sent Events (SSE). The client connects and receives real-time
 * status updates as the conductor executes multi-step commands.
 *
 * Events emitted:
 *   step-started:  { step: ConductorStep }
 *   step-completed: { step: ConductorStep }
 *   step-failed:   { step: ConductorStep }
 *   pipeline-complete: { result: ConductorResult }
 *   error: { message: string }
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  executeConductorPipeline,
  isMultiStepIntent,
  type ConductorStep,
} from '@/lib/agents/mcp-conductor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Authenticate
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Parse body
  let body: { intentType: string; entities: Record<string, any> }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { intentType, entities } = body
  if (!intentType) {
    return new Response(JSON.stringify({ error: 'Missing intentType' }), { status: 400 })
  }

  // Check if this intent needs multi-step
  if (!isMultiStepIntent(intentType, entities || {})) {
    return new Response(
      JSON.stringify({ error: 'Not a multi-step intent', intentType }),
      { status: 400 }
    )
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: any) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      try {
        const result = await executeConductorPipeline(
          intentType,
          entities || {},
          user.id,
          {
            onStepStart: (step: ConductorStep) => {
              sendEvent('step-started', { step })
            },
            onStepComplete: (step: ConductorStep) => {
              sendEvent('step-completed', { step })
            },
            onStepFailed: (step: ConductorStep) => {
              sendEvent('step-failed', { step })
            },
            onSpeak: (text: string) => {
              sendEvent('speak', { text })
            },
          }
        )

        sendEvent('pipeline-complete', { result })
      } catch (error: any) {
        sendEvent('error', { message: error.message || 'Pipeline execution failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  })
}
