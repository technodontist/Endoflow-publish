-- Migration: Switch from OpenAI (1536-dim) to Google Gemini (768-dim) Embeddings
-- Purpose: Update vector dimensions and recreate tables for Gemini API integration
-- Created: 2025-01-XX

-- ===============================================
-- STEP 1: BACKUP AND DROP EXISTING TABLES
-- ===============================================

-- Backup existing medical knowledge (optional - comment out if not needed)
-- CREATE TABLE IF NOT EXISTS api.medical_knowledge_backup AS SELECT * FROM api.medical_knowledge;

-- Drop existing tables (will recreate with new dimensions)
DROP TABLE IF EXISTS api.ai_suggestion_cache CASCADE;
DROP TABLE IF EXISTS api.medical_knowledge CASCADE;

-- Drop existing search function
DROP FUNCTION IF EXISTS api.search_treatment_protocols CASCADE;

-- ===============================================
-- STEP 2: CREATE TABLES WITH 768-DIM VECTORS
-- ===============================================

CREATE TABLE api.medical_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Content metadata
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('textbook', 'research_paper', 'clinical_protocol', 'case_study', 'guideline')),
    specialty TEXT DEFAULT 'endodontics' CHECK (specialty IN ('endodontics', 'periodontics', 'prosthodontics', 'oral_surgery', 'general_dentistry')),

    -- Document metadata
    authors TEXT,
    publication_year INTEGER,
    journal TEXT,
    doi TEXT,
    url TEXT,
    isbn TEXT,

    -- Vector embedding (768 dimensions for Gemini gemini-embedding-001)
    embedding vector(768),

    -- Clinical tags for filtering
    topics TEXT[],
    diagnosis_keywords TEXT[],
    treatment_keywords TEXT[],

    -- Additional metadata
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Upload tracking
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ===============================================
-- STEP 3: CREATE AI SUGGESTION CACHE
-- ===============================================

CREATE TABLE api.ai_suggestion_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Query parameters
    diagnosis TEXT NOT NULL,
    tooth_number TEXT,
    patient_context JSONB DEFAULT '{}'::JSONB,

    -- AI response
    suggested_treatment TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    reasoning TEXT NOT NULL,
    evidence_sources JSONB,
    alternative_treatments TEXT[],
    contraindications TEXT[],

    -- Metadata
    ai_model TEXT DEFAULT 'gemini-1.5-flash',
    processing_time INTEGER,

    -- Cache management
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),
    hit_count INTEGER DEFAULT 0
);

-- ===============================================
-- STEP 4: CREATE INDEXES
-- ===============================================

-- Vector similarity index (IVFFlat for 768-dim vectors)
CREATE INDEX idx_medical_knowledge_embedding
    ON api.medical_knowledge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- GIN indexes for array searches
CREATE INDEX idx_medical_knowledge_topics
    ON api.medical_knowledge USING GIN(topics);

CREATE INDEX idx_medical_knowledge_diagnosis
    ON api.medical_knowledge USING GIN(diagnosis_keywords);

CREATE INDEX idx_medical_knowledge_treatment
    ON api.medical_knowledge USING GIN(treatment_keywords);

-- Regular indexes
CREATE INDEX idx_medical_knowledge_source_type
    ON api.medical_knowledge(source_type);

CREATE INDEX idx_medical_knowledge_specialty
    ON api.medical_knowledge(specialty);

CREATE INDEX idx_medical_knowledge_year
    ON api.medical_knowledge(publication_year DESC);

-- Cache indexes
CREATE INDEX idx_ai_cache_diagnosis_tooth
    ON api.ai_suggestion_cache(diagnosis, tooth_number);

CREATE INDEX idx_ai_cache_expires
    ON api.ai_suggestion_cache(expires_at);

-- ===============================================
-- STEP 5: RECREATE VECTOR SEARCH FUNCTION
-- ===============================================

