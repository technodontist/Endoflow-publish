const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseJSONBSafe(field) {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return null;
  }
}

async function investigatePatientData() {
  console.log('\n🔍 INVESTIGATING PATIENT TREATMENT & DIAGNOSIS DATA\n');
  console.log('=' .repeat(80));

  // Get all patients
  const { data: patients, error: patientsError } = await supabase
    .schema('api')
    .from('patients')
    .select('id, first_name, last_name')
    .limit(100);

  if (patientsError) {
    console.error('❌ Error fetching patients:', patientsError);
    return;
  }

  console.log(`\n📊 Total Patients: ${patients.length}\n`);

  // Find patient6 and final patient
  const patient6 = patients.find(p =>
    p.first_name?.toLowerCase().includes('patient') && p.last_name?.toLowerCase().includes('6')
  ) || patients.find(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes('patient6')
  );

  const finalPatient = patients[patients.length - 1];

  console.log('🎯 Target Patients:\n');
  if (patient6) {
    console.log(`   Patient 6: ${patient6.first_name} ${patient6.last_name} (${patient6.id})`);
  } else {
    console.log('   Patient 6: Not found by name, will check all patients');
  }
  console.log(`   Final Patient: ${finalPatient.first_name} ${finalPatient.last_name} (${finalPatient.id})`);

  // Get ALL consultations to see treatment data
  const { data: consultations, error: consultationsError } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (consultationsError) {
    console.error('❌ Error fetching consultations:', consultationsError);
    return;
  }

  console.log(`\n📋 Total Consultations: ${consultations.length}\n`);

  // Get tooth diagnoses (FDI chart diagnoses)
  const { data: toothDiagnoses, error: toothError } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (toothError) {
    console.error('❌ Error fetching tooth diagnoses:', toothError);
  } else {
    console.log(`🦷 Total Tooth Diagnoses (FDI Chart): ${toothDiagnoses?.length || 0}\n`);
  }

  // Analyze ALL patients to find treatment data
  console.log('\n' + '='.repeat(80));
  console.log('📊 DETAILED PATIENT ANALYSIS');
  console.log('='.repeat(80));

  for (const patient of patients.slice(0, 10)) { // Check first 10 patients
    const patientConsultations = consultations.filter(c => c.patientId === patient.id || c.patient_id === patient.id);
    const patientTeeth = toothDiagnoses?.filter(td => td.patientId === patient.id || td.patient_id === patient.id) || [];

    if (patientConsultations.length > 0 || patientTeeth.length > 0) {
      console.log(`\n👤 ${patient.first_name} ${patient.last_name} (${patient.id})`);
      console.log(`   Consultations: ${patientConsultations.length}`);
      console.log(`   Tooth Diagnoses: ${patientTeeth.length}`);

      // Analyze each consultation
      patientConsultations.forEach((consultation, idx) => {
        console.log(`\n   📋 Consultation ${idx + 1} (${consultation.id}):`);
        console.log(`      Status: ${consultation.status}`);
        console.log(`      Date: ${consultation.consultationDate || consultation.consultation_date}`);

        // Check treatment_plan data
        const treatmentPlan = parseJSONBSafe(consultation.treatmentPlan || consultation.treatment_plan);
        if (treatmentPlan) {
          console.log(`\n      💊 TREATMENT PLAN DATA FOUND:`);
          console.log(`      ${JSON.stringify(treatmentPlan, null, 8).split('\n').map(l => '      ' + l).join('\n')}`);
        } else {
          console.log(`      ⚠️  No treatment_plan data`);
        }

        // Check diagnosis data
        const diagnosis = parseJSONBSafe(consultation.diagnosis);
        if (diagnosis) {
          console.log(`\n      🔬 DIAGNOSIS DATA:`);
          console.log(`      ${JSON.stringify(diagnosis, null, 8).split('\n').map(l => '      ' + l).join('\n')}`);
        }

        // Check pain_assessment
        const painAssessment = parseJSONBSafe(consultation.painAssessment || consultation.pain_assessment);
        if (painAssessment) {
          console.log(`\n      🩹 PAIN ASSESSMENT:`);
          console.log(`      Intensity: ${painAssessment.intensity}`);
          console.log(`      Location: ${painAssessment.location || 'N/A'}`);
          console.log(`      Duration: ${painAssessment.duration || 'N/A'}`);
        }
      });

      // Show tooth diagnoses (FDI Chart)
      if (patientTeeth.length > 0) {
        console.log(`\n   🦷 TOOTH DIAGNOSES (FDI Chart):`);
        patientTeeth.forEach((tooth, idx) => {
          console.log(`\n      Tooth ${idx + 1}: #${tooth.toothNumber || tooth.tooth_number}`);
          console.log(`         Status: ${tooth.status}`);
          console.log(`         Primary Diagnosis: ${tooth.primaryDiagnosis || tooth.primary_diagnosis || 'N/A'}`);
          console.log(`         Details: ${tooth.diagnosisDetails || tooth.diagnosis_details || 'N/A'}`);
          console.log(`         Symptoms: ${tooth.symptoms || 'N/A'}`);
          console.log(`         Recommended Treatment: ${tooth.recommendedTreatment || tooth.recommended_treatment || 'N/A'}`);
          console.log(`         Treatment Priority: ${tooth.treatmentPriority || tooth.treatment_priority || 'N/A'}`);
        });
      }
    }
  }

  // Special focus on patient6 and final patient
  console.log('\n\n' + '='.repeat(80));
  console.log('🎯 FOCUSED ANALYSIS: PATIENT6 & FINAL PATIENT');
  console.log('='.repeat(80));

  const targetPatients = [patient6, finalPatient].filter(Boolean);

  for (const patient of targetPatients) {
    if (!patient) continue;

    const patientConsultations = consultations.filter(c =>
      c.patientId === patient.id || c.patient_id === patient.id
    );
    const patientTeeth = toothDiagnoses?.filter(td =>
      td.patientId === patient.id || td.patient_id === patient.id
    ) || [];

    console.log(`\n👤 ${patient.first_name} ${patient.last_name}`);
    console.log(`   ID: ${patient.id}`);
    console.log(`   Consultations: ${patientConsultations.length}`);
    console.log(`   Tooth Diagnoses: ${patientTeeth.length}`);

    if (patientConsultations.length === 0 && patientTeeth.length === 0) {
      console.log(`   ⚠️  No consultation or tooth diagnosis data found`);
      continue;
    }

    // Full dump of all data
    patientConsultations.forEach((consultation, idx) => {
      console.log(`\n   📋 Full Consultation ${idx + 1} Data:`);

      const fields = [
        'treatment_plan',
        'treatmentPlan',
        'diagnosis',
        'pain_assessment',
        'painAssessment',
        'prognosis',
        'prescription_data',
        'prescriptionData',
        'follow_up_data',
        'followUpData',
        'clinical_examination',
        'clinicalExamination',
        'investigations',
        'medical_history',
        'medicalHistory'
      ];

      fields.forEach(field => {
        const value = consultation[field];
        if (value) {
          const parsed = parseJSONBSafe(value);
          if (parsed && Object.keys(parsed).length > 0) {
            console.log(`\n      ${field.toUpperCase()}:`);
            console.log(`      ${JSON.stringify(parsed, null, 8).split('\n').map(l => '      ' + l).join('\n')}`);
          }
        }
      });
    });

    // Full tooth diagnosis dump
    patientTeeth.forEach((tooth, idx) => {
      console.log(`\n   🦷 Tooth Diagnosis ${idx + 1}:`);
      console.log(`      Consultation ID: ${tooth.consultationId || tooth.consultation_id}`);
      console.log(`      Tooth Number: ${tooth.toothNumber || tooth.tooth_number}`);
      console.log(`      Status: ${tooth.status}`);
      console.log(`      Primary Diagnosis: ${tooth.primaryDiagnosis || tooth.primary_diagnosis}`);
      console.log(`      Diagnosis Details: ${tooth.diagnosisDetails || tooth.diagnosis_details}`);
      console.log(`      Symptoms: ${tooth.symptoms}`);
      console.log(`      Recommended Treatment: ${tooth.recommendedTreatment || tooth.recommended_treatment}`);
      console.log(`      Treatment Priority: ${tooth.treatmentPriority || tooth.treatment_priority}`);
      console.log(`      Treatment Status: ${tooth.treatmentStatus || tooth.treatment_status || 'N/A'}`);
      console.log(`      Notes: ${tooth.notes || 'N/A'}`);
    });
  }

  // Summary of what we found
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINDINGS SUMMARY');
  console.log('='.repeat(80));

  const consultationsWithTreatmentPlan = consultations.filter(c => {
    const tp = parseJSONBSafe(c.treatmentPlan || c.treatment_plan);
    return tp && Object.keys(tp).length > 0;
  });

  const consultationsWithDiagnosis = consultations.filter(c => {
    const diag = parseJSONBSafe(c.diagnosis);
    return diag && Object.keys(diag).length > 0;
  });

  console.log(`\n✅ Consultations with treatment_plan data: ${consultationsWithTreatmentPlan.length}/${consultations.length}`);
  console.log(`✅ Consultations with diagnosis data: ${consultationsWithDiagnosis.length}/${consultations.length}`);
  console.log(`✅ Tooth diagnoses (FDI chart) records: ${toothDiagnoses?.length || 0}`);

  if (consultationsWithTreatmentPlan.length > 0) {
    console.log(`\n💊 TREATMENT PLAN STRUCTURE FOUND:`);
    const sample = parseJSONBSafe(consultationsWithTreatmentPlan[0].treatmentPlan || consultationsWithTreatmentPlan[0].treatment_plan);
    console.log(JSON.stringify(sample, null, 2));
  }

  if (toothDiagnoses && toothDiagnoses.length > 0) {
    console.log(`\n🦷 TOOTH DIAGNOSIS (PRIMARY DIAGNOSIS) SAMPLE:`);
    const sampleTooth = toothDiagnoses[0];
    console.log(`   Tooth #${sampleTooth.toothNumber || sampleTooth.tooth_number}`);
    console.log(`   Primary Diagnosis: ${sampleTooth.primaryDiagnosis || sampleTooth.primary_diagnosis}`);
    console.log(`   Status: ${sampleTooth.status}`);
    console.log(`   Recommended Treatment: ${sampleTooth.recommendedTreatment || sampleTooth.recommended_treatment}`);

    // Count unique primary diagnoses
    const uniquePrimaryDiagnoses = [...new Set(
      toothDiagnoses
        .map(td => td.primaryDiagnosis || td.primary_diagnosis)
        .filter(Boolean)
    )];

    console.log(`\n   📊 Unique Primary Diagnoses Found: ${uniquePrimaryDiagnoses.length}`);
    uniquePrimaryDiagnoses.forEach((diag, idx) => {
      const count = toothDiagnoses.filter(td =>
        (td.primaryDiagnosis || td.primary_diagnosis) === diag
      ).length;
      console.log(`      ${idx + 1}. "${diag}" (${count} teeth)`);
    });
  }

  console.log('\n');
}

investigatePatientData().catch(console.error);
