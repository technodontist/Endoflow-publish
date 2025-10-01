'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// ===============================================
// REFERRAL SYSTEM ACTIONS
// ===============================================

interface CreateReferralData {
  sharedVia: 'whatsapp' | 'sms' | 'email' | 'facebook' | 'twitter' | 'link' | 'other'
  recipientContact?: string
  recipientName?: string
  customMessage?: string
}

export async function createReferralAction(data: CreateReferralData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Verify user is a patient
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'patient') {
      return { error: 'Only patients can create referrals' }
    }

    // Generate unique referral code
    const referralCode = `REF-${user.id.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

    // Insert referral record
    const { data: referral, error: insertError } = await serviceSupabase
      .from('patient_referrals')
      .insert({
        referrer_id: user.id,
        referral_code: referralCode,
        shared_via: data.sharedVia,
        recipient_contact: data.recipientContact,
        recipient_name: data.recipientName,
        custom_message: data.customMessage
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating referral:', insertError)
      return { error: 'Failed to create referral' }
    }

    console.log(`📤 [REFERRAL CREATED] Patient ${user.id} shared via ${data.sharedVia}`)
    return {
      success: true,
      referral,
      referralCode,
      referralLink: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://endoflow.com'}/signup?ref=${referralCode}`
    }

  } catch (error) {
    console.error('Error in createReferralAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getPatientReferralsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const { data: referrals, error } = await serviceSupabase
      .from('patient_referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching referrals:', error)
      return { error: 'Failed to fetch referrals' }
    }

    return { success: true, data: referrals }

  } catch (error) {
    console.error('Error in getPatientReferralsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

// ===============================================
// PRESCRIPTION MANAGEMENT ACTIONS
// ===============================================

export async function getPatientPrescriptionsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const { data: prescriptions, error } = await serviceSupabase
      .from('patient_prescriptions')
      .select(`
        *,
        dentist:dentist_id(full_name)
      `)
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching prescriptions:', error)
      return { error: 'Failed to fetch prescriptions' }
    }

    return { success: true, data: prescriptions }

  } catch (error) {
    console.error('Error in getPatientPrescriptionsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getTodaysMedicationRemindersAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: reminders, error } = await serviceSupabase
      .from('medication_reminders')
      .select(`
        *,
        prescription:prescription_id(
          medication_name,
          dosage,
          instructions,
          alarm_sound
        )
      `)
      .eq('patient_id', user.id)
      .eq('scheduled_date', today)
      .order('scheduled_time', { ascending: true })

    if (error) {
      console.error('Error fetching medication reminders:', error)
      return { error: 'Failed to fetch medication reminders' }
    }

    return { success: true, data: reminders }

  } catch (error) {
    console.error('Error in getTodaysMedicationRemindersAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

interface MarkMedicationData {
  reminderId: string
  status: 'taken' | 'skipped'
  notes?: string
  sideEffects?: string
}

export async function markMedicationAction(data: MarkMedicationData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const updateData: any = {
      status: data.status,
      updated_at: new Date().toISOString()
    }

    if (data.status === 'taken') {
      updateData.taken_at = new Date().toISOString()
    } else if (data.status === 'skipped') {
      updateData.skipped_at = new Date().toISOString()
    }

    if (data.notes) {
      updateData.patient_notes = data.notes
    }

    if (data.sideEffects) {
      updateData.side_effects_reported = data.sideEffects
    }

    const { error } = await serviceSupabase
      .from('medication_reminders')
      .update(updateData)
      .eq('id', data.reminderId)
      .eq('patient_id', user.id)

    if (error) {
      console.error('Error updating medication reminder:', error)
      return { error: 'Failed to update medication status' }
    }

    console.log(`💊 [MEDICATION ${data.status.toUpperCase()}] Patient ${user.id} marked reminder ${data.reminderId}`)

    // Revalidate the patient dashboard to show updated data
    revalidatePath('/patient')

    return { success: true }

  } catch (error) {
    console.error('Error in markMedicationAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

// ===============================================
// ENHANCED MESSAGING ACTIONS
// ===============================================

export async function getPatientMessageThreadsAction() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    const { data: threads, error } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .select(`
        *,
        dentist:dentist_id(full_name)
      `)
      .eq('patient_id', user.id)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching message threads:', error)
      return { error: 'Failed to fetch message threads' }
    }

    return { success: true, data: threads }

  } catch (error) {
    console.error('Error in getPatientMessageThreadsAction:', error)
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

    // Verify user has access to this thread
    const { data: thread, error: threadError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .select('patient_id, dentist_id')
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      return { error: 'Thread not found' }
    }

    if (thread.patient_id !== user.id) {
      return { error: 'Access denied' }
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

    // Mark messages as read for the patient
    await serviceSupabase
      .schema('api')
      .from('thread_messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('thread_id', threadId)
      .eq('sender_type', 'dentist')
      .eq('is_read', false)

    // Update unread count in thread
    await serviceSupabase
      .schema('api')
      .from('message_threads')
      .update({ patient_unread_count: 0 })
      .eq('id', threadId)

    return { success: true, data: messages }

  } catch (error) {
    console.error('Error in getThreadMessagesAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

interface SendThreadMessageData {
  threadId: string
  content: string
  messageType?: 'text' | 'image' | 'file'
  attachments?: string[]
}

export async function sendThreadMessageAction(data: SendThreadMessageData) {
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
      .select('patient_id, dentist_id, dentist_unread_count')
      .eq('id', data.threadId)
      .single()

    if (threadError || !thread) {
      return { error: 'Thread not found' }
    }

    if (thread.patient_id !== user.id) {
      return { error: 'Access denied' }
    }

    // Insert the message
    const { data: message, error: messageError } = await serviceSupabase
      .schema('api')
      .from('thread_messages')
      .insert({
        thread_id: data.threadId,
        sender_id: user.id,
        sender_type: 'patient',
        content: data.content,
        message_type: data.messageType || 'text',
        attachments: data.attachments ? JSON.stringify(data.attachments) : null
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error sending message:', messageError)
      return { error: 'Failed to send message' }
    }

    // Update thread metadata
    const updateData = {
      last_message_at: new Date().toISOString(),
      last_message_preview: data.content.substring(0, 100),
      dentist_unread_count: thread.dentist_unread_count + 1
    }

    await serviceSupabase
      .schema('api')
      .from('message_threads')
      .update(updateData)
      .eq('id', data.threadId)

    console.log(`💬 [MESSAGE SENT] Patient ${user.id} sent message in thread ${data.threadId}`)

    // Revalidate relevant paths
    revalidatePath('/patient')
    revalidatePath('/dentist')

    return { success: true, data: message }

  } catch (error) {
    console.error('Error in sendThreadMessageAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

interface CreateMessageThreadData {
  dentistId: string
  subject: string
  initialMessage: string
  priority?: 'urgent' | 'high' | 'normal' | 'low'
  isUrgent?: boolean
}

export async function createMessageThreadAction(data: CreateMessageThreadData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Authentication required' }
    }

    // Create the thread
    const { data: thread, error: threadError } = await serviceSupabase
      .schema('api')
      .from('message_threads')
      .insert({
        patient_id: user.id,
        dentist_id: data.dentistId,
        subject: data.subject,
        priority: data.priority || 'normal',
        is_urgent: data.isUrgent || false,
        last_message_preview: data.initialMessage.substring(0, 100),
        dentist_unread_count: 1,
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
        sender_type: 'patient',
        content: data.initialMessage,
        message_type: 'text'
      })

    if (messageError) {
      console.error('Error sending initial message:', messageError)
      return { error: 'Failed to send initial message' }
    }

    console.log(`💬 [THREAD CREATED] Patient ${user.id} started conversation with dentist ${data.dentistId}`)

    // Revalidate relevant paths
    revalidatePath('/patient')
    revalidatePath('/dentist')

    return { success: true, data: thread }

  } catch (error) {
    console.error('Error in createMessageThreadAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}

// ===============================================
// UTILITY ACTIONS
// ===============================================

export async function getAvailableDentistsAction() {
  const serviceSupabase = await createServiceClient()

  try {
    const { data: dentists, error } = await serviceSupabase
      .schema('api')
      .from('dentists')
      .select('id, full_name, specialty')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching dentists:', error)
      return { error: 'Failed to fetch dentists' }
    }

    return { success: true, data: dentists }

  } catch (error) {
    console.error('Error in getAvailableDentistsAction:', error)
    return { error: 'An unexpected error occurred' }
  }
}