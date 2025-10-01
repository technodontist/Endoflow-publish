// Setup script for Supabase Storage bucket
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pxpfbeqlqqrjpkiqlxmi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStorage() {
  console.log('🔧 Setting up Supabase Storage for medical files...');

  try {
    // Check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    console.log('📋 Current buckets:', buckets.map(b => b.name));

    const bucketExists = buckets.some(bucket => bucket.name === 'medical-files');

    if (bucketExists) {
      console.log('✅ medical-files bucket already exists!');
    } else {
      console.log('📝 medical-files bucket does not exist.');
      console.log('\n🔴 CRITICAL: You need to create the storage bucket manually in Supabase Dashboard');
      console.log('\n📋 Follow these steps:');
      console.log('1. Go to your Supabase Dashboard → Storage');
      console.log('2. Click "Create Bucket"');
      console.log('3. Name: medical-files');
      console.log('4. Set to Private (not public)');
      console.log('5. Save');
      console.log('\n🔧 Then run this SQL in the SQL Editor:');
      console.log(`
-- Storage policies for medical-files bucket
-- Allow authenticated users to upload files
INSERT INTO storage.policies (name, bucket_id, type, definition, check)
VALUES (
  'Allow authenticated uploads',
  'medical-files',
  'INSERT',
  'auth.role() = ''authenticated''',
  'auth.role() = ''authenticated'''
);

-- Allow authenticated users to view files
INSERT INTO storage.policies (name, bucket_id, type, definition, check)
VALUES (
  'Allow authenticated reads',
  'medical-files',
  'SELECT',
  'auth.role() = ''authenticated''',
  'auth.role() = ''authenticated'''
);

-- Allow authenticated users to delete files (optional)
INSERT INTO storage.policies (name, bucket_id, type, definition, check)
VALUES (
  'Allow authenticated deletes',
  'medical-files',
  'DELETE',
  'auth.role() = ''authenticated''',
  'auth.role() = ''authenticated'''
);
      `);
    }

    // Test upload to see if everything works
    if (bucketExists) {
      console.log('\n🧪 Testing storage access...');

      // Create a small test file
      const testContent = new Blob(['test'], { type: 'text/plain' });
      const testFileName = `test-${Date.now()}.txt`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('medical-files')
        .upload(`test/${testFileName}`, testContent);

      if (uploadError) {
        console.error('❌ Storage upload test failed:', uploadError);
        console.log('💡 This likely means the bucket exists but policies are not set correctly.');
      } else {
        console.log('✅ Storage upload test successful!');

        // Clean up test file
        await supabase.storage
          .from('medical-files')
          .remove([`test/${testFileName}`]);
      }
    }

  } catch (err) {
    console.error('❌ Setup error:', err);
  }
}

setupStorage();