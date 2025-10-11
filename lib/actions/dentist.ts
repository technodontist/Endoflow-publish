'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import {
  getDentistAppointments,
  getAppointmentsByDate,
  getActivePatients,
  getAvailableDentists
} from '@/lib/db/queries'
import {
  createAppointmentRequest,
  confirmAppointmentRequest,
  updateAppointmentStatus,
  cancelAppointment,
  getAvailableTimeSlots,
  AppointmentRequestData,
  AppointmentScheduleData
} from '@/lib/services/appointments'

// Get current dentist data
export async function getCurrentDentist() {
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
      .eq('role', 'dentist')
      .single()

    if (profileError || !profile) {
      throw new Error('Dentist profile not found')
    }

    // Get dentist-specific data
    const { data: dentistData, error: dentistError } = await serviceSupabase
      .schema('api')
      .from('dentists')
      .select('*')
      .eq('id', user.id)
      .single()

    return {
      id: profile.id,
      name: profile.full_name || 'Dr. Unknown',
      email: user.email || '',
      role: profile.role,
      status: profile.status,
      specialty: dentistData?.specialty || 'General Dentistry',
      fullData: dentistData
    }
  } catch (error) {
    console.error('Error getting current dentist:', error)
    return null
  }
}

// Get dentist's appointments for a date range
export async function getDentistAppointmentsAction(
  startDate?: string,
  endDate?: string
) {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const appointments = await getDentistAppointments(user.id, startDate, endDate)
    return { success: true, data: appointments }
  } catch (error) {
    console.error('Error getting dentist appointments:', error)
    return { success: false, error: 'Failed to fetch appointments' }
  }
}

// Get today's appointments for dentist
export async function getTodaysAppointments() {
  const today = new Date().toISOString().split('T')[0]
  return getDentistAppointmentsAction(today, today)
}

// Get this week's appointments for dentist
export async function getWeekAppointments() {
  const today = new Date()
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
  const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))

  return getDentistAppointmentsAction(
    startOfWeek.toISOString().split('T')[0],
    endOfWeek.toISOString().split('T')[0]
  )
}

// Book appointment as dentist (for direct scheduling)
export async function dentistBookAppointment(formData: FormData) {
  const supabase = await createClient()

  try {
    // Get current user (dentist)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Extract form data
    const patientId = formData.get('patientId') as string
    const appointmentType = formData.get('appointmentType') as string
    const scheduledDate = formData.get('scheduledDate') as string
    const scheduledTime = formData.get('scheduledTime') as string
    const durationMinutes = parseInt(formData.get('durationMinutes') as string) || 60
    const notes = formData.get('notes') as string || ''
    const urgency = (formData.get('urgency') as string) || 'routine'

    // Validate required fields
    if (!patientId || !appointmentType || !scheduledDate || !scheduledTime) {
      return { success: false, error: 'Missing required fields' }
    }

    // Create appointment request first
    const requestData: AppointmentRequestData = {
      chiefComplaint: appointmentType,
      painLevel: 0,
      urgency: urgency as 'routine' | 'urgent' | 'emergency',
      preferredDate: scheduledDate,
      preferredTime: scheduledTime,
      additionalNotes: `Direct booking by dentist. ${notes}`
    }

    const requestResult = await createAppointmentRequest(patientId, requestData)

    if (!requestResult.success || !requestResult.data) {
      return { success: false, error: requestResult.error || 'Failed to create appointment request' }
    }

    // Immediately confirm the appointment
    const scheduleData: AppointmentScheduleData = {
      dentistId: user.id,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      notes
    }

    const confirmResult = await confirmAppointmentRequest(
      requestResult.data.id,
      scheduleData,
      user.id
    )

    if (confirmResult.success) {
      revalidatePath('/dentist')
      revalidatePath('/assistant')
      revalidatePath('/patient')
    }

    return confirmResult
  } catch (error) {
    console.error('Error booking appointment as dentist:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to book appointment'
    }
  }
}

