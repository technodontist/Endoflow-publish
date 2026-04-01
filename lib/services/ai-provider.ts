/**
 * AI Provider Router
 * Routes AI requests to Claude (complex reasoning) or Gemini (fast/simple tasks)
 * Provides fallback: if Claude fails, falls back to Gemini
 */

import { generateChatCompletion, type GeminiChatMessage, type GeminiChatOptions } from './gemini-ai'
import { generateClaudeChatCompletion, convertGeminiToClaudeMessages, type ClaudeChatOptions, type ClaudeChatMessage } from './claude-ai'

export type AIProvider = 'claude' | 'gemini' | 'auto'

export type AITaskComplexity =
  | 'diagnosis'           // Complex - Claude
  | 'treatment_planning'  // Complex - Claude
  | 'intent_classification' // Complex - Claude
  | 'medical_parsing'     // Complex - Claude
  | 'evidence_synthesis'  // Complex - Claude
  | 'research_analysis'   // Complex - Claude
  | 'conversation_context' // Complex - Claude
  | 'data_extraction'     // Simple - Gemini
  | 'classification'      // Simple - Gemini
  | 'summarization'       // Simple - Gemini
  | 'embedding'           // Always Gemini (no Claude equivalent)

// Tasks that benefit from Claude's reasoning
const CLAUDE_TASKS: Set<AITaskComplexity> = new Set([
  'diagnosis',
  'treatment_planning',
  'intent_classification',
  'medical_parsing',
  'evidence_synthesis',
  'research_analysis',
  'conversation_context'
])

/**
 * Determine which provider to use based on task type
 */
function selectProvider(task?: AITaskComplexity): AIProvider {
  // Check if Claude API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    return 'gemini' // Fallback if no Claude key
  }

  if (!task) return 'gemini' // Default to Gemini for unspecified tasks

  return CLAUDE_TASKS.has(task) ? 'claude' : 'gemini'
}

/**
 * Unified AI chat completion with automatic provider routing and fallback
 *
 * Accepts Gemini-format messages (the existing format throughout the codebase)
 * and routes to the appropriate provider.
 */
// =====================================================
// CHAT SESSION (Session 7: persistent multi-turn)
// =====================================================

/**
 * A persistent chat session that accumulates conversation turns.
 * For Claude: maintains a messages array passed on each call.
 * For Gemini: could use startChat() in future, but currently same approach.
 *
 * This is NOT serializable — lives in server memory only.
 * Lifetime = one patient encounter.
 */
export interface AIChatSession {
  provider: AIProvider
  systemInstruction: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  options: {
    task?: AITaskComplexity
    temperature?: number
    maxOutputTokens?: number
    responseFormat?: 'json' | 'text'
  }
  totalInputTokens: number
  totalOutputTokens: number
  turnCount: number
}

/**
 * Create a new chat session with an initial system prompt.
 * The first user message should contain the full context (agent reports, RAG, etc.)
 */
export function createChatSession(
  systemInstruction: string,
  options: {
    task?: AITaskComplexity
    provider?: AIProvider
    temperature?: number
    maxOutputTokens?: number
    responseFormat?: 'json' | 'text'
  } = {}
): AIChatSession {
  const { task, provider: forcedProvider, ...rest } = options
  const provider = forcedProvider || selectProvider(task)

  console.log(`💬 [AI SESSION] Created new chat session (provider: ${provider}, task: ${task || 'unspecified'})`)

  return {
    provider,
    systemInstruction,
    messages: [],
    options: { task, ...rest },
    totalInputTokens: 0,
    totalOutputTokens: 0,
    turnCount: 0,
  }
}

/**
 * Send a message to an existing chat session.
 * The session accumulates all turns, so the LLM sees the full conversation history.
 * Returns the assistant's response text.
 */
export async function sendSessionMessage(
  session: AIChatSession,
  userMessage: string
): Promise<string> {
  // Add user message to history
  session.messages.push({ role: 'user', content: userMessage })
  session.turnCount++

  console.log(`💬 [AI SESSION] Turn ${session.turnCount}: sending ${userMessage.length} chars (${session.messages.length} messages in session)`)

  try {
    let response: string

    if (session.provider === 'claude' || session.provider === 'auto') {
      try {
        // Claude: pass full messages array as proper conversation turns
        const claudeMessages: ClaudeChatMessage[] = session.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

        response = await generateClaudeChatCompletion(claudeMessages, {
          temperature: session.options.temperature,
          maxTokens: session.options.maxOutputTokens,
          systemInstruction: session.systemInstruction,
          responseFormat: session.options.responseFormat,
        })
      } catch (error: any) {
        if (session.provider === 'claude') throw error
        console.warn(`⚠️ [AI SESSION] Claude failed, falling back to Gemini`)
        // Fall through to Gemini
        const geminiMessages: GeminiChatMessage[] = session.messages.map(m => ({
          role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
          parts: [{ text: m.content }],
        }))
        response = await generateChatCompletion(geminiMessages, {
          temperature: session.options.temperature,
          maxOutputTokens: session.options.maxOutputTokens,
          systemInstruction: session.systemInstruction,
          responseFormat: session.options.responseFormat,
        })
      }
    } else {
      // Gemini
      const geminiMessages: GeminiChatMessage[] = session.messages.map(m => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: m.content }],
      }))
      response = await generateChatCompletion(geminiMessages, {
        temperature: session.options.temperature,
        maxOutputTokens: session.options.maxOutputTokens,
        systemInstruction: session.systemInstruction,
        responseFormat: session.options.responseFormat,
      })
    }

    // Add assistant response to history
    session.messages.push({ role: 'assistant', content: response })

    console.log(`💬 [AI SESSION] Turn ${session.turnCount} complete (session: ${session.messages.length} messages total)`)

    return response
  } catch (error) {
    // Remove the failed user message so session stays consistent
    session.messages.pop()
    session.turnCount--
    throw error
  }
}

// =====================================================
// ONE-SHOT COMPLETION (existing)
// =====================================================

export async function aiChatCompletion(
  messages: GeminiChatMessage[],
  options: GeminiChatOptions & {
    task?: AITaskComplexity
    provider?: AIProvider
  } = {}
): Promise<string> {
  const { task, provider: forcedProvider, ...geminiOptions } = options
  const provider = forcedProvider || selectProvider(task)

  if (provider === 'claude' || (provider === 'auto' && task && CLAUDE_TASKS.has(task))) {
    try {
      console.log(`🧠 [AI ROUTER] Using Claude for task: ${task || 'unspecified'}`)

      const claudeMessages = convertGeminiToClaudeMessages(messages)
      const claudeOptions: ClaudeChatOptions = {
        temperature: geminiOptions.temperature,
        maxTokens: geminiOptions.maxOutputTokens,
        systemInstruction: geminiOptions.systemInstruction,
        responseFormat: geminiOptions.responseFormat
      }

      return await generateClaudeChatCompletion(claudeMessages, claudeOptions)
    } catch (error: any) {
      console.warn(`⚠️ [AI ROUTER] Claude failed (${error.message}), falling back to Gemini`)
      // Fall through to Gemini
    }
  }

  console.log(`⚡ [AI ROUTER] Using Gemini for task: ${task || 'unspecified'}`)
  return generateChatCompletion(messages, geminiOptions)
}
