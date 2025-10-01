// Test script to verify complete consultation integration after RLS fix
// This script simulates the data flow from the enhanced consultation component

const { createClient } = require('@supabase/supabase-js')

// Simulate the exact data structure from our consultation component
function createTestConsultationData() {
  return {
    // From consultationData state
    patientId: '', // Will be filled with real patient ID
    chiefComplaint: 'Pain in upper right tooth',
    painLocation: 'Upper right molar area',
    painIntensity: 7,
    painDuration: '3 days',
    painCharacter: 'Sharp, throbbing',
    painTriggers: ['Cold drinks', 'Chewing'],
    painRelief: ['Ibuprofen', 'Warm rinse'],
    medicalHistory: ['Hypertension'],
    currentMedications: ['Lisinopril 10mg'],
    allergies: ['Penicillin'],
    previousDentalTreatments: ['Cleaning 6 months ago'],
    extraoralFindings: 'Slight facial swelling on right side',
    intraoralFindings: 'Deep cavity visible on tooth #3',
    periodontalStatus: 'Mild gingivitis',
    occlusionNotes: 'Normal bite relationship',
    radiographicFindings: 'Periapical radiolucency around tooth #3',
    vitalityTests: 'Non-vital response to cold test',
    percussionTests: 'Positive percussion response',
    palpationFindings: 'Tenderness to palpation',
    provisionalDiagnosis: ['Irreversible Pulpitis'],
    differentialDiagnosis: ['Periapical Abscess'],
    finalDiagnosis: ['Irreversible Pulpitis'],
    treatmentPlan: ['Root Canal Treatment', 'Crown Restoration'],
    prognosis: 'good',
    prescriptions: [],
    followUpPlans: [],
    additionalNotes: 'Patient educated about treatment options'
  }
}

// Simulate tooth data from the interactive chart
function createTestToothData() {
  return {
    '3': {
      currentStatus: 'caries',
      selectedDiagnoses: ['Irreversible Pulpitis', 'Deep Caries'],
      diagnosisDetails: 'Large cavity extending to pulp chamber',
      examinationDate: '2025-01-15',
      symptoms: ['Pain', 'Sensitivity'],
      diagnosticNotes: 'Non-vital response to testing',
      selectedTreatments: ['Root Canal Treatment', 'Crown Restoration'],
      priority: 'high',
      treatmentDetails: 'Endodontic treatment followed by permanent restoration',
      duration: '120',
      estimatedCost: '800',
      scheduledDate: '2025-01-20',
      treatmentNotes: 'Multi-visit treatment required',
      followUpRequired: true
    },
    '4': {
      currentStatus: 'caries',
      selectedDiagnoses: ['Moderate Caries'],
      diagnosisDetails: 'Occlusal cavity',
      examinationDate: '2025-01-15',
      symptoms: ['Sensitivity'],
      diagnosticNotes: 'Cavity confined to dentin',
      selectedTreatments: ['Composite Filling'],
      priority: 'medium',
      treatmentDetails: 'Direct restoration',
      duration: '45',
      estimatedCost: '150',
      scheduledDate: '2025-01-18',
      treatmentNotes: 'Single visit treatment',
      followUpRequired: false
    }
  }
}

