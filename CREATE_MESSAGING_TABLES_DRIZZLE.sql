-- Create missing messaging tables from Drizzle migration
-- Extract from 0002_youthful_black_cat.sql

CREATE TABLE IF NOT EXISTS "api"."message_threads" (
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

CREATE TABLE IF NOT EXISTS "api"."thread_messages" (
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

-- Enable RLS on these tables
ALTER TABLE "api"."message_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api"."thread_messages" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "message_threads_participants_select" ON "api"."message_threads";
DROP POLICY IF EXISTS "message_threads_participants_insert" ON "api"."message_threads";
DROP POLICY IF EXISTS "message_threads_participants_update" ON "api"."message_threads";
DROP POLICY IF EXISTS "thread_messages_participants_select" ON "api"."thread_messages";
DROP POLICY IF EXISTS "thread_messages_participants_insert" ON "api"."thread_messages";
DROP POLICY IF EXISTS "thread_messages_participants_update" ON "api"."thread_messages";

-- Basic RLS policies for message_threads
CREATE POLICY "message_threads_participants_select"
ON "api"."message_threads" FOR SELECT TO authenticated
USING (patient_id = auth.uid() OR dentist_id = auth.uid());

CREATE POLICY "message_threads_participants_insert"
ON "api"."message_threads" FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid() OR dentist_id = auth.uid());

CREATE POLICY "message_threads_participants_update"
ON "api"."message_threads" FOR UPDATE TO authenticated
USING (patient_id = auth.uid() OR dentist_id = auth.uid())
WITH CHECK (patient_id = auth.uid() OR dentist_id = auth.uid());

-- Basic RLS policies for thread_messages
CREATE POLICY "thread_messages_participants_select"
ON "api"."thread_messages" FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM "api"."message_threads"
        WHERE id = thread_id
        AND (patient_id = auth.uid() OR dentist_id = auth.uid())
    )
);

CREATE POLICY "thread_messages_participants_insert"
ON "api"."thread_messages" FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "api"."message_threads"
        WHERE id = thread_id
        AND (patient_id = auth.uid() OR dentist_id = auth.uid())
    )
    AND sender_id = auth.uid()
);

CREATE POLICY "thread_messages_participants_update"
ON "api"."thread_messages" FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_message_threads_patient" ON "api"."message_threads"("patient_id");
CREATE INDEX IF NOT EXISTS "idx_message_threads_dentist" ON "api"."message_threads"("dentist_id");
CREATE INDEX IF NOT EXISTS "idx_message_threads_last_message" ON "api"."message_threads"("last_message_at");
CREATE INDEX IF NOT EXISTS "idx_thread_messages_thread" ON "api"."thread_messages"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_thread_messages_sender" ON "api"."thread_messages"("sender_id");

-- Success notification
DO $$
BEGIN
    RAISE NOTICE '✅ Messaging tables created successfully!';
    RAISE NOTICE '   • api.message_threads';
    RAISE NOTICE '   • api.thread_messages';
    RAISE NOTICE '   • RLS policies applied';
    RAISE NOTICE '   • Performance indexes created';
END $$;