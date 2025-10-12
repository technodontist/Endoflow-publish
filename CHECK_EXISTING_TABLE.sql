-- ================================================================
-- CHECK EXISTING ENDOFLOW_CONVERSATIONS TABLE
-- The table already exists! Let's verify it's set up correctly
-- ================================================================

-- 1. Verify the table exists and check its structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'api'
  AND table_name = 'endoflow_conversations'
ORDER BY ordinal_position;

-- Expected output: 6 columns (id, dentist_id, messages, intent_type, created_at, last_message_at)

-- 2. Check if there are any existing conversations
SELECT 
  COUNT(*) as total_conversations,
  COUNT(DISTINCT dentist_id) as unique_dentists
FROM api.endoflow_conversations;

-- 3. View sample conversations (if any exist)
SELECT 
  id,
  dentist_id,
  jsonb_array_length(messages) as message_count,
  intent_type,
  created_at,
  last_message_at
FROM api.endoflow_conversations
ORDER BY last_message_at DESC
LIMIT 5;

-- 4. Check RLS policies are active
SELECT
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Read'
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
  END as action_type
FROM pg_policies
WHERE schemaname = 'api'
  AND tablename = 'endoflow_conversations'
ORDER BY policyname;

-- Expected: 4 policies (view, create, update, delete)

-- 5. Check indexes exist
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'api'
  AND tablename = 'endoflow_conversations';

-- Expected: 3 indexes on dentist_id, last_message_at, intent_type

-- ================================================================
-- VERIFICATION RESULTS
-- ================================================================

-- If all checks pass:
-- ✅ Table exists with correct structure
-- ✅ RLS policies are active
-- ✅ Indexes are present
-- ✅ Ready to use!

-- If you see existing conversations, that's OK - they'll be used for context

-- ================================================================
-- OPTIONAL: Clean up old conversations (if needed)
-- ================================================================

-- Uncomment to delete conversations older than 7 days
/*
DELETE FROM api.endoflow_conversations
WHERE created_at < NOW() - INTERVAL '7 days';
*/

-- Uncomment to delete ALL conversations and start fresh
/*
TRUNCATE TABLE api.endoflow_conversations;
*/
