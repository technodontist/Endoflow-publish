// Database queries for ENDOFLOW
import { eq } from 'drizzle-orm';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { profiles, patients, assistants, dentists, pendingRegistrations, appointmentRequests, appointments, notifications, type Profile, type Patient, type Assistant, type Dentist, type PendingRegistration, type AppointmentRequest, type Appointment, type Notification, type NewAppointmentRequest, type NewAppointment, type NewNotification } from './schema';

export async function getUserByRole(id: string, role: 'patient' | 'assistant' | 'dentist'): Promise<any | null> {
  const supabase = await createClient();

  try {
    const tableName = role === 'patient' ? 'patients' : role === 'assistant' ? 'assistants' : 'dentists';
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user by role:', error);
    return null;
  }
}

export async function getPendingPatients(): Promise<any[]> {
  // FIXED: Only get patients who self-registered and are truly pending approval
  // Manually registered patients (created by staff) should NEVER appear here
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching self-registered pending patients only...');

    // STEP 1: Get patients who self-registered and are pending
    // These are patients who have profiles with status='pending' but also have
    // corresponding entries in pending_registrations table (self-registration)
    const { data: pendingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .eq('role', 'patient')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (profilesError) {
      console.error('❌ [DB] Error fetching pending profiles:', profilesError?.message || 'Unknown error');
      return [];
    }

    if (!pendingProfiles || pendingProfiles.length === 0) {
      console.log('✅ [DB] No pending patient profiles found');
      return [];
    }

    console.log('🔍 [DB] Found', pendingProfiles.length, 'pending profiles, filtering for self-registrations...');

    // STEP 2: Filter to only include patients who have corresponding pending_registrations
    // This excludes manually registered patients (who have pending profiles but no pending_registrations)
    const pendingProfileIds = pendingProfiles.map(p => p.id);

    const { data: pendingRegistrations, error: registrationsError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .select('user_id, id, submitted_at')
      .in('user_id', pendingProfileIds)
      .eq('status', 'pending');

    if (registrationsError) {
      console.error('❌ [DB] Error fetching pending registrations:', registrationsError?.message || 'Unknown error');
      return [];
    }

    // STEP 3: Only return profiles that have corresponding pending registrations (self-registered)
    const selfRegisteredPendingIds = new Set(pendingRegistrations?.map(reg => reg.user_id) || []);

    const selfRegisteredPendingPatients = pendingProfiles.filter(profile =>
      selfRegisteredPendingIds.has(profile.id)
    );

    console.log('✅ [DB] Filtered to', selfRegisteredPendingPatients.length, 'self-registered pending patients');
    console.log('🔍 [DB] Excluded', pendingProfiles.length - selfRegisteredPendingPatients.length, 'manually registered patients');

    return selfRegisteredPendingPatients || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching pending patients:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return [];
  }
}

export async function getPendingRegistrations(): Promise<PendingRegistration[]> {
  // Use service role to bypass RLS
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching pending registrations...');

    const { data: registrations, error } = await supabase
      .schema('api')
      .from('pending_registrations')
      .select('*')
      .eq('status', 'pending')
      .not('form_data', 'is', null) // Filter out null formData
      .neq('form_data', '') // Filter out empty formData
      .neq('form_data', 'undefined') // Filter out literal 'undefined' strings
      .neq('form_data', 'null') // Filter out literal 'null' strings
      .order('submitted_at', { ascending: true });

    if (error) {
      console.error('❌ [DB] Error fetching pending registrations:', error);
      return [];
    }

    if (!registrations || registrations.length === 0) {
      console.log('✅ [DB] No pending registrations found');
      return [];
    }

    console.log('✅ [DB] Successfully fetched pending registrations:', registrations.length);
    return registrations;
  } catch (error) {
    console.error('❌ [DB] Exception fetching pending registrations:', error);
    return [];
  }
}

export async function getActivePatients(): Promise<Patient[]> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    const { data, error } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active patients:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching active patients:', error);
    return [];
  }
}

export async function getPendingRegistrationById(id: string): Promise<PendingRegistration | null> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Attempting to fetch pending registration by ID:', id);

    const { data, error } = await supabase
      .schema('api')
      .from('pending_registrations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ [DB] Supabase error fetching pending registration by ID:', {
        id,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return null;
    }

    if (!data) {
      console.log('⚠️ [DB] No pending registration found for ID:', id);
      return null;
    }

    console.log('✅ [DB] Successfully fetched pending registration by ID:', id);
    return data;
  } catch (error) {
    console.error('❌ [DB] Exception fetching pending registration by ID:', {
      id,
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

// Legacy function for backward compatibility - redirects to pending registrations
export async function getUserProfile(id: string): Promise<any | null> {
  return getPendingRegistrationById(id);
}

// Helper function to get user role
export async function getUserRole(userId: string): Promise<string | null> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DEBUG] Starting role lookup for user ID:', userId);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('🚨 [DEBUG] Error querying profiles table:', error);
      }
      return null;
    }

    if (!profile) {
      console.log('❌ [DEBUG] No profile found for user ID:', userId);
      return null;
    }

    if (profile.status !== 'active' && profile.status !== 'pending') {
      console.log('❌ [DEBUG] User profile is not active:', profile.status);
      return null;
    }

    console.log('✅ [DEBUG] Found user role:', profile.role);
    return profile.role;
  } catch (error) {
    console.error('❌ [DEBUG] Exception getting user role:', error);
    return null;
  }
}

export async function approvePatient(patientId: string): Promise<{ success: boolean; error?: string }> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Attempting to approve patient:', patientId);

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', patientId)
      .eq('role', 'patient')
      .eq('status', 'pending');

    if (error) {
      console.error('❌ [DB] Error approving patient:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Patient approved successfully:', patientId);
    return { success: true };
  } catch (error) {
    console.error('❌ [DB] Exception approving patient:', error);
    return { success: false, error: 'Failed to approve patient' };
  }
}

export async function rejectPatient(patientId: string): Promise<{ success: boolean; error?: string }> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [DB] Attempting to reject patient:', patientId)

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'inactive' })
      .eq('id', patientId)
      .eq('role', 'patient')
      .eq('status', 'pending')

    if (error) {
      console.error('❌ [DB] Error rejecting patient:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ [DB] Patient rejected successfully:', patientId)
    return { success: true }
  } catch (error) {
    console.error('❌ [DB] Exception rejecting patient:', error)
    return { success: false, error: 'Failed to reject patient' }
  }
}

