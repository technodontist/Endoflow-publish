-- =====================================================
-- JSONB INDEXES FOR RESEARCH PROJECT PERFORMANCE
-- =====================================================
-- Creates optimized indexes for JSONB consultation data filtering
-- Run this in Supabase SQL Editor to improve research query performance

-- =====================================================
-- PAIN ASSESSMENT INDEXES
-- =====================================================

-- Index for pain intensity queries (numeric comparison)
CREATE INDEX IF NOT EXISTS idx_consultations_pain_intensity
ON api.consultations (((pain_assessment->>'intensity')::int));

-- Index for pain location queries (text search)
CREATE INDEX IF NOT EXISTS idx_consultations_pain_location
ON api.consultations ((pain_assessment->>'location'));

-- Index for pain duration queries
CREATE INDEX IF NOT EXISTS idx_consultations_pain_duration
ON api.consultations ((pain_assessment->>'duration'));

-- Index for pain character queries
CREATE INDEX IF NOT EXISTS idx_consultations_pain_character
ON api.consultations ((pain_assessment->>'character'));

-- =====================================================
-- DIAGNOSIS INDEXES
-- =====================================================

-- Index for primary diagnosis queries (most common)
CREATE INDEX IF NOT EXISTS idx_consultations_diagnosis_primary
ON api.consultations ((diagnosis->>'primary'));

-- Index for secondary diagnosis queries
CREATE INDEX IF NOT EXISTS idx_consultations_diagnosis_secondary
ON api.consultations ((diagnosis->>'secondary'));

-- Index for diagnosis severity queries
CREATE INDEX IF NOT EXISTS idx_consultations_diagnosis_severity
ON api.consultations ((diagnosis->>'severity'));

-- Index for ICD code queries
CREATE INDEX IF NOT EXISTS idx_consultations_diagnosis_icd_code
ON api.consultations ((diagnosis->>'icd_code'));

-- GIN index for full-text search on diagnosis JSONB
CREATE INDEX IF NOT EXISTS idx_consultations_diagnosis_gin
ON api.consultations USING GIN (diagnosis);

-- =====================================================
-- TREATMENT PLAN INDEXES
-- =====================================================

-- Index for treatment procedure queries
CREATE INDEX IF NOT EXISTS idx_consultations_treatment_procedure
ON api.consultations ((treatment_plan->>'procedure'));

-- Index for treatment complexity queries
CREATE INDEX IF NOT EXISTS idx_consultations_treatment_complexity
ON api.consultations ((treatment_plan->>'complexity'));

-- Index for estimated duration queries (numeric)
CREATE INDEX IF NOT EXISTS idx_consultations_treatment_duration
ON api.consultations (((treatment_plan->>'estimated_duration')::int));

-- GIN index for flexible treatment plan queries
CREATE INDEX IF NOT EXISTS idx_consultations_treatment_plan_gin
ON api.consultations USING GIN (treatment_plan);

-- =====================================================
-- CLINICAL EXAMINATION INDEXES
-- =====================================================

-- Index for periodontal pocket depth queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_pocket_depth
ON api.consultations (((clinical_examination->'periodontal'->>'max_pocket_depth')::int));

-- Index for bleeding on probing queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_bleeding
ON api.consultations (((clinical_examination->'periodontal'->>'bleeding')::boolean));

-- Index for tooth mobility grade queries
CREATE INDEX IF NOT EXISTS idx_consultations_mobility_grade
ON api.consultations (((clinical_examination->>'mobility_grade')::int));

-- GIN index for comprehensive clinical examination queries
CREATE INDEX IF NOT EXISTS idx_consultations_clinical_examination_gin
ON api.consultations USING GIN (clinical_examination);

-- =====================================================
-- MEDICAL HISTORY INDEXES
-- =====================================================

-- Index for diabetes control status queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_diabetes_control
ON api.consultations ((medical_history->'diabetes'->>'control_status'));

-- Index for anticoagulant therapy queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_anticoagulant
ON api.consultations (((medical_history->'medications'->>'anticoagulant')::boolean));

-- Index for penicillin allergy queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_penicillin_allergy
ON api.consultations (((medical_history->'allergies'->>'penicillin')::boolean));

-- Index for cardiovascular disease queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_cardiovascular
ON api.consultations (((medical_history->'conditions'->>'cardiovascular')::boolean));

-- GIN index for comprehensive medical history queries
CREATE INDEX IF NOT EXISTS idx_consultations_medical_history_gin
ON api.consultations USING GIN (medical_history);

-- =====================================================
-- INVESTIGATIONS INDEXES
-- =====================================================

-- Index for radiograph type queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_radiograph_type
ON api.consultations ((investigations->'radiography'->>'type'));

