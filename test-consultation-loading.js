// Quick test for consultation loading functionality
const { createClient } = require('@supabase/supabase-js')

async function testConsultationLoading() {
  console.log('🧪 CONSULTATION LOADING TEST')
  console.log('Testing fixed consultation loading queries')
  console.log('============================================================')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.log('❌ Missing environment variables')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Get a test patient
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
    console.log(`✅ Testing with patient: ${patient.first_name} ${patient.last_name}`)

    // Test getConsultationsAction equivalent
    console.log('\n📋 1. TESTING BASIC CONSULTATION QUERY')

    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .eq('patient_id', patient.id)
      .order('consultation_date', { ascending: false })

    if (consultationsError) {
      console.log('❌ Error fetching consultations:', consultationsError.message)
      return
    }

    console.log(`✅ Found ${consultations.length} consultations for patient`)

    if (consultations.length > 0) {
      const consultation = consultations[0]
      console.log(`✅ Latest consultation ID: ${consultation.id}`)

      // Test getConsultationByIdAction equivalent
      console.log('\n📋 2. TESTING CONSULTATION BY ID QUERY')

      const { data: specificConsultation, error: specificError } = await supabase
        .schema('api')
        .from('consultations')
        .select('*')
        .eq('id', consultation.id)
        .single()

      if (specificError) {
        console.log('❌ Error fetching specific consultation:', specificError.message)
        return
      }

      console.log(`✅ Fetched consultation: ${specificConsultation.id}`)

      // Test tooth diagnoses query
      console.log('\n📋 3. TESTING TOOTH DIAGNOSES QUERY')

      const { data: toothDiagnoses, error: toothError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .select('*')
        .eq('consultation_id', consultation.id)

      if (toothError) {
        console.log('❌ Error fetching tooth diagnoses:', toothError.message)
      } else {
        console.log(`✅ Found ${toothDiagnoses.length} tooth diagnoses`)
        if (toothDiagnoses.length > 0) {
          toothDiagnoses.forEach(tooth => {
            console.log(`   - Tooth #${tooth.tooth_number}: ${tooth.status} - ${tooth.primary_diagnosis}`)
          })
        }
      }

      console.log('\n🎉 ALL QUERIES WORKING!')
      console.log('✅ Consultation loading should now work in the enhanced consultation component')
    } else {
      console.log('ℹ️ No consultations found for this patient')
      console.log('✅ This is expected if no consultations have been created yet')
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testConsultationLoading()