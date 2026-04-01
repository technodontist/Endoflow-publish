'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getPatientAppointments,
  getPatientTreatmentHistory,
  getPatientMessages,
  createAppointmentBooking,
  sendPatientMessage,
  createNotification
} from '@/lib/db/queries'
import {
  createAppointmentRequest,
  getAvailableTimeSlots,
  cancelAppointment,
  AppointmentRequestData
} from '@/lib/services/appointments'

// Get current patient data
export async function getCurrentPatient() {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Not authenticated')
    }

    // Get user profile using service client
    const serviceSupabase = await createServiceClient()
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .eq('role', 'patient')
      .single()

    if (profileError || !profile) {
      throw new Error('Patient profile not found')
    }

    return {
      id: profile.id,
      name: profile.full_name || 'Patient',
      email: user.email || '',
      phone: profile.phone || '(555) 123-4567',
      role: profile.role,
      status: profile.status
    }
  } catch (error) {
    console.error('Error getting current patient:', error)
    return null
  }
}

// Enhanced appointment booking with validation and conflict detection
export async function bookAppointment(formData: FormData) {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Extract and validate form data
    const requestData: AppointmentRequestData = {
      chiefComplaint: (formData.get('chiefComplaint') as string)?.trim() || '',
      painLevel: parseInt(formData.get('painLevel') as string) || 0,
      urgency: (formData.get('urgency') as string) as 'routine' | 'urgent' | 'emergency' || 'routine',
      preferredDate: formData.get('preferredDate') as string,
      preferredTime: formData.get('preferredTime') as string,
      additionalNotes: (formData.get('additionalNotes') as string)?.trim() || ''
    }

    // Use the enhanced appointment service
    const result = await createAppointmentRequest(user.id, requestData)

    if (result.success) {
      revalidatePath('/patient')
      revalidatePath('/assistant')
      revalidatePath('/dentist')
    }

    return result
  } catch (error) {
    console.error('Error booking appointment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to book appointment'
    }
  }
}

// Get patient's appointment requests
export async function getAppointmentRequests() {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated', data: [] }
    }

    // Get patient's appointment requests
    const { data: requests, error } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching appointment requests:', error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: requests || [] }
  } catch (error) {
    console.error('Exception getting appointment requests:', error)
    return { success: false, error: 'Failed to fetch appointment requests', data: [] }
  }
}

// Get available appointment slots for patient scheduling
export async function getAvailableSlots(
  startDate: string,
  endDate: string,
  durationMinutes?: number
) {
  try {
    const result = await getAvailableTimeSlots(startDate, endDate, durationMinutes)
    return result
  } catch (error) {
    console.error('Error getting available slots:', error)
    return { success: false, error: 'Failed to fetch available time slots' }
  }
}

// Cancel patient appointment
export async function cancelPatientAppointment(
  appointmentId: string,
  reason: string
) {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const result = await cancelAppointment(appointmentId, user.id, reason, 'patient')

    if (result.success) {
      revalidatePath('/patient')
      revalidatePath('/assistant')
      revalidatePath('/dentist')
    }

    return result
  } catch (error) {
    console.error('Error cancelling appointment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel appointment'
    }
  }
}

// Request appointment reschedule
export async function requestReschedule(
  appointmentId: string,
  newPreferredDate: string,
  newPreferredTime: string,
  reason: string
) {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // First, get the current appointment details
    const serviceSupabase = await createServiceClient()
    const { data: appointment, error: apptError } = await serviceSupabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('patient_id', user.id)
      .single()

    if (apptError || !appointment) {
      return { success: false, error: 'Appointment not found' }
    }

    // Create a new appointment request for the reschedule
    const requestData: AppointmentRequestData = {
      chiefComplaint: `Reschedule request: ${appointment.appointment_type}`,
      painLevel: 0,
      urgency: 'routine' as const,
      preferredDate: newPreferredDate,
      preferredTime: newPreferredTime,
      additionalNotes: `Rescheduling appointment from ${appointment.scheduled_date} at ${appointment.scheduled_time}. Reason: ${reason}`
    }

    const result = await createAppointmentRequest(user.id, requestData)

    if (result.success) {
      // Add a note to cancel the original appointment
      await cancelAppointment(appointmentId, user.id, `Requested reschedule to ${newPreferredDate} at ${newPreferredTime}`, 'patient')

      revalidatePath('/patient')
      revalidatePath('/assistant')
      revalidatePath('/dentist')
    }

    return result
  } catch (error) {
    console.error('Error requesting reschedule:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request reschedule'
    }
  }
}

// Send a message
export async function sendMessage(message: string) {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Not authenticated')
    }

    if (!message.trim()) {
      throw new Error('Message cannot be empty')
    }

    // Send message
    const result = await sendPatientMessage(user.id, message.trim())

    if (!result.success) {
      throw new Error(result.error || 'Failed to send message')
    }

    revalidatePath('/patient')
    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error sending message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    }
  }
}

// Get patient appointments
export async function getAppointments() {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return []
    }

    return await getPatientAppointments(user.id)
  } catch (error) {
    console.error('Error getting appointments:', error)
    return []
  }
}

// Get patient treatment history
export async function getTreatmentHistory() {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return []
    }

    return await getPatientTreatmentHistory(user.id)
  } catch (error) {
    console.error('Error getting treatment history:', error)
    return []
  }
}

// Get patient messages
export async function getMessages() {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return []
    }

    return await getPatientMessages(user.id)
  } catch (error) {
    console.error('Error getting messages:', error)
    return []
  }
}

// Request urgent assistance
export async function requestUrgentAssistance() {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Not authenticated')
    }

    // Create urgent assistance request
    const result = await sendPatientMessage(
      user.id,
      '🚨 URGENT: Patient is requesting immediate assistance. This is a priority message.'
    )

    if (!result.success) {
      throw new Error(result.error || 'Failed to send urgent assistance request')
    }

    // Get patient name for notification
    const serviceSupabase = await createServiceClient()
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const patientName = profile?.full_name || 'A patient'

    // Get all assistants and dentists to notify them of the urgent request
    const { data: staff } = await serviceSupabase
      .from('profiles')
      .select('id')
      .in('role', ['assistant', 'dentist'])
      .eq('status', 'active')

    // Send urgent notifications to all active staff
    if (staff && staff.length > 0) {
      const notificationPromises = staff.map(staffMember =>
        createNotification(staffMember.id, 'urgent_request', {
          title: '🚨 URGENT ASSISTANCE NEEDED',
          message: `${patientName} is requesting immediate assistance. Please respond promptly.`,
          relatedId: result.data?.id
        })
      )

      await Promise.all(notificationPromises)
    }

    revalidatePath('/patient')
    revalidatePath('/dashboard/assistant')
    revalidatePath('/dashboard/dentist')
    return { success: true, message: 'Urgent assistance request sent successfully!' }
  } catch (error) {
    console.error('Error requesting urgent assistance:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request urgent assistance'
    }
  }
}

// Get all patients (for task assignment dropdowns)
export async function getAllPatientsAction() {
  const supabase = await createServiceClient()

  try {
    const { data: patients, error } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name, phone, email')
      .order('first_name')

    if (error) {
      console.error('Error fetching patients:', error)
      return { success: false, error: error.message, patients: [] }
    }

    return {
      success: true,
      patients: patients.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        phone: p.phone,
        email: p.email
      }))
    }
  } catch (error) {
    console.error('Error getting all patients:', error)
    return { success: false, error: 'Failed to fetch patients', patients: [] }
  }
}