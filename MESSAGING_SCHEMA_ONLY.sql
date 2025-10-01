-- ===============================================
-- MESSAGING SYSTEM SCHEMA ONLY
-- ===============================================
-- Run this in Supabase SQL Editor to enable messaging features only
-- (Avoids conflicts with existing referral/prescription tables)

-- Check if message_threads table exists, create if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'message_threads') THEN
        CREATE TABLE api.message_threads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL,
            dentist_id UUID NOT NULL,
            appointment_id UUID,

            -- Thread metadata
            subject TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
            is_urgent BOOLEAN NOT NULL DEFAULT false,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),

            -- Message tracking
            last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            last_message_preview TEXT,
            patient_unread_count INTEGER NOT NULL DEFAULT 0,
            dentist_unread_count INTEGER NOT NULL DEFAULT 0,
            message_count INTEGER NOT NULL DEFAULT 0,

            -- Timestamps
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

            CONSTRAINT fk_message_threads_patient
                FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE,
            CONSTRAINT fk_message_threads_dentist
                FOREIGN KEY (dentist_id) REFERENCES auth.users(id) ON DELETE CASCADE,
            CONSTRAINT fk_message_threads_appointment
                FOREIGN KEY (appointment_id) REFERENCES api.appointments(id) ON DELETE SET NULL
        );
        RAISE NOTICE '✅ Created api.message_threads table';
    ELSE
        RAISE NOTICE '⚠️ api.message_threads table already exists';
    END IF;
END $$;

-- Check if thread_messages table exists, create if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'thread_messages') THEN
        CREATE TABLE api.thread_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            thread_id UUID NOT NULL,
            sender_id UUID NOT NULL,
            sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'dentist')),

            -- Message content
            content TEXT NOT NULL,
            message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'image', 'file')),

            -- Status tracking
            is_read BOOLEAN NOT NULL DEFAULT false,
            read_at TIMESTAMP WITH TIME ZONE,

            -- Timestamps
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

            CONSTRAINT fk_thread_messages_thread
                FOREIGN KEY (thread_id) REFERENCES api.message_threads(id) ON DELETE CASCADE,
            CONSTRAINT fk_thread_messages_sender
                FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE
        );
        RAISE NOTICE '✅ Created api.thread_messages table';
    ELSE
        RAISE NOTICE '⚠️ api.thread_messages table already exists';
    END IF;
END $$;

-- Enable RLS on message_threads if not already enabled
ALTER TABLE api.message_threads ENABLE ROW LEVEL SECURITY;

-- Enable RLS on thread_messages if not already enabled
ALTER TABLE api.thread_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Participants can view their threads" ON api.message_threads;
DROP POLICY IF EXISTS "Participants can create threads" ON api.message_threads;
DROP POLICY IF EXISTS "Participants can update threads" ON api.message_threads;
DROP POLICY IF EXISTS "Thread participants can view messages" ON api.thread_messages;
DROP POLICY IF EXISTS "Thread participants can create messages" ON api.thread_messages;
DROP POLICY IF EXISTS "Senders can update their messages" ON api.thread_messages;

-- Create RLS policies for message_threads
CREATE POLICY "Participants can view their threads" ON api.message_threads
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid() OR dentist_id = auth.uid());

CREATE POLICY "Participants can create threads" ON api.message_threads
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = auth.uid() OR dentist_id = auth.uid());

CREATE POLICY "Participants can update threads" ON api.message_threads
    FOR UPDATE TO authenticated
    USING (patient_id = auth.uid() OR dentist_id = auth.uid())
    WITH CHECK (patient_id = auth.uid() OR dentist_id = auth.uid());

-- Create RLS policies for thread_messages
CREATE POLICY "Thread participants can view messages" ON api.thread_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM api.message_threads
            WHERE id = thread_id
            AND (patient_id = auth.uid() OR dentist_id = auth.uid())
        )
    );

CREATE POLICY "Thread participants can create messages" ON api.thread_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM api.message_threads
            WHERE id = thread_id
            AND (patient_id = auth.uid() OR dentist_id = auth.uid())
        )
        AND sender_id = auth.uid()
    );

CREATE POLICY "Senders can update their messages" ON api.thread_messages
    FOR UPDATE TO authenticated
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_threads_patient ON api.message_threads(patient_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_dentist ON api.message_threads(dentist_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message ON api.message_threads(last_message_at);
CREATE INDEX IF NOT EXISTS idx_message_threads_status ON api.message_threads(status);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON api.thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_sender ON api.thread_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_created ON api.thread_messages(created_at);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION api.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for message_threads updated_at
DROP TRIGGER IF EXISTS set_timestamp_message_threads ON api.message_threads;
CREATE TRIGGER set_timestamp_message_threads
    BEFORE UPDATE ON api.message_threads
    FOR EACH ROW
    EXECUTE FUNCTION api.update_updated_at_column();

-- Summary
DO $$
BEGIN
    RAISE NOTICE '🎉 Messaging system schema setup complete!';
    RAISE NOTICE '   • api.message_threads (Enhanced Messaging)';
    RAISE NOTICE '   • api.thread_messages (Individual Messages)';
    RAISE NOTICE '   • Row Level Security policies applied';
    RAISE NOTICE '   • Performance indexes created';
    RAISE NOTICE '   • Triggers for timestamp updates';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Next steps:';
    RAISE NOTICE '   1. Test messaging from dentist dashboard';
    RAISE NOTICE '   2. Create conversations from patient dashboard';
    RAISE NOTICE '   3. Verify real-time updates work';
END $$;
