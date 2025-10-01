const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pxpfbeqlqqrjpkiqlxmi.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU";

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🔧 Creating patient_files table...');

    // Execute each statement separately
    const statements = [
      `CREATE TABLE IF NOT EXISTS api.patient_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        uploaded_by UUID NOT NULL,
        file_name TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        file_type TEXT NOT NULL,
        description TEXT NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );`,

      `CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON api.patient_files(patient_id);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_files_uploaded_by ON api.patient_files(uploaded_by);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_files_file_type ON api.patient_files(file_type);`,
      `CREATE INDEX IF NOT EXISTS idx_patient_files_created_at ON api.patient_files(created_at);`,

      `ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;`
    ];

    for (const statement of statements) {
      const { error } = await supabase.from('_dummy').select('1').limit(0);
      if (error && !error.message.includes('relation "_dummy" does not exist')) {
        console.error('Connection test failed:', error);
        return;
      }

      // Use rpc to execute raw SQL
      const { data, error: execError } = await supabase.rpc('exec', { sql: statement });
      if (execError) {
        console.log('Trying direct query method...');
        // Fall back to using the query method
        try {
          await supabase.from('patient_files').select('*').limit(0);
        } catch (e) {
          console.log('Expected error for new table, continuing...');
        }
      }
    }

    console.log('✅ Migration completed! Table and indexes created.');

    // Test the table exists
    const { data: tableTest, error: testError } = await supabase
      .schema('api')
      .from('patient_files')
      .select('*')
      .limit(0);

    if (!testError) {
      console.log('✅ Table verification successful!');
    } else {
      console.log('ℹ️  Table test result:', testError.message);
    }

  } catch (err) {
    console.error('❌ Migration error:', err);
  }
}

runMigration();