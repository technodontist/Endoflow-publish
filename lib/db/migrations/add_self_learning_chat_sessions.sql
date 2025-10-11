-- Migration: Add Self-Learning AI Chat Sessions
-- Purpose: Store chat history for Self-Learning AI assistant (Gemini-style)
-- Created: 2025-01-10
-- Based on: clinic_analysis_chat_sessions structure

-- ============================================
-- Table 1: Self-Learning Chat Sessions (Threads)
-- ============================================
CREATE TABLE IF NOT EXISTS api.self_learning_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dentist_id UUID NOT NULL, -- References auth.users.id

    -- Session metadata
    title TEXT NOT NULL DEFAULT 'New Learning Session',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

    -- Session summary
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_preview TEXT, -- First 100 chars of last message
    last_activity_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    -- Learning context (optional)
    diagnosis TEXT, -- Primary diagnosis being studied
    treatment TEXT, -- Treatment being learned
    patient_id UUID, -- Optional: linked patient context
    patient_name TEXT -- Optional: patient name for context
);

-- ============================================
-- Table 2: Self-Learning Chat Messages
-- ============================================
CREATE TABLE IF NOT EXISTS api.self_learning_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES api.self_learning_chat_sessions(id) ON DELETE CASCADE,

    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL,

    -- Metadata (optional)
    metadata JSONB, -- treatment_options, learning_steps, sources, etc.

    -- Ordering
    sequence_number INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_self_learning_sessions_dentist_id
    ON api.self_learning_chat_sessions(dentist_id);

CREATE INDEX IF NOT EXISTS idx_self_learning_sessions_updated_at
    ON api.self_learning_chat_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_learning_sessions_last_activity
    ON api.self_learning_chat_sessions(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_learning_sessions_diagnosis
    ON api.self_learning_chat_sessions(diagnosis);

CREATE INDEX IF NOT EXISTS idx_self_learning_sessions_patient_id
    ON api.self_learning_chat_sessions(patient_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_self_learning_messages_session_id
    ON api.self_learning_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_self_learning_messages_timestamp
    ON api.self_learning_messages(timestamp ASC);

CREATE INDEX IF NOT EXISTS idx_self_learning_messages_sequence
    ON api.self_learning_messages(session_id, sequence_number);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE api.self_learning_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.self_learning_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: Dentists can view only their own sessions
CREATE POLICY "Dentists can view their own learning sessions"
    ON api.self_learning_chat_sessions
    FOR SELECT
    TO authenticated
    USING (
        dentist_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

-- Sessions: Dentists can insert their own sessions
CREATE POLICY "Dentists can insert their own learning sessions"
    ON api.self_learning_chat_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        dentist_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

-- Sessions: Dentists can update their own sessions
CREATE POLICY "Dentists can update their own learning sessions"
    ON api.self_learning_chat_sessions
    FOR UPDATE
    TO authenticated
    USING (
        dentist_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

-- Sessions: Dentists can delete their own sessions
CREATE POLICY "Dentists can delete their own learning sessions"
    ON api.self_learning_chat_sessions
    FOR DELETE
    TO authenticated
    USING (
        dentist_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

-- Messages: Dentists can view messages from their own sessions
CREATE POLICY "Dentists can view messages from their own learning sessions"
    ON api.self_learning_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM api.self_learning_chat_sessions
            WHERE id = session_id
            AND dentist_id = auth.uid()
        )
    );

-- Messages: Dentists can insert messages to their own sessions
CREATE POLICY "Dentists can insert messages to their own learning sessions"
    ON api.self_learning_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM api.self_learning_chat_sessions
            WHERE id = session_id
            AND dentist_id = auth.uid()
        )
    );

-- Messages: Dentists can delete messages from their own sessions
CREATE POLICY "Dentists can delete messages from their own learning sessions"
    ON api.self_learning_messages
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM api.self_learning_chat_sessions
            WHERE id = session_id
            AND dentist_id = auth.uid()
        )
    );

-- ============================================
-- Permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON api.self_learning_chat_sessions TO authenticated;
GRANT SELECT, INSERT, DELETE ON api.self_learning_messages TO authenticated;
GRANT USAGE ON SCHEMA api TO authenticated;

-- Service role needs full access
GRANT ALL ON api.self_learning_chat_sessions TO service_role;
GRANT ALL ON api.self_learning_messages TO service_role;

-- ============================================
-- Helper Function: Update Session Metadata
-- ============================================
CREATE OR REPLACE FUNCTION api.update_self_learning_session_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update message count and last activity
    UPDATE api.self_learning_chat_sessions
    SET
        message_count = (
            SELECT COUNT(*)
            FROM api.self_learning_messages
            WHERE session_id = NEW.session_id
        ),
        last_message_preview = LEFT(NEW.content, 100),
        last_activity_at = NEW.timestamp,
        updated_at = NOW()
    WHERE id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update session metadata when new message is added
CREATE TRIGGER trigger_update_self_learning_session_metadata
    AFTER INSERT ON api.self_learning_messages
    FOR EACH ROW
    EXECUTE FUNCTION api.update_self_learning_session_metadata();

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE api.self_learning_chat_sessions IS 'Chat sessions for Self-Learning AI assistant - Gemini-style conversation threads for treatment learning';
COMMENT ON TABLE api.self_learning_messages IS 'Individual messages within self-learning chat sessions';
COMMENT ON COLUMN api.self_learning_chat_sessions.diagnosis IS 'Primary diagnosis being studied in this session';
COMMENT ON COLUMN api.self_learning_chat_sessions.treatment IS 'Treatment protocol being learned';
COMMENT ON COLUMN api.self_learning_chat_sessions.patient_id IS 'Optional patient context for case-specific learning';
COMMENT ON COLUMN api.self_learning_messages.metadata IS 'JSON metadata: treatment_options, learning_steps, sources, patient_context, etc.';
COMMENT ON COLUMN api.self_learning_messages.sequence_number IS 'Message ordering within session for proper chronological display';

-- ============================================
-- Verify Tables Created
-- ============================================
SELECT 
    'Self-Learning Chat tables created successfully!' AS status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'self_learning_chat_sessions') AS sessions_table_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'self_learning_messages') AS messages_table_exists;
