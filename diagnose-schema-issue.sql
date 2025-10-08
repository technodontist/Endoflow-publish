-- Diagnostic SQL to check voice AI schema setup
-- Run this in Supabase SQL Editor to diagnose the issue

-- ============================================
-- 1. CHECK IF COLUMNS EXIST
-- ============================================
SELECT
  '✅ Column Check' as test_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'consultations'
  AND column_name IN (
    'global_voice_transcript',
    'global_voice_processed_data',
    'voice_recording_duration'
  )
ORDER BY column_name;

-- Expected: 3 rows
-- If 0 rows: Columns don't exist - run ADD_VOICE_COLUMNS_TO_CONSULTATIONS.sql

-- ============================================
-- 2. CHECK TABLE PERMISSIONS
-- ============================================
SELECT
  '✅ Permission Check' as test_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'api'
  AND table_name = 'consultations'
  AND grantee IN ('postgres', 'authenticated', 'anon', 'service_role')
ORDER BY grantee, privilege_type;

-- Expected: Multiple rows showing SELECT, INSERT, UPDATE permissions

-- ============================================
-- 3. CHECK IF ROW LEVEL SECURITY IS ENABLED
-- ============================================
SELECT
  '✅ RLS Check' as test_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'api'
  AND tablename = 'consultations';

-- ============================================
-- 4. CHECK EXISTING CONSULTATION (FOR TESTING)
-- ============================================
SELECT
  '✅ Test Consultation' as test_name,
  id,
  patient_id,
  global_voice_transcript IS NOT NULL as has_transcript,
  global_voice_processed_data IS NOT NULL as has_processed_data,
  voice_recording_duration as duration_seconds
FROM api.consultations
WHERE patient_id = '2fa4bd8a-b070-4461-80d5-f36d0a407e56'
ORDER BY created_at DESC
LIMIT 1;

-- ============================================
-- 5. RELOAD SCHEMA CACHE (FIX)
-- ============================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

SELECT '✅ Schema cache reloaded!' as result;
