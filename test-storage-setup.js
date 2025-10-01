// Test script to verify storage setup
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pxpfbeqlqqrjpkiqlxmi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSetup() {
  console.log('🧪 Testing storage and database setup...\n');

  try {
    // Test 1: Check if bucket exists
    console.log('1️⃣ Checking storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.log('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    const medicalBucket = buckets.find(b => b.name === 'medical-files');

    if (medicalBucket) {
      console.log('✅ medical-files bucket exists!');
    } else {
      console.log('❌ medical-files bucket NOT found');
      console.log('📋 Available buckets:', buckets.map(b => b.name).join(', ') || 'None');
      console.log('\n🔧 NEXT STEP: Create bucket manually in Supabase Dashboard:');
      console.log('   • Go to Storage section');
      console.log('   • Click "Create Bucket"');
      console.log('   • Name: medical-files');
      console.log('   • Privacy: Private');
      return;
    }

    // Test 2: Check if table exists
    console.log('\n2️⃣ Checking patient_files table...');
    const { data: tableTest, error: tableError } = await supabase
      .schema('api')
      .from('patient_files')
      .select('*')
      .limit(0);

    if (tableError) {
      if (tableError.message.includes('patient_files')) {
        console.log('❌ patient_files table NOT found');
        console.log('📋 Run FIXED_STORAGE_SETUP.sql to create it');
      } else {
        console.log('❌ Table check error:', tableError.message);
      }
      return;
    } else {
      console.log('✅ patient_files table exists!');
    }

    // Test 3: Try a storage upload
    console.log('\n3️⃣ Testing storage upload...');
    const testContent = new Blob(['test file content'], { type: 'text/plain' });
    const testPath = `test/test-${Date.now()}.txt`;

    const { data: uploadResult, error: uploadError } = await supabase.storage
      .from('medical-files')
      .upload(testPath, testContent);

    if (uploadError) {
      console.log('❌ Storage upload failed:', uploadError.message);
      console.log('📋 This likely means storage policies need to be set up');
      console.log('📋 Run FIXED_STORAGE_SETUP.sql to fix this');
    } else {
      console.log('✅ Storage upload successful!');

      // Clean up test file
      await supabase.storage.from('medical-files').remove([testPath]);
      console.log('🧹 Test file cleaned up');
    }

    console.log('\n🎯 SUMMARY:');
    console.log(`   Bucket: ${medicalBucket ? '✅' : '❌'}`);
    console.log(`   Table: ${!tableError ? '✅' : '❌'}`);
    console.log(`   Upload: ${!uploadError ? '✅' : '❌'}`);

    if (medicalBucket && !tableError && !uploadError) {
      console.log('\n🎉 All tests passed! File uploader should work now.');
    } else {
      console.log('\n⚠️  Some tests failed. Follow the setup instructions above.');
    }

  } catch (err) {
    console.error('❌ Test error:', err);
  }
}

testSetup();