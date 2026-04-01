-- Migration: Add Hybrid Search (BM25 + Vector) to Medical Knowledge Base
-- Purpose: Combine full-text keyword search with vector similarity for better retrieval
-- Created: 2026-03-28

-- ===============================================
-- 1. ADD FULL-TEXT SEARCH COLUMN
-- ===============================================

-- Add a tsvector column for full-text search (BM25-equivalent in PostgreSQL)
ALTER TABLE api.medical_knowledge
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate search_vector from title + content + authors + topics
UPDATE api.medical_knowledge
SET search_vector = (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(authors, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(journal, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'D')
);

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_search_vector
    ON api.medical_knowledge USING GIN(search_vector);

-- ===============================================
-- 2. AUTO-UPDATE TRIGGER
-- ===============================================

-- Trigger function to auto-update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION api.update_medical_knowledge_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.authors, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.journal, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'D');
    RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_update_search_vector ON api.medical_knowledge;
CREATE TRIGGER trg_update_search_vector
    BEFORE INSERT OR UPDATE OF title, content, authors, journal
    ON api.medical_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION api.update_medical_knowledge_search_vector();

-- ===============================================
-- 3. HYBRID SEARCH FUNCTION (Vector + Full-Text with RRF)
-- ===============================================

CREATE OR REPLACE FUNCTION api.hybrid_search_medical_knowledge(
    query_text TEXT,
    query_embedding vector(768),
    match_count INTEGER DEFAULT 10,
    -- Weights: how much to trust vector vs full-text (must sum to 1.0)
    vector_weight FLOAT DEFAULT 0.6,
    fulltext_weight FLOAT DEFAULT 0.4,
    -- RRF constant (standard value is 60)
    rrf_k INTEGER DEFAULT 60,
    -- Filters
    specialty_filter TEXT DEFAULT NULL,
    diagnosis_filter TEXT[] DEFAULT NULL,
    treatment_filter TEXT[] DEFAULT NULL
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
    topics TEXT[],
    -- Scores
    vector_similarity FLOAT,
    fulltext_rank FLOAT,
    hybrid_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    ts_query tsquery;
BEGIN
    -- Build tsquery from the query text
    -- plainto_tsquery handles natural language input (no special syntax needed)
    ts_query := plainto_tsquery('english', query_text);

    RETURN QUERY
    WITH
    -- Sub-query 1: Vector similarity search (top N*2 candidates)
    vector_results AS (
        SELECT
            mk.id,
            1 - (mk.embedding <=> query_embedding) AS similarity,
            ROW_NUMBER() OVER (ORDER BY mk.embedding <=> query_embedding) AS vector_rank
        FROM api.medical_knowledge mk
        WHERE
            mk.embedding IS NOT NULL
            AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
            AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
            AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
        ORDER BY mk.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    -- Sub-query 2: Full-text search (top N*2 candidates)
    fulltext_results AS (
        SELECT
            mk.id,
            ts_rank_cd(mk.search_vector, ts_query, 32) AS rank,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(mk.search_vector, ts_query, 32) DESC) AS text_rank
        FROM api.medical_knowledge mk
        WHERE
            mk.search_vector @@ ts_query
            AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
            AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
            AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
        ORDER BY ts_rank_cd(mk.search_vector, ts_query, 32) DESC
        LIMIT match_count * 3
    ),
    -- Reciprocal Rank Fusion: combine both result sets
    combined AS (
        SELECT
            COALESCE(vr.id, fr.id) AS doc_id,
            -- RRF formula: 1/(k + rank)
            -- Weighted combination of vector and fulltext RRF scores
            (
                vector_weight * COALESCE(1.0 / (rrf_k + vr.vector_rank), 0.0) +
                fulltext_weight * COALESCE(1.0 / (rrf_k + fr.text_rank), 0.0)
            ) AS rrf_score,
            COALESCE(vr.similarity, 0.0) AS vec_sim,
            COALESCE(fr.rank, 0.0) AS ft_rank
        FROM vector_results vr
        FULL OUTER JOIN fulltext_results fr ON vr.id = fr.id
    )
    -- Final: join back to get full document data, ordered by hybrid score
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
        mk.topics,
        c.vec_sim AS vector_similarity,
        c.ft_rank AS fulltext_rank,
        c.rrf_score AS hybrid_score
    FROM combined c
    JOIN api.medical_knowledge mk ON mk.id = c.doc_id
    ORDER BY c.rrf_score DESC
    LIMIT match_count;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION api.hybrid_search_medical_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION api.hybrid_search_medical_knowledge TO service_role;
