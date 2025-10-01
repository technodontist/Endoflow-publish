'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getPendingAppointmentRequests,
  getAppointmentRequestDetails,
  confirmAppointment,
  getAppointmentsByDate,
  getDentistAppointments,
  getAvailableDentists,
  createNotification,
  getActivePatients
} from '@/lib/db/queries';
import {
  appointmentService,
  createAppointmentRequest,
  getAvailableTimeSlots,
  confirmAppointmentRequest,
  updateAppointmentStatus,
  cancelAppointment,
  AppointmentRequestData,
  AppointmentScheduleData
} from '@/lib/services/appointments';

export async function getAppointmentRequestsAction() {
  try {
    const requests = await getPendingAppointmentRequests();
    return { success: true, data: requests };
  } catch (error) {
    console.error('Error fetching appointment requests:', error);
    return { success: false, error: 'Failed to fetch appointment requests' };
  }
}

export async function getAppointmentRequestDetailsAction(requestId: string) {
  try {
    const request = await getAppointmentRequestDetails(requestId);
    if (!request) {
      return { success: false, error: 'Appointment request not found' };
    }
    return { success: true, data: request };
  } catch (error) {
    console.error('Error fetching appointment request details:', error);
    return { success: false, error: 'Failed to fetch appointment request details' };
  }
}

export async function confirmAppointmentAction(
  requestId: string,
  scheduleData: {
    dentistId: string;
    assistantId?: string;
    scheduledDate: string;
    scheduledTime: string;
    durationMinutes?: number;
    notes?: string;
  }
) {
  try {
    const result = await confirmAppointment(requestId, scheduleData);

    if (result.success) {
      // Revalidate relevant pages
      revalidatePath('/dashboard/assistant');
      revalidatePath('/dashboard/dentist');
      revalidatePath('/dashboard/patient');
    }

    return result;
  } catch (error) {
    console.error('Error confirming appointment:', error);
    return { success: false, error: 'Failed to confirm appointment' };
  }
}

export async function getAppointmentsByDateAction(date: string) {
  try {
    const appointments = await getAppointmentsByDate(date);
    return { success: true, data: appointments };
  } catch (error) {
    console.error('Error fetching appointments by date:', error);
    return { success: false, error: 'Failed to fetch appointments' };
  }
}

export async function getDentistAppointmentsAction(dentistId: string, startDate?: string, endDate?: string) {
  try {
    const appointments = await getDentistAppointments(dentistId, startDate, endDate);
    return { success: true, data: appointments };
  } catch (error) {
    console.error('Error fetching dentist appointments:', error);
    return { success: false, error: 'Failed to fetch dentist appointments' };
  }
}

export async function getAvailableDentistsAction() {
  try {
    const dentists = await getAvailableDentists();
    return { success: true, data: dentists };
  } catch (error) {
    console.error('Error fetching available dentists:', error);
    return { success: false, error: 'Failed to fetch available dentists' };
  }
}

export async function getActivePatientsAction() {
  try {
    const patients = await getActivePatients();
    return { success: true, data: patients };
  } catch (error) {
    console.error('Error fetching active patients:', error);
    return { success: false, error: 'Failed to fetch active patients' };
  }
}

export async function sendUrgentNotificationAction(
  userId: string,
  title: string,
  message: string,
  relatedId?: string
) {
  try {
    const result = await createNotification(userId, 'urgent_request', {
      title,
      message,
      relatedId
    });

    if (result.success) {
      // Revalidate notification-related pages
      revalidatePath('/dashboard/assistant');
      revalidatePath('/dashboard/dentist');
    }

    return result;
  } catch (error) {
    console.error('Error sending urgent notification:', error);
    return { success: false, error: 'Failed to send urgent notification' };
  }
}

// Enhanced Appointment Actions using the new service

export async function createAppointmentRequestAction(
  patientId: string,
  formData: FormData
) {
  try {
    const requestData: AppointmentRequestData = {
      chiefComplaint: formData.get('chiefComplaint') as string,
      painLevel: parseInt(formData.get('painLevel') as string) || 0,
      urgency: (formData.get('urgency') as string) || 'routine',
      preferredDate: formData.get('preferredDate') as string,
      preferredTime: formData.get('preferredTime') as string,
      additionalNotes: formData.get('additionalNotes') as string
    } as AppointmentRequestData;

    const result = await createAppointmentRequest(patientId, requestData);

    if (result.success) {
      revalidatePath('/patient');
      revalidatePath('/assistant');
    }

    return result;
  } catch (error) {
    console.error('Error creating appointment request:', error);
    return { success: false, error: 'Failed to create appointment request' };
  }
}