export async function getPendingAssistants(): Promise<Profile[]> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [DB] Attempting to fetch pending assistants...')

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'assistant')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ [DB] Supabase error fetching pending assistants:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        full_error: error
      })
      return []
    }

    console.log('✅ [DB] Successfully fetched pending assistants:', data?.length || 0)
    return data || []
  } catch (error) {
    console.error('❌ [DB] Exception fetching pending assistants:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return []
  }
}

export async function approveAssistant(assistantId: string): Promise<{ success: boolean; error?: string }> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [DB] Attempting to approve assistant:', assistantId)

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', assistantId)
      .eq('role', 'assistant')
      .eq('status', 'pending')

    if (error) {
      console.error('❌ [DB] Error approving assistant:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ [DB] Assistant approved successfully:', assistantId)
    return { success: true }
  } catch (error) {
    console.error('❌ [DB] Exception approving assistant:', error)
    return { success: false, error: 'Failed to approve assistant' }
  }
}

export async function rejectAssistant(assistantId: string): Promise<{ success: boolean; error?: string }> {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [DB] Attempting to reject assistant:', assistantId)

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'inactive' })
      .eq('id', assistantId)
      .eq('role', 'assistant')
      .eq('status', 'pending')

    if (error) {
      console.error('❌ [DB] Error rejecting assistant:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ [DB] Assistant rejected successfully:', assistantId)
    return { success: true }
  } catch (error) {
    console.error('❌ [DB] Exception rejecting assistant:', error)
    return { success: false, error: 'Failed to reject assistant' }
  }
}

// Patient-specific queries
export async function getPatientAppointments(patientId: string) {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching appointments for patient:', patientId);

    const { data, error } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        *,
        dentists:dentist_id (
          full_name,
          specialty
        )
      `)
      .eq('patient_id', patientId)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('❌ [DB] Error fetching patient appointments:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched appointments:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching patient appointments:', error);
    return [];
  }
}

export async function getPatientTreatmentHistory(patientId: string) {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching treatment history for patient:', patientId);

    const { data, error } = await supabase
      .schema('api')
      .from('treatments')
      .select(`
        *,
        dentists:dentist_id (
          full_name,
          specialty
        ),
        appointments!treatments_appointment_id_fkey (
          scheduled_date,
          appointment_type
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [DB] Error fetching patient treatment history:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched treatment history:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching patient treatment history:', error);
    return [];
  }
}

export async function getPatientMessages(patientId: string) {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching messages for patient:', patientId);

    const { data, error } = await supabase
      .schema('api')
      .from('messages')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ [DB] Error fetching patient messages:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched messages:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching patient messages:', error);
    return [];
  }
}

