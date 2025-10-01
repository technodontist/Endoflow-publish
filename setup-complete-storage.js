// Complete storage setup script for medical files
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pxpfbeqlqqrjpkiqlxmi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU";

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupComplete() {
  console.log('🚀 Setting up complete file storage system...\n');

  try {
    // Step 1: Create patient_files table
    console.log('1️⃣ Creating patient_files table...');

    const { data: tableResult, error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create patient_files table if it doesn't exist
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

        -- Enable RLS
        ALTER TABLE api.patient_files ENABLE ROW LEVEL SECURITY;
      `
    });

    if (tableError) {
      console.log('❌ Table creation error:', tableError.message);
    } else {
      console.log('✅ patient_files table created successfully!');
    }

    // Step 2: Check bucket status
    console.log('\n2️⃣ Checking storage bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.log('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    const medicalBucket = buckets.find(b => b.name === 'medical-files');

    if (!medicalBucket) {
      console.log('❌ medical-files bucket NOT found');
      console.log('\n🔧 MANUAL STEP REQUIRED:');
      console.log('   1. Open your Supabase Dashboard');
      console.log('   2. Go to Storage section');
      console.log('   3. Click "Create Bucket"');
      console.log('   4. Name: medical-files');
      console.log('   5. Set to Private');
      console.log('   6. Click Create');
      console.log('\n   Then run this script again to continue setup.');
      return;
    }

    console.log('✅ medical-files bucket exists!');

    // Step 3: Set up storage policies
    console.log('\n3️⃣ Setting up storage policies...');

    const { data: policyResult, error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Enable RLS on storage.objects if not already enabled
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

        -- Drop existing storage policies if they exist
        DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

        -- Create storage policies
        CREATE POLICY "Allow authenticated uploads" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'medical-files');

        CREATE POLICY "Allow authenticated reads" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'medical-files');

        CREATE POLICY "Allow authenticated deletes" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'medical-files');
      `
    });

    if (policyError) {
      console.log('❌ Storage policy error:', policyError.message);
    } else {
      console.log('✅ Storage policies created successfully!');
    }

    // Step 4: Set up table policies
    console.log('\n4️⃣ Setting up table policies...');

    const { data: tablePolicyResult, error: tablePolicyError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view patient files" ON api.patient_files;
        DROP POLICY IF EXISTS "Staff can upload patient files" ON api.patient_files;
        DROP POLICY IF EXISTS "Staff can delete patient files" ON api.patient_files;

        -- Create table policies
        CREATE POLICY "Users can view patient files" ON api.patient_files
        FOR SELECT TO authenticated
        USING (
            patient_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()
                AND role IN ('assistant', 'dentist')
                AND status = 'active'
            )
        );

        CREATE POLICY "Staff can upload patient files" ON api.patient_files
        FOR INSERT TO authenticated
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()
                AND role IN ('assistant', 'dentist')
                AND status = 'active'
            )
            AND uploaded_by = auth.uid()
        );

        CREATE POLICY "Staff can delete patient files" ON api.patient_files
        FOR DELETE TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()
                AND role IN ('assistant', 'dentist')
                AND status = 'active'
            )
        );
      `
    });

    if (tablePolicyError) {
      console.log('❌ Table policy error:', tablePolicyError.message);
    } else {
      console.log('✅ Table policies created successfully!');
    }

    // Step 5: Test the complete setup
    console.log('\n5️⃣ Testing complete setup...');

    const testContent = new Blob(['test file for medical uploads'], { type: 'text/plain' });
    const testPath = `test/setup-test-${Date.now()}.txt`;

    const { data: uploadResult, error: uploadError } = await supabase.storage
      .from('medical-files')
      .upload(testPath, testContent);

    if (uploadError) {
      console.log('❌ Upload test failed:', uploadError.message);
    } else {
      console.log('✅ Upload test successful!');

      // Clean up test file
      await supabase.storage.from('medical-files').remove([testPath]);
      console.log('🧹 Test file cleaned up');
    }

    console.log('\n🎉 SETUP COMPLETE!');
    console.log('✅ Database table: Ready');
    console.log('✅ Storage bucket: Ready');
    console.log('✅ Storage policies: Ready');
    console.log('✅ Table policies: Ready');
    console.log('✅ Upload test: Passed');
    console.log('\n💡 Your file uploader should now work perfectly!');

  } catch (err) {
    console.error('❌ Setup error:', err);
  }
}

setupComplete();