const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createResearchTables() {
  try {
    console.log('🚀 Creating research projects database tables...');

    // Execute SQL directly through the REST API
    const createTablesSQL = `
      -- Enable UUID extension if not already enabled
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

      -- 3. Create research_criteria table
      CREATE TABLE IF NOT EXISTS api.research_criteria (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        field_name TEXT NOT NULL,
        operator TEXT NOT NULL,
        field_value TEXT NOT NULL,
        data_type TEXT NOT NULL,
        logical_operator TEXT DEFAULT 'AND' CHECK (logical_operator IN ('AND', 'OR')),
        display_name TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT fk_research_criteria_project
          FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE
      );

      -- 4. Create research_analytics table
      CREATE TABLE IF NOT EXISTS api.research_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        analytics_type TEXT NOT NULL,
        analytics_data JSONB NOT NULL,
        calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_current BOOLEAN DEFAULT TRUE,
        calculation_version TEXT DEFAULT '1.0',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT fk_research_analytics_project
          FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE
      );

      -- 5. Create research_exports table
      CREATE TABLE IF NOT EXISTS api.research_exports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        exported_by UUID NOT NULL,
        export_type TEXT NOT NULL DEFAULT 'csv',
        export_format TEXT NOT NULL DEFAULT 'anonymized',
        file_name TEXT,
        file_path TEXT,
        file_size INTEGER,
        export_criteria JSONB DEFAULT '{}',
        include_fields TEXT[] DEFAULT '{}',
        anonymization_level TEXT DEFAULT 'high' CHECK (anonymization_level IN ('low', 'medium', 'high')),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT fk_research_exports_project
          FOREIGN KEY (project_id) REFERENCES api.research_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_research_exports_user
          FOREIGN KEY (exported_by) REFERENCES auth.users(id) ON DELETE CASCADE
      );

      -- 6. Enable Row Level Security
      ALTER TABLE api.research_projects ENABLE ROW LEVEL SECURITY;
      ALTER TABLE api.research_cohorts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE api.research_criteria ENABLE ROW LEVEL SECURITY;
      ALTER TABLE api.research_analytics ENABLE ROW LEVEL SECURITY;
      ALTER TABLE api.research_exports ENABLE ROW LEVEL SECURITY;

      -- 7. Create RLS Policies
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

      CREATE POLICY "Dentists can manage cohorts for their projects" ON api.research_cohorts
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
          )
        );

      CREATE POLICY "Dentists can manage criteria for their projects" ON api.research_criteria
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
          )
        );

      CREATE POLICY "Dentists can view analytics for their projects" ON api.research_analytics
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
          )
        );

      CREATE POLICY "Dentists can manage exports for their projects" ON api.research_exports
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM api.research_projects rp
            WHERE rp.id = project_id
            AND rp.dentist_id = auth.uid()
          )
        );

      -- 8. Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_research_projects_dentist_id ON api.research_projects(dentist_id);
      CREATE INDEX IF NOT EXISTS idx_research_projects_status ON api.research_projects(status);
      CREATE INDEX IF NOT EXISTS idx_research_projects_created_at ON api.research_projects(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_research_cohorts_project_id ON api.research_cohorts(project_id);
      CREATE INDEX IF NOT EXISTS idx_research_cohorts_patient_id ON api.research_cohorts(patient_id);
      CREATE INDEX IF NOT EXISTS idx_research_criteria_project_id ON api.research_criteria(project_id);
    `;

    // Use fetch to send raw SQL to Supabase
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql: createTablesSQL
      })
    });

    if (response.ok) {
      console.log('✅ Research Projects database schema created successfully!');
      console.log('📊 Tables created: research_projects, research_cohorts, research_criteria, research_analytics, research_exports');
      console.log('🔒 Row Level Security policies applied');
      console.log('📈 Performance indexes created');
    } else {
      const error = await response.text();
      console.error('❌ Schema creation failed:', error);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createResearchTables();