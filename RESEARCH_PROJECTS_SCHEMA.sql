-- ===============================================
-- RESEARCH PROJECTS DATABASE SCHEMA
-- ===============================================
-- This script creates all necessary tables for the Research Projects system
-- Run this in Supabase SQL Editor to enable Research Projects functionality

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================
-- 1. RESEARCH PROJECTS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS api.research_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dentist_id UUID NOT NULL, -- References auth.users.id

    -- Project metadata
    name TEXT NOT NULL,
    description TEXT,
    hypothesis TEXT,

    -- Project timeline
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,

    -- Project status and configuration
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
    tags TEXT[] DEFAULT '{}',

    -- Filter criteria (stored as JSON)
    filter_criteria JSONB DEFAULT '[]',

    -- Metadata
    patient_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_research_projects_dentist
        FOREIGN KEY (dentist_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ===============================================
-- 2. RESEARCH COHORTS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS api.research_cohorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    patient_id UUID NOT NULL, -- References auth.users.id (patient)

    -- Cohort information
    cohort_name TEXT DEFAULT 'default',
    inclusion_date DATE DEFAULT CURRENT_DATE,
    exclusion_date DATE,
    notes TEXT,

    -- Patient matching metadata
    match_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100 percentage
    matching_criteria JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_research_cohorts_project
        FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_research_cohorts_patient
        FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Unique constraint to prevent duplicate patient-project combinations
    CONSTRAINT unique_patient_project UNIQUE (project_id, patient_id)
);

-- ===============================================
-- 3. RESEARCH CRITERIA TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS api.research_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,

    -- Filter definition
    field_name TEXT NOT NULL,
    operator TEXT NOT NULL,
    field_value TEXT NOT NULL,
    data_type TEXT NOT NULL,
    logical_operator TEXT DEFAULT 'AND' CHECK (logical_operator IN ('AND', 'OR')),

    -- Metadata
    display_name TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_research_criteria_project
        FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE
);

-- ===============================================
-- 4. RESEARCH ANALYTICS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS api.research_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,

    -- Analytics data
    analytics_type TEXT NOT NULL, -- 'demographics', 'outcomes', 'treatments', etc.
    analytics_data JSONB NOT NULL,

    -- Calculation metadata
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_current BOOLEAN DEFAULT TRUE,
    calculation_version TEXT DEFAULT '1.0',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_research_analytics_project
        FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE
);

-- ===============================================
-- 5. RESEARCH EXPORTS TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS api.research_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    exported_by UUID NOT NULL, -- References auth.users.id

    -- Export metadata
    export_type TEXT NOT NULL DEFAULT 'csv', -- 'csv', 'json', 'excel'
    export_format TEXT NOT NULL DEFAULT 'anonymized', -- 'anonymized', 'aggregate'
    file_name TEXT,
    file_path TEXT,
    file_size INTEGER,

    -- Export configuration
    export_criteria JSONB DEFAULT '{}',
    include_fields TEXT[] DEFAULT '{}',
    anonymization_level TEXT DEFAULT 'high' CHECK (anonymization_level IN ('low', 'medium', 'high')),

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Foreign key constraints
    CONSTRAINT fk_research_exports_project
        FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_research_exports_user
        FOREIGN KEY (exported_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Research Projects indexes
CREATE INDEX IF NOT EXISTS idx_research_projects_dentist_id ON api.research_projects(dentist_id);
CREATE INDEX IF NOT EXISTS idx_research_projects_status ON api.research_projects(status);
CREATE INDEX IF NOT EXISTS idx_research_projects_created_at ON api.research_projects(created_at DESC);

-- Research Cohorts indexes
CREATE INDEX IF NOT EXISTS idx_research_cohorts_project_id ON api.research_cohorts(project_id);
CREATE INDEX IF NOT EXISTS idx_research_cohorts_patient_id ON api.research_cohorts(patient_id);
CREATE INDEX IF NOT EXISTS idx_research_cohorts_match_score ON api.research_cohorts(match_score DESC);

-- Research Criteria indexes
CREATE INDEX IF NOT EXISTS idx_research_criteria_project_id ON api.research_criteria(project_id);
CREATE INDEX IF NOT EXISTS idx_research_criteria_active ON api.research_criteria(is_active);

-- Research Analytics indexes
CREATE INDEX IF NOT EXISTS idx_research_analytics_project_id ON api.research_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_research_analytics_type ON api.research_analytics(analytics_type);
CREATE INDEX IF NOT EXISTS idx_research_analytics_current ON api.research_analytics(is_current);

-- Research Exports indexes
CREATE INDEX IF NOT EXISTS idx_research_exports_project_id ON api.research_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_research_exports_status ON api.research_exports(status);
CREATE INDEX IF NOT EXISTS idx_research_exports_created_at ON api.research_exports(created_at DESC);

-- ===============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================

-- Enable RLS on all research tables
ALTER TABLE api.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.research_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.research_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.research_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.research_exports ENABLE ROW LEVEL SECURITY;

-- Research Projects policies
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

-- Research Cohorts policies
CREATE POLICY "Dentists can manage cohorts for their projects" ON api.research_cohorts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
        )
    );

