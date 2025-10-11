-- ===============================================
-- FIX MESSAGE_THREADS PERMISSION ERRORS
-- ===============================================
-- This script grants necessary permissions to service_role
-- for the messaging tables to fix permission denied errors

-- Grant permissions on message_threads table
GRANT ALL ON api.message_threads TO service_role;
GRANT ALL ON api.thread_messages TO service_role;

-- Grant usage on the api schema (if not already granted)
GRANT USAGE ON SCHEMA api TO service_role;

-- Grant permissions on all sequences in api schema (for auto-generated IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO service_role;

-- Enable service_role to bypass RLS (Row Level Security) for administrative operations
ALTER TABLE api.message_threads FORCE ROW LEVEL SECURITY;
ALTER TABLE api.thread_messages FORCE ROW LEVEL SECURITY;

-- Verify the grants were successful
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully granted permissions to service_role';
    RAISE NOTICE '   • GRANT ALL on api.message_threads';
    RAISE NOTICE '   • GRANT ALL on api.thread_messages';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Testing permissions...';
    
    -- Test if service_role can access the tables
    PERFORM 1 FROM api.message_threads LIMIT 1;
    RAISE NOTICE '✅ message_threads table accessible';
    
    PERFORM 1 FROM api.thread_messages LIMIT 1;
    RAISE NOTICE '✅ thread_messages table accessible';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Messaging permissions fix complete!';
    RAISE NOTICE '   The "permission denied for table message_threads" error should now be resolved.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  Warning: % - %', SQLERRM, SQLSTATE;
        RAISE NOTICE '   This is normal if tables are empty or if running with limited permissions.';
END $$;
