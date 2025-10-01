const { createClient } = require('@supabase/supabase-js');

async function setupResearchTables() {
  try {
    console.log('🔧 Setting up Research Projects tables directly...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Create research_projects table
    console.log('📊 Creating research_projects table...');
    let { data, error } = await supabase.rpc('exec', {
      sql: `
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
      `
    });

    if (error) {
      console.error('❌ Error creating research_projects:', error);
    } else {
      console.log('✅ research_projects table created');
    }

    // 2. Create research_cohorts table
    console.log('👥 Creating research_cohorts table...');
    ({ data, error } = await supabase.rpc('exec', {
      sql: `
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
      `
    }));

    if (error) {
      console.error('❌ Error creating research_cohorts:', error);
    } else {
      console.log('✅ research_cohorts table created');
    }

    // 3. Enable Row Level Security
    console.log('🔒 Setting up Row Level Security...');
    ({ data, error } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE api.research_projects ENABLE ROW LEVEL SECURITY;
        ALTER TABLE api.research_cohorts ENABLE ROW LEVEL SECURITY;
      `
    }));

    if (error) {
      console.error('❌ Error enabling RLS:', error);
    } else {
      console.log('✅ RLS enabled');
    }

    // 4. Test table creation
    console.log('🧪 Testing table access...');
    const { data: projects, error: testError } = await supabase
      .schema('api')
      .from('research_projects')
      .select('count(*)', { count: 'exact', head: true });

    if (testError) {
      console.error('❌ Table test failed:', testError);
    } else {
      console.log('✅ Tables accessible - setup complete!');
      console.log('🎉 Research Projects system is ready to use!');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupResearchTables();