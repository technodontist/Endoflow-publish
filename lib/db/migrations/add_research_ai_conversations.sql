-- Migration: Add Research AI Conversations Table
-- Purpose: Store AI chat history for research projects with LangFlow integration
-- Created: 2025-01-XX

-- Create the research_ai_conversations table
CREATE TABLE IF NOT EXISTS api.research_ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, -- References api.research_projects.id (nullable for temp analysis)
    dentist_id UUID NOT NULL, -- References auth.users.id

    -- Message content
    user_query TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    analysis_type TEXT, -- 'analyze_cohort', 'compare_treatments', 'predict_outcomes', etc.

    -- Context and metadata
    cohort_size INTEGER, -- Number of patients in analysis
    metadata TEXT, -- JSON string for additional data (filters, parameters, etc.)
    source TEXT NOT NULL DEFAULT 'langflow', -- 'langflow', 'n8n', 'fallback'

    -- Response quality tracking
    confidence TEXT, -- 'high', 'medium', 'low'
    processing_time INTEGER, -- milliseconds

    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_project_id
    ON api.research_ai_conversations(project_id);

CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_dentist_id
    ON api.research_ai_conversations(dentist_id);

CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_created_at
    ON api.research_ai_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_ai_conversations_analysis_type
    ON api.research_ai_conversations(analysis_type);

-- Add foreign key constraints (with ON DELETE CASCADE for cleanup)
ALTER TABLE api.research_ai_conversations
    ADD CONSTRAINT fk_research_ai_conversations_project
    FOREIGN KEY (project_id)
    REFERENCES api.research_projects(id)
    ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE api.research_ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Dentists can only view their own AI conversations
CREATE POLICY "Dentists can view their own AI conversations"
    ON api.research_ai_conversations
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

-- RLS Policy: Dentists can insert their own AI conversations
CREATE POLICY "Dentists can insert their own AI conversations"
    ON api.research_ai_conversations
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

-- RLS Policy: Dentists can delete their own AI conversations
CREATE POLICY "Dentists can delete their own AI conversations"
    ON api.research_ai_conversations
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

-- Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON api.research_ai_conversations TO authenticated;
GRANT USAGE ON SCHEMA api TO authenticated;

-- Add helpful comments
COMMENT ON TABLE api.research_ai_conversations IS 'Stores AI-powered research conversations and analysis results from LangFlow';
COMMENT ON COLUMN api.research_ai_conversations.project_id IS 'Optional: Links conversation to a research project. NULL for temporary analysis';
COMMENT ON COLUMN api.research_ai_conversations.source IS 'AI source: langflow (production), n8n (legacy), fallback (development)';
COMMENT ON COLUMN api.research_ai_conversations.metadata IS 'JSON string containing filters, cohort data, and analysis parameters';
COMMENT ON COLUMN api.research_ai_conversations.processing_time IS 'AI response time in milliseconds for performance monitoring';
