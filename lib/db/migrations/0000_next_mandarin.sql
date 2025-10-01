CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uhid" text NOT NULL,
	"date_of_birth" timestamp,
	"address" text,
	"emergency_contact" text,
	"medical_history" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_uhid_unique" UNIQUE("uhid")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"role" text DEFAULT 'patient' NOT NULL,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_id_profiles_id_fk" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;