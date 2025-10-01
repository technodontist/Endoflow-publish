// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

console.log('🔍 [PATIENT-SEARCH] Finding "final patient" and creating diagnoses...')

async function findPatientAndCreateData() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey) {
      console.log('❌ [ERROR] SUPABASE_SERVICE_ROLE_KEY is required')
      return false
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('\n1️⃣ Searching for "final patient"...')
    
    // Search for patients with "final" in their name
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .or('first_name.ilike.%final%,last_name.ilike.%final%')
      .limit(5)
    
    if (patientsError) {
      console.log('❌ [ERROR] Failed to search patients:', patientsError.message)
      return false
    }
    
    console.log(`📊 [RESULTS] Found ${patients?.length || 0} patients with "final" in name:`)
    patients?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} (ID: ${p.id})`)
    })
    
    if (!patients || patients.length === 0) {
      console.log('❌ [ERROR] No patients found with "final" in name')
      console.log('💡 [INFO] Try searching for other patients:')
      
      // Get any recent patients
      const { data: recentPatients } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name')
        .order('created_at', { ascending: false })
        .limit(5)
      
      console.log('\n📋 [ALTERNATIVE] Recent patients:')
      recentPatients?.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} (ID: ${p.id})`)
      })
      
      return false
    }
    
    // Use the first "final" patient found
    const finalPatient = patients[0]
    console.log(`\n✅ [SUCCESS] Using patient: ${finalPatient.first_name} ${finalPatient.last_name}`)
    
    console.log('\n2️⃣ Checking existing tooth diagnoses...')
    
    // Check existing diagnoses
    const { data: existingDiagnoses, error: diagnosesError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('tooth_number, status, color_code, primary_diagnosis')
      .eq('patient_id', finalPatient.id)
      .order('tooth_number')
    
    if (diagnosesError) {
      console.log('❌ [ERROR] Failed to check existing diagnoses:', diagnosesError.message)
      return false
    }
    
    console.log(`📊 [CURRENT] ${existingDiagnoses?.length || 0} existing diagnoses:`)
    existingDiagnoses?.forEach(d => {
      console.log(`   Tooth #${d.tooth_number}: ${d.status} (${d.color_code || 'no color'}) - ${d.primary_diagnosis || 'no diagnosis'}`)
    })
    
    console.log('\n3️⃣ Creating diverse sample tooth diagnoses...')
    
    // Define comprehensive sample diagnoses
    const comprehensiveDiagnoses = [
      {
        tooth_number: '16', // Upper right molar
        status: 'caries',
        primary_diagnosis: 'Deep caries on occlusal surface',
        recommended_treatment: 'Composite filling',
        color_code: '#ef4444', // Red
        notes: 'Sample diagnosis - deep caries'
      },
      {
        tooth_number: '15', // Upper right premolar
        status: 'caries',
        primary_diagnosis: 'Mesial caries',
        recommended_treatment: 'Small filling',
        color_code: '#ef4444', // Red
        notes: 'Sample diagnosis - mesial caries'
      },
      {
        tooth_number: '21', // Upper left central incisor
        status: 'filled',
        primary_diagnosis: 'Composite restoration',
        recommended_treatment: 'Monitor restoration',
        color_code: '#3b82f6', // Blue
        notes: 'Sample diagnosis - filled'
      },
      {
        tooth_number: '22', // Upper left lateral incisor
        status: 'filled',
        primary_diagnosis: 'Amalgam restoration',
        recommended_treatment: 'Monitor restoration',
        color_code: '#3b82f6', // Blue
        notes: 'Sample diagnosis - amalgam fill'
      },
      {
        tooth_number: '36', // Lower left molar
        status: 'crown',
        primary_diagnosis: 'Full crown restoration',
        recommended_treatment: 'Monitor crown',
        color_code: '#eab308', // Yellow
        notes: 'Sample diagnosis - crown'
      },
      {
        tooth_number: '37', // Lower left molar
        status: 'crown',
        primary_diagnosis: 'Porcelain crown',
        recommended_treatment: 'Monitor crown',
        color_code: '#eab308', // Yellow
        notes: 'Sample diagnosis - porcelain crown'
      },
      {
        tooth_number: '46', // Lower right molar
        status: 'attention',
        primary_diagnosis: 'Requires clinical evaluation',
        recommended_treatment: 'Further examination needed',
        color_code: '#f97316', // Orange
        notes: 'Sample diagnosis - attention needed'
      },
      {
        tooth_number: '47', // Lower right molar
        status: 'attention',
        primary_diagnosis: 'Possible crack',
        recommended_treatment: 'Detailed examination',
        color_code: '#f97316', // Orange
        notes: 'Sample diagnosis - possible crack'
      },
      {
        tooth_number: '11', // Upper right central incisor
        status: 'root_canal',
        primary_diagnosis: 'Root canal therapy completed',
        recommended_treatment: 'Crown placement recommended',
        color_code: '#8b5cf6', // Purple
        notes: 'Sample diagnosis - root canal'
      },
      {
        tooth_number: '26', // Upper left molar
        status: 'root_canal',
        primary_diagnosis: 'Endodontic treatment',
        recommended_treatment: 'Crown needed',
        color_code: '#8b5cf6', // Purple
        notes: 'Sample diagnosis - endo treatment'
      },
      {
        tooth_number: '18', // Upper right wisdom tooth
        status: 'extraction_needed',
        primary_diagnosis: 'Impacted wisdom tooth',
        recommended_treatment: 'Surgical extraction',
        color_code: '#dc2626', // Dark red
        notes: 'Sample diagnosis - extraction needed'
      },
      {
        tooth_number: '28', // Upper left wisdom tooth
        status: 'extraction_needed',
        primary_diagnosis: 'Partially erupted',
        recommended_treatment: 'Extraction recommended',
        color_code: '#dc2626', // Dark red
        notes: 'Sample diagnosis - partial eruption'
      }
    ]
    
    // Filter out existing diagnoses
    const existingTeeth = (existingDiagnoses || []).map(d => d.tooth_number)
    const newDiagnoses = comprehensiveDiagnoses.filter(d => !existingTeeth.includes(d.tooth_number))
    
    console.log(`📝 [INFO] Creating ${newDiagnoses.length} new tooth diagnoses...`)
    
    let created = 0
    for (const diagnosis of newDiagnoses) {
      const toothData = {
        patient_id: finalPatient.id,
        consultation_id: null,
        tooth_number: diagnosis.tooth_number,
        status: diagnosis.status,
        primary_diagnosis: diagnosis.primary_diagnosis,
        recommended_treatment: diagnosis.recommended_treatment,
        treatment_priority: 'medium',
        examination_date: new Date().toISOString().split('T')[0],
        follow_up_required: true,
        color_code: diagnosis.color_code,
        notes: diagnosis.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .insert(toothData)
      
      if (error) {
        console.log(`❌ [ERROR] Failed to create diagnosis for tooth ${diagnosis.tooth_number}:`, error.message)
      } else {
        console.log(`✅ [SUCCESS] Created diagnosis for tooth #${diagnosis.tooth_number} - ${diagnosis.status} (${diagnosis.color_code})`)
        created++
      }
    }
    
    console.log(`\n🎉 [SUMMARY] Created ${created} new tooth diagnoses for ${finalPatient.first_name} ${finalPatient.last_name}`)
    console.log('\n📋 [EXPECTED RESULTS] You should now see:')
    console.log('   🔴 RED teeth (caries): #16, #15')
    console.log('   🔵 BLUE teeth (filled): #21, #22')
    console.log('   🟡 YELLOW teeth (crown): #36, #37')
    console.log('   🟠 ORANGE teeth (attention): #46, #47')
    console.log('   🟣 PURPLE teeth (root canal): #11, #26')
    console.log('   🔺 DARK RED teeth (extraction): #18, #28')
    
    console.log('\n🔄 [NEXT STEP] Refresh your FDI chart to see the colors!')
    
    return true
    
  } catch (error) {
    console.error('❌ [FATAL] Search and create failed:', error.message)
    return false
  }
}

// Run the script
findPatientAndCreateData()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] Patient Search and Data Creation Completed!')
    } else {
      console.log('\n💥 [RESULT] Patient Search and Data Creation Failed')
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
  })