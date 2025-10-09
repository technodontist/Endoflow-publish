/**
 * Direct Database Test for Tooth Diagnoses
 * Run this to check what's actually in the database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkToothData() {
  console.log('🔍 Checking tooth diagnoses in database...\n');
  
  // Replace with actual patient ID from your testing
  const patientId = '00b1dad3-16da-4456-bae7-6641706ad62a';
  
  try {
    // Check latest_tooth_diagnoses view
    console.log('📋 Checking latest_tooth_diagnoses view:');
    const { data: latestData, error: latestError } = await supabase
      .schema('api')
      .from('latest_tooth_diagnoses')
      .select('*')
      .eq('patient_id', patientId);
    
    if (latestError) {
      console.error('❌ Error:', latestError);
    } else {
      console.log(`Found ${latestData.length} teeth with diagnoses\n`);
      latestData.forEach(tooth => {
        console.log(`Tooth #${tooth.tooth_number}:`);
        console.log(`  Status: ${tooth.status}`);
        console.log(`  Color Code: ${tooth.color_code}`);
        console.log(`  Diagnosis: ${tooth.primary_diagnosis}`);
        console.log(`  Updated: ${tooth.updated_at}`);
        console.log('');
      });
    }
    
    // Also check raw tooth_diagnoses table for tooth 41
    console.log('📋 Checking raw tooth_diagnoses table for tooth 41:');
    const { data: rawData, error: rawError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('patient_id', patientId)
      .eq('tooth_number', '41')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (rawError) {
      console.error('❌ Error:', rawError);
    } else {
      console.log(`Found ${rawData.length} records for tooth 41\n`);
      rawData.forEach((record, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(`  ID: ${record.id}`);
        console.log(`  Status: ${record.status}`);
        console.log(`  Color Code: ${record.color_code}`);
        console.log(`  Diagnosis: ${record.primary_diagnosis}`);
        console.log(`  Updated: ${record.updated_at}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkToothData();