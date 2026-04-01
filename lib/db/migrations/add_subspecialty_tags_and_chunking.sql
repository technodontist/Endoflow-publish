-- Migration: Add subspecialty tags, document chunking columns, and upgrade to 3072-dim embeddings
-- Phase 1 of Session 6: Knowledge Base Enhancement
-- Date: 2026-03-29

-- ===============================================
-- 1. ADD SUBSPECIALTY TAGS COLUMN
-- ===============================================

ALTER TABLE api.medical_knowledge
ADD COLUMN IF NOT EXISTS subspecialty_tags text[] DEFAULT '{}';

-- GIN index for array overlap/containment queries
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_subspecialty
ON api.medical_knowledge USING GIN (subspecialty_tags);

-- Standard subspecialty categories for endodontics
COMMENT ON COLUMN api.medical_knowledge.subspecialty_tags IS
'Standard tags: pulp_pathology, periapical_pathology, trauma,
resorption, endo_perio, cracked_tooth, regenerative_endo,
retreatment, surgical_endo, vital_pulp_therapy, bleaching,
restorative, periodontal, prosthodontic, pediatric_endo';

-- ===============================================
-- 2. ADD DOCUMENT CHUNKING COLUMNS
-- ===============================================

ALTER TABLE api.medical_knowledge
ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES api.medical_knowledge(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS chunk_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS section_title text;

-- Index for finding all chunks of a parent document
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_parent_doc
ON api.medical_knowledge(parent_document_id) WHERE parent_document_id IS NOT NULL;

-- Index for chunk ordering
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_chunk_order
ON api.medical_knowledge(parent_document_id, chunk_index) WHERE parent_document_id IS NOT NULL;

-- ===============================================
-- 3. ADD 3072-DIM EMBEDDING COLUMN (OpenAI text-embedding-3-large)
-- ===============================================

-- Add the new high-dimensional embedding column alongside the existing 768-dim one
-- 1) Add the column as you did
ALTER TABLE api.medical_knowledge
ADD COLUMN IF NOT EXISTS embedding_3072 vector(3072);

-- 2) Create HNSW index by casting to halfvec
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_embedding_3072
ON api.medical_knowledge
USING hnsw ((embedding_3072::halfvec(3072)) halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);;

-- ===============================================
-- 4. UPDATED HYBRID SEARCH RPC WITH SUBSPECIALTY WEIGHTING
-- ===============================================

DROP FUNCTION IF EXISTS api.hybrid_search_medical_knowledge;

