import {
  AppointmentRequest,
  Appointment,
  NewAppointmentRequest,
  NewAppointment,
  NewNotification,
  Dentist
} from '@/lib/db/schema';

// Types for enhanced appointment service
export interface AppointmentRequestData {
  chiefComplaint: string;
  painLevel: number;
  urgency: 'routine' | 'urgent' | 'emergency';
  preferredDate: string;
  preferredTime: string;
  additionalNotes?: string;
}

export interface AppointmentScheduleData {
  dentistId: string;
  assistantId?: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes?: number;
  notes?: string;
}

export interface AppointmentConflict {
  conflictType: 'time_overlap' | 'dentist_unavailable' | 'facility_full';
  conflictingAppointment?: Appointment;
  suggestedAlternatives: TimeSlot[];
}

export interface TimeSlot {
  date: string;
  time: string;
  dentistId: string;
  dentistName: string;
  available: boolean;
}

export interface AppointmentAvailability {
  date: string;
  timeSlots: TimeSlot[];
}

// Constants for appointment management
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
} as const;

export const URGENCY_LEVELS = {
  EMERGENCY: 'emergency',
  URGENT: 'urgent',
  ROUTINE: 'routine'
} as const;

// Default appointment durations by type
export const APPOINTMENT_DURATIONS = {
  'consultation': 30,
  'cleaning': 60,
  'filling': 90,
  'extraction': 60,
  'root_canal': 120,
  'crown': 90,
  'emergency': 45
} as const;

// Time slot configuration
export const CLINIC_HOURS = {
  START: 9,  // 9 AM
  END: 17,   // 5 PM
  INTERVAL: 30 // 30-minute slots
} as const;

// Maximum appointment booking window (6 months)
export const MAX_BOOKING_MONTHS = 6;

// Validation constants
export const PAIN_SCALE = {
  MIN: 0,
  MAX: 10
} as const;

// Maximum pending requests per patient per day
export const MAX_PENDING_REQUESTS_PER_DAY = 1;