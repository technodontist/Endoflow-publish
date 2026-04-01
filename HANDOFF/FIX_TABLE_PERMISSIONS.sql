-- ============================================
-- ENDOFLOW: Fix API Schema Table Permissions
-- Run this in Supabase SQL Editor
-- Created: 2026-03-26
-- ============================================

-- Step 1: Ensure api schema is accessible
GRANT USAGE ON SCHEMA api TO authenticated, anon, service_role;

-- Step 2: Grant permissions on ALL api tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO anon;

-- Step 3: Grant sequence permissions (for auto-generated IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO service_role;

-- Step 4: Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- Step 5: Add api schema to PostgREST search path
-- This makes tables in the api schema accessible via Supabase client
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, api';

-- Step 6: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Step 7: Verify - this should return all api tables
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'api'
ORDER BY table_name;
