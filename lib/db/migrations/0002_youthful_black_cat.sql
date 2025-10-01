CREATE TABLE "api"."consultations" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"dentist_id" uuid NOT NULL,
	"consultation_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"chief_complaint" text,
	"pain_assessment" text,
	"medical_history" text,
	"clinical_examination" text,
	"investigations" text,
	"diagnosis" text,
	"treatment_plan" text,
	"prognosis" text,
	"voice_transcript" text,
	"ai_parsed_data" text,
	"voice_session_active" boolean DEFAULT false NOT NULL,
	"prescription_data" text,
	"follow_up_data" text,
	"additional_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."medication_reminders" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"prescription_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"scheduled_time" time NOT NULL,
	"reminder_date_time" timestamp NOT NULL,
	"taken_at" timestamp,
	"skipped_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"patient_notes" text,
	"side_effects_reported" text,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"notification_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."message_threads" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"dentist_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"last_message_preview" text,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_urgent" boolean DEFAULT false NOT NULL,
	"patient_unread_count" integer DEFAULT 0 NOT NULL,
	"dentist_unread_count" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"tags" text,
	"related_appointment_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."patient_files" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_name" text NOT NULL,
	"original_file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"file_type" text NOT NULL,
	"description" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."patient_prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"dentist_id" uuid NOT NULL,
	"consultation_id" uuid,
	"medication_name" text NOT NULL,
	"brand_name" text,
	"dosage" text NOT NULL,
	"strength" text,
	"form" text,
	"frequency" text NOT NULL,
	"times_per_day" integer DEFAULT 1 NOT NULL,
	"duration_days" integer,
	"total_quantity" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"reminder_times" text NOT NULL,
	"instructions" text,
	"side_effects" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"refills_remaining" integer DEFAULT 0,
	"pharmacy_info" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."patient_referrals" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"shared_via" text NOT NULL,
	"recipient_contact" text,
	"recipient_name" text,
	"shared_at" timestamp DEFAULT now() NOT NULL,
	"clicked_at" timestamp,
	"registered_referral_id" uuid,
	"reward_status" text DEFAULT 'pending' NOT NULL,
	"custom_message" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patient_referrals_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "api"."research_analytics" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_type" text NOT NULL,
	"analysis_date" timestamp DEFAULT now() NOT NULL,
	"analytics_data" text NOT NULL,
	"chart_data" text,
	"sample_size" integer NOT NULL,
	"confidence_level" text DEFAULT '95%',
	"statistical_significance" boolean DEFAULT false,
	"is_exported" boolean DEFAULT false NOT NULL,
	"export_date" timestamp,
	"export_format" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."research_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"project_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"inclusion_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'included' NOT NULL,
	"anonymous_id" text NOT NULL,
	"baseline_data_collected" boolean DEFAULT false NOT NULL,
	"follow_up_data_collected" boolean DEFAULT false NOT NULL,
	"research_data" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."research_criteria" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"project_id" uuid NOT NULL,
	"field" text NOT NULL,
	"operator" text NOT NULL,
	"value" text NOT NULL,
	"value_type" text DEFAULT 'string' NOT NULL,
	"logic_connector" text DEFAULT 'AND' NOT NULL,
	"group_id" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."research_exports" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"project_id" uuid NOT NULL,
	"exported_by" uuid NOT NULL,
	"export_type" text NOT NULL,
	"format" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text,
	"file_size" integer,
	"is_anonymized" boolean DEFAULT true NOT NULL,
	"privacy_level" text DEFAULT 'high' NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"last_downloaded" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."research_projects" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"dentist_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"research_type" text,
	"study_period_start" date,
	"study_period_end" date,
	"filter_criteria" text NOT NULL,
	"inclusion_criteria" text,
	"exclusion_criteria" text,
	"total_patients" integer DEFAULT 0 NOT NULL,
	"last_analysis_date" timestamp,
	"is_public" boolean DEFAULT false NOT NULL,
	"collaborators" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."thread_messages" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"attachments" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"reply_to_message_id" uuid,
	"system_message_type" text,
	"system_message_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."tooth_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"tooth_number" text NOT NULL,
	"status" text DEFAULT 'healthy' NOT NULL,
	"primary_diagnosis" text,
	"diagnosis_details" text,
	"symptoms" text,
	"recommended_treatment" text,
	"treatment_priority" text DEFAULT 'medium' NOT NULL,
	"treatment_details" text,
	"estimated_duration" integer,
	"estimated_cost" text,
	"color_code" text DEFAULT '#22c55e' NOT NULL,
	"scheduled_date" date,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"examination_date" date DEFAULT 'CURRENT_DATE',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."voice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"consultation_id" uuid NOT NULL,
	"dentist_id" uuid NOT NULL,
	"session_start" timestamp DEFAULT now() NOT NULL,
	"session_end" timestamp,
	"duration_seconds" integer,
	"transcript" text,
	"raw_audio_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"n8n_webhook_url" text,
	"n8n_session_id" uuid,
	"processed_data" text,
	"ai_confidence" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api"."patients" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "api"."patients" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "api"."patients" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "api"."patients" ADD COLUMN "emergency_contact_phone" text;--> statement-breakpoint
ALTER TABLE "api"."pending_registrations" ADD COLUMN "user_id" uuid NOT NULL;