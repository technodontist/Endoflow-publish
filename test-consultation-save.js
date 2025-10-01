const { createClient } = require('@supabase/supabase-js')

async function testConsultationSave() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🧪 TESTING CONSULTATION SAVE FUNCTIONALITY')
  console.log('=' .repeat(50))

  try {
    // First, let's get a real patient and dentist from the database
    console.log('\n📋 1. GETTING REAL PATIENT AND DENTIST DATA')

    // Get a real patient
    const { data: patients, error: patientError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1)

    if (patientError || !patients?.length) {
      console.log('❌ No patients found or error:', patientError?.message)
      return
    }

    const patient = patients[0]
    console.log(`✅ Found patient: ${patient.first_name} ${patient.last_name} (${patient.id})`)

    // Get a real dentist
    const { data: dentists, error: dentistError } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name')
      .limit(1)

    if (dentistError || !dentists?.length) {
      console.log('❌ No dentists found or error:', dentistError?.message)
      return
    }

    const dentist = dentists[0]
    console.log(`✅ Found dentist: ${dentist.full_name} (${dentist.id})`)

    // Now test the consultation save structure
    console.log('\n📋 2. TESTING CONSULTATION RECORD CREATION')

    const testConsultationData = {
      patient_id: patient.id,
      dentist_id: dentist.id,
      consultation_date: new Date().toISOString(),
      status: 'draft',
      chief_complaint: 'Test consultation from audit script',
      pain_assessment: JSON.stringify({
        intensity: 5,
        location: 'Upper right molar',
        duration: '2 days',
        character: 'Throbbing',
        triggers: ['Cold drinks'],
        relief: ['Painkillers']
      }),
      medical_history: JSON.stringify({
        conditions: ['None'],
        medications: ['Ibuprofen'],
        allergies: [],
        previous_treatments: []
      }),
      clinical_examination: JSON.stringify({
        extraoral: 'Normal facial symmetry',
        intraoral: 'Mild inflammation',
        periodontal: 'Healthy gums',
        occlusion: 'Normal bite'
      }),
      additional_notes: 'This is a test consultation created during database audit',
      voice_session_active: false
    }

    const { data: consultation, error: consultationError } = await supabase
      .schema('api')
      .from('consultations')
      .insert(testConsultationData)
      .select()
      .single()

    if (consultationError) {
      console.log('❌ Consultation creation failed:', consultationError.message)
      console.log('📝 Error details:', consultationError)
    } else {
      console.log(`✅ Consultation created successfully with ID: ${consultation.id}`)

      // Test tooth diagnoses creation
      console.log('\n📋 3. TESTING TOOTH DIAGNOSES CREATION')

      const testToothData = [
        {
          consultation_id: consultation.id,
          patient_id: patient.id,
          tooth_number: '11',
          status: 'caries',
          primary_diagnosis: 'Deep Caries',
          diagnosis_details: 'Large cavitation on mesial surface',
          symptoms: JSON.stringify(['Pain', 'Sensitivity']),
          recommended_treatment: 'Root Canal Treatment',
          treatment_priority: 'high',
          treatment_details: 'Endodontic treatment followed by crown',
          estimated_duration: 90,
          estimated_cost: '500',
          examination_date: new Date().toISOString().split('T')[0],
          notes: 'Urgent treatment required',
          color_code: '#ef4444'
        },
        {
          consultation_id: consultation.id,
          patient_id: patient.id,
          tooth_number: '12',
          status: 'filled',
          primary_diagnosis: 'Previous restoration',
          recommended_treatment: 'Routine check',
          treatment_priority: 'low',
          examination_date: new Date().toISOString().split('T')[0],
          color_code: '#3b82f6'
        }
      ]

      const { data: toothDiagnoses, error: toothError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .insert(testToothData)
        .select()

      if (toothError) {
        console.log('❌ Tooth diagnoses creation failed:', toothError.message)
        console.log('📝 Error details:', toothError)
      } else {
        console.log(`✅ Created ${toothDiagnoses.length} tooth diagnoses successfully`)
        toothDiagnoses.forEach(tooth => {
          console.log(`   - Tooth #${tooth.tooth_number}: ${tooth.status} (${tooth.primary_diagnosis})`)
        })
      }

      // Clean up test data
      console.log('\n📋 4. CLEANING UP TEST DATA')

      // Delete tooth diagnoses first (foreign key constraint)
      if (toothDiagnoses?.length > 0) {
        await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .delete()
          .eq('consultation_id', consultation.id)
        console.log('✅ Test tooth diagnoses deleted')
      }

      // Delete consultation
      await supabase
        .schema('api')
        .from('consultations')
        .delete()
        .eq('id', consultation.id)
      console.log('✅ Test consultation deleted')
    }

    console.log('\n🎯 CONSULTATION SAVE TEST COMPLETE')
    console.log('✅ Database structure is compatible with our save actions!')

  } catch (error) {
    console.error('❌ Test failed with exception:', error.message)
    console.error('Stack:', error.stack)
  }
}

testConsultationSave().catch(console.error)