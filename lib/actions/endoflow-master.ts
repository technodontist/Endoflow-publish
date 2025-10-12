'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { orchestrateQuery } from '@/lib/services/endoflow-master-ai'

// ===============================================
// ENDOFLOW MASTER AI SERVER ACTIONS
// Purpose: Handle conversational AI orchestration
// ===============================================

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  agentName?: string
}

export interface ProcessQueryResult {
  success: boolean
  response?: string
  conversationId?: string
  error?: string
  intent?: any
  suggestions?: string[]
  agentResponses?: any[]
}

/**
 * Process a natural language query through the master AI orchestrator
 * This is the main entry point for all EndoFlow AI conversations
 */
export async function processEndoFlowQuery(params: {
  query: string
  conversationId?: string | null
}): Promise<ProcessQueryResult> {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    // Verify user is a dentist
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { success: false, error: 'Only active dentists can use EndoFlow AI' }
    }

    console.log('🎭 [ENDOFLOW ACTION] Processing query for dentist:', user.id)
    console.log('🔑 [ENDOFLOW ACTION] Received conversationId:', params.conversationId)

    // Get conversation history if conversationId provided
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    let currentConversationId = params.conversationId

    if (currentConversationId) {
      const { data: messages, error: historyError } = await serviceSupabase
        .schema('api')
        .from('endoflow_conversations')
        .select('messages')
        .eq('id', currentConversationId)
        .single()

      if (historyError) {
        console.error('⚠️ [ENDOFLOW ACTION] Failed to fetch conversation history:', historyError)
        console.error('⚠️ [ENDOFLOW ACTION] Make sure api.endoflow_conversations table exists!')
      } else if (messages?.messages) {
        conversationHistory = messages.messages
        console.log('✅ [ENDOFLOW ACTION] Loaded conversation history:', conversationHistory.length, 'messages')
      }
    } else {
      // Create new conversation
      const { data: newConversation, error: createError } = await serviceSupabase
        .schema('api')
        .from('endoflow_conversations')
        .insert({
          dentist_id: user.id,
          messages: []
        })
        .select()
        .single()

      if (!createError && newConversation) {
        currentConversationId = newConversation.id
      }
    }

    // Orchestrate the query through specialized agents
    const result = await orchestrateQuery({
      userQuery: params.query,
      dentistId: user.id,
      conversationHistory
    })

    if (!result.success) {
      return {
        success: false,
        error: result.response || 'Failed to process query'
      }
    }

    // Update conversation history
    if (currentConversationId) {
      const updatedMessages = [
        ...conversationHistory,
        { role: 'user' as const, content: params.query },
        {
          role: 'assistant' as const,
          content: result.response,
          agentName: result.agentResponses[0]?.agentName
        }
      ]

      await serviceSupabase
        .schema('api')
        .from('endoflow_conversations')
        .update({
          messages: updatedMessages,
          last_message_at: new Date().toISOString(),
          intent_type: result.intent.type
        })
        .eq('id', currentConversationId)
    }

    // Revalidate dentist dashboard
    revalidatePath('/dentist')

    return {
      success: true,
      response: result.response,
      conversationId: currentConversationId || undefined,
      intent: result.intent,
      suggestions: result.suggestions,
      agentResponses: result.agentResponses
    }

  } catch (error) {
    console.error('❌ [ENDOFLOW ACTION] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

/**
 * Get conversation history for a specific conversation
 */
export async function getConversationHistory(conversationId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: conversation, error } = await serviceSupabase
      .schema('api')
      .from('endoflow_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('dentist_id', user.id)
      .single()

    if (error) {
      return { success: false, error: 'Conversation not found' }
    }

    return {
      success: true,
      data: conversation
    }

  } catch (error) {
    console.error('Error fetching conversation history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get all conversations for the current dentist
 */
export async function getAllConversations() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: conversations, error } = await serviceSupabase
      .schema('api')
      .from('endoflow_conversations')
      .select('id, created_at, last_message_at, intent_type, messages')
      .eq('dentist_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    return {
      success: true,
      data: conversations
    }

  } catch (error) {
    console.error('Error fetching conversations:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await serviceSupabase
      .schema('api')
      .from('endoflow_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('dentist_id', user.id)

    if (error) {
      throw error
    }

    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('Error deleting conversation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Clear all conversations for current dentist
 */
export async function clearAllConversations() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await serviceSupabase
      .schema('api')
      .from('endoflow_conversations')
      .delete()
      .eq('dentist_id', user.id)

    if (error) {
      throw error
    }

    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('Error clearing conversations:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
