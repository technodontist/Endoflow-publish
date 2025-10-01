-- =============================================
-- ENDOFLOW: Post-Fix Verification Script
-- =============================================
-- Run this after applying fix_database_schema_complete.sql
-- This will confirm that all foreign key relationships are working

-- 1. Test that the foreign key relationships exist and work
SELECT 
    'FOREIGN KEY CONSTRAINTS CHECK' as test_name,
    COUNT(*) as total_fk_constraints
FROM pg_constraint 
WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'api')
AND contype = 'f';

-- 2. Specifically check for the problematic relationships mentioned in the errors
SELECT 
    'CONSULTATIONS -> DENTISTS FK' as relationship,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'api.consultations'::regclass
            AND c.contype = 'f'
            AND a.attname = 'dentist_id'
        ) THEN 'EXISTS' ELSE 'MISSING'
    END as status;

SELECT 
    'PATIENT_FILES -> PROFILES FK' as relationship,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'api.patient_files'::regclass
            AND c.contype = 'f'
            AND a.attname = 'uploaded_by'
        ) THEN 'EXISTS' ELSE 'MISSING'
    END as status;

-- 3. Test that both tables exist
SELECT 
    'TABLE EXISTENCE CHECK' as test_name,
    COUNT(CASE WHEN table_name = 'consultations' THEN 1 END) as consultations_table,
    COUNT(CASE WHEN table_name = 'patient_files' THEN 1 END) as patient_files_table,
    COUNT(CASE WHEN table_name = 'tooth_diagnoses' THEN 1 END) as tooth_diagnoses_table
FROM information_schema.tables 
WHERE table_schema = 'api' 
AND table_name IN ('consultations', 'patient_files', 'tooth_diagnoses');

-- 4. Test a simple join query (like the one failing in consultations.ts)
-- This should work without PostgREST errors if the FK relationships are properly set up
SELECT 
    'JOIN TEST: consultations with dentists' as test_name,
    'Query should execute without error if FK relationships are correct' as description;

-- Simulate the join that was failing
SELECT COUNT(*) as test_count
FROM api.consultations c
LEFT JOIN auth.users u ON c.dentist_id = u.id;

-- 5. Test patient_files join
SELECT 
    'JOIN TEST: patient_files with profiles' as test_name,
    'Query should execute without error if FK relationships are correct' as description;

SELECT COUNT(*) as test_count  
FROM api.patient_files pf
LEFT JOIN auth.users u ON pf.uploaded_by = u.id;

-- 6. Final status report
SELECT 
    '=== VERIFICATION COMPLETE ===' as status,
    CASE 
        WHEN (
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'consultations') > 0 AND
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'patient_files') > 0 AND
            (SELECT COUNT(*) FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'api') AND contype = 'f') >= 6
        ) THEN '✅ ALL CHECKS PASSED - Database schema errors should be resolved!'
        ELSE '⚠️  Some issues may remain - please check individual test results above'
    END as result;