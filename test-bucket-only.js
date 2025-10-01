// Test script - Just create bucket first, policies can come later
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pxpfbeqlqqrjpkiqlxmi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBucketOnly() {
  console.log('🔍 Testing bucket creation status...\n');

  try {
    // Check if bucket exists
    console.log('1️⃣ Checking for medical-files bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.log('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    console.log('📋 All buckets:', buckets.map(b => b.name).join(', ') || 'None');

    const medicalBucket = buckets.find(b => b.name === 'medical-files');

    if (medicalBucket) {
      console.log('✅ medical-files bucket found!');
      console.log('📝 Bucket details:', {
        name: medicalBucket.name,
        public: medicalBucket.public,
        created: medicalBucket.created_at
      });

      // Try a basic upload test with service key (should work regardless of policies)
      console.log('\n2️⃣ Testing basic upload with service key...');
      const testContent = new Blob(['test content'], { type: 'text/plain' });
      const testPath = `test/service-test-${Date.now()}.txt`;

      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('medical-files')
        .upload(testPath, testContent);

      if (uploadError) {
        console.log('❌ Upload failed:', uploadError.message);
        console.log('💡 This is normal - policies need to be set up');
        console.log('📋 Next: Run STORAGE_SETUP_NO_PERMS.sql');
      } else {
        console.log('✅ Upload successful!');
        console.log('📝 File uploaded to:', uploadResult.path);

        // Clean up
        await supabase.storage.from('medical-files').remove([testPath]);
        console.log('🧹 Test file cleaned up');
      }

    } else {
      console.log('❌ medical-files bucket NOT found');
      console.log('\n🔧 NEXT STEPS:');
      console.log('1. Go to Supabase Dashboard');
      console.log('2. Navigate to Storage section');
      console.log('3. Click "Create Bucket"');
      console.log('4. Name: medical-files');
      console.log('5. Privacy: Private');
      console.log('6. Click Create');
      console.log('7. Run this test again');
    }

    console.log('\n' + '='.repeat(50));

    if (medicalBucket) {
      console.log('🎯 BUCKET STATUS: ✅ Ready');
      console.log('📋 NEXT: Run STORAGE_SETUP_NO_PERMS.sql for table + policies');
    } else {
      console.log('🎯 BUCKET STATUS: ❌ Missing');
      console.log('📋 NEXT: Create bucket manually in Supabase Dashboard');
    }

  } catch (err) {
    console.error('❌ Test error:', err);
  }
}

testBucketOnly();