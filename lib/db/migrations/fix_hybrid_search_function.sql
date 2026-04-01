-- Fix: hybrid_search_medical_knowledge return type mismatch
-- The FLOAT in RETURNS TABLE needs to match actual column types (DOUBLE PRECISION)
-- Also disambiguate column names between CTEs and RETURNS TABLE

DROP FUNCTION IF EXISTS api.hybrid_search_medical_knowledge;

CREATE OR REPLACE FUNCTION api.hybrid_search_medical_knowledge(
    query_text TEXT,
    query_embedding vector(768),
    match_count INTEGER DEFAULT 10,
    vector_weight FLOAT DEFAULT 0.6,
    fulltext_weight FLOAT DEFAULT 0.4,
    rrf_k INTEGER DEFAULT 60,
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
    vector_similarity DOUBLE PRECISION,
    fulltext_rank DOUBLE PRECISION,
    hybrid_score DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
    ts_query tsquery;
BEGIN
    ts_query := plainto_tsquery('english', query_text);

    RETURN QUERY
    WITH
    vector_results AS (
        SELECT
            mk.id AS vid,
            (1 - (mk.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
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
        ORDER BY ts_rank_cd(mk.search_vector, ts_query, 32) DESC
        LIMIT match_count * 3
    ),
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
        c.vec_sim AS vector_similarity,
        c.ft_rnk AS fulltext_rank,
        c.rrf_score AS hybrid_score
    FROM combined c
    JOIN api.medical_knowledge mk ON mk.id = c.doc_id
    ORDER BY c.rrf_score DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION api.hybrid_search_medical_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION api.hybrid_search_medical_knowledge TO service_role;
