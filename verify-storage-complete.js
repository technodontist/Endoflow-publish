// Final verification script - run AFTER manual bucket creation and SQL execution
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pxpfbeqlqqrjpkiqlxmi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODQyNywiZXhwIjoyMDcyNzU0NDI3fQ.8dOLsTfkiflfl8xprKTfTCxku0wvuvkpbDOIWc8oNkU";

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyComplete() {
  console.log('🔍 Verifying complete file storage setup...\n');

  let allGood = true;

  try {
    // Test 1: Check bucket
    console.log('1️⃣ Checking storage bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.log('❌ Error listing buckets:', bucketsError.message);
      allGood = false;
    } else {
      const medicalBucket = buckets.find(b => b.name === 'medical-files');
      if (medicalBucket) {
        console.log('✅ medical-files bucket exists!');
      } else {
        console.log('❌ medical-files bucket NOT found');
        console.log('📋 Available buckets:', buckets.map(b => b.name).join(', ') || 'None');
        allGood = false;
      }
    }

    // Test 2: Check table
    console.log('\n2️⃣ Checking patient_files table...');
    const { data: tableTest, error: tableError } = await supabase
      .schema('api')
      .from('patient_files')
      .select('*')
      .limit(0);

    if (tableError) {
      if (tableError.message.includes('patient_files')) {
        console.log('❌ patient_files table NOT found');
        console.log('📋 Run FINAL_STORAGE_SETUP.sql in Supabase SQL Editor');
        allGood = false;
      } else {
        console.log('❌ Table check error:', tableError.message);
        allGood = false;
      }
    } else {
      console.log('✅ patient_files table exists!');
    }

    // Test 3: Upload test
    if (allGood) {
      console.log('\n3️⃣ Testing file upload...');
      const testContent = new Blob(['test upload for medical files'], { type: 'text/plain' });
      const testPath = `test/verification-${Date.now()}.txt`;

      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('medical-files')
        .upload(testPath, testContent);

      if (uploadError) {
        console.log('❌ Upload test failed:', uploadError.message);
        console.log('💡 Check storage policies in FINAL_STORAGE_SETUP.sql');
        allGood = false;
      } else {
        console.log('✅ Upload test successful!');

        // Clean up
        await supabase.storage.from('medical-files').remove([testPath]);
        console.log('🧹 Test file cleaned up');
      }
    }

    // Final result
    console.log('\n' + '='.repeat(50));
    if (allGood) {
      console.log('🎉 SETUP VERIFICATION PASSED!');
      console.log('✅ Storage bucket: Ready');
      console.log('✅ Database table: Ready');
      console.log('✅ Upload functionality: Working');
      console.log('\n💡 Your file uploader is now fully functional!');
      console.log('🚀 Go test it at: /assistant/files');
    } else {
      console.log('❌ SETUP INCOMPLETE');
      console.log('\n📋 TODO:');
      console.log('1. Create "medical-files" bucket in Supabase Dashboard (Storage section)');
      console.log('2. Run FINAL_STORAGE_SETUP.sql in Supabase SQL Editor');
      console.log('3. Run this verification script again');
    }

  } catch (err) {
    console.error('❌ Verification error:', err);
  }
}

verifyComplete();