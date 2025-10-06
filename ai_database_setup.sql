-- ===============================================
-- COMPLETE AI INTEGRATION DATABASE SETUP
-- Run this entire script in your Supabase SQL Editor
-- ===============================================

-- 1. Create API schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS api;

-- 2. Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ===============================================
-- 3. RESEARCH AI CONVERSATIONS TABLE
-- ===============================================

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

-- ===============================================
-- 4. MEDICAL KNOWLEDGE VECTOR STORE
-- ===============================================

CREATE TABLE IF NOT EXISTS api.medical_knowledge (
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

    -- Vector embedding (768 dimensions for Google Gemini)
    embedding vector(768),

    -- Clinical tags for filtering
    topics TEXT[], -- ['root_canal', 'pulpitis', 'restoration']
    diagnosis_keywords TEXT[], -- ['irreversible_pulpitis', 'deep_caries', 'apical_abscess']
    treatment_keywords TEXT[], -- ['rct', 'composite_filling', 'crown', 'apicoectomy']

    -- Additional metadata as JSONB
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Upload tracking
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_embedding
    ON api.medical_knowledge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- GIN indexes for array searches
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_topics
    ON api.medical_knowledge USING GIN(topics);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_diagnosis
    ON api.medical_knowledge USING GIN(diagnosis_keywords);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_treatment
    ON api.medical_knowledge USING GIN(treatment_keywords);

-- Regular indexes
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_source_type
    ON api.medical_knowledge(source_type);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_specialty
    ON api.medical_knowledge(specialty);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_year
    ON api.medical_knowledge(publication_year DESC);

-- ===============================================
-- 5. AI SUGGESTION CACHE TABLE
-- ===============================================

CREATE TABLE IF NOT EXISTS api.ai_suggestion_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Query parameters (for cache key)
    diagnosis TEXT NOT NULL,
    tooth_number TEXT,
    patient_context JSONB DEFAULT '{}'::JSONB,

    -- AI response
    suggested_treatment TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    reasoning TEXT NOT NULL,
    evidence_sources JSONB, -- Array of source references
    alternative_treatments TEXT[],
    contraindications TEXT[],

    -- Metadata
    ai_model TEXT DEFAULT 'gemini-2.0-flash',
    processing_time INTEGER, -- milliseconds
    langflow_flow_id TEXT,

    -- Cache management
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'), -- Cache for 7 days
    hit_count INTEGER DEFAULT 0
);

-- Indexes for cache lookups
CREATE INDEX IF NOT EXISTS idx_ai_cache_diagnosis_tooth
    ON api.ai_suggestion_cache(diagnosis, tooth_number);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires
    ON api.ai_suggestion_cache(expires_at);

-- ===============================================
-- 6. VECTOR SEARCH FUNCTION
-- ===============================================

CREATE OR REPLACE FUNCTION api.search_treatment_protocols (
    query_embedding vector(768),
    diagnosis_filter TEXT[] DEFAULT NULL,
    treatment_filter TEXT[] DEFAULT NULL,
    specialty_filter TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.5,
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
-- 7. ROW LEVEL SECURITY POLICIES
-- ===============================================

-- Enable RLS on all tables
ALTER TABLE api.research_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.medical_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.ai_suggestion_cache ENABLE ROW LEVEL SECURITY;

-- Research AI Conversations Policies
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

-- Medical Knowledge Policies
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

-- AI Cache Policies
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
-- 8. GRANT PERMISSIONS
-- ===============================================

GRANT SELECT, INSERT, DELETE ON api.research_ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api.medical_knowledge TO authenticated;
GRANT SELECT ON api.ai_suggestion_cache TO authenticated;
GRANT ALL ON api.ai_suggestion_cache TO service_role;
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO service_role;

-- ===============================================
-- 9. SEED SAMPLE MEDICAL KNOWLEDGE
-- ===============================================

-- Insert sample knowledge (you'll need to generate embeddings for these)
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
    metadata
) VALUES
(
    'Modern Endodontic Treatment: Success Rates and Techniques',
    'Root canal treatment (RCT) with modern rotary instrumentation and bioceramic sealers has shown success rates exceeding 90% in systematic reviews. The use of nickel-titanium (NiTi) rotary files combined with calcium silicate-based sealers provides superior outcomes compared to traditional techniques. Studies demonstrate that single-visit RCT is as effective as multiple-visit approaches when proper infection control protocols are followed. Crown lengthening or surgical access may be required for subgingival fractures.',
    'research_paper',
    'endodontics',
    'Smith J, Johnson K, Lee M',
    2023,
    'Journal of Endodontics',
    ARRAY['root_canal', 'rotary_instrumentation', 'bioceramic_sealers'],
    ARRAY['irreversible_pulpitis', 'pulp_necrosis', 'apical_periodontitis'],
    ARRAY['rct', 'root_canal_treatment', 'rotary_files'],
    '{"doi": "10.1016/j.joen.2023.001", "study_type": "systematic_review", "sample_size": 1250}'::JSONB
),
(
    'Evidence-Based Caries Management: Minimal Intervention Dentistry',
    'Selective caries removal has emerged as the gold standard for managing deep carious lesions. Research shows that leaving caries-affected dentin beneath restorations does not compromise long-term success when proper sealing is achieved. Composite restorations using adhesive techniques provide excellent outcomes with minimal tooth structure removal. Glass ionomer cements are indicated for high-risk caries patients and primary teeth.',
    'clinical_protocol',
    'general_dentistry',
    'Anderson P, Williams R',
    2024,
    'International Dental Journal',
    ARRAY['caries', 'composite_filling', 'minimal_intervention'],
    ARRAY['deep_caries', 'moderate_caries', 'incipient_caries'],
    ARRAY['composite_restoration', 'selective_caries_removal', 'adhesive_dentistry'],
    '{"guideline_level": "A", "evidence_quality": "high"}'::JSONB
);

-- ===============================================
-- SETUP COMPLETE!
-- ===============================================

SELECT 'AI Integration Database Setup Complete!' as status;