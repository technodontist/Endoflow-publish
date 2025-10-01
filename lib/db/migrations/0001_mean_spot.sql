CREATE SCHEMA "api";
--> statement-breakpoint
CREATE TABLE "api"."appointment_requests" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_type" text NOT NULL,
	"preferred_date" date NOT NULL,
	"preferred_time" text NOT NULL,
	"reason_for_visit" text NOT NULL,
	"pain_level" integer,
	"additional_notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"assigned_to" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."appointments" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"dentist_id" uuid NOT NULL,
	"assistant_id" uuid,
	"appointment_request_id" uuid,
	"scheduled_date" date NOT NULL,
	"scheduled_time" time NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"appointment_type" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."assistants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."dentists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"specialty" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."messages" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"message" text NOT NULL,
	"is_from_patient" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."patients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" date,
	"medical_history_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."pending_registrations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"form_data" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."treatments" (
	"id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"patient_id" uuid NOT NULL,
	"dentist_id" uuid NOT NULL,
	"appointment_id" uuid,
	"treatment_type" text NOT NULL,
	"description" text,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "patients" CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_email_unique";--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "full_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "last_name";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "updated_at";