-- Research Criteria policies
CREATE POLICY "Dentists can manage criteria for their projects" ON api.research_criteria
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
        )
    );

-- Research Analytics policies
CREATE POLICY "Dentists can view analytics for their projects" ON api.research_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
        )
    );

-- Research Exports policies
CREATE POLICY "Dentists can manage exports for their projects" ON api.research_exports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
        )
    );

-- ===============================================
-- FUNCTIONS FOR AUTOMATIC UPDATES
-- ===============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION api.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_research_projects_updated_at
    BEFORE UPDATE ON api.research_projects
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

CREATE TRIGGER update_research_cohorts_updated_at
    BEFORE UPDATE ON api.research_cohorts
    FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

-- ===============================================
-- VIEWS FOR EASY QUERYING
-- ===============================================

-- View for research projects with patient counts
CREATE OR REPLACE VIEW api.research_projects_with_stats AS
SELECT
    rp.*,
    COALESCE(cohort_stats.patient_count, 0) as actual_patient_count,
    COALESCE(cohort_stats.avg_match_score, 0) as avg_match_score
FROM api.research_projects rp
LEFT JOIN (
    SELECT
        project_id,
        COUNT(*) as patient_count,
        AVG(match_score) as avg_match_score
    FROM api.research_cohorts
    WHERE exclusion_date IS NULL
    GROUP BY project_id
) cohort_stats ON rp.id = cohort_stats.project_id;

-- View for cohort patients with patient details
CREATE OR REPLACE VIEW api.cohort_patients_detailed AS
SELECT
    rc.*,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age,
    pr.full_name as patient_name
FROM api.research_cohorts rc
JOIN api.patients p ON rc.patient_id = p.id
JOIN public.profiles pr ON rc.patient_id = pr.id
WHERE rc.exclusion_date IS NULL;

-- ===============================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- ===============================================

-- Insert sample research project for testing (uncomment if needed)
/*
INSERT INTO api.research_projects (
    dentist_id,
    name,
    description,
    hypothesis,
    status,
    filter_criteria
) VALUES (
    (SELECT id FROM public.profiles WHERE role = 'dentist' LIMIT 1),
    'Endodontic Treatment Outcomes Study',
    'Analyzing success rates of single-visit vs multi-visit root canal treatments',
    'Single-visit root canal treatments have similar success rates to multi-visit treatments',
    'active',
    '[{"field": "age", "operator": "greater_than", "value": "18", "dataType": "number"}]'::jsonb
);
*/

-- ===============================================
-- COMPLETION MESSAGE
-- ===============================================

-- Create a notification function for successful setup
DO $$
BEGIN
    RAISE NOTICE 'Research Projects database schema has been successfully created!';
    RAISE NOTICE 'Tables created: research_projects, research_cohorts, research_criteria, research_analytics, research_exports';
    RAISE NOTICE 'Indexes and RLS policies have been applied.';
    RAISE NOTICE 'The Research Projects system is now ready for use.';
END $$;