-- Index for pulp vitality test queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_pulp_vitality
ON api.consultations ((investigations->'pulp_tests'->>'vitality'));

-- Index for percussion test queries (nested JSONB)
CREATE INDEX IF NOT EXISTS idx_consultations_percussion_test
ON api.consultations ((investigations->'clinical_tests'->>'percussion'));

-- GIN index for comprehensive investigations queries
CREATE INDEX IF NOT EXISTS idx_consultations_investigations_gin
ON api.consultations USING GIN (investigations);

-- =====================================================
-- PRESCRIPTION DATA INDEXES
-- =====================================================

-- GIN index for prescription data (array of objects)
CREATE INDEX IF NOT EXISTS idx_consultations_prescription_data_gin
ON api.consultations USING GIN (prescription_data);

-- =====================================================
-- FOLLOW-UP DATA INDEXES
-- =====================================================

-- Index for follow-up required queries
CREATE INDEX IF NOT EXISTS idx_consultations_follow_up_required
ON api.consultations (((follow_up_data->>'required')::boolean));

-- Index for follow-up days queries (numeric)
CREATE INDEX IF NOT EXISTS idx_consultations_follow_up_days
ON api.consultations (((follow_up_data->>'days')::int));

-- GIN index for comprehensive follow-up queries
CREATE INDEX IF NOT EXISTS idx_consultations_follow_up_data_gin
ON api.consultations USING GIN (follow_up_data);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON RESEARCH QUERIES
-- =====================================================

-- Composite index for consultation status and date (research-ready consultations)
CREATE INDEX IF NOT EXISTS idx_consultations_status_date
ON api.consultations (status, consultation_date DESC);

-- Composite index for patient and consultation date (patient history)
CREATE INDEX IF NOT EXISTS idx_consultations_patient_date
ON api.consultations (patient_id, consultation_date DESC);

-- =====================================================
-- QUERY PERFORMANCE MONITORING
-- =====================================================

-- Create a function to check index usage statistics
CREATE OR REPLACE FUNCTION check_research_index_usage()
RETURNS TABLE (
    index_name text,
    table_name text,
    scans bigint,
    tuples_read bigint,
    tuples_fetched bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        indexrelname::text as index_name,
        tablename::text as table_name,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    WHERE schemaname = 'api'
    AND tablename = 'consultations'
    AND indexrelname LIKE 'idx_consultations_%'
    ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify all indexes were created successfully
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'api'
AND tablename = 'consultations'
AND indexname LIKE 'idx_consultations_%'
ORDER BY indexname;

-- Check table size and index sizes
SELECT
    pg_size_pretty(pg_total_relation_size('api.consultations')) as total_size,
    pg_size_pretty(pg_relation_size('api.consultations')) as table_size,
    pg_size_pretty(pg_indexes_size('api.consultations')) as indexes_size;

-- =====================================================
-- NOTES
-- =====================================================

/*
USAGE NOTES:

1. **GIN Indexes**:
   - Use GIN (Generalized Inverted Index) for flexible JSONB queries
   - Support @>, ?, ?|, ?& operators
   - Larger but faster for complex JSONB queries

2. **Expression Indexes**:
   - Created on specific JSONB paths (e.g., diagnosis->>'primary')
   - Faster for exact path queries
   - Require explicit type casting for numeric/boolean values

3. **Performance Impact**:
   - Indexes improve SELECT performance but slow INSERT/UPDATE
   - Monitor index usage with check_research_index_usage() function
   - Drop unused indexes if needed

4. **Maintenance**:
   - PostgreSQL auto-updates indexes on data changes
   - Run VACUUM ANALYZE api.consultations; periodically
   - Check index bloat with pg_stat_user_indexes

5. **Query Optimization**:
   - Use EXPLAIN ANALYZE to verify index usage
   - Ensure queries match index structure exactly
   - Consider partial indexes for frequently filtered subsets

EXAMPLE QUERIES THAT WILL USE THESE INDEXES:

-- Pain intensity query (uses idx_consultations_pain_intensity)
SELECT * FROM api.consultations
WHERE (pain_assessment->>'intensity')::int > 7;

-- Primary diagnosis query (uses idx_consultations_diagnosis_primary)
SELECT * FROM api.consultations
WHERE diagnosis->>'primary' = 'Irreversible Pulpitis';

-- Treatment procedure query (uses idx_consultations_treatment_procedure)
SELECT * FROM api.consultations
WHERE treatment_plan->>'procedure' = 'root_canal';

-- Complex JSONB query (uses GIN indexes)
SELECT * FROM api.consultations
WHERE diagnosis @> '{"severity": "severe"}';

*/
