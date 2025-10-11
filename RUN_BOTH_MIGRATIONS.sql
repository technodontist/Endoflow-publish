-- ==============================================================================
-- COMPLETE VOICE DIAGNOSIS & AI SETUP - RUN THIS IN SUPABASE SQL EDITOR
-- ==============================================================================
-- This file combines both required migrations:
-- 1. Voice extraction columns (already working in your case)
-- 2. AI diagnosis cache table (needed for AI suggestions)
-- ==============================================================================

-- ==============================================================================
-- PART 1: Voice Extraction Columns (You already have these working!)
-- ==============================================================================

ALTER TABLE api.consultations
ADD COLUMN IF NOT EXISTS global_voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS global_voice_processed_data TEXT,
ADD COLUMN IF NOT EXISTS voice_recording_duration INTEGER,
ADD COLUMN IF NOT EXISTS voice_extracted_tooth_diagnoses TEXT;

SELECT '✅ Voice extraction columns ready!' as status;

-- ==============================================================================
-- PART 2: AI Diagnosis Cache Table (NEEDS TO RUN FOR AI SUGGESTIONS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS api.ai_diagnosis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Query identifiers
    symptoms_key TEXT NOT NULL,
    symptoms TEXT[] NOT NULL,
    pain_characteristics JSONB,
    clinical_findings TEXT,
    tooth_number TEXT,
    patient_context JSONB,

    -- AI suggestions
    suggested_diagnosis TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    reasoning TEXT NOT NULL,
    clinical_significance TEXT NOT NULL,
    differential_diagnoses TEXT[] NOT NULL DEFAULT '{}',
    recommended_tests TEXT[] DEFAULT '{}',
    evidence_sources JSONB NOT NULL DEFAULT '[]',

    -- Metadata
    ai_model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    processing_time INTEGER,
    hit_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_diagnosis_cache_symptoms_key
ON api.ai_diagnosis_cache(symptoms_key);

CREATE INDEX IF NOT EXISTS idx_ai_diagnosis_cache_expires_at
ON api.ai_diagnosis_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_diagnosis_cache_tooth_number
ON api.ai_diagnosis_cache(tooth_number);

-- Grant permissions
GRANT ALL ON api.ai_diagnosis_cache TO authenticated;

SELECT '✅ AI diagnosis cache table created!' as status;

-- ==============================================================================
-- PART 3: Verify Setup
-- ==============================================================================

-- Check voice columns
SELECT 'Voice Columns Check:' as section, column_name
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'consultations'
  AND column_name IN (
    'global_voice_transcript',
    'global_voice_processed_data',
    'voice_recording_duration',
    'voice_extracted_tooth_diagnoses'
  );

-- Check AI cache table
SELECT 'AI Cache Table Check:' as section, table_name
FROM information_schema.tables
WHERE table_schema = 'api'
  AND table_name = 'ai_diagnosis_cache';

SELECT '
✅✅✅ MIGRATIONS COMPLETE! ✅✅✅

WHAT WORKS NOW:
✅ Voice-to-diagnosis auto-population
✅ AI diagnosis cache system ready

NEXT STEPS:
1. Restart your Next.js dev server (Ctrl+C then npm run dev)
2. Test AI diagnosis by opening tooth dialog with symptoms
3. AI will show error initially (no medical knowledge yet)
4. Either:
   a) Upload medical textbooks/papers via Medical Knowledge Manager
   OR
   b) Run create-test-diagnosis-cache.sql for instant test data

See CURRENT_STATUS_AND_NEXT_STEPS.md for full instructions.
' as completion_message;