CREATE OR REPLACE FUNCTION api.search_treatment_protocols (
    query_embedding vector(768), -- Updated to 768 dimensions
    diagnosis_filter TEXT[] DEFAULT NULL,
    treatment_filter TEXT[] DEFAULT NULL,
    specialty_filter TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    source_type TEXT,
    specialty TEXT,
    authors TEXT,
    journal TEXT,
    publication_year INTEGER,
    doi TEXT,
    url TEXT,
    similarity FLOAT,
    topics TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mk.id,
        mk.title,
        mk.content,
        mk.source_type,
        mk.specialty,
        mk.authors,
        mk.journal,
        mk.publication_year,
        mk.doi,
        mk.url,
        1 - (mk.embedding <=> query_embedding) AS similarity,
        mk.topics
    FROM api.medical_knowledge mk
    WHERE
        1 - (mk.embedding <=> query_embedding) > match_threshold
        AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
        AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
        AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
    ORDER BY mk.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ===============================================
-- STEP 6: ROW LEVEL SECURITY
-- ===============================================

ALTER TABLE api.medical_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dentists can view medical knowledge"
    ON api.medical_knowledge
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

CREATE POLICY "Dentists can upload medical knowledge"
    ON api.medical_knowledge
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

CREATE POLICY "Dentists can update their uploads"
    ON api.medical_knowledge
    FOR UPDATE
    TO authenticated
    USING (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

ALTER TABLE api.ai_suggestion_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dentists can read AI cache"
    ON api.ai_suggestion_cache
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

CREATE POLICY "Service role can write AI cache"
    ON api.ai_suggestion_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===============================================
-- STEP 7: GRANT PERMISSIONS
-- ===============================================

GRANT SELECT, INSERT, UPDATE ON api.medical_knowledge TO authenticated;
GRANT SELECT ON api.ai_suggestion_cache TO authenticated;
GRANT USAGE ON SCHEMA api TO authenticated;

-- ===============================================
-- STEP 8: ADD COMMENTS
-- ===============================================

COMMENT ON TABLE api.medical_knowledge IS 'Vector store for medical knowledge using Google Gemini 768-dimensional embeddings';
COMMENT ON COLUMN api.medical_knowledge.embedding IS '768-dimensional vector embedding from Gemini gemini-embedding-001 model';
COMMENT ON TABLE api.ai_suggestion_cache IS 'Cache for AI treatment suggestions using Gemini 1.5 Flash';
COMMENT ON FUNCTION api.search_treatment_protocols IS 'Vector similarity search for Gemini 768-dim embeddings';

-- ===============================================
-- STEP 9: SEED DATA (SAMPLE MEDICAL KNOWLEDGE)
-- ===============================================

-- Note: These are placeholder entries with NULL embeddings
-- Real embeddings will be generated when uploading via UI using Gemini API

INSERT INTO api.medical_knowledge (
    title,
    content,
    source_type,
    specialty,
    authors,
    publication_year,
    journal,
    topics,
    diagnosis_keywords,
    treatment_keywords,
    embedding,
    metadata
) VALUES
(
    'Modern Endodontic Treatment: Success Rates and Techniques',
    'Root canal treatment (RCT) with modern rotary instrumentation and bioceramic sealers has shown success rates exceeding 90% in systematic reviews. The use of nickel-titanium (NiTi) rotary files combined with calcium silicate-based sealers provides superior outcomes compared to traditional techniques.',
    'research_paper',
    'endodontics',
    'Smith J, Johnson K, Lee M',
    2023,
    'Journal of Endodontics',
    ARRAY['root_canal', 'rotary_instrumentation', 'bioceramic_sealers'],
    ARRAY['irreversible_pulpitis', 'pulp_necrosis', 'apical_periodontitis'],
    ARRAY['rct', 'root_canal_treatment', 'rotary_files'],
    NULL, -- Embedding will be generated via API
    '{"doi": "10.1016/j.joen.2023.001", "study_type": "systematic_review"}'::JSONB
),
(
    'Evidence-Based Caries Management',
    'Selective caries removal has emerged as the gold standard for managing deep carious lesions. Research shows that leaving caries-affected dentin beneath restorations does not compromise long-term success when proper sealing is achieved.',
    'clinical_protocol',
    'general_dentistry',
    'Anderson P, Williams R',
    2024,
    'International Dental Journal',
    ARRAY['caries', 'composite_filling', 'minimal_intervention'],
    ARRAY['deep_caries', 'moderate_caries', 'incipient_caries'],
    ARRAY['composite_restoration', 'selective_caries_removal'],
    NULL, -- Embedding will be generated via API
    '{"guideline_level": "A", "evidence_quality": "high"}'::JSONB
);

-- ===============================================
-- MIGRATION COMPLETE
-- ===============================================

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration to Gemini 768-dimensional embeddings complete!';
    RAISE NOTICE '📝 Next steps:';
    RAISE NOTICE '   1. Configure GEMINI_API_KEY in environment variables';
    RAISE NOTICE '   2. Re-upload medical knowledge via UI to generate embeddings';
    RAISE NOTICE '   3. Test AI treatment suggestions';
END $$;
