-- =============================================
-- ENDOFLOW: Database Schema Check Script
-- =============================================
-- Run this in Supabase SQL Editor to check current schema state
-- This will help identify what needs to be created or fixed

-- 1. Check if api schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'api';

-- 2. Check which tables exist in api schema
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'api' 
ORDER BY table_name;

-- 3. Check if consultations table exists
SELECT COUNT(*) as consultations_table_exists 
FROM information_schema.tables 
WHERE table_schema = 'api' AND table_name = 'consultations';

-- 4. Check if patient_files table exists
SELECT COUNT(*) as patient_files_table_exists 
FROM information_schema.tables 
WHERE table_schema = 'api' AND table_name = 'patient_files';

-- 5. Check current foreign key constraints in api schema
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as references_table,
    contype as constraint_type
FROM pg_constraint 
WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'api')
AND contype = 'f'  -- foreign key constraints only
ORDER BY table_name, constraint_name;

-- 6. Check if consultations table has proper foreign key to dentists
SELECT 
    c.conname as constraint_name,
    c.conrelid::regclass as table_name,
    c.confrelid::regclass as references_table,
    a.attname as column_name,
    af.attname as foreign_column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
WHERE c.conrelid = 'api.consultations'::regclass
AND c.contype = 'f'
AND a.attname = 'dentist_id';

-- 7. Check if patient_files table has proper foreign key to profiles
SELECT 
    c.conname as constraint_name,
    c.conrelid::regclass as table_name,
    c.confrelid::regclass as references_table,
    a.attname as column_name,
    af.attname as foreign_column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
WHERE c.conrelid = 'api.patient_files'::regclass
AND c.contype = 'f'
AND a.attname = 'uploaded_by';

-- 8. Check the structure of consultations table (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'api' 
AND table_name = 'consultations'
ORDER BY ordinal_position;

-- 9. Check the structure of patient_files table (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'api' 
AND table_name = 'patient_files'
ORDER BY ordinal_position;

-- 10. Summary report
SELECT 
    'SCHEMA STATUS REPORT' as report_section,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'consultations') > 0 
        THEN 'EXISTS' ELSE 'MISSING' 
    END as consultations_table,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'patient_files') > 0 
        THEN 'EXISTS' ELSE 'MISSING' 
    END as patient_files_table,
    (SELECT COUNT(*) FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'api') AND contype = 'f') as total_foreign_keys;