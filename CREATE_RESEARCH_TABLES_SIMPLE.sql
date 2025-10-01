-- ===============================================
-- MINIMAL RESEARCH PROJECTS TABLES
-- ===============================================
-- Run this in Supabase SQL Editor to enable Research Projects

-- 1. Create research_projects table
CREATE TABLE IF NOT EXISTS api.research_projects (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_research_projects_dentist
        FOREIGN KEY (dentist_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Create research_cohorts table
CREATE TABLE IF NOT EXISTS api.research_cohorts (
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
    CONSTRAINT fk_research_cohorts_project
        FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_research_cohorts_patient
        FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT unique_patient_project UNIQUE (project_id, patient_id)
);

-- 3. Enable Row Level Security
ALTER TABLE api.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.research_cohorts ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies (safe - handle existing policies)
DO $$
BEGIN
    -- Create research_projects policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'research_projects'
        AND policyname = 'Dentists can manage their own research projects'
    ) THEN
        CREATE POLICY "Dentists can manage their own research projects" ON api.research_projects
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                    AND role = 'dentist'
                    AND status = 'active'
                )
                AND dentist_id = auth.uid()
            );
    END IF;

    -- Create research_cohorts policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'research_cohorts'
        AND policyname = 'Dentists can manage cohorts for their projects'
    ) THEN
        CREATE POLICY "Dentists can manage cohorts for their projects" ON api.research_cohorts
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM api.research_projects rp
                    WHERE rp.id = project_id
                    AND rp.dentist_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_projects_dentist_id ON api.research_projects(dentist_id);
CREATE INDEX IF NOT EXISTS idx_research_projects_status ON api.research_projects(status);
CREATE INDEX IF NOT EXISTS idx_research_cohorts_project_id ON api.research_cohorts(project_id);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Research Projects tables created successfully!';
    RAISE NOTICE 'You can now use patient search and save projects in the Research Projects tab.';
END $$;