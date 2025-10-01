-- FIX RESEARCH PROJECTS PERMISSIONS
-- Run this SQL in Supabase SQL Editor to fix table access issues

-- 1. Grant permissions to service role
GRANT ALL ON api.research_projects TO service_role;
GRANT ALL ON api.research_cohorts TO service_role;

-- 2. Grant permissions to authenticated users
GRANT ALL ON api.research_projects TO authenticated;
GRANT ALL ON api.research_cohorts TO authenticated;

-- 3. Grant permissions to anon users (for public access if needed)
GRANT SELECT ON api.research_projects TO anon;
GRANT SELECT ON api.research_cohorts TO anon;

-- 4. Make sure the api schema is accessible
GRANT USAGE ON SCHEMA api TO service_role;
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO anon;

-- 5. Grant sequence permissions (for ID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO authenticated;

-- 6. Set default permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO authenticated;

-- 7. Ensure RLS policies allow service role access
-- Update RLS policies to allow service role bypass
DROP POLICY IF EXISTS "Dentists can manage their own research projects" ON api.research_projects;
DROP POLICY IF EXISTS "Dentists can manage cohorts for their projects" ON api.research_cohorts;

-- Create more permissive policies that work with service role
CREATE POLICY "Service role can access all research projects" ON api.research_projects
    FOR ALL TO service_role USING (true);

CREATE POLICY "Dentists can manage their own research projects" ON api.research_projects
    FOR ALL TO authenticated USING (
        auth.uid() = dentist_id OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

CREATE POLICY "Service role can access all research cohorts" ON api.research_cohorts
    FOR ALL TO service_role USING (true);

CREATE POLICY "Dentists can manage cohorts for their projects" ON api.research_cohorts
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND (rp.dentist_id = auth.uid() OR auth.role() = 'service_role')
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Research Projects permissions have been fixed!';
    RAISE NOTICE 'Service role now has full access to research tables';
    RAISE NOTICE 'The Research Projects feature should now work properly';
END $$;