export async function createAppointmentBooking(patientId: string, bookingData: {
  chiefComplaint: string;
  painLevel: string;
  urgency: string;
  preferredDate: string;
  preferredTime: string;
  additionalNotes: string;
}) {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Creating appointment booking for patient:', patientId);

    // First, create a pending appointment request
    const { data, error } = await supabase
      .schema('api')
      .from('appointment_requests')
      .insert({
        patient_id: patientId,
        appointment_type: bookingData.chiefComplaint, // Map chiefComplaint to appointment_type
        reason_for_visit: bookingData.chiefComplaint,
        pain_level: parseInt(bookingData.painLevel) || null,
        preferred_date: bookingData.preferredDate,
        preferred_time: bookingData.preferredTime,
        additional_notes: bookingData.additionalNotes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Error creating appointment booking:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully created appointment booking:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ [DB] Exception creating appointment booking:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendPatientMessage(patientId: string, message: string) {
  // TEMPORARY: Use service role to bypass RLS until database fix is applied
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Sending message from patient:', patientId);

    const { data, error } = await supabase
      .schema('api')
      .from('messages')
      .insert({
        patient_id: patientId,
        sender_id: patientId,
        sender_type: 'patient',
        message: message,
        is_from_patient: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Error sending patient message:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully sent patient message:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ [DB] Exception sending patient message:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ======================================
// APPOINTMENT BOOKING WORKFLOW FUNCTIONS
// ======================================

export async function getPendingAppointmentRequests(): Promise<AppointmentRequest[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching pending appointment requests...');

    const { data: requests, error } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ [DB] Error fetching pending appointment requests:', error);
      return [];
    }

    if (!requests || requests.length === 0) {
      console.log('✅ [DB] No pending appointment requests found');
      return [];
    }

    // Manually fetch patient data for each request
    console.log('🔍 [DB] Fetching patient data for', requests.length, 'requests');
    const requestsWithPatients = await Promise.all(
      requests.map(async (request) => {
        const { data: patient, error: patientError } = await supabase
          .schema('api')
          .from('patients')
          .select('id, first_name, last_name')
          .eq('id', request.patient_id)
          .single();

        if (patientError) {
          console.error('❌ [DB] Error fetching patient for request:', request.patient_id, patientError);
          // Return request without patient data if patient fetch fails
          return request;
        }

        return {
          ...request,
          patients: patient
        };
      })
    );

    console.log('✅ [DB] Successfully fetched pending appointment requests:', requestsWithPatients.length);
    return requestsWithPatients;
  } catch (error) {
    console.error('❌ [DB] Exception fetching pending appointment requests:', error);
    return [];
  }
}

export async function getAppointmentRequestDetails(requestId: string): Promise<AppointmentRequest | null> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching appointment request details:', requestId);

    const { data: request, error } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !request) {
      console.error('❌ [DB] Error fetching appointment request details:', error);
      return null;
    }

    // Manually fetch profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', request.patient_id)
      .single();

    const requestWithProfile = {
      ...request,
      profiles: profile || null
    };

    if (profileError) {
      console.error('❌ [DB] Error fetching profile for request:', profileError);
    }

    console.log('✅ [DB] Successfully fetched appointment request details');
    return requestWithProfile;
  } catch (error) {
    console.error('❌ [DB] Exception fetching appointment request details:', error);
    return null;
  }
}

export async function confirmAppointment(
  requestId: string,
  scheduleData: {
    dentistId: string;
    assistantId?: string;
    scheduledDate: string;
    scheduledTime: string;
    durationMinutes?: number;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string; appointmentId?: string }> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Confirming appointment for request:', requestId);

    // First, get the appointment request details
    const { data: request, error: requestError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      console.error('❌ [DB] Error fetching appointment request:', requestError);
      return { success: false, error: 'Appointment request not found' };
    }

    // Create the confirmed appointment
    const { data: appointment, error: appointmentError } = await supabase
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
        notes: scheduleData.notes,
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('❌ [DB] Error creating appointment:', appointmentError);
      return { success: false, error: appointmentError.message };
    }

    // Update the appointment request status
    const { error: updateError } = await supabase
      .schema('api')
      .from('appointment_requests')
      .update({
        status: 'confirmed',
        assigned_to: scheduleData.assistantId
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ [DB] Error updating appointment request:', updateError);
      return { success: false, error: updateError.message };
    }

    // Create notifications for patient and dentist
    await createNotification(request.patient_id, 'appointment_confirmed', {
      title: 'Appointment Confirmed',
      message: `Your appointment has been scheduled for ${scheduleData.scheduledDate} at ${scheduleData.scheduledTime}`,
      relatedId: appointment.id
    });

    await createNotification(scheduleData.dentistId, 'appointment_scheduled', {
      title: 'New Appointment Scheduled',
      message: `New appointment scheduled for ${scheduleData.scheduledDate} at ${scheduleData.scheduledTime}`,
      relatedId: appointment.id
    });

    console.log('✅ [DB] Successfully confirmed appointment:', appointment.id);
    return { success: true, appointmentId: appointment.id };
  } catch (error) {
    console.error('❌ [DB] Exception confirming appointment:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createNotification(
  userId: string,
  type: string,
  notificationData: {
    title: string;
    message: string;
    relatedId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Creating notification for user:', userId);

    const { data, error } = await supabase
      .schema('api')
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title: notificationData.title,
        message: notificationData.message,
        related_id: notificationData.relatedId,
        read: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Error creating notification:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully created notification');
    return { success: true };
  } catch (error) {
    console.error('❌ [DB] Exception creating notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching notifications for user:', userId);

    const { data, error } = await supabase
      .schema('api')
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [DB] Error fetching notifications:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched notifications:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching notifications:', error);
    return [];
  }
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Marking notification as read:', notificationId);

    const { error } = await supabase
      .schema('api')
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('❌ [DB] Error marking notification as read:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully marked notification as read');
    return { success: true };
  } catch (error) {
    console.error('❌ [DB] Exception marking notification as read:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getAppointmentsByDate(date: string): Promise<Appointment[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching appointments for date:', date);

    const { data, error } = await supabase
      .schema('api')
      .from('appointments')
      .select(`
        *,
        patients:patient_id (
          first_name,
          last_name
        ),
        dentists:dentist_id (
          full_name,
          specialty
        ),
        assistants:assistant_id (
          full_name
        )
      `)
      .eq('scheduled_date', date)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ [DB] Error fetching appointments by date:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched appointments for date:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching appointments by date:', error);
    return [];
  }
}

export async function getDentistAppointments(dentistId: string, startDate?: string, endDate?: string): Promise<Appointment[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching appointments for dentist:', dentistId);

    let query = supabase
      .schema('api')
      .from('appointments')
      .select('*')
      .eq('dentist_id', dentistId);

    if (startDate) {
      query = query.gte('scheduled_date', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_date', endDate);
    }

    const { data, error } = await query.order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ [DB] Error fetching dentist appointments:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched dentist appointments:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching dentist appointments:', error);
    return [];
  }
}

export async function getAvailableDentists(): Promise<Dentist[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching available dentists...');

    const { data, error } = await supabase
      .schema('api')
      .from('dentists')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('❌ [DB] Error fetching available dentists:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched available dentists:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching available dentists:', error);
    return [];
  }
}

// ===============================================
// ANALYTICS QUERY FUNCTIONS
// ===============================================

export interface ClinicStatistics {
  totalPatients: number;
  totalPatientsGrowth: number;
  monthlyRevenue: number;
  monthlyRevenueGrowth: number;
  totalAppointments: number;
  appointmentsGrowth: number;
  successRate: number;
  successRateGrowth: number;
}

export interface TreatmentDistribution {
  treatmentType: string;
  count: number;
  percentage: number;
}

export interface PatientDemographics {
  ageGroup: string;
  count: number;
  percentage: number;
}

export async function getClinicStatistics(): Promise<ClinicStatistics | null> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching clinic statistics...');

    // Get current month and last month date ranges
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total Patients
    const { data: totalPatientsData, error: patientsError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('role', 'patient')
      .eq('status', 'active');

    const { data: lastMonthPatientsData } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('role', 'patient')
      .eq('status', 'active')
      .lt('created_at', currentMonthStart.toISOString());

    // Total Appointments this month
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .schema('api')
      .from('appointments')
      .select('id', { count: 'exact' })
      .gte('scheduled_date', currentMonthStart.toISOString().split('T')[0]);

    const { data: lastMonthAppointmentsData } = await supabase
      .schema('api')
      .from('appointments')
      .select('id', { count: 'exact' })
      .gte('scheduled_date', lastMonthStart.toISOString().split('T')[0])
      .lt('scheduled_date', currentMonthStart.toISOString().split('T')[0]);

    // Success Rate (completed appointments)
    const { data: completedAppointmentsData } = await supabase
      .schema('api')
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('status', 'completed')
      .gte('scheduled_date', currentMonthStart.toISOString().split('T')[0]);

    const { data: lastMonthCompletedData } = await supabase
      .schema('api')
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('status', 'completed')
      .gte('scheduled_date', lastMonthStart.toISOString().split('T')[0])
      .lt('scheduled_date', currentMonthStart.toISOString().split('T')[0]);

    // Calculate values
    const totalPatients = totalPatientsData?.length || 0;
    const lastMonthPatients = lastMonthPatientsData?.length || 0;
    const totalPatientsGrowth = lastMonthPatients > 0 ?
      ((totalPatients - lastMonthPatients) / lastMonthPatients) * 100 : 0;

    const totalAppointments = appointmentsData?.length || 0;
    const lastMonthAppointments = lastMonthAppointmentsData?.length || 0;
    const appointmentsGrowth = lastMonthAppointments > 0 ?
      ((totalAppointments - lastMonthAppointments) / lastMonthAppointments) * 100 : 0;

    const completedAppointments = completedAppointmentsData?.length || 0;
    const lastMonthCompleted = lastMonthCompletedData?.length || 0;
    const successRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
    const lastMonthSuccessRate = lastMonthAppointments > 0 ? (lastMonthCompleted / lastMonthAppointments) * 100 : 0;
    const successRateGrowth = lastMonthSuccessRate > 0 ?
      ((successRate - lastMonthSuccessRate) / lastMonthSuccessRate) * 100 : 0;

    // Mock revenue calculation (would need actual pricing data)
    const monthlyRevenue = completedAppointments * 2500; // Average ₹2500 per appointment
    const lastMonthRevenue = lastMonthCompleted * 2500;
    const monthlyRevenueGrowth = lastMonthRevenue > 0 ?
      ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    const statistics: ClinicStatistics = {
      totalPatients,
      totalPatientsGrowth: Math.round(totalPatientsGrowth * 100) / 100,
      monthlyRevenue,
      monthlyRevenueGrowth: Math.round(monthlyRevenueGrowth * 100) / 100,
      totalAppointments,
      appointmentsGrowth: Math.round(appointmentsGrowth * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      successRateGrowth: Math.round(successRateGrowth * 100) / 100,
    };

    console.log('✅ [DB] Successfully calculated clinic statistics:', statistics);
    return statistics;
  } catch (error) {
    console.error('❌ [DB] Exception fetching clinic statistics:', error);
    return null;
  }
}

