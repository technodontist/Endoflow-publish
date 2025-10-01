-- Fix schema exposure issue in Supabase
-- This script ensures the api schema is properly exposed via PostgREST

-- 1. First, grant usage on the api schema to the anon and authenticated roles
GRANT USAGE ON SCHEMA api TO anon, authenticated;

-- 2. Grant appropriate permissions on all tables in the api schema
GRANT SELECT ON ALL TABLES IN SCHEMA api TO authenticated;
GRANT INSERT ON api.pending_registrations TO anon; -- Allow anonymous users to submit registrations

-- 3. Grant permissions on future tables (important for maintenance)
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT INSERT ON TABLES TO anon;

-- 4. Make sure the api schema is included in the search path for PostgREST
-- Note: This needs to be done in Supabase Dashboard -> Settings -> API -> Exposed schemas
-- Add 'api' to the list of exposed schemas (comma-separated)

-- 5. Verify current permissions
SELECT
    schemaname,
    tablename,
    grantor,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges
WHERE schemaname = 'api'
ORDER BY tablename, grantee, privilege_type;