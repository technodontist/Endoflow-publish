'use server';

import { createClient } from '@/lib/supabase/client';
import { createNotificationAction } from './notifications';
import { revalidatePath } from 'next/cache';

interface PrescriptionItem {
  medicationName: string;
  brandName?: string;
  dosage: string;
  strength?: string;
  form?: string;
  frequency: string;
  timesPerDay: number;
  instructions?: string;
  duration?: string;
  quantity?: string;
  refills?: number;
}

export async function createPrescriptionNotificationAction(
  patientId: string,
  dentistId: string,
  consultationId: string,
  prescriptions: PrescriptionItem[]
) {
  try {
    const supabase = createClient();

    // Get dentist information for notification
    const { data: dentist, error: dentistError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', dentistId)
      .single();

    if (dentistError || !dentist) {
      console.error('Error fetching dentist info:', dentistError);
      return { success: false, error: 'Failed to fetch dentist information' };
    }

    // Get consultation date for context
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select('created_at, status')
      .eq('id', consultationId)
      .single();

    if (consultationError || !consultation) {
      console.error('Error fetching consultation:', consultationError);
      return { success: false, error: 'Failed to fetch consultation information' };
    }

    // Create notification title and message
    const medicationCount = prescriptions.length;
    const medicationNames = prescriptions.slice(0, 2).map(p => p.medicationName).join(', ');
    const additionalCount = medicationCount > 2 ? ` and ${medicationCount - 2} more` : '';

    const title = medicationCount === 1
      ? `New Prescription: ${prescriptions[0].medicationName}`
      : `${medicationCount} New Prescriptions`;

    const message = medicationCount === 1
      ? `Dr. ${dentist.full_name} has prescribed ${prescriptions[0].medicationName} (${prescriptions[0].dosage}) for you. Please check the details and dosage instructions in your alarms tab.`
      : `Dr. ${dentist.full_name} has prescribed ${medicationNames}${additionalCount} for you. Please check the details and dosage instructions for all medications in your alarms tab.`;

    // Create the notification with prescription details
    const notificationResult = await createNotificationAction(
      patientId,
      'prescription_prescribed',
      title,
      message,
      consultationId
    );

    if (!notificationResult.success) {
      console.error('Failed to create notification:', notificationResult.error);
      return { success: false, error: 'Failed to create prescription notification' };
    }

    // Store detailed prescription information in patient_prescriptions table for the alarms tab
    const prescriptionInserts = prescriptions.map(prescription => ({
      patient_id: patientId,
      dentist_id: dentistId,
      consultation_id: consultationId,
      medication_name: prescription.medicationName,
      brand_name: prescription.brandName || null,
      dosage: prescription.dosage,
      strength: prescription.strength || null,
      form: prescription.form || null,
      frequency: prescription.frequency,
      times_per_day: prescription.timesPerDay,
      duration_days: prescription.duration ? parseInt(prescription.duration) || null : null,
      instructions: prescription.instructions || null,
      total_quantity: prescription.quantity || null,
      refills_remaining: prescription.refills || 0,
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
      reminder_times: JSON.stringify(['09:00', '13:00', '19:00'].slice(0, prescription.timesPerDay))
    }));

    const { error: insertError } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .insert(prescriptionInserts);

    if (insertError) {
      console.error('Error storing prescription details:', insertError);
      // Don't fail completely if notification was created successfully
      console.warn('Prescription notification created but detailed prescription data storage failed');
    }

    // Revalidate patient dashboard and alarms
    revalidatePath('/patient');
    revalidatePath('/dashboard/patient');

    return {
      success: true,
      notificationId: notificationResult.data?.id,
      prescriptionCount: medicationCount
    };

  } catch (error) {
    console.error('Error creating prescription notification:', error);
    return {
      success: false,
      error: 'Failed to create prescription notification'
    };
  }
}

export async function getPrescriptionNotificationsAction(patientId: string) {
  try {
    const supabase = createClient();

    // Get prescription-related notifications
    const { data: notifications, error } = await supabase
      .schema('api')
      .from('notifications')
      .select(`
        id,
        type,
        title,
        message,
        related_id,
        read,
        created_at
      `)
      .eq('user_id', patientId)
      .eq('type', 'prescription_prescribed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching prescription notifications:', error);
      return { success: false, error: 'Failed to fetch prescription notifications' };
    }

    return {
      success: true,
      data: notifications || []
    };

  } catch (error) {
    console.error('Error in getPrescriptionNotificationsAction:', error);
    return {
      success: false,
      error: 'Failed to fetch prescription notifications'
    };
  }
}

export async function getPrescriptionDetailsAction(consultationId: string) {
  try {
    const supabase = createClient();

    // Get detailed prescription information from patient_prescriptions table
    const { data: prescriptions, error } = await supabase
      .schema('api')
      .from('patient_prescriptions')
      .select(`
        id,
        medication_name,
        brand_name,
        dosage,
        strength,
        form,
        frequency,
        times_per_day,
        duration_days,
        instructions,
        total_quantity,
        refills_remaining,
        status,
        start_date,
        created_at
      `)
      .eq('consultation_id', consultationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching prescription details:', error);
      return { success: false, error: 'Failed to fetch prescription details' };
    }

    return {
      success: true,
      data: prescriptions || []
    };

  } catch (error) {
    console.error('Error in getPrescriptionDetailsAction:', error);
    return {
      success: false,
      error: 'Failed to fetch prescription details'
    };
  }
}