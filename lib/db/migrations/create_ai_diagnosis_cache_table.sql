-- Create AI diagnosis cache table for smart diagnosis suggestions
CREATE TABLE IF NOT EXISTS api.ai_diagnosis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Query identifiers
    symptoms_key TEXT NOT NULL, -- Cached key for quick lookups
    symptoms TEXT[] NOT NULL, -- Array of symptom strings
    pain_characteristics JSONB, -- Pain characteristics object
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
    processing_time INTEGER, -- in milliseconds
    hit_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_diagnosis_cache_symptoms_key
ON api.ai_diagnosis_cache(symptoms_key);

CREATE INDEX IF NOT EXISTS idx_ai_diagnosis_cache_expires_at
ON api.ai_diagnosis_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_diagnosis_cache_tooth_number
ON api.ai_diagnosis_cache(tooth_number);

-- Add comments for documentation
COMMENT ON TABLE api.ai_diagnosis_cache IS 'Caches AI-generated diagnosis suggestions to improve performance';
COMMENT ON COLUMN api.ai_diagnosis_cache.symptoms_key IS 'Unique key combining symptoms, pain, and tooth for cache lookups';
COMMENT ON COLUMN api.ai_diagnosis_cache.confidence_score IS 'AI confidence in diagnosis (0-100)';
COMMENT ON COLUMN api.ai_diagnosis_cache.hit_count IS 'Number of times this cached suggestion was returned';
COMMENT ON COLUMN api.ai_diagnosis_cache.expires_at IS 'Cache expiration timestamp (default 7 days)';

-- Grant permissions
GRANT ALL ON api.ai_diagnosis_cache TO authenticated;

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION api.update_ai_diagnosis_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_ai_diagnosis_cache_updated_at_trigger ON api.ai_diagnosis_cache;
CREATE TRIGGER update_ai_diagnosis_cache_updated_at_trigger
    BEFORE UPDATE ON api.ai_diagnosis_cache
    FOR EACH ROW
    EXECUTE FUNCTION api.update_ai_diagnosis_cache_updated_at();

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Created ai_diagnosis_cache table for AI diagnosis suggestions';
END $$;
