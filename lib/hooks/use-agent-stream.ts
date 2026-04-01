/**
 * useAgentStream — React hook for consuming MCP Conductor SSE events
 *
 * Session 14: Connects to /api/agent-stream, receives step-by-step
 * conductor updates, and exposes them as React state for the sidebar
 * agent activity panel.
 *
 * Usage:
 *   const { steps, isRunning, finalResult, error, executePipeline } = useAgentStream()
 *   executePipeline('consultation_start', { patientName: 'Popatlal' })
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import type { ConductorStep, ConductorResult } from '@/lib/agents/mcp-conductor'

export interface AgentStreamState {
  steps: ConductorStep[]
  isRunning: boolean
  finalResult: ConductorResult | null
  error: string | null
  speakQueue: string[]
}

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    steps: [],
    isRunning: false,
    finalResult: null,
    error: null,
    speakQueue: [],
  })

  const abortRef = useRef<AbortController | null>(null)

  /**
   * Execute a multi-step pipeline and stream results
   */
  const executePipeline = useCallback(async (
    intentType: string,
    entities: Record<string, any>
  ): Promise<ConductorResult | null> => {
    // Reset state
    setState({
      steps: [],
      isRunning: true,
      finalResult: null,
      error: null,
      speakQueue: [],
    })

    // Abort any previous stream
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/agent-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentType, entities }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }))
        setState(prev => ({ ...prev, isRunning: false, error: err.error || 'Request failed' }))
        return null
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) {
        setState(prev => ({ ...prev, isRunning: false, error: 'No response stream' }))
        return null
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: ConductorResult | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const eventStr of events) {
          if (!eventStr.trim()) continue

          const lines = eventStr.split('\n')
          let eventType = ''
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7)
            if (line.startsWith('data: ')) eventData = line.slice(6)
          }

          if (!eventType || !eventData) continue

          try {
            const parsed = JSON.parse(eventData)

            switch (eventType) {
              case 'step-started':
                setState(prev => ({
                  ...prev,
                  steps: [...prev.steps.filter(s => s.id !== parsed.step.id), parsed.step],
                }))
                break

              case 'step-completed':
                setState(prev => ({
                  ...prev,
                  steps: prev.steps.map(s => s.id === parsed.step.id ? parsed.step : s),
                }))
                break

              case 'step-failed':
                setState(prev => ({
                  ...prev,
                  steps: prev.steps.map(s => s.id === parsed.step.id ? parsed.step : s),
                }))
                break

              case 'speak':
                setState(prev => ({
                  ...prev,
                  speakQueue: [...prev.speakQueue, parsed.text],
                }))
                break

              case 'pipeline-complete':
                finalResult = parsed.result
                setState(prev => ({
                  ...prev,
                  isRunning: false,
                  finalResult: parsed.result,
                }))
                break

              case 'error':
                setState(prev => ({
                  ...prev,
                  isRunning: false,
                  error: parsed.message,
                }))
                break
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      return finalResult
    } catch (error: any) {
      if (error.name === 'AbortError') return null
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: error.message || 'Stream connection failed',
      }))
      return null
    }
  }, [])

  /**
   * Cancel a running pipeline
   */
  const cancelPipeline = useCallback(() => {
    abortRef.current?.abort()
    setState(prev => ({ ...prev, isRunning: false }))
  }, [])

  /**
   * Clear speak queue (called after TTS plays each item)
   */
  const clearSpeakItem = useCallback(() => {
    setState(prev => ({
      ...prev,
      speakQueue: prev.speakQueue.slice(1),
    }))
  }, [])

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({
      steps: [],
      isRunning: false,
      finalResult: null,
      error: null,
      speakQueue: [],
    })
  }, [])

  return {
    ...state,
    executePipeline,
    cancelPipeline,
    clearSpeakItem,
    reset,
  }
}
