'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ===============================================
// DENTIST MESSAGING ACTIONS
// ===============================================

export async function getDentistMessageThreadsAction() {
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'dentist') {
      return { error: 'Only dentists can access message threads' }
    }

    // First get the threads for this dentist
    const { data: threads, error } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .select('*')
      .eq('dentist_id', user.id)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching message threads:', error)
      return { error: 'Failed to fetch message threads' }
    }

    if (!threads || threads.length === 0) {
      return { success: true, data: [] }
    }

    // Get patient information for each thread
    const patientIds = threads.map(thread => thread.patient_id)
    const { data: patients, error: patientsError } = await serviceSupabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, phone, email')
      .in('id', patientIds)

    if (patientsError) {
      console.error('Error fetching patient data:', patientsError)
      // Continue without patient data rather than failing
    }

    // Combine threads with patient data
    const threadsWithPatients = threads.map(thread => {
      const patient = patients?.find(p => p.id === thread.patient_id)
      return {
        ...thread,
        patient: patient ? {
          ...patient,
          full_name: `${patient.first_name} ${patient.last_name}`,
          uhid: `UH${patient.id.slice(0, 6).toUpperCase()}`
        } : {
          id: thread.patient_id,
          full_name: 'Unknown Patient',
          uhid: 'N/A',
          first_name: 'Unknown',
          last_name: 'Patient'
        }
      }
    })

    return { success: true, data: threadsWithPatients }

  } catch (error) {
    console.error('Error in getDentistMessageThreadsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getThreadMessagesAction(threadId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify user has access to this thread (is the dentist assigned to it)
    const { data: thread, error: threadError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .select('dentist_id, patient_id')
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      return { error: 'Thread not found' }
    }

    if (thread.dentist_id !== user.id) {
      return { error: 'Access denied - not authorized for this conversation' }
    }

    const { data: messages, error } = await serviceSupabase
      .schema('api')
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching thread messages:', error)
      return { error: 'Failed to fetch messages' }
    }

    return { success: true, data: messages }

  } catch (error) {
    console.error('Error in getThreadMessagesAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

interface SendDentistMessageData {
  threadId: string
  content: string
  messageType?: 'text' | 'system'
}

export async function sendThreadMessageAction(data: SendDentistMessageData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify user has access to this thread (is the dentist assigned to it)
    const { data: thread, error: threadError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .select('dentist_id, patient_id, patient_unread_count')
      .eq('id', data.threadId)
      .single()

    if (threadError || !thread) {
      return { error: 'Thread not found' }
    }

    if (thread.dentist_id !== user.id) {
      return { error: 'Access denied - not authorized for this conversation' }
    }

    // Insert the message
    const { data: message, error: messageError } = await serviceSupabase
      .schema('api')
      .from('thread_messages')
      .insert({
        thread_id: data.threadId,
        sender_id: user.id,
        sender_type: 'dentist',
        content: data.content,
        message_type: data.messageType || 'text'
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error sending dentist message:', messageError)
      return { error: 'Failed to send message' }
    }

    // Update thread metadata
    const updateData = {
      last_message_at: new Date().toISOString(),
      last_message_preview: data.content.substring(0, 100),
      patient_unread_count: thread.patient_unread_count + 1,
      dentist_unread_count: 0 // Reset dentist unread count since they just sent a message
    }

    const { error: updateError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .update(updateData)
      .eq('id', data.threadId)

    if (updateError) {
      console.error('Error updating thread metadata:', updateError)
      // Don't fail the whole operation for this
    }

    console.log(`💬 [DENTIST MESSAGE] Dentist ${user.id} sent message in thread ${data.threadId}`)

    // Revalidate relevant paths
    revalidatePath('/dentist')
    revalidatePath('/patient')

    return { success: true, data: message }

  } catch (error) {
    console.error('Error in sendThreadMessageAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function markThreadAsReadAction(threadId: string) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify user has access to this thread
    const { data: thread, error: threadError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .select('dentist_id')
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      return { error: 'Thread not found' }
    }

    if (thread.dentist_id !== user.id) {
      return { error: 'Access denied' }
    }

    // Mark patient messages as read for the dentist
    const { error: messagesError } = await serviceSupabase
      .schema('api')
      .from('thread_messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('thread_id', threadId)
      .eq('sender_type', 'patient')
      .eq('is_read', false)

    if (messagesError) {
      console.error('Error marking messages as read:', messagesError)
    }

    // Update dentist unread count in thread
    const { error: threadUpdateError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .update({ dentist_unread_count: 0 })
      .eq('id', threadId)

    if (threadUpdateError) {
      console.error('Error updating thread unread count:', threadUpdateError)
    }

    return { success: true }

  } catch (error) {
    console.error('Error in markThreadAsReadAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function createThreadFromDentistAction(patientId: string, subject: string, initialMessage: string, priority: 'urgent' | 'high' | 'normal' | 'low' = 'normal', isUrgent: boolean = false) {
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'dentist') {
      return { error: 'Only dentists can create message threads' }
    }

    // Create the thread
    const { data: thread, error: threadError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .insert({
        patient_id: patientId,
        dentist_id: user.id,
        subject: subject,
        priority: priority,
        is_urgent: isUrgent,
        last_message_preview: initialMessage.substring(0, 100),
        patient_unread_count: 1,
        message_count: 1
      })
      .select()
      .single()

    if (threadError) {
      console.error('Error creating thread:', threadError)
      return { error: 'Failed to create message thread' }
    }

    // Send the initial message
    const { error: messageError } = await serviceSupabase
      .schema('api')
      .from('thread_messages')
      .insert({
        thread_id: thread.id,
        sender_id: user.id,
        sender_type: 'dentist',
        content: initialMessage,
        message_type: 'text'
      })

    if (messageError) {
      console.error('Error sending initial message:', messageError)
      return { error: 'Failed to send initial message' }
    }

    console.log(`💬 [THREAD CREATED] Dentist ${user.id} started conversation with patient ${patientId}`)

    // Revalidate relevant paths
    revalidatePath('/dentist')
    revalidatePath('/patient')

    return { success: true, data: thread }

  } catch (error) {
    console.error('Error in createThreadFromDentistAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}