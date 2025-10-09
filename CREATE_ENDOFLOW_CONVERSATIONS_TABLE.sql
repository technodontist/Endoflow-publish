-- ================================================================
-- ENDOFLOW MASTER AI CONVERSATIONS TABLE
-- Purpose: Store conversation history for the master AI orchestrator
-- ================================================================

-- Create the conversations table
CREATE TABLE IF NOT EXISTS api.endoflow_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dentist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  intent_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_endoflow_conversations_dentist_id
  ON api.endoflow_conversations(dentist_id);

CREATE INDEX IF NOT EXISTS idx_endoflow_conversations_last_message_at
  ON api.endoflow_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_endoflow_conversations_intent_type
  ON api.endoflow_conversations(intent_type);

-- Enable Row Level Security
ALTER TABLE api.endoflow_conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for dentists
CREATE POLICY "Dentists can view their own conversations"
  ON api.endoflow_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'dentist'
      AND status = 'active'
    )
    AND dentist_id = auth.uid()
  );

CREATE POLICY "Dentists can create their own conversations"
  ON api.endoflow_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'dentist'
      AND status = 'active'
    )
    AND dentist_id = auth.uid()
  );

CREATE POLICY "Dentists can update their own conversations"
  ON api.endoflow_conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'dentist'
      AND status = 'active'
    )
    AND dentist_id = auth.uid()
  );

CREATE POLICY "Dentists can delete their own conversations"
  ON api.endoflow_conversations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'dentist'
      AND status = 'active'
    )
    AND dentist_id = auth.uid()
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON api.endoflow_conversations TO authenticated;
GRANT USAGE ON SCHEMA api TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE api.endoflow_conversations IS 'Stores conversation history for EndoFlow Master AI orchestrator';
COMMENT ON COLUMN api.endoflow_conversations.messages IS 'JSONB array of {role, content, timestamp, agentName} conversation messages';
COMMENT ON COLUMN api.endoflow_conversations.intent_type IS 'Last detected intent type (clinical_research, appointment_scheduling, etc.)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ EndoFlow Conversations table created successfully!';
  RAISE NOTICE '📋 Table: api.endoflow_conversations';
  RAISE NOTICE '🔒 RLS enabled with dentist-only access policies';
  RAISE NOTICE '📊 Indexes created for optimal query performance';
END $$;