CREATE OR REPLACE FUNCTION api.hybrid_search_medical_knowledge(
    query_text TEXT,
    query_embedding vector(3072),
    match_count INTEGER DEFAULT 10,
    vector_weight FLOAT DEFAULT 0.6,
    fulltext_weight FLOAT DEFAULT 0.4,
    rrf_k INTEGER DEFAULT 60,
    specialty_filter TEXT DEFAULT NULL,
    diagnosis_filter TEXT[] DEFAULT NULL,
    treatment_filter TEXT[] DEFAULT NULL,
    subspecialty_weights JSONB DEFAULT NULL,
    exclude_parent_docs BOOLEAN DEFAULT TRUE
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
    subspecialty_tags TEXT[],
    section_title TEXT,
    parent_document_id UUID,
    chunk_index INTEGER,
    vector_similarity DOUBLE PRECISION,
    fulltext_rank DOUBLE PRECISION,
    hybrid_score DOUBLE PRECISION,
    subspecialty_boost DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
    ts_query tsquery;
BEGIN
    ts_query := plainto_tsquery('english', query_text);

    RETURN QUERY
    WITH
    -- Vector search using 3072-dim embeddings (fall back to 768 if 3072 not available)
    vector_results AS (
        SELECT
            mk.id AS vid,
            CASE
                WHEN mk.embedding_3072 IS NOT NULL THEN
                    (1 - (mk.embedding_3072 <=> query_embedding))::DOUBLE PRECISION
                ELSE 0.0::DOUBLE PRECISION
            END AS similarity,
            ROW_NUMBER() OVER (
                ORDER BY
                    CASE
                        WHEN mk.embedding_3072 IS NOT NULL THEN mk.embedding_3072 <=> query_embedding
                        ELSE 999.0
                    END
            ) AS vector_rank
        FROM api.medical_knowledge mk
        WHERE
            mk.embedding_3072 IS NOT NULL
            AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
            AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
            AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
            -- Filter by subspecialty if weights provided (match ANY of the weighted subspecialties)
            AND (subspecialty_weights IS NULL OR
                 mk.subspecialty_tags && (SELECT array_agg(key::text) FROM jsonb_each(subspecialty_weights)))
            -- Optionally exclude parent documents (prefer chunks)
            AND (NOT exclude_parent_docs OR mk.parent_document_id IS NOT NULL OR
                 NOT EXISTS (SELECT 1 FROM api.medical_knowledge child WHERE child.parent_document_id = mk.id))
        ORDER BY
            CASE
                WHEN mk.embedding_3072 IS NOT NULL THEN mk.embedding_3072 <=> query_embedding
                ELSE 999.0
            END
        LIMIT match_count * 3
    ),
    -- Full-text search
    fulltext_results AS (
        SELECT
            mk.id AS fid,
            ts_rank_cd(mk.search_vector, ts_query, 32)::DOUBLE PRECISION AS ft_rank,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(mk.search_vector, ts_query, 32) DESC) AS text_rank
        FROM api.medical_knowledge mk
        WHERE
            mk.search_vector IS NOT NULL
            AND mk.search_vector @@ ts_query
            AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
            AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
            AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
            AND (subspecialty_weights IS NULL OR
                 mk.subspecialty_tags && (SELECT array_agg(key::text) FROM jsonb_each(subspecialty_weights)))
            AND (NOT exclude_parent_docs OR mk.parent_document_id IS NOT NULL OR
                 NOT EXISTS (SELECT 1 FROM api.medical_knowledge child WHERE child.parent_document_id = mk.id))
        ORDER BY ts_rank_cd(mk.search_vector, ts_query, 32) DESC
        LIMIT match_count * 3
    ),
    -- Combine with RRF scoring + subspecialty boost
    combined AS (
        SELECT
            COALESCE(vr.vid, fr.fid) AS doc_id,
            (
                vector_weight * COALESCE(1.0 / (rrf_k + vr.vector_rank)::DOUBLE PRECISION, 0.0) +
                fulltext_weight * COALESCE(1.0 / (rrf_k + fr.text_rank)::DOUBLE PRECISION, 0.0)
            )::DOUBLE PRECISION AS rrf_score,
            COALESCE(vr.similarity, 0.0)::DOUBLE PRECISION AS vec_sim,
            COALESCE(fr.ft_rank, 0.0)::DOUBLE PRECISION AS ft_rnk
        FROM vector_results vr
        FULL OUTER JOIN fulltext_results fr ON vr.vid = fr.fid
    )
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
        mk.subspecialty_tags,
        mk.section_title,
        mk.parent_document_id,
        mk.chunk_index,
        c.vec_sim AS vector_similarity,
        c.ft_rnk AS fulltext_rank,
        -- Apply subspecialty boost to RRF score
        CASE
            WHEN subspecialty_weights IS NULL THEN c.rrf_score
            ELSE c.rrf_score * (
                1.0 + COALESCE(
                    (SELECT MAX((subspecialty_weights->>tag)::float)
                     FROM unnest(mk.subspecialty_tags) AS tag
                     WHERE subspecialty_weights ? tag),
                    0.0
                )
            )
        END AS hybrid_score,
        CASE
            WHEN subspecialty_weights IS NULL THEN 1.0::DOUBLE PRECISION
            ELSE (
                1.0 + COALESCE(
                    (SELECT MAX((subspecialty_weights->>tag)::float)
                     FROM unnest(mk.subspecialty_tags) AS tag
                     WHERE subspecialty_weights ? tag),
                    0.0
                )
            )::DOUBLE PRECISION
        END AS subspecialty_boost
    FROM combined c
    JOIN api.medical_knowledge mk ON mk.id = c.doc_id
    ORDER BY
        CASE
            WHEN subspecialty_weights IS NULL THEN c.rrf_score
            ELSE c.rrf_score * (
                1.0 + COALESCE(
                    (SELECT MAX((subspecialty_weights->>tag)::float)
                     FROM unnest(mk.subspecialty_tags) AS tag
                     WHERE subspecialty_weights ? tag),
                    0.0
                )
            )
        END DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION api.hybrid_search_medical_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION api.hybrid_search_medical_knowledge TO service_role;

-- ===============================================
-- 5. UPDATED VECTOR-ONLY SEARCH FOR 3072-DIM
-- ===============================================

-- Drop the old 768-dim version to avoid "function name is not unique" error
DROP FUNCTION IF EXISTS api.search_treatment_protocols(vector(768), TEXT[], TEXT[], TEXT, FLOAT, INTEGER);

CREATE OR REPLACE FUNCTION api.search_treatment_protocols (
    query_embedding vector(3072),
    diagnosis_filter TEXT[] DEFAULT NULL,
    treatment_filter TEXT[] DEFAULT NULL,
    specialty_filter TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INTEGER DEFAULT 5,
    subspecialty_filter TEXT[] DEFAULT NULL
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
    topics TEXT[],
    subspecialty_tags TEXT[],
    section_title TEXT,
    parent_document_id UUID
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
        (1 - (mk.embedding_3072 <=> query_embedding))::FLOAT AS similarity,
        mk.topics,
        mk.subspecialty_tags,
        mk.section_title,
        mk.parent_document_id
    FROM api.medical_knowledge mk
    WHERE
        mk.embedding_3072 IS NOT NULL
        AND 1 - (mk.embedding_3072 <=> query_embedding) > match_threshold
        AND (diagnosis_filter IS NULL OR mk.diagnosis_keywords && diagnosis_filter)
        AND (treatment_filter IS NULL OR mk.treatment_keywords && treatment_filter)
        AND (specialty_filter IS NULL OR mk.specialty = specialty_filter)
        AND (subspecialty_filter IS NULL OR mk.subspecialty_tags && subspecialty_filter)
    ORDER BY mk.embedding_3072 <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION api.search_treatment_protocols(vector(3072), TEXT[], TEXT[], TEXT, FLOAT, INTEGER, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION api.search_treatment_protocols(vector(3072), TEXT[], TEXT[], TEXT, FLOAT, INTEGER, TEXT[]) TO service_role;
