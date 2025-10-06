'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ===============================================
// RESEARCH AI CONVERSATION ACTIONS
// Purpose: Manage AI-powered research conversations with LangFlow
// ===============================================

/**
 * Save a research AI conversation to the database
 */
export async function saveResearchConversationAction(data: {
  projectId?: string | null
  userQuery: string
  aiResponse: string
  analysisType?: string
  cohortSize?: number
  metadata?: any
  source?: 'langflow' | 'n8n' | 'fallback'
  confidence?: string
  processingTime?: number
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
      return { error: 'Only active dentists can save AI conversations' }
    }

    console.log('💾 [RESEARCH AI] Saving conversation:', {
      projectId: data.projectId || 'temp-analysis',
      analysisType: data.analysisType,
      source: data.source || 'langflow'
    })

    // Prepare metadata as JSON string
    const metadataString = data.metadata ? JSON.stringify(data.metadata) : null

    // Insert the conversation
    const { data: conversation, error: insertError } = await serviceSupabase
      .schema('api')
      .from('research_ai_conversations')
      .insert({
        project_id: data.projectId || null,
        dentist_id: user.id,
        user_query: data.userQuery,
        ai_response: data.aiResponse,
        analysis_type: data.analysisType || null,
        cohort_size: data.cohortSize || null,
        metadata: metadataString,
        source: data.source || 'langflow',
        confidence: data.confidence || null,
        processing_time: data.processingTime || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [RESEARCH AI] Error saving conversation:', insertError)
      return { error: 'Failed to save conversation' }
    }

    console.log('✅ [RESEARCH AI] Conversation saved:', conversation.id)

    // Revalidate research projects page
    revalidatePath('/dentist')

    return { success: true, data: conversation }

  } catch (error) {
    console.error('Error in saveResearchConversationAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get all AI conversations for a specific research project
 */
export async function getProjectConversationsAction(projectId: string) {
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
      return { error: 'Access denied' }
    }

    console.log('📚 [RESEARCH AI] Fetching conversations for project:', projectId)

    // Fetch conversations for this project and user
    const { data: conversations, error: fetchError } = await serviceSupabase
      .schema('api')
      .from('research_ai_conversations')
      .select('*')
      .eq('project_id', projectId)
      .eq('dentist_id', user.id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ [RESEARCH AI] Error fetching conversations:', fetchError)
      return { error: 'Failed to fetch conversations' }
    }

    console.log(`✅ [RESEARCH AI] Found ${conversations?.length || 0} conversations`)

    // Parse metadata JSON strings back to objects
    const enhancedConversations = conversations?.map(conv => ({
      ...conv,
      metadata: conv.metadata ? JSON.parse(conv.metadata) : null
    })) || []

    return { success: true, data: enhancedConversations }

  } catch (error) {
    console.error('Error in getProjectConversationsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get all AI conversations for the current dentist (all projects)
 */
export async function getAllConversationsAction() {
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
      return { error: 'Access denied' }
    }

    console.log('📚 [RESEARCH AI] Fetching all conversations for dentist:', user.id)

    // Fetch all conversations for this dentist
    const { data: conversations, error: fetchError } = await serviceSupabase
      .schema('api')
      .from('research_ai_conversations')
      .select('*')
      .eq('dentist_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100) // Limit to last 100 conversations

    if (fetchError) {
      console.error('❌ [RESEARCH AI] Error fetching conversations:', fetchError)
      return { error: 'Failed to fetch conversations' }
    }

    console.log(`✅ [RESEARCH AI] Found ${conversations?.length || 0} conversations`)

    // Parse metadata JSON strings back to objects
    const enhancedConversations = conversations?.map(conv => ({
      ...conv,
      metadata: conv.metadata ? JSON.parse(conv.metadata) : null
    })) || []

    return { success: true, data: enhancedConversations }

  } catch (error) {
    console.error('Error in getAllConversationsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a specific AI conversation
 */
export async function deleteConversationAction(conversationId: string) {
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
      return { error: 'Access denied' }
    }

    console.log('🗑️ [RESEARCH AI] Deleting conversation:', conversationId)

    // Delete the conversation (RLS ensures user owns it)
    const { error: deleteError } = await serviceSupabase
      .schema('api')
      .from('research_ai_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('dentist_id', user.id) // Extra safety check

    if (deleteError) {
      console.error('❌ [RESEARCH AI] Error deleting conversation:', deleteError)
      return { error: 'Failed to delete conversation' }
    }

    console.log('✅ [RESEARCH AI] Conversation deleted successfully')

    // Revalidate research projects page
    revalidatePath('/dentist')

    return { success: true }

  } catch (error) {
    console.error('Error in deleteConversationAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Get conversation statistics for a dentist
 */
export async function getConversationStatsAction() {
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
      return { error: 'Access denied' }
    }

    console.log('📊 [RESEARCH AI] Fetching conversation stats for dentist:', user.id)

    // Fetch all conversations for stats
    const { data: conversations, error: fetchError } = await serviceSupabase
      .schema('api')
      .from('research_ai_conversations')
      .select('analysis_type, source, processing_time, created_at')
      .eq('dentist_id', user.id)

    if (fetchError) {
      console.error('❌ [RESEARCH AI] Error fetching stats:', fetchError)
      return { error: 'Failed to fetch statistics' }
    }

    // Calculate statistics
    const stats = {
      totalConversations: conversations?.length || 0,
      byAnalysisType: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      avgProcessingTime: 0,
      recentActivity: conversations?.slice(0, 10) || []
    }

    conversations?.forEach(conv => {
      // Count by analysis type
      if (conv.analysis_type) {
        stats.byAnalysisType[conv.analysis_type] = (stats.byAnalysisType[conv.analysis_type] || 0) + 1
      }

      // Count by source
      if (conv.source) {
        stats.bySource[conv.source] = (stats.bySource[conv.source] || 0) + 1
      }
    })

    // Calculate average processing time
    const processingTimes = conversations?.filter(c => c.processing_time).map(c => c.processing_time) || []
    if (processingTimes.length > 0) {
      stats.avgProcessingTime = Math.round(
        processingTimes.reduce((sum, time) => sum + (time || 0), 0) / processingTimes.length
      )
    }

    console.log('✅ [RESEARCH AI] Stats calculated:', stats)

    return { success: true, data: stats }

  } catch (error) {
    console.error('Error in getConversationStatsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}