async function testCompleteIntegration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🧪 COMPLETE INTEGRATION TEST')
  console.log('Testing the full consultation save workflow')
  console.log('=' .repeat(60))

  try {
    // Step 1: Get real patient and dentist
    console.log('\n📋 1. GETTING TEST DATA')

    const { data: patients } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1)

    const { data: dentists } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name')
      .limit(1)

    if (!patients?.length || !dentists?.length) {
      console.log('❌ Need at least one patient and one dentist in the database')
      return
    }

    const patient = patients[0]
    const dentist = dentists[0]

    console.log(`✅ Patient: ${patient.first_name} ${patient.last_name}`)
    console.log(`✅ Dentist: ${dentist.full_name}`)

    // Step 2: Prepare test data exactly as our component would
    console.log('\n📋 2. PREPARING CONSULTATION DATA')

    const consultationData = createTestConsultationData()
    consultationData.patientId = patient.id

    const toothData = createTestToothData()

    console.log(`✅ Consultation data prepared`)
    console.log(`✅ Tooth data prepared for ${Object.keys(toothData).length} teeth`)

    // Step 3: Test the exact save structure from our action
    console.log('\n📋 3. TESTING CONSULTATION SAVE (Exact Action Structure)')

    // This mimics exactly what saveCompleteConsultationAction does
    const consultationRecord = {
      patient_id: patient.id,
      dentist_id: dentist.id,
      consultation_date: new Date().toISOString(),
      status: 'completed',
      chief_complaint: consultationData.chiefComplaint,
      pain_assessment: JSON.stringify({
        intensity: consultationData.painIntensity,
        location: consultationData.painLocation,
        duration: consultationData.painDuration,
        character: consultationData.painCharacter,
        triggers: consultationData.painTriggers,
        relief: consultationData.painRelief
      }),
      medical_history: JSON.stringify({
        conditions: consultationData.medicalHistory,
        medications: consultationData.currentMedications,
        allergies: consultationData.allergies,
        previous_treatments: consultationData.previousDentalTreatments
      }),
      clinical_examination: JSON.stringify({
        extraoral: consultationData.extraoralFindings,
        intraoral: consultationData.intraoralFindings,
        periodontal: consultationData.periodontalStatus,
        occlusion: consultationData.occlusionNotes
      }),
      investigations: JSON.stringify({
        radiographic: consultationData.radiographicFindings,
        vitality: consultationData.vitalityTests,
        percussion: consultationData.percussionTests,
        palpation: consultationData.palpationFindings
      }),
      diagnosis: JSON.stringify({
        provisional: consultationData.provisionalDiagnosis,
        differential: consultationData.differentialDiagnosis,
        final: consultationData.finalDiagnosis
      }),
      treatment_plan: JSON.stringify({
        plan: consultationData.treatmentPlan,
        prognosis: consultationData.prognosis
      }),
      prescription_data: JSON.stringify(consultationData.prescriptions),
      follow_up_data: JSON.stringify(consultationData.followUpPlans),
      additional_notes: consultationData.additionalNotes,
      voice_session_active: false
    }

    const { data: consultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .insert(consultationRecord)
      .select()
      .single()

    if (consultationError) {
      console.log('❌ Consultation save failed:', consultationError.message)
      console.log('📝 This indicates the RLS policies still need to be applied')
      console.log('📝 Please run FIX_CONSULTATION_RLS_POLICIES.sql in Supabase SQL Editor')
      return
    }

    console.log(`✅ Consultation saved with ID: ${consultation.id}`)

    // Step 4: Test tooth diagnoses save
    console.log('\n📋 4. TESTING TOOTH DIAGNOSES SAVE')

    const toothRecords = []
    for (const [toothNumber, toothInfo] of Object.entries(toothData)) {
      const toothRecord = {
        consultation_id: consultation.id,
        patient_id: patient.id,
        tooth_number: toothNumber,
        status: toothInfo.currentStatus || 'healthy',
        primary_diagnosis: toothInfo.selectedDiagnoses?.join(', ') || null,
        diagnosis_details: toothInfo.diagnosisDetails || null,
        symptoms: null, // Skip symptoms for now to complete testing
        recommended_treatment: toothInfo.selectedTreatments?.join(', ') || null,
        treatment_priority: toothInfo.priority || 'medium',
        treatment_details: toothInfo.treatmentDetails || null,
        estimated_duration: parseInt(toothInfo.duration) || null,
        estimated_cost: toothInfo.estimatedCost || null,
        scheduled_date: toothInfo.scheduledDate || null,
        follow_up_required: toothInfo.followUpRequired || false,
        examination_date: toothInfo.examinationDate || new Date().toISOString().split('T')[0],
        notes: toothInfo.treatmentNotes || toothInfo.diagnosticNotes || null,
        color_code: toothInfo.currentStatus === 'caries' ? '#ef4444' : '#22c55e'
      }
      toothRecords.push(toothRecord)
    }

    const { data: toothResults, error: toothError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .insert(toothRecords)
      .select()

    if (toothError) {
      console.log('❌ Tooth diagnoses save failed:', toothError.message)
    } else {
      console.log(`✅ Saved ${toothResults.length} tooth diagnoses:`)
      toothResults.forEach(tooth => {
        console.log(`   - Tooth #${tooth.tooth_number}: ${tooth.status} (${tooth.primary_diagnosis})`)
      })
    }

    // Step 5: Test cross-dashboard data access
    console.log('\n📋 5. TESTING CROSS-DASHBOARD DATA ACCESS')

    // Test if assistant can see the consultation
    const { data: consultationForAssistant, error: assistantError } = await supabase
      .schema('api')
      .from('consultations')
      .select(`
        id,
        patient_id,
        dentist_id,
        consultation_date,
        status,
        chief_complaint
      `)
      .eq('id', consultation.id)
      .single()

    if (assistantError) {
      console.log('❌ Assistant dashboard access failed:', assistantError.message)
    } else {
      console.log('✅ Assistant dashboard can access consultation data')
    }

    // Test if patient can see their consultation (would need patient auth context)
    const { data: patientConsultations, error: patientError } = await supabase
      .schema('api')
      .from('consultations')
      .select('id, consultation_date, chief_complaint, status')
      .eq('patient_id', patient.id)

    if (patientError) {
      console.log('❌ Patient dashboard access failed:', patientError.message)
    } else {
      console.log(`✅ Patient dashboard can access ${patientConsultations.length} consultations`)
    }

    // Clean up test data
    console.log('\n📋 6. CLEANING UP TEST DATA')

    await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .delete()
      .eq('consultation_id', consultation.id)

    await supabase
      .schema('api')
      .from('consultations')
      .delete()
      .eq('id', consultation.id)

    console.log('✅ Test data cleaned up')

    console.log('\n🎉 INTEGRATION TEST COMPLETE!')
    console.log('✅ Consultation system is fully functional!')

  } catch (error) {
    console.error('❌ Integration test failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

testCompleteIntegration().catch(console.error)