import { createClient } from '@/lib/supabase/server';

/**
 * Script to fix invalid formData in pending_registrations table
 * This should be run once to clean up any existing bad records
 */
async function fixInvalidFormData() {
  console.log('🔧 Starting formData cleanup...');
  
  const supabase = await createClient();
  
  try {
    // Get all pending registrations
    const { data: registrations, error: fetchError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .select('*');

    if (fetchError) {
      console.error('❌ Error fetching registrations:', fetchError);
      return;
    }

    if (!registrations || registrations.length === 0) {
      console.log('✅ No registrations found');
      return;
    }

    console.log(`📊 Found ${registrations.length} registrations to check`);

    const invalidRecords = [];
    const validRecords = [];

    for (const registration of registrations) {
      try {
        // Try to parse the formData
        if (!registration.formData || 
            registration.formData === 'undefined' || 
            registration.formData.trim() === '') {
          invalidRecords.push({
            id: registration.id,
            reason: 'Empty or undefined formData',
            formData: registration.formData
          });
        } else {
          JSON.parse(registration.formData);
          validRecords.push(registration);
        }
      } catch (error) {
        invalidRecords.push({
          id: registration.id,
          reason: 'Invalid JSON',
          formData: registration.formData,
          error: error.message
        });
      }
    }

    console.log(`✅ Valid records: ${validRecords.length}`);
    console.log(`❌ Invalid records: ${invalidRecords.length}`);

    if (invalidRecords.length > 0) {
      console.log('\n📋 Invalid records details:');
      invalidRecords.forEach(record => {
        console.log(`- ID: ${record.id}`);
        console.log(`  Reason: ${record.reason}`);
        console.log(`  FormData: ${JSON.stringify(record.formData)}`);
        if (record.error) {
          console.log(`  Error: ${record.error}`);
        }
        console.log('');
      });

      console.log('🗑️  To clean up these records, you can:');
      console.log('1. Delete them if they\'re not needed');
      console.log('2. Fix the formData manually if you know what it should contain');
      console.log('\nDelete query example:');
      console.log(`DELETE FROM api.pending_registrations WHERE id IN ('${invalidRecords.map(r => r.id).join('\', \'')}');`);
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }

  console.log('🏁 Cleanup script completed');
}

// Run the script if executed directly
if (require.main === module) {
  fixInvalidFormData().catch(console.error);
}

export { fixInvalidFormData };