// Update appointment status (start, complete, etc.)
export async function updateDentistAppointmentStatus(
  appointmentId: string,
  newStatus: string,
  notes?: string
) {
  const supabase = await createClient()

  try {
    // Get current user (dentist)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const result = await updateAppointmentStatus(appointmentId, newStatus, user.id, notes)

    if (result.success) {
      revalidatePath('/dentist')
      revalidatePath('/assistant')
      revalidatePath('/patient')
    }

    return result
  } catch (error) {
    console.error('Error updating appointment status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update appointment status'
    }
  }
}

// Cancel appointment as dentist
export async function dentistCancelAppointment(
  appointmentId: string,
  reason: string
) {
  const supabase = await createClient()

  try {
    // Get current user (dentist)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const result = await cancelAppointment(appointmentId, user.id, reason, 'staff')

    if (result.success) {
      revalidatePath('/dentist')
      revalidatePath('/assistant')
      revalidatePath('/patient')
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

// Get available time slots for dentist's calendar
export async function getDentistAvailableSlots(
  startDate: string,
  endDate: string,
  durationMinutes?: number
) {
  const supabase = await createClient()

  try {
    // Get current user (dentist)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const result = await getAvailableTimeSlots(startDate, endDate, durationMinutes, user.id)
    return result
  } catch (error) {
    console.error('Error getting available slots:', error)
    return { success: false, error: 'Failed to fetch available time slots' }
  }
}

// Get patients for dentist booking
export async function getPatientsForBooking() {
  try {
    const patients = await getActivePatients()
    return { success: true, data: patients }
  } catch (error) {
    console.error('Error getting patients:', error)
    return { success: false, error: 'Failed to fetch patients' }
  }
}

// Create a new patient record (staff-created). This does NOT create an auth user.
// Fields map to api.patients columns; unknown/optional fields will be ignored by DB if not present.
export async function createNewPatientAction(formData: FormData) {
  'use server'
  const supabase = await createClient()

  try {
    // Ensure a logged-in dentist or assistant is performing this action
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Basic extraction and validation
    const firstName = (formData.get('firstName') as string || '').trim()
    const lastName = (formData.get('lastName') as string || '').trim()
    const email = (formData.get('email') as string || '').trim() || null
    const phone = (formData.get('phone') as string || '').trim() || null
    const dateOfBirth = (formData.get('dateOfBirth') as string || '').trim() || null
    const emergencyContactName = (formData.get('emergencyContactName') as string || '').trim() || null
    const emergencyContactPhone = (formData.get('emergencyContactPhone') as string || '').trim() || null
    const medicalHistorySummary = (formData.get('medicalHistorySummary') as string || '').trim() || null

    if (!firstName || !lastName) {
      return { success: false, error: 'First and last name are required' }
    }

    const serviceSupabase = await createServiceClient()

    const id = randomUUID()
    const payload: Record<string, any> = {
      id,
      first_name: firstName,
      last_name: lastName,
      medical_history_summary: medicalHistorySummary,
    }
    if (email) payload.email = email
    if (phone) payload.phone = phone
    if (dateOfBirth) payload.date_of_birth = dateOfBirth
    if (emergencyContactName) payload.emergency_contact_name = emergencyContactName
    if (emergencyContactPhone) payload.emergency_contact_phone = emergencyContactPhone

    const { data, error } = await serviceSupabase
      .schema('api')
      .from('patients')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('Failed to create patient:', error)
      return { success: false, error: error.message }
    }

    // Revalidate dashboards
    revalidatePath('/dentist')
    revalidatePath('/assistant')

    return { success: true, data }
  } catch (error) {
    console.error('Unexpected error creating patient:', error)
    return { success: false, error: 'Unexpected error creating patient' }
  }
}

// Mark patient as no-show
export async function markPatientNoShow(appointmentId: string, notes?: string) {
  return updateDentistAppointmentStatus(appointmentId, 'no_show', notes || 'Patient did not show up for appointment')
}

// Reschedule appointment from dentist side
export async function dentistRescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime: string,
  reason: string
) {
  const supabase = await createClient()

  try {
    // Get current user (dentist)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // First get the appointment details
    const serviceSupabase = await createServiceClient()
    const { data: appointment, error: apptError } = await serviceSupabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('dentist_id', user.id)
      .single()

    if (apptError || !appointment) {
      return { success: false, error: 'Appointment not found' }
    }

    // Cancel the current appointment
    const cancelResult = await cancelAppointment(
      appointmentId,
      user.id,
      `Rescheduled by dentist to ${newDate} at ${newTime}. Reason: ${reason}`,
      'staff'
    )

    if (!cancelResult.success) {
      return { success: false, error: 'Failed to cancel original appointment' }
    }

    // Create a new appointment request for the new time
    const requestData: AppointmentRequestData = {
      chiefComplaint: appointment.appointment_type,
      painLevel: 0,
      urgency: 'routine',
      preferredDate: newDate,
      preferredTime: newTime,
      additionalNotes: `Rescheduled by dentist from ${appointment.scheduled_date} at ${appointment.scheduled_time}. Reason: ${reason}`
    }

    const requestResult = await createAppointmentRequest(appointment.patient_id, requestData)

    if (!requestResult.success || !requestResult.data) {
      return { success: false, error: 'Failed to create new appointment request' }
    }

    // Immediately confirm the new appointment
    const scheduleData: AppointmentScheduleData = {
      dentistId: user.id,
      scheduledDate: newDate,
      scheduledTime: newTime,
      durationMinutes: appointment.duration_minutes,
      notes: appointment.notes || ''
    }

    const confirmResult = await confirmAppointmentRequest(
      requestResult.data.id,
      scheduleData,
      user.id
    )

    if (confirmResult.success) {
      revalidatePath('/dentist')
      revalidatePath('/assistant')
      revalidatePath('/patient')
    }

    return confirmResult
  } catch (error) {
    console.error('Error rescheduling appointment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reschedule appointment'
    }
  }
}

/**
 * Delete a patient from the database (hard delete)
 * This will cascade delete all related records:
 * - Consultations
 * - Treatments
 * - Tooth diagnoses
 * - Appointments
 * - Patient files
 * - Messages
 * - Notifications
 */
export async function deletePatientAction(patientId: string) {
  const supabase = await createClient()

  try {
    // Verify dentist authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user is a dentist
    const serviceSupabase = await createServiceClient()
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'dentist') {
      return { success: false, error: 'Only dentists can delete patients' }
    }

    // First delete from profiles (this will cascade to api.patients via foreign key)
    const { error: profileDeleteError } = await serviceSupabase
      .from('profiles')
      .delete()
      .eq('id', patientId)

    if (profileDeleteError) {
      console.error('Error deleting patient profile:', profileDeleteError)
      return {
        success: false,
        error: `Failed to delete patient: ${profileDeleteError.message}`
      }
    }

    // Delete from auth.users (final cleanup)
    // Note: This requires service role key
    const { error: authDeleteError } = await serviceSupabase.auth.admin.deleteUser(patientId)

    if (authDeleteError) {
      console.warn('Warning: Failed to delete auth user (profile deleted):', authDeleteError.message)
      // Continue anyway - profile is deleted which is the main goal
    }

    console.log('✅ [DELETE PATIENT] Successfully deleted patient:', patientId)

    // Revalidate all dashboards
    revalidatePath('/dentist')
    revalidatePath('/assistant')
    revalidatePath('/patient')

    return {
      success: true,
      message: 'Patient and all related records deleted successfully'
    }
  } catch (error) {
    console.error('Error deleting patient:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete patient'
    }
  }
}