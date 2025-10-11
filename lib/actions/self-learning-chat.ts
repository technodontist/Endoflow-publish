'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ===============================================
// SELF-LEARNING CHAT SESSION ACTIONS
// Purpose: Manage Gemini-style chat history for Self-Learning AI Assistant
// Based on: clinic-analysis-chat.ts structure
// ===============================================

/**
 * Create a new self-learning chat session
 */
export async function createLearningSessionAction(params?: {
  title?: string
  diagnosis?: string
  treatment?: string
  patientId?: string
  patientName?: string
}) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify user is a dentist
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { error: 'Only active dentists can create learning sessions' }
    }

    console.log('📚 [LEARNING CHAT] Creating new session for dentist:', user.id)

    // Generate title based on context
    let sessionTitle = params?.title
    if (!sessionTitle) {
      if (params?.diagnosis) {
        sessionTitle = `Learning: ${params.diagnosis}`
      } else if (params?.treatment) {
        sessionTitle = `Treatment: ${params.treatment}`
      } else {
        sessionTitle = `Learning Session ${new Date().toLocaleDateString()}`
      }
    }

    // Create new session
    const { data: session, error: insertError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .insert({
        dentist_id: user.id,
        title: sessionTitle,
        diagnosis: params?.diagnosis || null,
        treatment: params?.treatment || null,
        patient_id: params?.patientId || null,
        patient_name: params?.patientName || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [LEARNING CHAT] Error creating session:', insertError)
      // If table doesn't exist, provide helpful error message
      if (insertError.code === 'PGRST205' || insertError.message?.includes('Could not find the table')) {
        return { error: 'Self-learning chat feature not yet configured. Please run database migration: lib/db/migrations/add_self_learning_chat_sessions.sql' }
      }
      return { error: 'Failed to create learning session' }
    }

    console.log('✅ [LEARNING CHAT] Session created:', session.id)

    revalidatePath('/dentist')

    return { success: true, data: session }

  } catch (error) {
    console.error('Error in createLearningSessionAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get all learning sessions for current user
 */
export async function getLearningSessionsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify user is a dentist
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { error: 'Only active dentists can view learning sessions' }
    }

    console.log('📋 [LEARNING CHAT] Fetching sessions for dentist:', user.id)

    // Get all sessions ordered by last activity
    const { data: sessions, error: fetchError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('*')
      .eq('dentist_id', user.id)
      .order('last_activity_at', { ascending: false })

    if (fetchError) {
      console.error('❌ [LEARNING CHAT] Error fetching sessions:', fetchError)
      // If table doesn't exist, return empty array instead of error
      if (fetchError.code === 'PGRST205' || fetchError.message?.includes('Could not find the table')) {
        console.log('⚠️ [LEARNING CHAT] Table not found - returning empty sessions. Run migration: lib/db/migrations/add_self_learning_chat_sessions.sql')
        return { success: true, data: [] }
      }
      return { error: 'Failed to fetch learning sessions' }
    }

    console.log(`✅ [LEARNING CHAT] Found ${sessions?.length || 0} sessions`)

    return { success: true, data: sessions || [] }

  } catch (error) {
    console.error('Error in getLearningSessionsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get messages for a specific learning session
 */
export async function getLearningMessagesAction(sessionId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('dentist_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session || session.dentist_id !== user.id) {
      return { error: 'Session not found or access denied' }
    }

    console.log('📚 [LEARNING CHAT] Fetching messages for session:', sessionId)

    // Get all messages ordered by sequence
    const { data: messages, error: fetchError } = await serviceSupabase
      .schema('api')
      .from('self_learning_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: true })

    if (fetchError) {
      console.error('❌ [LEARNING CHAT] Error fetching messages:', fetchError)
      return { error: 'Failed to fetch messages' }
    }

    console.log(`✅ [LEARNING CHAT] Found ${messages?.length || 0} messages`)

    return { success: true, data: messages || [] }

  } catch (error) {
    console.error('Error in getLearningMessagesAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Save a message to a learning session
 */
export async function saveLearningMessageAction(params: {
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  metadata?: any
}) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('dentist_id, message_count')
      .eq('id', params.sessionId)
      .single()

    if (sessionError || !session || session.dentist_id !== user.id) {
      return { error: 'Session not found or access denied' }
    }

    console.log('📚 [LEARNING CHAT] Saving message to session:', params.sessionId)

    // Prepare metadata as JSON string
    const metadataString = params.metadata ? JSON.stringify(params.metadata) : null

    // Insert message with sequence number
    const { data: message, error: insertError } = await serviceSupabase
      .schema('api')
      .from('self_learning_messages')
      .insert({
        session_id: params.sessionId,
        role: params.role,
        content: params.content,
        metadata: metadataString,
        sequence_number: session.message_count, // Auto-increment via current count
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [LEARNING CHAT] Error saving message:', insertError)
      return { error: 'Failed to save message' }
    }

    console.log('✅ [LEARNING CHAT] Message saved:', message.id)

    // Note: Session metadata is auto-updated by database trigger
    revalidatePath('/dentist')

    return { success: true, data: message }

  } catch (error) {
    console.error('Error in saveLearningMessageAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a learning session and all its messages
 */
export async function deleteLearningSessionAction(sessionId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('dentist_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session || session.dentist_id !== user.id) {
      return { error: 'Session not found or access denied' }
    }

    console.log('🗑️ [LEARNING CHAT] Deleting session:', sessionId)

    // Delete session (messages will be cascade deleted)
    const { error: deleteError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .delete()
      .eq('id', sessionId)

    if (deleteError) {
      console.error('❌ [LEARNING CHAT] Error deleting session:', deleteError)
      return { error: 'Failed to delete session' }
    }

    console.log('✅ [LEARNING CHAT] Session deleted:', sessionId)

    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('Error in deleteLearningSessionAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Rename a learning session
 */
export async function renameLearningSessionAction(sessionId: string, newTitle: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('dentist_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session || session.dentist_id !== user.id) {
      return { error: 'Session not found or access denied' }
    }

    // Validate title
    if (!newTitle || newTitle.trim().length === 0) {
      return { error: 'Title cannot be empty' }
    }

    if (newTitle.length > 100) {
      return { error: 'Title too long (max 100 characters)' }
    }

    console.log('✏️ [LEARNING CHAT] Renaming session:', sessionId, 'to:', newTitle)

    // Update title
    const { data: updatedSession, error: updateError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .update({
        title: newTitle.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ [LEARNING CHAT] Error renaming session:', updateError)
      return { error: 'Failed to rename session' }
    }

    console.log('✅ [LEARNING CHAT] Session renamed successfully')

    revalidatePath('/dentist')

    return { success: true, data: updatedSession }

  } catch (error) {
    console.error('Error in renameLearningSessionAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Auto-title learning session based on first user message (if default title)
 */
export async function autoTitleLearningSessionAction(sessionId: string, firstMessage: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify session belongs to user and has default title
    const { data: session, error: sessionError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .select('dentist_id, title, message_count')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session || session.dentist_id !== user.id) {
      return { error: 'Session not found or access denied' }
    }

    // Only auto-title if it's still the default title and first message
    const isDefaultTitle = session.title.startsWith('Learning') || session.title === 'New Learning Session'
    if (!isDefaultTitle || session.message_count > 1) {
      return { success: true, skipped: true } // Already has custom title or not first message
    }

    // Generate title from first message (truncate to 50 chars)
    const autoTitle = firstMessage.trim().substring(0, 50) + (firstMessage.length > 50 ? '...' : '')

    console.log('🤖 [LEARNING CHAT] Auto-titling session:', sessionId)

    // Update title
    const { error: updateError } = await serviceSupabase
      .schema('api')
      .from('self_learning_chat_sessions')
      .update({
        title: autoTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ [LEARNING CHAT] Error auto-titling session:', updateError)
      // Don't fail the whole operation for this
      return { success: true, warning: 'Auto-title failed but message saved' }
    }

    console.log('✅ [LEARNING CHAT] Session auto-titled successfully')

    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('Error in autoTitleLearningSessionAction:', error)
    return { success: true, warning: 'Auto-title failed but message saved' }
  }
}