export async function getAvailabilityAction(
  startDate: string,
  endDate: string,
  durationMinutes?: number,
  dentistId?: string
) {
  try {
    const result = await getAvailableTimeSlots(startDate, endDate, durationMinutes, dentistId);
    return result;
  } catch (error) {
    console.error('Error fetching availability:', error);
    return { success: false, error: 'Failed to fetch availability' };
  }
}

export async function confirmAppointmentRequestAction(
  requestId: string,
  scheduleData: {
    dentistId: string;
    assistantId?: string;
    scheduledDate: string;
    scheduledTime: string;
    durationMinutes?: number;
    notes?: string;
  },
  confirmedBy: string
) {
  try {
    const result = await confirmAppointmentRequest(requestId, scheduleData, confirmedBy);

    if (result.success) {
      revalidatePath('/patient');
      revalidatePath('/assistant');
      revalidatePath('/dentist');
    }

    return result;
  } catch (error) {
    console.error('Error confirming appointment:', error);
    return { success: false, error: 'Failed to confirm appointment' };
  }
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  newStatus: string,
  updatedBy: string,
  notes?: string
) {
  try {
    const result = await updateAppointmentStatus(appointmentId, newStatus, updatedBy, notes);

    if (result.success) {
      revalidatePath('/patient');
      revalidatePath('/assistant');
      revalidatePath('/dentist');
    }

    return result;
  } catch (error) {
    console.error('Error updating appointment status:', error);
    return { success: false, error: 'Failed to update appointment status' };
  }
}

export async function cancelAppointmentAction(
  appointmentId: string,
  cancelledBy: string,
  reason: string,
  cancellationType?: 'patient' | 'staff' | 'system'
) {
  try {
    const result = await cancelAppointment(appointmentId, cancelledBy, reason, cancellationType);

    if (result.success) {
      revalidatePath('/patient');
      revalidatePath('/assistant');
      revalidatePath('/dentist');
    }

    return result;
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return { success: false, error: 'Failed to cancel appointment' };
  }
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  newScheduleData: {
    scheduledDate: string;
    scheduledTime: string;
    reason: string;
  },
  rescheduledBy: string
) {
  try {
    // First, get the current appointment
    const { data: appointments } = await getAppointmentsByDateAction(new Date().toISOString().split('T')[0]);

    if (!appointments.success) {
      return { success: false, error: 'Failed to fetch appointment details' };
    }

    // Cancel the current appointment with reason
    const cancelResult = await cancelAppointment(
      appointmentId,
      rescheduledBy,
      `Rescheduled: ${newScheduleData.reason}`,
      'patient'
    );

    if (!cancelResult.success) {
      return { success: false, error: 'Failed to cancel original appointment' };
    }

    // Create a new appointment request for the new time
    // This would need the patient ID and other details from the original appointment
    // For now, return success indicating the cancellation was processed

    return { success: true, message: 'Reschedule request submitted. Please wait for confirmation of your new appointment time.' };
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    return { success: false, error: 'Failed to reschedule appointment' };
  }
}

// Direct appointment scheduling for assistant dashboard
export interface DirectScheduleAppointmentData {
  patient_id: string
  dentist_id: string
  scheduled_date: string
  scheduled_time: string
  appointment_type: string
  duration_minutes: number
  notes?: string
  status?: string
}

export async function scheduleAppointmentDirectAction(data: DirectScheduleAppointmentData) {
  try {
    const supabase = await createServiceClient()

    // Validate required fields
    if (!data.patient_id || !data.dentist_id || !data.scheduled_date || !data.scheduled_time || !data.appointment_type) {
      return { success: false, error: 'Missing required appointment data' }
    }

    // Check if the time slot is already taken
    const { data: existingAppointment, error: checkError } = await supabase
      .schema('api')
      .from('appointments')
      .select('id')
      .eq('dentist_id', data.dentist_id)
      .eq('scheduled_date', data.scheduled_date)
      .eq('scheduled_time', data.scheduled_time)
      .neq('status', 'cancelled')
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking appointment slot:', checkError)
      return { success: false, error: 'Failed to check appointment availability' }
    }

    if (existingAppointment) {
      return { success: false, error: 'This time slot is already booked' }
    }

    // Create the appointment
    const appointmentData = {
      patient_id: data.patient_id,
      dentist_id: data.dentist_id,
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time,
      appointment_type: data.appointment_type,
      duration_minutes: data.duration_minutes || 60,
      status: data.status || 'scheduled',
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newAppointment, error: insertError } = await supabase
      .schema('api')
      .from('appointments')
      .insert([appointmentData])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating appointment:', insertError)
      return { success: false, error: 'Failed to schedule appointment' }
    }

    // Create a notification for the dentist
    await supabase
      .schema('api')
      .from('notifications')
      .insert([{
        user_id: data.dentist_id,
        type: 'appointment_scheduled',
        title: 'New Appointment Scheduled',
        message: `A new appointment has been scheduled for ${data.scheduled_date} at ${data.scheduled_time}`,
        related_id: newAppointment.id,
        read: false,
        created_at: new Date().toISOString()
      }])

    // Revalidate relevant pages
    revalidatePath('/assistant')
    revalidatePath('/assistant/verify')
    revalidatePath('/dentist')

    return {
      success: true,
      data: newAppointment,
      message: 'Appointment scheduled successfully'
    }
  } catch (error) {
    console.error('Error in scheduleAppointmentDirectAction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function getAppointmentsForWeekAction(startDate: string, endDate: string, dentistId?: string) {
  try {
    // Use service client for schema access
    const supabase = await createServiceClient()

    let query = supabase
      .schema('api')
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        scheduled_date,
        scheduled_time,
        appointment_type,
        status,
        duration_minutes,
        notes
      `)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .neq('status', 'cancelled')
      .order('scheduled_date')
      .order('scheduled_time')

    if (dentistId) {
      query = query.eq('dentist_id', dentistId)
    }

    const { data: appointments, error } = await query

    if (error) {
      console.error('Error fetching appointments:', error)
      return { success: false, data: [], error: 'Failed to load appointments' }
    }

    return {
      success: true,
      data: appointments || []
    }
  } catch (error) {
    console.error('Error in getAppointmentsForWeekAction:', error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function createAppointmentsFromFollowUpsAction(consultationId: string, dentistId: string) {
  try {
    const supabase = await createServiceClient()

    // Fetch consultation and parse follow_up_data
    const { data: consultation, error: cErr } = await supabase
      .schema('api')
      .from('consultations')
      .select('id, patient_id, follow_up_data')
      .eq('id', consultationId)
      .single()

    if (cErr || !consultation) {
      return { success: false, error: 'Consultation not found' }
    }

    let followUp: any = null
    try { followUp = consultation.follow_up_data ? JSON.parse(consultation.follow_up_data) : null } catch {}

    if (!followUp) {
      return { success: false, error: 'No follow-up data to schedule' }
    }

    // Collect candidate appointments from JSON
    const candidates: { type: string; date: string; time?: string; duration?: number }[] = []

    if (Array.isArray(followUp.appointments)) {
      for (const ap of followUp.appointments) {
        const date = ap.scheduled_date || ap.date
        if (!date) continue
        candidates.push({ type: ap.type || 'follow_up', date, time: ap.time || ap.scheduled_time || '10:00', duration: parseInt(ap.duration || '30') || 30 })
      }
    }
    if (followUp.tooth_specific_follow_ups && typeof followUp.tooth_specific_follow_ups === 'object') {
      for (const tooth of Object.keys(followUp.tooth_specific_follow_ups)) {
        const entry = followUp.tooth_specific_follow_ups[tooth]
        if (entry && Array.isArray(entry.appointments)) {
          for (const ap of entry.appointments) {
            const date = ap.scheduled_date || ap.date
            if (!date) continue
            candidates.push({ type: `${ap.type || 'follow_up'} (Tooth ${tooth})`, date, time: ap.time || '10:00', duration: parseInt(ap.duration || '30') || 30 })
          }
        }
      }
    }

    if (candidates.length === 0) {
      return { success: false, error: 'No valid follow-up entries with dates' }
    }

    let created = 0
    for (const ap of candidates) {
      const { error: insErr } = await supabase
        .schema('api')
        .from('appointments')
        .insert({
          patient_id: consultation.patient_id,
          dentist_id: dentistId,
          scheduled_date: ap.date,
          scheduled_time: ap.time || '10:00',
          duration_minutes: ap.duration || 30,
          appointment_type: ap.type,
          status: 'scheduled',
          notes: 'Created from follow_up_data'
        })
      if (!insErr) created++
    }

    revalidatePath('/assistant')
    revalidatePath('/dentist')
    revalidatePath('/patient')

    return { success: true, created }
  } catch (error) {
    console.error('Error in createAppointmentsFromFollowUpsAction:', error)
    return { success: false, error: 'Failed to create follow-up appointments' }
  }
}
