-- ================================================================
-- VERIFY ENDOFLOW CONVERSATIONS TABLE
-- Run these queries to verify the table is created correctly
-- ================================================================

-- 1. Check if the table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'api'
  AND table_name = 'endoflow_conversations'
) AS table_exists;

-- Expected: table_exists = true

-- 2. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'endoflow_conversations'
ORDER BY ordinal_position;

-- Expected columns:
-- - id (uuid, not null, default gen_random_uuid())
-- - dentist_id (uuid, not null)
-- - messages (jsonb, not null, default '[]'::jsonb)
-- - intent_type (text, nullable)
-- - created_at (timestamp with time zone, not null, default now())
-- - last_message_at (timestamp with time zone, not null, default now())

-- 3. Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'api'
  AND tablename = 'endoflow_conversations';

-- Expected indexes:
-- - idx_endoflow_conversations_dentist_id
-- - idx_endoflow_conversations_last_message_at
-- - idx_endoflow_conversations_intent_type

-- 4. Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'api'
  AND tablename = 'endoflow_conversations';

-- Expected: rowsecurity = true

-- 5. Check RLS policies
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'api'
  AND tablename = 'endoflow_conversations';

-- Expected policies:
-- - Dentists can view their own conversations (SELECT)
-- - Dentists can create their own conversations (INSERT)
-- - Dentists can update their own conversations (UPDATE)
-- - Dentists can delete their own conversations (DELETE)

-- 6. Test insert (will create a test conversation)
-- Replace YOUR_DENTIST_ID with an actual dentist UUID from your profiles table
/*
INSERT INTO api.endoflow_conversations (dentist_id, messages, intent_type)
VALUES (
  'YOUR_DENTIST_ID'::uuid,
  '[
    {"role": "user", "content": "Test query", "timestamp": "2025-01-01T00:00:00Z"},
    {"role": "assistant", "content": "Test response", "timestamp": "2025-01-01T00:00:01Z"}
  ]'::jsonb,
  'general_question'
)
RETURNING *;
*/

-- 7. Test select (view all conversations)
SELECT 
  id,
  dentist_id,
  jsonb_array_length(messages) as message_count,
  intent_type,
  created_at,
  last_message_at
FROM api.endoflow_conversations
ORDER BY last_message_at DESC
LIMIT 10;

-- 8. Clean up test data (if needed)
/*
DELETE FROM api.endoflow_conversations
WHERE intent_type = 'general_question' 
  AND created_at > NOW() - INTERVAL '1 hour';
*/

-- ================================================================
-- TROUBLESHOOTING
-- ================================================================

-- If table doesn't exist, run: CREATE_ENDOFLOW_CONVERSATIONS_TABLE.sql

-- If RLS is blocking access, check:
SELECT * FROM public.profiles WHERE id = auth.uid();
-- User must have role = 'dentist' and status = 'active'

-- If seeing permission errors, grant permissions:
/*
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.endoflow_conversations TO authenticated;
*/

-- ================================================================
-- SUCCESS INDICATORS
-- ================================================================

-- ✅ table_exists = true
-- ✅ 6 columns present with correct types
-- ✅ 3 indexes created
-- ✅ rowsecurity = true
-- ✅ 4 RLS policies active
-- ✅ Can insert/select test data
