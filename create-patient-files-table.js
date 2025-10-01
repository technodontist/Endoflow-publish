// Simple script to create patient_files table using Supabase REST API
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pxpfbeqlqqrjpkiqlxmi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTable() {
  console.log('🔧 Creating patient_files table...');

  try {
    // First, let's test if we can access the database
    const { data: testData, error: testError } = await supabase
      .from('patients')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }

    console.log('✅ Database connection successful');

    // Try to query the patient_files table to see if it exists
    const { data: tableTest, error: tableError } = await supabase
      .schema('api')
      .from('patient_files')
      .select('*')
      .limit(0);

    if (!tableError) {
      console.log('✅ patient_files table already exists!');
      return;
    }

    console.log('ℹ️  Table does not exist, this is expected. Message:', tableError.message);
    console.log('📝 Please create the table manually in Supabase SQL Editor with the following SQL:');
    console.log(`
-- Create patient_files table
CREATE TABLE IF NOT EXISTS api.patient_files (
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
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON api.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_file_type ON api.patient_files(file_type);
CREATE INDEX IF NOT EXISTS idx_patient_files_created_at ON api.patient_files(created_at);

-- Enable RLS
ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view files based on role
CREATE POLICY "Users can view patient files" ON api.patient_files
FOR SELECT
TO authenticated
USING (
    -- Patient can view their own files
    patient_id = auth.uid()
    OR
    -- Staff can view all files
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
);

-- Allow staff to insert files
CREATE POLICY "Staff can upload patient files" ON api.patient_files
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('assistant', 'dentist')
        AND status = 'active'
    )
    AND uploaded_by = auth.uid()
);
    `);

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

createTable();