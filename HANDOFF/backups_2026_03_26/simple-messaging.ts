'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ===============================================
// SIMPLE MESSAGING ACTIONS - Using api.messages table
// ===============================================

export async function sendMessageAction(data: {
  patientId: string
  message: string
}) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Get user profile to determine sender type
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { error: 'User profile not found' }
    }

    const senderType = profile.role
    const isFromPatient = senderType === 'patient'

    console.log(`📝 [SENDING] ${senderType} ${user.id} sending message to patient ${data.patientId}`)

    // Insert the message
    const { data: message, error: messageError } = await serviceSupabase
      .schema('api')
      .from('messages')
      .insert({
        patient_id: data.patientId,
        sender_id: user.id,
        sender_type: senderType,
        message: data.message,
        is_from_patient: isFromPatient,
        read: false
      })
      .select()
      .single()

    if (messageError) {
      console.error('❌ [MESSAGE ERROR] Error sending message:', messageError)
      return { error: 'Failed to send message' }
    }

    console.log(`✅ [MESSAGE SENT] ${senderType} ${user.id} → Patient ${data.patientId}`)
    console.log(`📋 [MESSAGE DATA]`, message)

    // Add a small delay to ensure the database change is propagated
    await new Promise(resolve => setTimeout(resolve, 100))

    // Revalidate relevant paths
    revalidatePath('/dentist')
    revalidatePath('/patient')

    return { success: true, data: message }

  } catch (error) {
    console.error('Error in sendMessageAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getConversationAction(patientId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Get user profile to check permissions
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { error: 'User profile not found' }
    }

    // Check if user has access to this conversation
    if (profile.role === 'patient' && user.id !== patientId) {
      return { error: 'Access denied - can only view own messages' }
    }

    // Fetch all messages for this patient
    const { data: messages, error: messagesError } = await serviceSupabase
      .schema('api')
      .from('messages')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return { error: 'Failed to fetch messages' }
    }

    // Get sender profiles for display names
    const senderIds = [...new Set(messages.map(m => m.sender_id))]
    const { data: profiles, error: profilesError } = await serviceSupabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', senderIds)

    if (profilesError) {
      console.error('Error fetching sender profiles:', profilesError)
      // Continue without profile data
    }

    // Enhance messages with sender info
    const enhancedMessages = messages.map(message => {
      const senderProfile = profiles?.find(p => p.id === message.sender_id)
      return {
        ...message,
        sender_name: senderProfile?.full_name || 'Unknown User',
        sender_role: senderProfile?.role || message.sender_type
      }
    })

    return { success: true, data: enhancedMessages }

  } catch (error) {
    console.error('Error in getConversationAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function markMessagesAsReadAction(patientId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Get user profile
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { error: 'User profile not found' }
    }

    // Mark messages as read based on user role
    let query = serviceSupabase
      .schema('api')
      .from('messages')
      .update({ read: true })
      .eq('patient_id', patientId)
      .eq('read', false)

    if (profile.role === 'patient') {
      // Patient reading messages from dentist/assistant
      query = query.neq('sender_type', 'patient')
    } else if (profile.role === 'dentist' || profile.role === 'assistant') {
      // Dentist/assistant reading messages from patient
      query = query.eq('sender_type', 'patient')
    }

    const { error: updateError } = await query

    if (updateError) {
      console.error('Error marking messages as read:', updateError)
      return { error: 'Failed to mark messages as read' }
    }

    console.log(`✅ [MESSAGES READ] ${profile.role} ${user.id} marked messages as read for patient ${patientId}`)

    return { success: true }

  } catch (error) {
    console.error('Error in markMessagesAsReadAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getPatientConversationsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Get user profile
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { error: 'User profile not found' }
    }

    if (profile.role !== 'dentist' && profile.role !== 'assistant') {
      return { error: 'Only dentists and assistants can view all conversations' }
    }

    // Get unique patient conversations with latest message info
    const { data: conversations, error: conversationsError } = await serviceSupabase
      .schema('api')
      .from('messages')
      .select(`
        patient_id,
        message,
        created_at,
        is_from_patient,
        read,
        sender_type
      `)
      .order('created_at', { ascending: false })

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      return { error: 'Failed to fetch conversations' }
    }

    // Group by patient and get latest message for each
    const patientConversations = new Map()

    conversations.forEach(msg => {
      if (!patientConversations.has(msg.patient_id)) {
        patientConversations.set(msg.patient_id, {
          patient_id: msg.patient_id,
          last_message: msg.message,
          last_message_at: msg.created_at,
          is_from_patient: msg.is_from_patient,
          unread_count: 0
        })
      }

      // Count unread messages from patient
      if (msg.is_from_patient && !msg.read) {
        const conversation = patientConversations.get(msg.patient_id)
        conversation.unread_count++
      }
    })

    const conversationList = Array.from(patientConversations.values())

    // Get patient details
    const patientIds = conversationList.map(c => c.patient_id)
    const { data: patients, error: patientsError } = await serviceSupabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, phone, email')
      .in('id', patientIds)

    if (patientsError) {
      console.error('Error fetching patient details:', patientsError)
      // Continue without patient details
    }

    // Enhance conversations with patient info
    const enhancedConversations = conversationList.map(conversation => {
      const patient = patients?.find(p => p.id === conversation.patient_id)
      return {
        ...conversation,
        patient: patient ? {
          ...patient,
          full_name: `${patient.first_name} ${patient.last_name}`,
          uhid: `UH${patient.id.slice(0, 6).toUpperCase()}`
        } : {
          id: conversation.patient_id,
          full_name: 'Unknown Patient',
          uhid: 'N/A'
        }
      }
    })

    // Sort by last message time
    enhancedConversations.sort((a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    )

    return { success: true, data: enhancedConversations }

  } catch (error) {
    console.error('Error in getPatientConversationsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}