// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

console.log('🦷 [SAMPLE-DATA] Creating Sample Tooth Diagnoses for FDI Chart Testing...')

async function createSampleToothDiagnoses() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey) {
      console.log('❌ [ERROR] SUPABASE_SERVICE_ROLE_KEY is required')
      console.log('💡 [INFO] Set the environment variable and try again')
      return false
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('\n1️⃣ Finding a test patient...')
    
    // Get the first available patient
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1)
    
    if (patientsError || !patients || patients.length === 0) {
      console.log('❌ [ERROR] No patients found. Please create a patient first.')
      return false
    }
    
    const testPatient = patients[0]
    console.log(`✅ [SUCCESS] Using patient: ${testPatient.first_name} ${testPatient.last_name}`)
    
    console.log('\n2️⃣ Creating sample tooth diagnoses...')
    
    // Define sample tooth diagnoses with different statuses and colors
    const sampleDiagnoses = [
      {
        tooth_number: '16', // Upper right molar
        status: 'caries',
        primary_diagnosis: 'Deep caries on occlusal surface',
        recommended_treatment: 'Composite filling',
        color_code: '#ef4444', // Red
        notes: 'Sample diagnosis - caries'
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
        tooth_number: '36', // Lower left molar
        status: 'crown',
        primary_diagnosis: 'Full crown restoration',
        recommended_treatment: 'Monitor crown',
        color_code: '#eab308', // Yellow
        notes: 'Sample diagnosis - crown'
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
        tooth_number: '11', // Upper right central incisor
        status: 'root_canal',
        primary_diagnosis: 'Root canal therapy completed',
        recommended_treatment: 'Crown placement recommended',
        color_code: '#8b5cf6', // Purple
        notes: 'Sample diagnosis - root canal'
      },
      {
        tooth_number: '18', // Upper right wisdom tooth
        status: 'extraction_needed',
        primary_diagnosis: 'Impacted wisdom tooth',
        recommended_treatment: 'Surgical extraction',
        color_code: '#dc2626', // Dark red
        notes: 'Sample diagnosis - extraction needed'
      }
    ]
    
    // Check if diagnoses already exist
    const { data: existingDiagnoses } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('tooth_number')
      .eq('patient_id', testPatient.id)
      .in('tooth_number', sampleDiagnoses.map(d => d.tooth_number))
    
    const existingTeeth = (existingDiagnoses || []).map(d => d.tooth_number)
    const newDiagnoses = sampleDiagnoses.filter(d => !existingTeeth.includes(d.tooth_number))
    
    if (newDiagnoses.length === 0) {
      console.log('ℹ️  [INFO] Sample diagnoses already exist for this patient')
      console.log('🎯 [RESULT] FDI Chart should already show colored teeth')
      return true
    }
    
    console.log(`📝 [INFO] Creating ${newDiagnoses.length} new tooth diagnoses...`)
    
    // Create the diagnoses
    for (const diagnosis of newDiagnoses) {
      const toothData = {
        patient_id: testPatient.id,
        consultation_id: null, // Can be null for standalone diagnoses
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
      
      const { data, error } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .insert(toothData)
        .select()
        .single()
      
      if (error) {
        console.log(`❌ [ERROR] Failed to create diagnosis for tooth ${diagnosis.tooth_number}:`, error.message)
      } else {
        console.log(`✅ [SUCCESS] Created diagnosis for tooth #${diagnosis.tooth_number} - ${diagnosis.status} (${diagnosis.color_code})`)
      }
    }
    
    console.log('\n3️⃣ Verification...')
    
    // Verify the diagnoses were created
    const { data: allDiagnoses, error: verifyError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('tooth_number, status, color_code')
      .eq('patient_id', testPatient.id)
      .order('tooth_number')
    
    if (verifyError) {
      console.log('❌ [ERROR] Failed to verify diagnoses:', verifyError.message)
      return false
    }
    
    console.log('📊 [VERIFICATION] All tooth diagnoses for this patient:')
    if (allDiagnoses && allDiagnoses.length > 0) {
      allDiagnoses.forEach(d => {
        console.log(`   Tooth #${d.tooth_number}: ${d.status} (${d.color_code || 'no color'})`)
      })
    } else {
      console.log('   No diagnoses found')
    }
    
    console.log('\n🎉 [SUCCESS] Sample tooth diagnoses created!')
    console.log('\n📋 [NEXT STEPS]:')
    console.log('   1. Refresh the FDI Chart in your browser')
    console.log('   2. You should now see colored teeth:')
    console.log('      - Tooth #16: RED (caries)')
    console.log('      - Tooth #21: BLUE (filled)')
    console.log('      - Tooth #36: YELLOW (crown)')
    console.log('      - Tooth #46: ORANGE (attention)')
    console.log('      - Tooth #11: PURPLE (root canal)')
    console.log('      - Tooth #18: DARK RED (extraction needed)')
    console.log('   3. Check browser console for debug logs')
    console.log('   4. Try right-clicking on other teeth to add more diagnoses')
    
    return true
    
  } catch (error) {
    console.error('❌ [FATAL] Failed to create sample data:', error.message)
    return false
  }
}

// Run the script
createSampleToothDiagnoses()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] Sample Data Creation Completed!')
    } else {
      console.log('\n💥 [RESULT] Sample Data Creation Failed')
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
  })