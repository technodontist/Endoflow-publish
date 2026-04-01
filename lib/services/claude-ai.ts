/**
 * Claude AI Service
 * Provides complex clinical reasoning via Anthropic's Claude API
 * Used for diagnosis, treatment planning, intent classification, and medical parsing
 */

import Anthropic from '@anthropic-ai/sdk'

// Lazy-initialized client
let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not configured')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

// Session 12: Vision content block types for image analysis
export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export interface ClaudeChatMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

/** Normalize content to always be a string (for backward compatibility) */
export function extractTextContent(content: string | ClaudeContentBlock[]): string {
  if (typeof content === 'string') return content
  return content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('\n')
}

export interface ClaudeChatOptions {
  model?: 'claude-sonnet-4-6' | 'claude-haiku-4-5'
  temperature?: number
  maxTokens?: number
  systemInstruction?: string
  responseFormat?: 'json' | 'text'
}

/**
 * Generate chat completion using Claude
 * Mirrors the Gemini generateChatCompletion interface for drop-in replacement
 */
export async function generateClaudeChatCompletion(
  messages: ClaudeChatMessage[],
  options: ClaudeChatOptions = {}
): Promise<string> {
  const {
    model = 'claude-sonnet-4-6',
    temperature = 0.3,
    maxTokens = 4096,
    systemInstruction,
    responseFormat = 'text'
  } = options

  // Build system prompt with JSON instruction if needed
  let system = systemInstruction || ''
  if (responseFormat === 'json') {
    system = system
      ? `${system}\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, no extra text.`
      : 'You MUST respond with valid JSON only. No markdown, no code blocks, no extra text.'
  }

  // Retry logic matching Gemini service pattern
  let lastError: Error | null = null
  let attempts = 0
  const maxAttempts = 2

  while (attempts < maxAttempts) {
    try {
      attempts++
      console.log(`🔄 [CLAUDE] Attempt ${attempts}/${maxAttempts} - Starting request (model: ${model})...`)

      const response = await getClient().messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: system || undefined,
        messages: messages.map(msg => ({
          role: msg.role,
          // Session 12: Pass content blocks through for vision support
          content: typeof msg.content === 'string'
            ? msg.content
            : msg.content as any  // Anthropic SDK natively accepts ContentBlock[]
        }))
      })

      console.log(`✅ [CLAUDE] Request successful on attempt ${attempts} (tokens: ${response.usage.input_tokens}+${response.usage.output_tokens})`)

      // Extract text from response
      const textBlock = response.content.find(block => block.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in Claude response')
      }

      let result = textBlock.text

      // Clean JSON response if needed
      if (responseFormat === 'json') {
        result = result.trim()
        // Strip markdown code blocks if Claude wrapped the response
        if (result.startsWith('```json')) {
          result = result.slice(7)
        } else if (result.startsWith('```')) {
          result = result.slice(3)
        }
        if (result.endsWith('```')) {
          result = result.slice(0, -3)
        }
        result = result.trim()
      }

      return result

    } catch (error: any) {
      lastError = error
      console.error(`❌ [CLAUDE] Attempt ${attempts} failed:`, error.message)

      // Retry on transient errors
      if (attempts < maxAttempts && (
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 529 || // Overloaded
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET')
      )) {
        const waitTime = attempts * 2000 // 2s, 4s backoff
        console.log(`⏳ [CLAUDE] Waiting ${waitTime}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }

      break
    }
  }

  throw lastError || new Error('Claude API request failed after all attempts')
}

/**
 * Convert Gemini-format messages to Claude format
 * Allows drop-in replacement in existing code
 */
export function convertGeminiToClaudeMessages(
  geminiMessages: { role: 'user' | 'model'; parts: { text: string }[] }[]
): ClaudeChatMessage[] {
  return geminiMessages.map(msg => ({
    role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
    content: msg.parts.map(p => p.text).join('\n')
  }))
}
