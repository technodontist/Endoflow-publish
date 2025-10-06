import { pgTable, text, timestamp, uuid, date, pgSchema, boolean, integer, time } from 'drizzle-orm/pg-core';

// Create api schema
export const apiSchema = pgSchema('api');

// Main profiles table (public schema) - Central authentication table
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // References auth.users.id
  role: text('role', { enum: ['patient', 'assistant', 'dentist'] }).notNull(),
  status: text('status', { enum: ['active', 'pending', 'inactive'] }).notNull().default('pending'),
  fullName: text('full_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Assistants table - references auth.users.id
export const assistants = apiSchema.table('assistants', {
  id: uuid('id').primaryKey(), // This will be the same as auth.users.id
  fullName: text('full_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Dentists table - references auth.users.id
export const dentists = apiSchema.table('dentists', {
  id: uuid('id').primaryKey(), // This will be the same as auth.users.id
  fullName: text('full_name').notNull(),
  specialty: text('specialty'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Patients table - references auth.users.id
export const patients = apiSchema.table('patients', {
  id: uuid('id').primaryKey(), // This will be the same as auth.users.id
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  dateOfBirth: date('date_of_birth'),
  medicalHistorySummary: text('medical_history_summary'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Pending registrations table - for users who signed up but aren't approved yet
export const pendingRegistrations = apiSchema.table('pending_registrations', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(), // References auth.users.id - NEW FK RELATIONSHIP
  formData: text('form_data').notNull(), // JSON string of the registration form
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
});

// Appointment requests table - Patient booking requests
export const appointmentRequests = apiSchema.table('appointment_requests', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  appointmentType: text('appointment_type').notNull(),
  preferredDate: date('preferred_date').notNull(),
  preferredTime: text('preferred_time').notNull(),
  reasonForVisit: text('reason_for_visit').notNull(),
  painLevel: integer('pain_level'),
  additionalNotes: text('additional_notes'),
  status: text('status', { enum: ['pending', 'confirmed', 'cancelled'] }).notNull().default('pending'),
  notificationSent: boolean('notification_sent').notNull().default(false),
  assignedTo: uuid('assigned_to'), // References api.assistants.id
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Appointments table - Confirmed appointments
export const appointments = apiSchema.table('appointments', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  dentistId: uuid('dentist_id').notNull(), // References api.dentists.id
  assistantId: uuid('assistant_id'), // References api.assistants.id
  appointmentRequestId: uuid('appointment_request_id'), // References api.appointment_requests.id
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: time('scheduled_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  appointmentType: text('appointment_type').notNull(),
  status: text('status', { enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'] }).notNull().default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Appointment teeth linkage (many-to-one from teeth to appointment)
export const appointmentTeeth = apiSchema.table('appointment_teeth', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  appointmentId: uuid('appointment_id').notNull(), // References api.appointments.id
  consultationId: uuid('consultation_id'), // References api.consultations.id
  toothNumber: text('tooth_number').notNull(),
  toothDiagnosisId: uuid('tooth_diagnosis_id'), // References api.tooth_diagnoses.id
  diagnosis: text('diagnosis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Notifications table - Real-time alerts
export const notifications = apiSchema.table('notifications', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  userId: uuid('user_id').notNull(), // References auth.users.id
  type: text('type').notNull(), // 'appointment_request', 'appointment_confirmed', etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  relatedId: uuid('related_id'), // Links to appointment_request or appointment
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Define types for easier use
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Assistant = typeof assistants.$inferSelect;
export type NewAssistant = typeof assistants.$inferInsert;
export type Dentist = typeof dentists.$inferSelect;
export type NewDentist = typeof dentists.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type PendingRegistration = typeof pendingRegistrations.$inferSelect;
export type NewPendingRegistration = typeof pendingRegistrations.$inferInsert;
export type AppointmentRequest = typeof appointmentRequests.$inferSelect;
export type NewAppointmentRequest = typeof appointmentRequests.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// Messages table for patient-staff communication
export const messages = apiSchema.table('messages', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  senderId: uuid('sender_id').notNull(), // References auth.users.id
  senderType: text('sender_type', { enum: ['patient', 'assistant', 'dentist'] }).notNull(),
  message: text('message').notNull(),
  isFromPatient: boolean('is_from_patient').notNull().default(false),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Treatments table for tracking patient treatment history
export const treatments = apiSchema.table('treatments', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  dentistId: uuid('dentist_id').notNull(), // References api.dentists.id
  appointmentId: uuid('appointment_id'), // References api.appointments.id
  treatmentType: text('treatment_type').notNull(),
  description: text('description'),
  notes: text('notes'),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'cancelled'] }).notNull().default('pending'),
  // Enhanced linkage and progress fields (mirrors migrations)
  toothNumber: text('tooth_number'),
  toothDiagnosisId: uuid('tooth_diagnosis_id'),
  consultationId: uuid('consultation_id'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  totalVisits: integer('total_visits').default(1),
  completedVisits: integer('completed_visits').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Patient Files table for storing medical images and documents
export const patientFiles = apiSchema.table('patient_files', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  uploadedBy: uuid('uploaded_by').notNull(), // References auth.users.id (assistant/dentist who uploaded)
  fileName: text('file_name').notNull(),
  originalFileName: text('original_file_name').notNull(),
  filePath: text('file_path').notNull(), // Supabase storage path
  fileSize: integer('file_size').notNull(), // in bytes
  mimeType: text('mime_type').notNull(),
  fileType: text('file_type').notNull(), // X-Ray, Oral Photo, etc.
  description: text('description').notNull(), // Legend/description of the file
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Treatment = typeof treatments.$inferSelect;
export type NewTreatment = typeof treatments.$inferInsert;
export type PatientFile = typeof patientFiles.$inferSelect;
export type NewPatientFile = typeof patientFiles.$inferInsert;

// Consultations table for comprehensive dental consultations
export const consultations = apiSchema.table('consultations', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id
  consultationDate: timestamp('consultation_date').defaultNow().notNull(),
  status: text('status', { enum: ['draft', 'completed', 'archived'] }).notNull().default('draft'),

  // Main consultation data fields
  chiefComplaint: text('chief_complaint'),
  painAssessment: text('pain_assessment'), // JSON string
  medicalHistory: text('medical_history'), // JSON string
  clinicalExamination: text('clinical_examination'), // JSON string
  investigations: text('investigations'), // JSON string
  diagnosis: text('diagnosis'), // JSON string
  treatmentPlan: text('treatment_plan'), // JSON string
  prognosis: text('prognosis', { enum: ['excellent', 'good', 'fair', 'poor', 'hopeless'] }),

  // Voice/AI integration
  voiceTranscript: text('voice_transcript'), // JSON string
  aiParsedData: text('ai_parsed_data'), // JSON string
  voiceSessionActive: boolean('voice_session_active').notNull().default(false),

  // Prescription & Follow-up
  prescriptionData: text('prescription_data'), // JSON string
  followUpData: text('follow_up_data'), // JSON string

  // Additional
  additionalNotes: text('additional_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tooth Diagnoses table for individual tooth tracking
export const toothDiagnoses = apiSchema.table('tooth_diagnoses', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  consultationId: uuid('consultation_id').notNull(), // References api.consultations.id
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  toothNumber: text('tooth_number').notNull(),

  // Tooth status and diagnosis
  status: text('status', {
    enum: ['healthy', 'caries', 'filled', 'crown', 'missing', 'attention', 'root_canal', 'extraction_needed', 'implant']
  }).notNull().default('healthy'),
  primaryDiagnosis: text('primary_diagnosis'),
  diagnosisDetails: text('diagnosis_details'),
  symptoms: text('symptoms'), // JSON array as string

  // Treatment information
  recommendedTreatment: text('recommended_treatment'),
  treatmentPriority: text('treatment_priority', {
    enum: ['urgent', 'high', 'medium', 'low', 'routine']
  }).notNull().default('medium'),
  treatmentDetails: text('treatment_details'),
  estimatedDuration: integer('estimated_duration'), // in minutes
  estimatedCost: text('estimated_cost'), // Using text for decimal handling

  // Visual and scheduling
  colorCode: text('color_code').notNull().default('#22c55e'), // Green for healthy
  scheduledDate: date('scheduled_date'),
  followUpRequired: boolean('follow_up_required').notNull().default(false),

  // Metadata
  examinationDate: date('examination_date').default('CURRENT_DATE'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Voice Sessions table for N8N integration
export const voiceSessions = apiSchema.table('voice_sessions', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  consultationId: uuid('consultation_id').notNull(), // References api.consultations.id
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id

  // Session details
  sessionStart: timestamp('session_start').defaultNow().notNull(),
  sessionEnd: timestamp('session_end'),
  durationSeconds: integer('duration_seconds'),

  // Voice data
  transcript: text('transcript'), // JSON string
  rawAudioUrl: text('raw_audio_url'), // Supabase Storage URL

  // Processing status
  status: text('status', { enum: ['active', 'processing', 'completed', 'failed'] }).notNull().default('active'),

  // N8N integration
  n8nWebhookUrl: text('n8n_webhook_url'),
  n8nSessionId: uuid('n8n_session_id'),

  // Processed data
  processedData: text('processed_data'), // JSON string
  aiConfidence: text('ai_confidence'), // JSON string

  // Error handling
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Consultation = typeof consultations.$inferSelect;
export type NewConsultation = typeof consultations.$inferInsert;
export type ToothDiagnosis = typeof toothDiagnoses.$inferSelect;
export type NewToothDiagnosis = typeof toothDiagnoses.$inferInsert;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type NewVoiceSession = typeof voiceSessions.$inferInsert;

// ===============================================
// RESEARCH PROJECTS SCHEMA
// ===============================================

// Research Projects table for managing clinical research studies
export const researchProjects = apiSchema.table('research_projects', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id

  // Project metadata
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: text('status', { enum: ['draft', 'active', 'inactive', 'completed', 'archived'] }).notNull().default('draft'),

  // Research details
  researchType: text('research_type'), // 'outcome_study', 'comparative', 'demographic', etc.
  studyPeriodStart: date('study_period_start'),
  studyPeriodEnd: date('study_period_end'),

  // Filter criteria stored as JSON
  filterCriteria: text('filter_criteria').notNull(), // JSON string of filter rules
  inclusionCriteria: text('inclusion_criteria'), // Human-readable inclusion criteria
  exclusionCriteria: text('exclusion_criteria'), // Human-readable exclusion criteria

  // Statistics and metadata
  totalPatients: integer('total_patients').notNull().default(0),
  lastAnalysisDate: timestamp('last_analysis_date'),

  // Collaboration and sharing
  isPublic: boolean('is_public').notNull().default(false),
  collaborators: text('collaborators'), // JSON array of dentist IDs

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Research Cohorts table for patient-project relationships
export const researchCohorts = apiSchema.table('research_cohorts', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  projectId: uuid('project_id').notNull(), // References api.research_projects.id
  patientId: uuid('patient_id').notNull(), // References auth.users.id

  // Cohort membership details
  inclusionDate: timestamp('inclusion_date').defaultNow().notNull(),
  status: text('status', { enum: ['included', 'excluded', 'withdrawn', 'completed'] }).notNull().default('included'),

  // Group assignment for comparative studies (Control, Treatment A, Treatment B, etc.)
  groupName: text('group_name').notNull().default('Control'), // e.g., "Control", "Treatment A", "Treatment B"

  // Anonymous research identifier
  anonymousId: text('anonymous_id').notNull(), // e.g., "P001", "E002"

  // Data collection status
  baselineDataCollected: boolean('baseline_data_collected').notNull().default(false),
  followUpDataCollected: boolean('follow_up_data_collected').notNull().default(false),

  // Research-specific data (JSON)
  researchData: text('research_data'), // JSON string of collected research data

  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Research Criteria table for complex filter rules
export const researchCriteria = apiSchema.table('research_criteria', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  projectId: uuid('project_id').notNull(), // References api.research_projects.id

  // Filter rule definition
  field: text('field').notNull(), // 'age', 'gender', 'condition', 'treatment', etc.
  operator: text('operator').notNull(), // 'equals', 'greater_than', 'less_than', 'contains', 'between', 'in'
  value: text('value').notNull(), // The comparison value
  valueType: text('value_type').notNull().default('string'), // 'string', 'number', 'date', 'boolean'

  // Logic and grouping
  logicConnector: text('logic_connector', { enum: ['AND', 'OR'] }).notNull().default('AND'),
  groupId: text('group_id'), // For grouping complex logic
  priority: integer('priority').notNull().default(0), // Order of evaluation

  // Metadata
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Research Analytics table for storing calculated analytics
export const researchAnalytics = apiSchema.table('research_analytics', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  projectId: uuid('project_id').notNull(), // References api.research_projects.id

  // Analytics metadata
  analysisType: text('analysis_type').notNull(), // 'demographics', 'outcomes', 'comparative', 'longitudinal'
  analysisDate: timestamp('analysis_date').defaultNow().notNull(),

  // Calculated data (JSON)
  analyticsData: text('analytics_data').notNull(), // JSON string of calculated statistics
  chartData: text('chart_data'), // JSON string of chart-ready data

  // Statistical validity
  sampleSize: integer('sample_size').notNull(),
  confidenceLevel: text('confidence_level').default('95%'),
  statisticalSignificance: boolean('statistical_significance').default(false),

  // Export and sharing
  isExported: boolean('is_exported').notNull().default(false),
  exportDate: timestamp('export_date'),
  exportFormat: text('export_format'), // 'csv', 'pdf', 'xlsx'

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Research Exports table for tracking data exports
export const researchExports = apiSchema.table('research_exports', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  projectId: uuid('project_id').notNull(), // References api.research_projects.id
  exportedBy: uuid('exported_by').notNull(), // References auth.users.id

  // Export details
  exportType: text('export_type').notNull(), // 'patient_data', 'analytics', 'full_report'
  format: text('format').notNull(), // 'csv', 'xlsx', 'pdf', 'json'

  // File details
  fileName: text('file_name').notNull(),
  filePath: text('file_path'), // Supabase storage path
  fileSize: integer('file_size'), // in bytes

  // Privacy and compliance
  isAnonymized: boolean('is_anonymized').notNull().default(true),
  privacyLevel: text('privacy_level').notNull().default('high'), // 'high', 'medium', 'low'

  // Access control
  downloadCount: integer('download_count').notNull().default(0),
  lastDownloaded: timestamp('last_downloaded'),
  expiresAt: timestamp('expires_at'), // For time-limited exports

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Research AI Conversations - Store AI chat history for research projects
export const researchAIConversations = apiSchema.table('research_ai_conversations', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  projectId: uuid('project_id'), // References research_projects.id (nullable for temp analysis)
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id

  // Message content
  userQuery: text('user_query').notNull(),
  aiResponse: text('ai_response').notNull(),
  analysisType: text('analysis_type'), // 'analyze_cohort', 'compare_treatments', etc.

  // Context and metadata
  cohortSize: integer('cohort_size'), // Number of patients in analysis
  metadata: text('metadata'), // JSON string for additional data
  source: text('source').notNull().default('langflow'), // 'langflow', 'n8n', 'fallback'

  // Response quality
  confidence: text('confidence'), // 'high', 'medium', 'low'
  processingTime: integer('processing_time'), // milliseconds

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Export type definitions
export type ResearchProject = typeof researchProjects.$inferSelect;
export type NewResearchProject = typeof researchProjects.$inferInsert;
export type ResearchCohort = typeof researchCohorts.$inferSelect;
export type NewResearchCohort = typeof researchCohorts.$inferInsert;
export type ResearchCriteria = typeof researchCriteria.$inferSelect;
export type NewResearchCriteria = typeof researchCriteria.$inferInsert;
export type ResearchAnalytics = typeof researchAnalytics.$inferSelect;
export type NewResearchAnalytics = typeof researchAnalytics.$inferInsert;
export type ResearchExport = typeof researchExports.$inferSelect;
export type NewResearchExport = typeof researchExports.$inferInsert;
export type ResearchAIConversation = typeof researchAIConversations.$inferSelect;
export type NewResearchAIConversation = typeof researchAIConversations.$inferInsert;

// ===============================================
// PATIENT DASHBOARD NEW FEATURES SCHEMA
// ===============================================

// Patient Referrals table for family & friend referral tracking
export const patientReferrals = apiSchema.table('patient_referrals', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  referrerId: uuid('referrer_id').notNull(), // References auth.users.id (patient who made referral)
  referralCode: text('referral_code').notNull().unique(), // Unique code for tracking

  // Sharing details
  sharedVia: text('shared_via', { enum: ['whatsapp', 'sms', 'email', 'facebook', 'twitter', 'link', 'other'] }).notNull(),
  recipientContact: text('recipient_contact'), // Phone/email of person referred
  recipientName: text('recipient_name'), // Optional name of referred person

  // Tracking and success
  shared_at: timestamp('shared_at').defaultNow().notNull(),
  clicked_at: timestamp('clicked_at'), // When referral link was clicked
  registered_referral_id: uuid('registered_referral_id'), // If referral resulted in registration
  reward_status: text('reward_status', { enum: ['pending', 'eligible', 'awarded', 'expired'] }).notNull().default('pending'),

  // Metadata
  custom_message: text('custom_message'), // Personal message from referrer
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Patient Prescriptions table for medication management
export const patientPrescriptions = apiSchema.table('patient_prescriptions', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id (prescribing dentist)
  consultationId: uuid('consultation_id'), // References api.consultations.id (optional)

  // Medication details
  medicationName: text('medication_name').notNull(),
  brandName: text('brand_name'), // Optional brand name
  dosage: text('dosage').notNull(), // e.g., "500mg", "1 tablet"
  strength: text('strength'), // e.g., "500mg"
  form: text('form'), // e.g., "tablet", "capsule", "liquid"

  // Dosing schedule
  frequency: text('frequency').notNull(), // e.g., "twice daily", "every 8 hours"
  timesPerDay: integer('times_per_day').notNull().default(1),
  durationDays: integer('duration_days'), // Total duration in days
  totalQuantity: text('total_quantity'), // Total amount prescribed

  // Schedule timing
  startDate: date('start_date').notNull(),
  endDate: date('end_date'), // Calculated or manually set
  reminderTimes: text('reminder_times').notNull(),
  alarmSound: text('alarm_sound').notNull().default('default'),

  // Instructions and notes
  instructions: text('instructions'), // "Take with food", "Before meals", etc.
  sideEffects: text('side_effects'), // Known side effects to watch for
  notes: text('notes'), // Additional notes from dentist

  // Status and compliance
  status: text('status', { enum: ['active', 'completed', 'discontinued', 'paused'] }).notNull().default('active'),
  priority: text('priority', { enum: ['high', 'medium', 'low'] }).notNull().default('medium'),

  // Refill information
  refillsRemaining: integer('refills_remaining').default(0),
  pharmacyInfo: text('pharmacy_info'), // JSON string

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Medication Reminders table for tracking individual doses
export const medicationReminders = apiSchema.table('medication_reminders', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  prescriptionId: uuid('prescription_id').notNull(), // References api.patient_prescriptions.id
  patientId: uuid('patient_id').notNull(), // References auth.users.id

  // Reminder details
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: time('scheduled_time').notNull(), // e.g., "09:00:00"
  reminderDateTime: timestamp('reminder_date_time').notNull(), // Combined date/time for easy querying

  // Completion tracking
  takenAt: timestamp('taken_at'), // When medication was marked as taken
  skippedAt: timestamp('skipped_at'), // When medication was marked as skipped
  status: text('status', { enum: ['pending', 'taken', 'skipped', 'late', 'missed'] }).notNull().default('pending'),

  // Patient notes and feedback
  patientNotes: text('patient_notes'), // Patient can add notes about taking medication
  sideEffectsReported: text('side_effects_reported'), // Any side effects experienced

  // Notification tracking
  notificationSent: boolean('notification_sent').notNull().default(false),
  notificationSentAt: timestamp('notification_sent_at'),
  reminderCount: integer('reminder_count').notNull().default(0), // How many reminders sent

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Prescription Alarms table for user-created custom medication alarms
export const prescriptionAlarms = apiSchema.table('prescription_alarms', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id

  // Medication details
  medicationName: text('medication_name').notNull(),
  dosage: text('dosage').notNull(),
  form: text('form'), // tablet, capsule, liquid, etc.

  // Schedule configuration
  scheduleType: text('schedule_type', { enum: ['daily', 'weekly', 'monthly', 'custom'] }).notNull(),
  frequencyPerDay: integer('frequency_per_day').notNull().default(1),
  specificTimes: text('specific_times').notNull(), // JSON array of times ["09:00", "21:00"]

  // Duration settings
  durationType: text('duration_type', { enum: ['days', 'weeks', 'months', 'ongoing'] }).notNull(),
  durationValue: integer('duration_value'), // Number of days/weeks/months
  startDate: date('start_date').notNull().default('current_date'),
  endDate: date('end_date'), // Calculated or manually set

  // Alarm settings
  alarmEnabled: boolean('alarm_enabled').notNull().default(true),
  alarmSound: text('alarm_sound').notNull().default('default'),
  snoozeEnabled: boolean('snooze_enabled').notNull().default(true),
  snoozeDurationMinutes: integer('snooze_duration_minutes').notNull().default(10),

  // Instructions and notes
  instructions: text('instructions'),
  additionalNotes: text('additional_notes'),

  // Status tracking
  status: text('status', { enum: ['active', 'paused', 'completed', 'cancelled'] }).notNull().default('active'),
  isArchived: boolean('is_archived').notNull().default(false),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Alarm Instances table for tracking individual alarm occurrences
export const alarmInstances = apiSchema.table('alarm_instances', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  prescriptionAlarmId: uuid('prescription_alarm_id').notNull(), // References api.prescription_alarms.id
  patientId: uuid('patient_id').notNull(), // References auth.users.id

  // Scheduled time details
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: time('scheduled_time').notNull(),
  scheduledDatetime: timestamp('scheduled_datetime').notNull(),

  // Status tracking
  status: text('status', { enum: ['pending', 'taken', 'skipped', 'missed', 'snoozed'] }).notNull().default('pending'),
  takenAt: timestamp('taken_at'),
  skippedAt: timestamp('skipped_at'),
  dismissedAt: timestamp('dismissed_at'),

  // Snooze tracking
  snoozeCount: integer('snooze_count').notNull().default(0),
  snoozeUntil: timestamp('snooze_until'),
  originalTime: timestamp('original_time'),

  // Patient feedback
  patientNotes: text('patient_notes'),
  sideEffectsReported: text('side_effects_reported'),

  // Notification tracking
  notificationSent: boolean('notification_sent').notNull().default(false),
  notificationSentAt: timestamp('notification_sent_at'),
  browserNotificationId: text('browser_notification_id'), // For managing browser notifications

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Message Threads table for enhanced patient-dentist communication
export const messageThreads = apiSchema.table('message_threads', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  patientId: uuid('patient_id').notNull(), // References auth.users.id
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id

  // Thread details
  subject: text('subject').notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  lastMessagePreview: text('last_message_preview'), // First 100 chars of last message

  // Thread status and priority
  status: text('status', { enum: ['active', 'resolved', 'archived'] }).notNull().default('active'),
  priority: text('priority', { enum: ['urgent', 'high', 'normal', 'low'] }).notNull().default('normal'),
  isUrgent: boolean('is_urgent').notNull().default(false),

  // Participant tracking
  patientUnreadCount: integer('patient_unread_count').notNull().default(0),
  dentistUnreadCount: integer('dentist_unread_count').notNull().default(0),

  // Metadata
  messageCount: integer('message_count').notNull().default(0),
  tags: text('tags'), // JSON array of tags for categorization
  relatedAppointmentId: uuid('related_appointment_id'), // Optional link to appointment

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Enhanced Messages table (extending existing functionality)
export const threadMessages = apiSchema.table('thread_messages', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  threadId: uuid('thread_id').notNull(), // References api.message_threads.id
  senderId: uuid('sender_id').notNull(), // References auth.users.id
  senderType: text('sender_type', { enum: ['patient', 'dentist'] }).notNull(),

  // Message content
  content: text('content').notNull(),
  messageType: text('message_type', { enum: ['text', 'image', 'file', 'voice', 'system'] }).notNull().default('text'),

  // File attachments
  attachments: text('attachments'), // JSON array of attachment URLs/metadata

  // Message status
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),

  // Reply/thread functionality
  replyToMessageId: uuid('reply_to_message_id'), // References another thread_messages.id

  // System message data
  systemMessageType: text('system_message_type'), // For system-generated messages
  systemMessageData: text('system_message_data'), // JSON data for system messages

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Export new types
export type PatientReferral = typeof patientReferrals.$inferSelect;
export type NewPatientReferral = typeof patientReferrals.$inferInsert;
export type PatientPrescription = typeof patientPrescriptions.$inferSelect;
export type NewPatientPrescription = typeof patientPrescriptions.$inferInsert;
export type MedicationReminder = typeof medicationReminders.$inferSelect;
export type NewMedicationReminder = typeof medicationReminders.$inferInsert;
export type PrescriptionAlarm = typeof prescriptionAlarms.$inferSelect;
export type NewPrescriptionAlarm = typeof prescriptionAlarms.$inferInsert;
export type AlarmInstance = typeof alarmInstances.$inferSelect;
export type NewAlarmInstance = typeof alarmInstances.$inferInsert;
export type MessageThread = typeof messageThreads.$inferSelect;
export type NewMessageThread = typeof messageThreads.$inferInsert;
export type ThreadMessage = typeof threadMessages.$inferSelect;
export type NewThreadMessage = typeof threadMessages.$inferInsert;

// ===============================================
// TEMPLATES MANAGEMENT SCHEMA
// ===============================================

// Clinical Templates table for managing reusable clinical documentation templates
export const clinicalTemplates = apiSchema.table('clinical_templates', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id (creator)

  // Template metadata
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category', {
    enum: ['endodontics', 'periodontics', 'oral_surgery', 'restorative', 'orthodontics', 'general', 'emergency', 'pediatric', 'prosthetics', 'diagnostics']
  }).notNull().default('general'),

  // Template content and structure
  templateContent: text('template_content').notNull(), // JSON string of form fields and structure
  formFields: text('form_fields').notNull(), // JSON array of field definitions
  defaultValues: text('default_values'), // JSON object of default field values

  // Usage and sharing
  isPublic: boolean('is_public').notNull().default(false), // Can other dentists use this template?
  isActive: boolean('is_active').notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0), // How many times used

  // Clinical relevance
  specialties: text('specialties'), // JSON array of relevant specialties
  tags: text('tags'), // JSON array of searchable tags
  clinicalIndications: text('clinical_indications'), // When to use this template

  // Version control and collaboration
  version: text('version').notNull().default('1.0'),
  parentTemplateId: uuid('parent_template_id'), // References another clinical_templates.id for versions
  collaborators: text('collaborators'), // JSON array of dentist IDs with edit access

  // Quality and validation
  isValidated: boolean('is_validated').notNull().default(false), // Reviewed by senior dentist
  validatedBy: uuid('validated_by'), // References auth.users.id
  validatedAt: timestamp('validated_at'),
  validationNotes: text('validation_notes'),

  // System metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
  archivedAt: timestamp('archived_at'), // Soft delete timestamp
});

// Template Usage History for tracking when templates are used
export const templateUsageHistory = apiSchema.table('template_usage_history', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  templateId: uuid('template_id').notNull(), // References api.clinical_templates.id
  dentistId: uuid('dentist_id').notNull(), // References auth.users.id (user)
  patientId: uuid('patient_id'), // References auth.users.id (optional - if used for specific patient)
  consultationId: uuid('consultation_id'), // References api.consultations.id (optional)

  // Usage details
  usageDate: timestamp('usage_date').defaultNow().notNull(),
  completionStatus: text('completion_status', { enum: ['draft', 'completed', 'partially_completed', 'cancelled'] }).notNull().default('completed'),

  // Performance tracking
  timeToComplete: integer('time_to_complete'), // in seconds
  modifications: text('modifications'), // JSON string of field modifications made
  customizations: text('customizations'), // JSON string of template customizations

  // Feedback
  rating: integer('rating'), // 1-5 star rating of template usefulness
  feedback: text('feedback'), // User feedback about template
  suggestedImprovements: text('suggested_improvements'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Template Categories table for managing template organization
export const templateCategories = apiSchema.table('template_categories', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),

  // Visual and organizational
  colorCode: text('color_code').notNull().default('#6b7280'), // Tailwind color for UI
  icon: text('icon').notNull().default('folder'), // Icon name for UI
  sortOrder: integer('sort_order').notNull().default(0),

  // Hierarchy support
  parentCategoryId: uuid('parent_category_id'), // References another template_categories.id
  level: integer('level').notNull().default(0), // Hierarchy level (0 = root)

  // Status
  isActive: boolean('is_active').notNull().default(true),
  templateCount: integer('template_count').notNull().default(0), // Updated via triggers

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Export template types
export type ClinicalTemplate = typeof clinicalTemplates.$inferSelect;
export type NewClinicalTemplate = typeof clinicalTemplates.$inferInsert;
export type TemplateUsageHistory = typeof templateUsageHistory.$inferSelect;
export type NewTemplateUsageHistory = typeof templateUsageHistory.$inferInsert;
export type TemplateCategory = typeof templateCategories.$inferSelect;
export type NewTemplateCategory = typeof templateCategories.$inferInsert;

// ===============================================
// ASSISTANT TASKS MANAGEMENT SCHEMA
// ===============================================

// Assistant Tasks table for task management system
export const assistantTasks = apiSchema.table('assistant_tasks', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  createdBy: uuid('created_by').notNull(), // References auth.users.id (dentist who created task)
  assignedTo: uuid('assigned_to'), // References auth.users.id (assistant assigned, null = unassigned)

  // Task details
  title: text('title').notNull(),
  description: text('description').notNull(),

  // Patient association (optional)
  patientId: uuid('patient_id'), // References auth.users.id
  patientName: text('patient_name'), // Cached for performance

  // Priority and scheduling
  priority: text('priority', { enum: ['urgent', 'high', 'medium', 'low'] }).notNull().default('medium'),
  dueDate: timestamp('due_date'),
  estimatedDuration: integer('estimated_duration'), // in minutes

  // Status workflow
  status: text('status', { enum: ['todo', 'in_progress', 'completed', 'cancelled', 'on_hold'] }).notNull().default('todo'),

  // Progress tracking
  startedAt: timestamp('started_at'), // When assistant started working
  completedAt: timestamp('completed_at'), // When task was completed

  // Additional metadata
  category: text('category'), // 'patient_care', 'administrative', 'clinical_support', etc.
  tags: text('tags'), // JSON array for filtering
  notes: text('notes'), // Additional notes or instructions

  // Status tracking
  isUrgent: boolean('is_urgent').notNull().default(false),
  requiresFollowUp: boolean('requires_follow_up').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Task Comments table for communication between dentist and assistant
export const taskComments = apiSchema.table('task_comments', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  taskId: uuid('task_id').notNull(), // References api.assistant_tasks.id
  authorId: uuid('author_id').notNull(), // References auth.users.id
  authorType: text('author_type', { enum: ['dentist', 'assistant'] }).notNull(),

  // Comment content
  comment: text('comment').notNull(),
  commentType: text('comment_type', { enum: ['update', 'question', 'instruction', 'completion'] }).notNull().default('update'),

  // Status change tracking
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Task Activity Log for comprehensive tracking
export const taskActivityLog = apiSchema.table('task_activity_log', {
  id: uuid('id').primaryKey().default('gen_random_uuid()'),
  taskId: uuid('task_id').notNull(), // References api.assistant_tasks.id
  userId: uuid('user_id').notNull(), // References auth.users.id (who performed action)
  userType: text('user_type', { enum: ['dentist', 'assistant'] }).notNull(),

  // Activity details
  action: text('action').notNull(), // 'created', 'status_changed', 'assigned', 'commented', etc.
  previousValue: text('previous_value'), // Old value for comparison
  newValue: text('new_value'), // New value

  // Context
  description: text('description').notNull(), // Human readable description
  metadata: text('metadata'), // JSON string for additional context

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Export task management types
export type AssistantTask = typeof assistantTasks.$inferSelect;
export type NewAssistantTask = typeof assistantTasks.$inferInsert;
export type TaskComment = typeof taskComments.$inferSelect;
export type NewTaskComment = typeof taskComments.$inferInsert;
export type TaskActivityLog = typeof taskActivityLog.$inferSelect;
export type NewTaskActivityLog = typeof taskActivityLog.$inferInsert;