export async function getTreatmentDistribution(): Promise<TreatmentDistribution[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching treatment distribution...');

    // Get treatment distribution from consultations
    const { data: consultationsData, error } = await supabase
      .schema('api')
      .from('consultations')
      .select('diagnosis, treatment_plan')
      .eq('status', 'completed')
      .not('diagnosis', 'is', null);

    if (error) {
      console.error('❌ [DB] Error fetching consultations for treatment distribution:', error);
      return [];
    }

    // Parse and aggregate treatment data
    const treatmentCounts: { [key: string]: number } = {};
    let totalTreatments = 0;

    consultationsData?.forEach(consultation => {
      try {
        if (consultation.diagnosis) {
          const diagnosisData = typeof consultation.diagnosis === 'string'
            ? JSON.parse(consultation.diagnosis)
            : consultation.diagnosis;

          if (diagnosisData?.primaryDiagnosis) {
            const treatmentType = diagnosisData.primaryDiagnosis;
            treatmentCounts[treatmentType] = (treatmentCounts[treatmentType] || 0) + 1;
            totalTreatments++;
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse diagnosis data:', parseError);
      }
    });

    // Convert to array format with percentages
    const distribution: TreatmentDistribution[] = Object.entries(treatmentCounts)
      .map(([treatmentType, count]) => ({
        treatmentType,
        count,
        percentage: totalTreatments > 0 ? Math.round((count / totalTreatments) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // Top 6 treatments

    // Add fallback data if no treatments found
    if (distribution.length === 0) {
      return [
        { treatmentType: 'Root Canal', count: 45, percentage: 45 },
        { treatmentType: 'Fillings', count: 30, percentage: 30 },
        { treatmentType: 'Cleanings', count: 25, percentage: 25 }
      ];
    }

    console.log('✅ [DB] Successfully fetched treatment distribution:', distribution);
    return distribution;
  } catch (error) {
    console.error('❌ [DB] Exception fetching treatment distribution:', error);
    return [];
  }
}

export async function getPatientDemographics(): Promise<PatientDemographics[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching patient demographics...');

    const { data: patientsData, error } = await supabase
      .schema('api')
      .from('patients')
      .select('date_of_birth')
      .not('date_of_birth', 'is', null);

    if (error) {
      console.error('❌ [DB] Error fetching patients for demographics:', error);
      return [];
    }

    // Calculate age groups
    const ageCounts: { [key: string]: number } = {
      '18-30': 0,
      '31-50': 0,
      '51+': 0
    };

    const currentYear = new Date().getFullYear();

    patientsData?.forEach(patient => {
      if (patient.date_of_birth) {
        const birthYear = new Date(patient.date_of_birth).getFullYear();
        const age = currentYear - birthYear;

        if (age >= 18 && age <= 30) {
          ageCounts['18-30']++;
        } else if (age >= 31 && age <= 50) {
          ageCounts['31-50']++;
        } else if (age > 50) {
          ageCounts['51+']++;
        }
      }
    });

    const totalPatients = Object.values(ageCounts).reduce((sum, count) => sum + count, 0);

    const demographics: PatientDemographics[] = Object.entries(ageCounts)
      .map(([ageGroup, count]) => ({
        ageGroup,
        count,
        percentage: totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0
      }))
      .filter(demo => demo.count > 0);

    // Add fallback data if no demographics found
    if (demographics.length === 0) {
      return [
        { ageGroup: '18-30', count: 25, percentage: 25 },
        { ageGroup: '31-50', count: 40, percentage: 40 },
        { ageGroup: '51+', count: 35, percentage: 35 }
      ];
    }

    console.log('✅ [DB] Successfully fetched patient demographics:', demographics);
    return demographics;
  } catch (error) {
    console.error('❌ [DB] Exception fetching patient demographics:', error);
    return [];
  }
}

// ===============================================
// RESEARCH PROJECTS QUERY FUNCTIONS
// ===============================================

export interface ResearchProjectWithStats {
  id: string;
  name: string;
  description: string;
  status: string;
  totalPatients: number;
  lastAnalysisDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilterRule {
  field: string;
  operator: string;
  value: string;
  valueType?: string;
  logicConnector?: 'AND' | 'OR';
}

export interface CohortPatient {
  anonymousId: string;
  age: number;
  gender: string;
  condition: string;
  outcome: string;
  inclusionDate: string;
}

export interface ResearchAnalyticsData {
  totalPatients: number;
  averageAge: number;
  activeStudies: number;
  ageStats: {
    mean: number;
    mode: number;
    sd: number;
    ci95Lower: number;
    ci95Upper: number;
    min: number;
    max: number;
  };
  ageDistribution: Array<{ range: string; count: number; fill: string }>;
  genderDistribution: Array<{ name: string; value: number; fill: string }>;
  conditionDistribution: Array<{ name: string; value: number; fill: string }>;
  outcomeDistribution: Array<{ name: string; value: number; fill: string }>;
  treatmentComparison: Array<{ treatment: string; successRate: number }>;
  healingTimeComparison: Array<{ protocol: string; avgDays: number }>;
}

export async function getDentistResearchProjects(dentistId: string): Promise<ResearchProjectWithStats[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching research projects for dentist:', dentistId);

    // Try different approaches to access the data
    let data = null;
    let error = null;

    // First try: Direct query
    ({ data, error } = await supabase
      .schema('api')
      .from('research_projects')
      .select('*')
      .eq('dentist_id', dentistId)
      .order('updated_at', { ascending: false }));

    if (error) {
      console.error('❌ [DB] Direct query failed:', error.message);
      console.log('🔄 [DB] Trying alternative query approach...');

      // Second try: Query without dentist filter first, then filter in code
      ({ data, error } = await supabase
        .schema('api')
        .from('research_projects')
        .select('*')
        .order('updated_at', { ascending: false }));

      if (data && !error) {
        // Filter by dentist ID in JavaScript
        data = data.filter((project: any) => project.dentist_id === dentistId);
        console.log('✅ [DB] Alternative query succeeded, filtered to:', data.length, 'projects');
      }
    }

    if (error) {
      console.error('❌ [DB] Both query approaches failed:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched research projects:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching research projects:', error);
    return [];
  }
}

export async function createResearchProject(
  dentistId: string,
  projectData: {
    name: string;
    description: string;
    hypothesis?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    tags?: string[];
    filterCriteria: FilterRule[];
    researchType?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Creating research project for dentist:', dentistId);

    const insertData: any = {
      dentist_id: dentistId,
      name: projectData.name,
      description: projectData.description,
      filter_criteria: JSON.stringify(projectData.filterCriteria),
      status: projectData.status || 'draft'
    };

    // Add optional fields if provided
    if (projectData.hypothesis) insertData.hypothesis = projectData.hypothesis;
    if (projectData.startDate) insertData.start_date = projectData.startDate.toISOString().split('T')[0];
    if (projectData.endDate) insertData.end_date = projectData.endDate.toISOString().split('T')[0];
    if (projectData.tags) insertData.tags = projectData.tags;

    const { data, error } = await supabase
      .schema('api')
      .from('research_projects')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Error creating research project:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully created research project:', data.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ [DB] Exception creating research project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateResearchProject(
  projectId: string,
  updateData: {
    name?: string;
    description?: string;
    hypothesis?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    tags?: string[];
    filterCriteria?: FilterRule[];
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Updating research project:', projectId);

    const updateFields: any = {};
    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.description) updateFields.description = updateData.description;
    if (updateData.hypothesis) updateFields.hypothesis = updateData.hypothesis;
    if (updateData.status) updateFields.status = updateData.status;
    if (updateData.tags) updateFields.tags = updateData.tags;
    if (updateData.startDate) updateFields.start_date = updateData.startDate.toISOString().split('T')[0];
    if (updateData.endDate) updateFields.end_date = updateData.endDate.toISOString().split('T')[0];
    if (updateData.filterCriteria) updateFields.filter_criteria = JSON.stringify(updateData.filterCriteria);
    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .schema('api')
      .from('research_projects')
      .update(updateFields)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Error updating research project:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully updated research project:', projectId);
    return { success: true, data };
  } catch (error) {
    console.error('❌ [DB] Exception updating research project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getResearchProjectById(projectId: string): Promise<any | null> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching research project by ID:', projectId);

    const { data, error } = await supabase
      .schema('api')
      .from('research_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('❌ [DB] Error fetching research project:', error);
      return null;
    }

    console.log('✅ [DB] Successfully fetched research project:', projectId);
    return data;
  } catch (error) {
    console.error('❌ [DB] Exception fetching research project:', error);
    return null;
  }
}

export async function findMatchingPatients(filterCriteria: FilterRule[]): Promise<CohortPatient[]> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Finding matching patients with criteria:', filterCriteria);

    // Fetch patients, consultations, and appointments separately and join manually
    const { data: allPatients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (patientsError) {
      console.error('❌ [DB] Error fetching patients:', patientsError);
      throw patientsError;
    }

    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*');

    if (consultationsError) {
      console.error('❌ [DB] Error fetching consultations:', consultationsError);
    }

    const { data: appointments, error: appointmentsError } = await supabase
      .schema('api')
      .from('appointments')
      .select('*');

    if (appointmentsError) {
      console.error('❌ [DB] Error fetching appointments:', appointmentsError);
    }

    // Manually join patients with their consultations and appointments
    const patientsWithRelations = allPatients.map(patient => ({
      ...patient,
      consultations: consultations?.filter(c => c.patient_id === patient.id) || [],
      appointments: appointments?.filter(a => a.patient_id === patient.id) || []
    }));

    console.log(`🔍 [DB] Retrieved ${patientsWithRelations.length} patients for filtering`);

    // Apply filters in memory for better flexibility
    let filteredPatients = patientsWithRelations || [];

    for (const filter of filterCriteria) {
      filteredPatients = filteredPatients.filter(patient => {
        switch (filter.field) {
          case 'age':
            const age = patient.date_of_birth
              ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : 0;

            switch (filter.operator) {
              case 'greater_than':
                return age > parseInt(filter.value);
              case 'less_than':
                return age < parseInt(filter.value);
              case 'greater_than_or_equal':
                return age >= parseInt(filter.value);
              case 'less_than_or_equal':
                return age <= parseInt(filter.value);
              case 'equals':
                return age === parseInt(filter.value);
              case 'between':
                const [min, max] = filter.value.split(',').map(v => parseInt(v.trim()));
                return age >= min && age <= max;
              default:
                return true;
            }

          case 'medical_conditions':
            const medicalHistory = patient.medical_history_summary || '';
            switch (filter.operator) {
              case 'contains':
                return medicalHistory.toLowerCase().includes(filter.value.toLowerCase());
              case 'not_contains':
                return !medicalHistory.toLowerCase().includes(filter.value.toLowerCase());
              case 'is_null':
                return !medicalHistory || medicalHistory.trim() === '';
              case 'is_not_null':
                return medicalHistory && medicalHistory.trim() !== '';
              default:
                return true;
            }

          case 'diagnosis':
            const hasMatchingDiagnosis = patient.consultations?.some(consultation => {
              const diagnosis = consultation.diagnosis || '';
              switch (filter.operator) {
                case 'contains':
                  return diagnosis.toLowerCase().includes(filter.value.toLowerCase());
                case 'equals':
                  return diagnosis.toLowerCase() === filter.value.toLowerCase();
                case 'not_contains':
                  return !diagnosis.toLowerCase().includes(filter.value.toLowerCase());
                default:
                  return true;
              }
            });
            return hasMatchingDiagnosis || false;

          case 'treatment_type':
            const hasMatchingTreatment = patient.consultations?.some(consultation => {
              const treatment = consultation.treatment_plan || '';
              switch (filter.operator) {
                case 'contains':
                  return treatment.toLowerCase().includes(filter.value.toLowerCase());
                case 'equals':
                  return treatment.toLowerCase() === filter.value.toLowerCase();
                case 'not_contains':
                  return !treatment.toLowerCase().includes(filter.value.toLowerCase());
                default:
                  return true;
              }
            });
            return hasMatchingTreatment || false;

          case 'prognosis':
            const hasMatchingPrognosis = patient.consultations?.some(consultation => {
              const prognosis = consultation.prognosis || '';
              switch (filter.operator) {
                case 'equals':
                  return prognosis.toLowerCase() === filter.value.toLowerCase();
                case 'not_equals':
                  return prognosis.toLowerCase() !== filter.value.toLowerCase();
                case 'in':
                  const prognosisOptions = filter.value.split(',').map(v => v.trim().toLowerCase());
                  return prognosisOptions.includes(prognosis.toLowerCase());
                default:
                  return true;
              }
            });
            return hasMatchingPrognosis || false;

          case 'pain_intensity':
            const hasMatchingPainIntensity = patient.consultations?.some(consultation => {
              try {
                const painData = consultation.pain_assessment
                  ? (typeof consultation.pain_assessment === 'string' 
                      ? JSON.parse(consultation.pain_assessment) 
                      : consultation.pain_assessment)
                  : null;
                const intensity = painData?.intensity || 0;
                const filterValue = parseFloat(filter.value) || 0;

                switch (filter.operator) {
                  case 'equals':
                    return intensity === filterValue;
                  case 'greater_than':
                    return intensity > filterValue;
                  case 'less_than':
                    return intensity < filterValue;
                  case 'greater_than_or_equal':
                    return intensity >= filterValue;
                  case 'less_than_or_equal':
                    return intensity <= filterValue;
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingPainIntensity || false;

          case 'diagnosis_primary':
            const hasMatchingPrimaryDiagnosis = patient.consultations?.some(consultation => {
              try {
                const diagnosisData = consultation.diagnosis
                  ? (typeof consultation.diagnosis === 'string' 
                      ? JSON.parse(consultation.diagnosis) 
                      : consultation.diagnosis)
                  : null;
                const primary = diagnosisData?.primary || '';
                const filterValue = (filter.value || '').toLowerCase();

                switch (filter.operator) {
                  case 'contains':
                    return primary.toLowerCase().includes(filterValue);
                  case 'equals':
                    return primary.toLowerCase() === filterValue;
                  case 'not_contains':
                    return !primary.toLowerCase().includes(filterValue);
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingPrimaryDiagnosis || false;

          case 'pain_location':
            const hasMatchingPainLocation = patient.consultations?.some(consultation => {
              try {
                const painData = consultation.pain_assessment
                  ? (typeof consultation.pain_assessment === 'string' 
                      ? JSON.parse(consultation.pain_assessment) 
                      : consultation.pain_assessment)
                  : null;
                const location = painData?.location || '';
                const filterValue = (filter.value || '').toLowerCase();

                switch (filter.operator) {
                  case 'contains':
                    return location.toLowerCase().includes(filterValue);
                  case 'equals':
                    return location.toLowerCase() === filterValue;
                  case 'not_contains':
                    return !location.toLowerCase().includes(filterValue);
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingPainLocation || false;

          case 'pain_duration':
            const hasMatchingPainDuration = patient.consultations?.some(consultation => {
              try {
                const painData = consultation.pain_assessment
                  ? (typeof consultation.pain_assessment === 'string' 
                      ? JSON.parse(consultation.pain_assessment) 
                      : consultation.pain_assessment)
                  : null;
                const duration = painData?.duration || '';
                const filterValue = (filter.value || '').toLowerCase();

                switch (filter.operator) {
                  case 'contains':
                    return duration.toLowerCase().includes(filterValue);
                  case 'equals':
                    return duration.toLowerCase() === filterValue;
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingPainDuration || false;

          case 'pain_character':
            const hasMatchingPainCharacter = patient.consultations?.some(consultation => {
              try {
                const painData = consultation.pain_assessment
                  ? (typeof consultation.pain_assessment === 'string' 
                      ? JSON.parse(consultation.pain_assessment) 
                      : consultation.pain_assessment)
                  : null;
                const character = painData?.character || '';
                const filterValue = (filter.value || '').toLowerCase();

                switch (filter.operator) {
                  case 'contains':
                    return character.toLowerCase().includes(filterValue);
                  case 'equals':
                    return character.toLowerCase() === filterValue;
                  case 'in':
                    const characterOptions = filter.value.split(',').map(v => v.trim().toLowerCase());
                    return characterOptions.includes(character.toLowerCase());
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingPainCharacter || false;

          case 'diagnosis_final':
            const hasMatchingFinalDiagnosis = patient.consultations?.some(consultation => {
              try {
                const diagnosisData = consultation.diagnosis
                  ? (typeof consultation.diagnosis === 'string' 
                      ? JSON.parse(consultation.diagnosis) 
                      : consultation.diagnosis)
                  : null;
                const finalDiag = Array.isArray(diagnosisData?.final) 
                  ? diagnosisData.final.join(' ') 
                  : (diagnosisData?.final || '');
                const filterValue = (filter.value || '').toLowerCase();

                switch (filter.operator) {
                  case 'contains':
                    return finalDiag.toLowerCase().includes(filterValue);
                  case 'not_contains':
                    return !finalDiag.toLowerCase().includes(filterValue);
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingFinalDiagnosis || false;

          case 'diagnosis_provisional':
            const hasMatchingProvisionalDiagnosis = patient.consultations?.some(consultation => {
              try {
                const diagnosisData = consultation.diagnosis
                  ? (typeof consultation.diagnosis === 'string' 
                      ? JSON.parse(consultation.diagnosis) 
                      : consultation.diagnosis)
                  : null;
                const provisionalDiag = Array.isArray(diagnosisData?.provisional) 
                  ? diagnosisData.provisional.join(' ') 
                  : (diagnosisData?.provisional || '');
                const filterValue = (filter.value || '').toLowerCase();

                switch (filter.operator) {
                  case 'contains':
                    return provisionalDiag.toLowerCase().includes(filterValue);
                  case 'not_contains':
                    return !provisionalDiag.toLowerCase().includes(filterValue);
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingProvisionalDiagnosis || false;

          case 'treatment_procedures':
            const hasMatchingTreatmentProcedures = patient.consultations?.some(consultation => {
              try {
                const treatmentData = consultation.treatment_plan
                  ? (typeof consultation.treatment_plan === 'string' 
                      ? JSON.parse(consultation.treatment_plan) 
                      : consultation.treatment_plan)
                  : null;
                const procedures = Array.isArray(treatmentData?.plan) 
                  ? treatmentData.plan.join(' ') 
                  : (treatmentData?.plan || '');
                const filterValue = (filter.value || '').toLowerCase();

                switch (filter.operator) {
                  case 'contains':
                    return procedures.toLowerCase().includes(filterValue);
                  case 'not_contains':
                    return !procedures.toLowerCase().includes(filterValue);
                  default:
                    return true;
                }
              } catch (e) {
                return false;
              }
            });
            return hasMatchingTreatmentProcedures || false;

          case 'total_visits':
            const totalVisits = patient.appointments?.length || 0;
            switch (filter.operator) {
              case 'greater_than':
                return totalVisits > parseInt(filter.value);
              case 'less_than':
                return totalVisits < parseInt(filter.value);
              case 'equals':
                return totalVisits === parseInt(filter.value);
              case 'greater_than_or_equal':
                return totalVisits >= parseInt(filter.value);
              case 'less_than_or_equal':
                return totalVisits <= parseInt(filter.value);
              default:
                return true;
            }

          case 'last_visit_date':
            const lastVisit = patient.appointments?.length > 0
              ? new Date(Math.max(...patient.appointments.map(apt => new Date(apt.appointment_date).getTime())))
              : null;

            if (!lastVisit) return filter.operator === 'is_null';

            const filterDate = new Date(filter.value);
            switch (filter.operator) {
              case 'greater_than':
                return lastVisit > filterDate;
              case 'less_than':
                return lastVisit < filterDate;
              case 'equals':
                return lastVisit.toDateString() === filterDate.toDateString();
              default:
                return true;
            }

          case 'registration_date':
            const registrationDate = new Date(patient.created_at);
            const filterRegDate = new Date(filter.value);
            switch (filter.operator) {
              case 'greater_than':
                return registrationDate > filterRegDate;
              case 'less_than':
                return registrationDate < filterRegDate;
              case 'equals':
                return registrationDate.toDateString() === filterRegDate.toDateString();
              default:
                return true;
            }

          default:
            console.warn(`⚠️ [DB] Unsupported filter field: ${filter.field}`);
            return true;
        }
      });
    }

    console.log(`✅ [DB] Filtered to ${filteredPatients.length} matching patients`);

    // Transform data to CohortPatient format (matching MatchingPatient interface)
    const cohortPatients: CohortPatient[] = filteredPatients.map((patient, index) => {
      const age = patient.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0;

      // Calculate match score based on how many criteria the patient meets
      let matchScore = 70; // Base score
      const criteriaMatches = filterCriteria.length;
      if (criteriaMatches > 0) {
        matchScore += Math.min(criteriaMatches * 5, 25); // Up to 95% match
      }
      matchScore += Math.random() * 5; // Small random variation

      const lastVisit = patient.appointments?.length > 0
        ? new Date(Math.max(...patient.appointments.map(apt => new Date(apt.appointment_date).getTime())))
        : new Date(patient.created_at);

      const latestConsultation = patient.consultations?.length > 0
        ? patient.consultations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;

      // Generate anonymous ID for research purposes
      const anonymousId = `P${String(index + 1).padStart(3, '0')}`;

      // Extract outcome from latest consultation
      let outcome = 'Unknown';
      try {
        if (latestConsultation?.diagnosis) {
          const diagnosisData = typeof latestConsultation.diagnosis === 'string'
            ? JSON.parse(latestConsultation.diagnosis)
            : latestConsultation.diagnosis;
          outcome = diagnosisData?.outcome || latestConsultation.status || 'Pending';
        }
      } catch (e) {
        outcome = latestConsultation?.status || 'Pending';
      }

      return {
        anonymousId,
        age,
        gender: 'Not specified', // TODO: Add gender field to patients table
        condition: latestConsultation?.diagnosis || 'No diagnosis recorded',
        outcome,
        inclusionDate: new Date().toISOString()
      };
    });

    return cohortPatients.slice(0, 100); // Limit to 100 results for UI performance

  } catch (error) {
    console.error('❌ [DB] Exception finding matching patients:', error);
    return [];
  }
}

export async function getResearchProjectAnalytics(projectId: string): Promise<ResearchAnalyticsData | null> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Fetching research project analytics:', projectId);

    // Get project details
    const project = await getResearchProjectById(projectId);
    if (!project) return null;

    // Parse filter criteria and find matching patients
    const filterCriteria = JSON.parse(project.filter_criteria || '[]');
    const cohortPatients = await findMatchingPatients(filterCriteria);

    // Calculate analytics
    const totalPatients = cohortPatients.length;
    const averageAge = totalPatients > 0
      ? Math.round(cohortPatients.reduce((sum, p) => sum + p.age, 0) / totalPatients * 10) / 10
      : 0;

    // Calculate comprehensive age statistics
    const ages = cohortPatients.map(p => p.age);
    let ageStats = {
      mean: 0,
      mode: 0,
      sd: 0,
      ci95Lower: 0,
      ci95Upper: 0,
      min: 0,
      max: 0
    };

    if (totalPatients > 0) {
      // Mean
      const mean = ages.reduce((sum, age) => sum + age, 0) / ages.length;

      // Mode (most frequent age)
      const frequency: { [key: number]: number } = {};
      ages.forEach(age => {
        frequency[age] = (frequency[age] || 0) + 1;
      });
      const mode = parseInt(Object.entries(frequency).reduce((a, b) => a[1] > b[1] ? a : b)[0]);

      // Standard Deviation
      const variance = ages.reduce((sum, age) => sum + Math.pow(age - mean, 2), 0) / ages.length;
      const sd = Math.sqrt(variance);

      // 95% Confidence Interval
      const standardError = sd / Math.sqrt(ages.length);
      const ci95Lower = mean - (1.96 * standardError);
      const ci95Upper = mean + (1.96 * standardError);

      // Min and Max
      const min = Math.min(...ages);
      const max = Math.max(...ages);

      ageStats = {
        mean: Math.round(mean * 10) / 10,
        mode,
        sd: Math.round(sd * 10) / 10,
        ci95Lower: Math.round(ci95Lower * 10) / 10,
        ci95Upper: Math.round(ci95Upper * 10) / 10,
        min,
        max
      };
    }

    // Age distribution (histogram data)
    const ageRanges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-30', min: 21, max: 30 },
      { range: '31-40', min: 31, max: 40 },
      { range: '41-50', min: 41, max: 50 },
      { range: '51-60', min: 51, max: 60 },
      { range: '61+', min: 61, max: 999 }
    ];

    const ageDistribution = ageRanges.map((range, index) => {
      const count = ages.filter(age => age >= range.min && age <= range.max).length;
      return {
        range: range.range,
        count,
        fill: ['#009688', '#00796B', '#00695C', '#004D40', '#005A9C', '#003D7A'][index]
      };
    }).filter(item => item.count > 0);

    // Gender distribution (mock data for now)
    const genderDistribution = [
      { name: 'Female', value: Math.round(totalPatients * 0.58), fill: '#009688' },
      { name: 'Male', value: Math.round(totalPatients * 0.42), fill: '#005A9C' }
    ];

    // Condition distribution
    const conditionCounts: { [key: string]: number } = {};
    cohortPatients.forEach(patient => {
      conditionCounts[patient.condition] = (conditionCounts[patient.condition] || 0) + 1;
    });

    const conditionDistribution = Object.entries(conditionCounts).map(([condition, count], index) => ({
      name: condition,
      value: count,
      fill: ['#009688', '#005A9C', '#F59E0B'][index % 3]
    }));

    // Outcome distribution
    const outcomeCounts: { [key: string]: number } = {};
    cohortPatients.forEach(patient => {
      outcomeCounts[patient.outcome] = (outcomeCounts[patient.outcome] || 0) + 1;
    });

    const outcomeDistribution = Object.entries(outcomeCounts).map(([outcome, count], index) => ({
      name: outcome,
      value: count,
      fill: outcome.toLowerCase().includes('success') ? '#10B981' :
            outcome.toLowerCase().includes('failure') ? '#EF4444' : '#F59E0B'
    }));

    // Treatment comparison (mock data)
    const treatmentComparison = [
      { treatment: 'Standard Protocol', successRate: 85 },
      { treatment: 'Advanced Protocol', successRate: 92 }
    ];

    // Healing time comparison (mock data)
    const healingTimeComparison = [
      { protocol: 'Standard Care', avgDays: 14 },
      { protocol: 'Enhanced Care', avgDays: 10 }
    ];

    const analytics: ResearchAnalyticsData = {
      totalPatients,
      averageAge,
      activeStudies: 1, // Current project
      ageStats,
      ageDistribution,
      genderDistribution,
      conditionDistribution,
      outcomeDistribution,
      treatmentComparison,
      healingTimeComparison
    };

    console.log('✅ [DB] Successfully calculated research analytics:', analytics);
    return analytics;
  } catch (error) {
    console.error('❌ [DB] Exception fetching research analytics:', error);
    return null;
  }
}

export async function deleteResearchProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  try {
    console.log('🔍 [DB] Deleting research project:', projectId);

    // First delete related cohorts
    await supabase
      .schema('api')
      .from('research_cohorts')
      .delete()
      .eq('project_id', projectId);

    // Delete the project
    const { error } = await supabase
      .schema('api')
      .from('research_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('❌ [DB] Error deleting research project:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully deleted research project:', projectId);
    return { success: true };
  } catch (error) {
    console.error('❌ [DB] Exception deleting research project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ===============================================
// COHORT MANAGEMENT FUNCTIONS
// ===============================================

export async function addPatientToCohort(
  projectId: string,
  patientId: string,
  cohortName: string = 'default',
  matchScore: number = 0.0,
  matchingCriteria: any[] = []
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();
  try {
    console.log('👥 [DB] Adding patient to cohort:', { projectId, patientId, cohortName });

    const { data, error } = await supabase
      .schema('api')
      .from('research_cohorts')
      .insert({
        project_id: projectId,
        patient_id: patientId,
        cohort_name: cohortName,
        match_score: matchScore,
        matching_criteria: JSON.stringify(matchingCriteria),
        inclusion_date: new Date().toISOString().split('T')[0],
        notes: `Added via Research Projects interface`
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Error adding patient to cohort:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully added patient to cohort:', data.id);
    return { success: true };
  } catch (error) {
    console.error('❌ [DB] Exception adding patient to cohort:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function removePatientFromCohort(
  projectId: string,
  patientId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();
  try {
    console.log('👥 [DB] Removing patient from cohort:', { projectId, patientId });

    const { error } = await supabase
      .schema('api')
      .from('research_cohorts')
      .delete()
      .eq('project_id', projectId)
      .eq('patient_id', patientId);

    if (error) {
      console.error('❌ [DB] Error removing patient from cohort:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [DB] Successfully removed patient from cohort');
    return { success: true };
  } catch (error) {
    console.error('❌ [DB] Exception removing patient from cohort:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getResearchCohortPatients(projectId: string): Promise<any[]> {
  const supabase = await createServiceClient();
  try {
    console.log('👥 [DB] Fetching cohort patients for project:', projectId);

    const { data, error } = await supabase
      .schema('api')
      .from('research_cohorts')
      .select(`
        *,
        patients:patient_id (
          id,
          first_name,
          last_name,
          date_of_birth,
          created_at
        )
      `)
      .eq('project_id', projectId)
      .order('inclusion_date', { ascending: false });

    if (error) {
      console.error('❌ [DB] Error fetching cohort patients:', error);
      return [];
    }

    console.log('✅ [DB] Successfully fetched cohort patients:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ [DB] Exception fetching cohort patients:', error);
    return [];
  }
}
