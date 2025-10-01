const { createServiceClient } = require('./lib/supabase/server');
const fs = require('fs');

async function setupResearchTables() {
  try {
    console.log('🔧 Setting up Research Projects tables...');

    // Read the SQL setup script
    const sqlScript = fs.readFileSync('./CREATE_RESEARCH_TABLES_SIMPLE.sql', 'utf8');

    // Create service client with elevated permissions
    const supabase = await createServiceClient();

    // Execute the SQL script
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlScript });

    if (error) {
      console.error('❌ Error setting up tables:', error);
      return;
    }

    console.log('✅ Research Projects tables setup completed!');
    console.log('📊 Tables created: research_projects, research_cohorts');
    console.log('🔒 RLS policies and indexes applied');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupResearchTables();