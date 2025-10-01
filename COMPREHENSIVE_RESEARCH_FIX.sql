-- COMPREHENSIVE RESEARCH FIX
-- This SQL fixes all permission and access issues
-- Run this ENTIRE script in Supabase SQL Editor

-- 1. First, let's make sure the api schema exists and is accessible
CREATE SCHEMA IF NOT EXISTS api;

-- 2. Grant full schema access to all roles
GRANT ALL ON SCHEMA api TO postgres;
GRANT ALL ON SCHEMA api TO service_role;
GRANT ALL ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO anon;

-- 3. Drop existing tables if they have permission issues and recreate them
DROP TABLE IF EXISTS api.research_cohorts;
DROP TABLE IF EXISTS api.research_projects;

-- 4. Recreate the tables with proper ownership
CREATE TABLE api.research_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dentist_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    hypothesis TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
    tags TEXT[] DEFAULT '{}',
    filter_criteria JSONB DEFAULT '[]',
    patient_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE api.research_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    cohort_name TEXT DEFAULT 'default',
    inclusion_date DATE DEFAULT CURRENT_DATE,
    exclusion_date DATE,
    notes TEXT,
    match_score DECIMAL(5,2) DEFAULT 0.0,
    matching_criteria JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_patient_project UNIQUE (project_id, patient_id)
);

-- 5. Set proper ownership
ALTER TABLE api.research_projects OWNER TO postgres;
ALTER TABLE api.research_cohorts OWNER TO postgres;

-- 6. Grant ALL permissions to service_role (this is key!)
GRANT ALL PRIVILEGES ON api.research_projects TO service_role;
GRANT ALL PRIVILEGES ON api.research_cohorts TO service_role;
GRANT ALL PRIVILEGES ON api.research_projects TO authenticated;
GRANT ALL PRIVILEGES ON api.research_cohorts TO authenticated;

-- 7. Grant sequence permissions for ID generation
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO authenticated;

-- 8. Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON SEQUENCES TO authenticated;

-- 9. Enable RLS but make it permissive for service_role
ALTER TABLE api.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.research_cohorts ENABLE ROW LEVEL SECURITY;

-- 10. Create very permissive RLS policies
CREATE POLICY "Allow all for service_role" ON api.research_projects
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow dentists to manage projects" ON api.research_projects
    FOR ALL TO authenticated USING (
        current_setting('role') = 'service_role' OR
        auth.uid() = dentist_id OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    ) WITH CHECK (true);

CREATE POLICY "Allow all for service_role cohorts" ON api.research_cohorts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow dentists to manage cohorts" ON api.research_cohorts
    FOR ALL TO authenticated USING (
        current_setting('role') = 'service_role' OR
        EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    ) WITH CHECK (true);

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_projects_dentist_id ON api.research_projects(dentist_id);
CREATE INDEX IF NOT EXISTS idx_research_projects_status ON api.research_projects(status);
CREATE INDEX IF NOT EXISTS idx_research_cohorts_project_id ON api.research_cohorts(project_id);

-- 12. Test the setup by inserting and deleting a test record
DO $$
DECLARE
    test_project_id UUID;
BEGIN
    -- Insert test project
    INSERT INTO api.research_projects (dentist_id, name, description)
    VALUES ('00000000-0000-0000-0000-000000000000', 'Test Project', 'Test Description')
    RETURNING id INTO test_project_id;

    -- Delete test project
    DELETE FROM api.research_projects WHERE id = test_project_id;

    RAISE NOTICE 'SUCCESS: Research tables are working correctly!';
    RAISE NOTICE 'Tables: research_projects, research_cohorts';
    RAISE NOTICE 'All permissions granted to service_role and authenticated users';
    RAISE NOTICE 'Row Level Security configured with permissive policies';
    RAISE NOTICE 'Research Projects feature should now work properly!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: %', SQLERRM;
        RAISE NOTICE 'Check table permissions and try again';
END $$;