const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDiagnosisData() {
  console.log('🔍 CHECKING DIAGNOSIS DATA IN DATABASE\n');

  // 1. Check consultations diagnosis format
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CONSULTATIONS TABLE - Overall Diagnosis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: consultations } = await supabase
    .schema('api')
    .from('consultations')
    .select('id, patient_id, diagnosis, status, consultation_date')
    .eq('status', 'completed')
    .limit(10);

  if (!consultations || consultations.length === 0) {
    console.log('❌ No completed consultations found!\n');
  } else {
    console.log(`✅ Found ${consultations.length} consultations:\n`);

    consultations.forEach((c, i) => {
      console.log(`Consultation ${i + 1}:`);
      console.log(`  ID: ${c.id.substring(0, 8)}...`);
      console.log(`  Date: ${c.consultation_date}`);
      console.log(`  Diagnosis Data:`);

      if (!c.diagnosis) {
        console.log(`    ❌ NULL - No diagnosis saved`);
      } else {
        try {
          const diagData = typeof c.diagnosis === 'string' ? JSON.parse(c.diagnosis) : c.diagnosis;
          console.log(`    Type: ${typeof diagData}`);
          console.log(`    Content:`, JSON.stringify(diagData, null, 6));

          if (diagData.primary) {
            console.log(`    ✅ Has primary diagnosis: "${diagData.primary}"`);
          } else {
            console.log(`    ⚠️ No 'primary' field found`);
          }
        } catch (e) {
          console.log(`    ⚠️ Not valid JSON:`, c.diagnosis);
        }
      }
      console.log('');
    });
  }

  // 2. Check tooth_diagnoses table
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🦷 TOOTH_DIAGNOSES TABLE - FDI Chart Data');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: toothDiagnoses, error: tdError } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('id, patient_id, tooth_number, status, primary_diagnosis, recommended_treatment')
    .limit(10);

  if (tdError) {
    console.log(`❌ Error querying tooth_diagnoses: ${tdError.message}\n`);
  } else if (!toothDiagnoses || toothDiagnoses.length === 0) {
    console.log('❌ No tooth diagnoses found - FDI chart not being used!\n');
  } else {
    console.log(`✅ Found ${toothDiagnoses.length} tooth diagnoses:\n`);

    toothDiagnoses.forEach((td, i) => {
      console.log(`Tooth Diagnosis ${i + 1}:`);
      console.log(`  Tooth #${td.tooth_number}`);
      console.log(`  Status: ${td.status || 'not set'}`);
      console.log(`  Primary Diagnosis: ${td.primary_diagnosis || 'not set'}`);
      console.log(`  Recommended Treatment: ${td.recommended_treatment || 'not set'}`);
      console.log('');
    });
  }

  // 3. Statistics
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DIAGNOSIS DATA STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Consultations with diagnosis
  const { count: totalConsultations } = await supabase
    .schema('api')
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed');

  const { count: consultationsWithDiagnosis } = await supabase
    .schema('api')
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .not('diagnosis', 'is', null);

  console.log(`Completed Consultations: ${totalConsultations || 0}`);
  console.log(`  With diagnosis data: ${consultationsWithDiagnosis || 0} (${totalConsultations ? Math.round(consultationsWithDiagnosis / totalConsultations * 100) : 0}%)`);
  console.log(`  Without diagnosis: ${(totalConsultations || 0) - (consultationsWithDiagnosis || 0)}\n`);

  // Tooth diagnoses count
  const { count: totalToothDiagnoses } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('id', { count: 'exact', head: true });

  const { data: patientsWithToothDiag } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('patient_id');

  const uniquePatients = new Set(patientsWithToothDiag?.map(p => p.patient_id) || []).size;

  console.log(`Total Tooth Diagnoses: ${totalToothDiagnoses || 0}`);
  console.log(`  Unique Patients: ${uniquePatients}`);
  console.log(`  Avg teeth per patient: ${uniquePatients ? (totalToothDiagnoses / uniquePatients).toFixed(1) : 0}\n`);

  // 4. Sample diagnosis values
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔬 SAMPLE DIAGNOSIS VALUES (for filtering)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get unique tooth diagnoses
  const { data: uniqueToothDiag } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('primary_diagnosis')
    .not('primary_diagnosis', 'is', null)
    .limit(100);

  const uniqueDiagValues = [...new Set(uniqueToothDiag?.map(t => t.primary_diagnosis) || [])];

  if (uniqueDiagValues.length > 0) {
    console.log('Unique Tooth Diagnoses (from FDI chart):');
    uniqueDiagValues.slice(0, 10).forEach(d => console.log(`  • ${d}`));
    if (uniqueDiagValues.length > 10) {
      console.log(`  ... and ${uniqueDiagValues.length - 10} more`);
    }
  } else {
    console.log('⚠️ No tooth-specific diagnoses found');
  }

  console.log('\n✅ DIAGNOSIS DATA CHECK COMPLETE\n');
}

checkDiagnosisData().catch(console.error);
