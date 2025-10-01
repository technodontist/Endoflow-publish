'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import {
  AppointmentRequest,
  Appointment,
  NewAppointmentRequest,
  NewAppointment,
  NewNotification,
  Dentist
} from '@/lib/db/schema';
import { createNotification } from '@/lib/db/queries';
import {
  AppointmentRequestData,
  AppointmentScheduleData,
  AppointmentConflict,
  TimeSlot,
  AppointmentAvailability,
  APPOINTMENT_STATUS,
  URGENCY_LEVELS
} from '@/lib/types/appointments';
import { updateTreatmentsForAppointmentStatusAction, linkAppointmentToTreatmentAction } from '@/lib/actions/treatments';

// Re-export types for convenience
export type {
  AppointmentRequestData,
  AppointmentScheduleData,
  AppointmentConflict,
  TimeSlot,
  AppointmentAvailability
} from '@/lib/types/appointments';

/**
 * Enhanced Appointment Service Functions
 * Provides comprehensive appointment management with validation,
 * conflict detection, and real-time notifications
 */

// Helper function to get Supabase client
async function getSupabase() {
  return await createServiceClient();
}

/**
 * Create a new appointment request with validation
 */
export async function createAppointmentRequest(
  patientId: string,
  requestData: AppointmentRequestData
): Promise<{ success: boolean; data?: AppointmentRequest; error?: string }> {
  try {
    const supabase = await getSupabase();

    // Validate request data
    const validation = validateAppointmentRequest(requestData);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Check for existing pending requests from same patient
    const { data: existingRequests, error: checkError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('id, created_at')
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (checkError) {
      console.error('Error checking existing requests:', checkError);
      return { success: false, error: 'Failed to validate request' };
    }

    // Limit to one pending request per patient per day for routine appointments
    if (existingRequests && existingRequests.length > 0 && requestData.urgency === 'routine') {
      return {
        success: false,
        error: 'You already have a pending appointment request. Please wait for confirmation or contact us for urgent needs.'
      };
    }

    // Create the appointment request
    const { data: newRequest, error: insertError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert({
        patient_id: patientId,
        appointment_type: requestData.chiefComplaint,
        reason_for_visit: requestData.chiefComplaint,
        pain_level: requestData.painLevel,
        preferred_date: requestData.preferredDate,
        preferred_time: requestData.preferredTime,
        additional_notes: requestData.additionalNotes || '',
        status: 'pending',
        notification_sent: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating appointment request:', insertError);
      return { success: false, error: 'Failed to create appointment request' };
    }

    // Create notification for assistants based on urgency
    await notifyStaffOfNewRequest(newRequest, requestData.urgency);

    // Revalidate relevant pages
    revalidatePath('/patient');
    revalidatePath('/assistant');
    revalidatePath('/dentist');

    return { success: true, data: newRequest };
  } catch (error) {
    console.error('Exception in createAppointmentRequest:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get available time slots for appointment scheduling
 */
export async function getAvailableTimeSlots(
  startDate: string,
  endDate: string,
  durationMinutes: number = 60,
  dentistId?: string
): Promise<{ success: boolean; data?: AppointmentAvailability[]; error?: string }> {
  try {
    const supabase = await getSupabase();

    // Get all dentists if none specified
    let dentistIds: string[] = [];
    if (dentistId) {
      dentistIds = [dentistId];
    } else {
      const { data: dentists, error: dentistError } = await supabase
        .schema('api')
        .from('dentists')
        .select('id');

      if (dentistError) {
        return { success: false, error: 'Failed to fetch dentists' };
      }

      dentistIds = dentists?.map(d => d.id) || [];

      // If no dentists found, provide mock dentist data for development
      if (dentistIds.length === 0) {
        dentistIds = ['mock-dentist-1', 'mock-dentist-2'];
      }
    }

    // Get existing appointments in date range
    let existingAppointments: any[] = [];

    // Only query real dentists, not mock ones
    const realDentistIds = dentistIds.filter(id => !id.startsWith('mock-'));

    if (realDentistIds.length > 0) {
      const { data: appointments, error: apptError } = await supabase
        .schema('api')
        .from('appointments')
        .select('*')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .in('dentist_id', realDentistIds)
        .in('status', ['scheduled', 'in_progress']);

      if (apptError) {
        console.error('Error fetching existing appointments:', apptError);
        // Don't fail completely - continue with empty appointments for mock dentists
      } else {
        existingAppointments = appointments || [];
      }
    }

    // Generate available time slots
    const availability = await generateAvailabilitySlots(
      startDate,
      endDate,
      dentistIds,
      existingAppointments,
      durationMinutes
    );

    return { success: true, data: availability };
  } catch (error) {
    console.error('Exception in getAvailableTimeSlots:', error);
    return { success: false, error: 'Failed to fetch availability' };
  }
}

/**
 * Confirm an appointment request and schedule it
 */
export async function confirmAppointmentRequest(
  requestId: string,
  scheduleData: AppointmentScheduleData,
  confirmedBy: string
): Promise<{ success: boolean; data?: Appointment; error?: string; conflicts?: AppointmentConflict[] }> {
  try {
    const supabase = await getSupabase();

    // Get the appointment request
    const { data: request, error: requestError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return { success: false, error: 'Appointment request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Appointment request is no longer pending' };
    }

    // Check for scheduling conflicts
    const conflicts = await checkSchedulingConflicts(scheduleData);
    if (conflicts.length > 0) {
      return { success: false, conflicts, error: 'Scheduling conflict detected' };
    }

    // Create the confirmed appointment
    const { data: appointment, error: apptError } = await supabase
      .schema('api')
      .from('appointments')
      .insert({
        patient_id: request.patient_id,
        dentist_id: scheduleData.dentistId,
        assistant_id: scheduleData.assistantId,
        appointment_request_id: requestId,
        scheduled_date: scheduleData.scheduledDate,
        scheduled_time: scheduleData.scheduledTime,
        duration_minutes: scheduleData.durationMinutes || 60,
        appointment_type: request.appointment_type,
        status: 'scheduled',
        notes: scheduleData.notes
      })
      .select()
      .single();

    if (apptError) {
      console.error('Error creating appointment:', apptError);
      return { success: false, error: 'Failed to create appointment' };
    }

    // Update the request status
    const { error: updateError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .update({
        status: 'confirmed',
        assigned_to: confirmedBy
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating request status:', updateError);
      // Continue - appointment was created successfully
    }

    // Send notifications
    await notifyAppointmentConfirmed(appointment, request);

    // Revalidate pages
    revalidatePath('/patient');
    revalidatePath('/assistant');
    revalidatePath('/dentist');

    return { success: true, data: appointment };
  } catch (error) {
    console.error('Exception in confirmAppointmentRequest:', error);
    return { success: false, error: 'Failed to confirm appointment' };
  }
}

/**
 * Update appointment status with workflow validation
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: string,
  updatedBy: string,
  notes?: string
): Promise<{ success: boolean; data?: Appointment; error?: string }> {
  try {
    const supabase = await getSupabase();

    // Get current appointment
    const { data: appointment, error: fetchError } = await supabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    // Validate status transition
    const isValidTransition = validateStatusTransition(appointment.status, newStatus);
    if (!isValidTransition) {
      return {
        success: false,
        error: `Invalid status transition from ${appointment.status} to ${newStatus}`
      };
    }

    // If starting and no treatment linked yet, auto-create one so downstream sync works
    if (newStatus === 'in_progress') {
      try {
        const { data: existing } = await supabase
          .schema('api')
          .from('treatments')
          .select('id')
          .eq('appointment_id', appointmentId)
          .limit(1)
        if (!existing || existing.length === 0) {
          await linkAppointmentToTreatmentAction({
            appointmentId,
            treatmentType: (appointment as any).appointment_type || 'Treatment',
            totalVisits: 1
          })
        }
      } catch (e) {
        console.warn('[APPOINTMENTS] Auto-create treatment warning:', e)
      }
    }

    // Update appointment
    const updateData: Partial<Appointment> = {
      status: newStatus as any,
      updated_at: new Date().toISOString()
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data: updatedAppointment, error: updateError } = await supabase
      .schema('api')
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating appointment status:', updateError);
      return { success: false, error: 'Failed to update appointment status' };
    }

    // Send status change notifications
    await notifyStatusChange(updatedAppointment, updatedBy);

    // Update linked treatments based on new appointment status (best-effort)
    try {
      if (['in_progress', 'completed', 'cancelled'].includes(newStatus)) {
        await updateTreatmentsForAppointmentStatusAction(appointmentId, newStatus as any)
      }
    } catch (e) {
      console.warn('[APPOINTMENTS] Treatment status sync warning:', e)
    }

    // Revalidate pages
    revalidatePath('/patient');
    revalidatePath('/assistant');
    revalidatePath('/dentist');

    return { success: true, data: updatedAppointment };
  } catch (error) {
    console.error('Exception in updateAppointmentStatus:', error);
    return { success: false, error: 'Failed to update appointment status' };
  }
}

/**
 * Cancel appointment with reason
 */
export async function cancelAppointment(
  appointmentId: string,
  cancelledBy: string,
  reason: string,
  cancellationType: 'patient' | 'staff' | 'system' = 'patient'
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await updateAppointmentStatus(
      appointmentId,
      APPOINTMENT_STATUS.CANCELLED,
      cancelledBy,
      `Cancelled by ${cancellationType}: ${reason}`
    );

    if (result.success && result.data) {
      // Send cancellation notifications
      await notifyAppointmentCancelled(result.data, cancelledBy, reason);
    }

    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('Exception in cancelAppointment:', error);
    return { success: false, error: 'Failed to cancel appointment' };
  }
}

/**
 * Helper functions
 */

function validateAppointmentRequest(data: AppointmentRequestData): { isValid: boolean; error?: string } {
  if (!data.chiefComplaint?.trim()) {
    return { isValid: false, error: 'Chief complaint is required' };
  }

  if (data.painLevel < 0 || data.painLevel > 10) {
    return { isValid: false, error: 'Pain level must be between 0 and 10' };
  }

  if (!data.preferredDate) {
    return { isValid: false, error: 'Preferred date is required' };
  }

  const requestDate = new Date(data.preferredDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (requestDate < today) {
    return { isValid: false, error: 'Preferred date cannot be in the past' };
  }

  // Check if date is too far in the future (e.g., 6 months)
  const maxFutureDate = new Date();
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 6);
  if (requestDate > maxFutureDate) {
    return { isValid: false, error: 'Preferred date is too far in the future' };
  }

  return { isValid: true };
}

async function generateAvailabilitySlots(
  startDate: string,
  endDate: string,
  dentistIds: string[],
  existingAppointments: Appointment[],
  durationMinutes: number
): Promise<AppointmentAvailability[]> {
  const availability: AppointmentAvailability[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get dentist information
  const supabase = await getSupabase();
  const { data: dentists } = await supabase
    .schema('api')
    .from('dentists')
    .select('id, full_name')
    .in('id', dentistIds.filter(id => !id.startsWith('mock-')));

  const dentistMap = new Map(dentists?.map(d => [d.id, d.full_name]) || []);

  // Add mock dentist names for development
  dentistMap.set('mock-dentist-1', 'Dr. Sarah Johnson');
  dentistMap.set('mock-dentist-2', 'Dr. Michael Chen');

  // Generate slots for each day
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    const timeSlots: TimeSlot[] = [];

    // Generate time slots (9 AM to 5 PM, 30-minute intervals)
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        // Check availability for each dentist
        for (const dentistId of dentistIds) {
          const isAvailable = !existingAppointments.some(apt =>
            apt.dentist_id === dentistId &&
            apt.scheduled_date === dateStr &&
            timeOverlaps(apt.scheduled_time, timeStr, apt.duration_minutes, durationMinutes)
          );

          timeSlots.push({
            date: dateStr,
            time: timeStr,
            dentistId,
            dentistName: dentistMap.get(dentistId) || 'Unknown',
            available: isAvailable
          });
        }
      }
    }

    availability.push({
      date: dateStr,
      timeSlots
    });
  }

  return availability;
}

function timeOverlaps(existingTime: string, newTime: string, existingDuration: number, newDuration: number): boolean {
  const existing = timeToMinutes(existingTime);
  const newTimeMinutes = timeToMinutes(newTime);

  const existingEnd = existing + existingDuration;
  const newEnd = newTimeMinutes + newDuration;

  return (newTimeMinutes < existingEnd && newEnd > existing);
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

async function checkSchedulingConflicts(scheduleData: AppointmentScheduleData): Promise<AppointmentConflict[]> {
  const supabase = await getSupabase();
  const conflicts: AppointmentConflict[] = [];

  // Check for time conflicts with same dentist
  const { data: conflictingAppointments } = await supabase
    .schema('api')
    .from('appointments')
    .select('*')
    .eq('dentist_id', scheduleData.dentistId)
    .eq('scheduled_date', scheduleData.scheduledDate)
    .in('status', ['scheduled', 'in_progress']);

  if (conflictingAppointments) {
    for (const apt of conflictingAppointments) {
      if (timeOverlaps(
        apt.scheduled_time,
        scheduleData.scheduledTime,
        apt.duration_minutes,
        scheduleData.durationMinutes || 60
      )) {
        conflicts.push({
          conflictType: 'time_overlap',
          conflictingAppointment: apt,
          suggestedAlternatives: [] // Would be populated with alternative time slots
        });
      }
    }
  }

  return conflicts;
}

function validateStatusTransition(currentStatus: string, newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'scheduled': ['in_progress', 'cancelled', 'no_show'],
    'in_progress': ['completed', 'cancelled'],
    'completed': [], // Final state
    'cancelled': [], // Final state
    'no_show': []    // Final state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

async function notifyStaffOfNewRequest(request: AppointmentRequest, urgency: string): Promise<void> {
  const supabase = await getSupabase();

  // Get all assistants to notify
  const { data: assistants } = await supabase
    .schema('api')
    .from('assistants')
    .select('id');

  const notificationType = urgency === 'emergency' ? 'emergency_request' :
                         urgency === 'urgent' ? 'urgent_request' : 'appointment_request';

  const title = urgency === 'emergency' ? '🚨 Emergency Appointment Request' :
                urgency === 'urgent' ? '⚡ Urgent Appointment Request' :
                '📅 New Appointment Request';

  // Notify each assistant
  if (assistants) {
    for (const assistant of assistants) {
      await createNotification(assistant.id, notificationType, {
        title,
        message: `New ${urgency} appointment request needs attention`,
        relatedId: request.id
      });
    }
  }
}

async function notifyAppointmentConfirmed(appointment: Appointment, request: AppointmentRequest): Promise<void> {
  // Notify patient
  await createNotification(appointment.patient_id, 'appointment_confirmed', {
    title: 'Appointment Confirmed',
    message: `Your appointment has been scheduled for ${appointment.scheduled_date} at ${appointment.scheduled_time}`,
    relatedId: appointment.id
  });

  // Notify dentist
  await createNotification(appointment.dentist_id, 'appointment_scheduled', {
    title: 'New Appointment Scheduled',
    message: `New appointment scheduled for ${appointment.scheduled_date} at ${appointment.scheduled_time}`,
    relatedId: appointment.id
  });
}

async function notifyStatusChange(appointment: Appointment, updatedBy: string): Promise<void> {
  const statusMessages = {
    'in_progress': 'Your appointment has started',
    'completed': 'Your appointment has been completed',
    'cancelled': 'Your appointment has been cancelled',
    'no_show': 'Missed appointment recorded'
  };

  const message = statusMessages[appointment.status as keyof typeof statusMessages];
  if (message) {
    await createNotification(appointment.patient_id, `appointment_${appointment.status}`, {
      title: 'Appointment Update',
      message,
      relatedId: appointment.id
    });
  }
}

async function notifyAppointmentCancelled(appointment: Appointment, cancelledBy: string, reason: string): Promise<void> {
  // Notify patient if cancelled by staff
  if (cancelledBy !== appointment.patient_id) {
    await createNotification(appointment.patient_id, 'appointment_cancelled', {
      title: 'Appointment Cancelled',
      message: `Your appointment scheduled for ${appointment.scheduled_date} has been cancelled. Reason: ${reason}`,
      relatedId: appointment.id
    });
  }

  // Notify dentist if cancelled by patient
  if (cancelledBy === appointment.patient_id) {
    await createNotification(appointment.dentist_id, 'appointment_cancelled', {
      title: 'Patient Cancelled Appointment',
      message: `Appointment for ${appointment.scheduled_date} at ${appointment.scheduled_time} has been cancelled by patient`,
      relatedId: appointment.id
    });
  }
}