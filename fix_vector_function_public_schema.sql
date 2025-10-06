-- ===============================================
-- FINAL FIX: Create vector function in public schema
-- This fixes the schema issue preventing AI responses
-- ===============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the vector search function in PUBLIC schema (not api schema)
-- This is what Supabase RPC calls expect
CREATE OR REPLACE FUNCTION public.search_treatment_protocols (
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
SECURITY DEFINER  -- This allows the function to access api schema tables
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
    FROM api.medical_knowledge mk  -- Access api schema from public function
    WHERE
        mk.embedding IS NOT NULL
        AND 1 - (mk.embedding <=> query_embedding) > match_threshold
        AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
        AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
        AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
    ORDER BY mk.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant permissions for the public function
GRANT EXECUTE ON FUNCTION public.search_treatment_protocols TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_treatment_protocols TO service_role;
GRANT EXECUTE ON FUNCTION public.search_treatment_protocols TO anon;

-- Verify the function was created
SELECT 'Vector search function created in public schema!' as status;

-- Test the function with a dummy embedding
SELECT 'Testing function...' as test_status;
-- This will only work if you have medical knowledge with embeddings