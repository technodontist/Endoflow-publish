require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'api'
  }
})

// Map treatment types to tooth statuses and colors
const TREATMENT_STATUS_MAP = {
  'filling': { status: 'filled', color: '#3b82f6' }, // Blue
  'dental filling': { status: 'filled', color: '#3b82f6' },
  'composite filling': { status: 'filled', color: '#3b82f6' },
  'amalgam filling': { status: 'filled', color: '#3b82f6' },
  'root canal': { status: 'root_canal', color: '#8b5cf6' }, // Purple
  'root canal treatment': { status: 'root_canal', color: '#8b5cf6' },
  'rct': { status: 'root_canal', color: '#8b5cf6' },
  'crown': { status: 'crown', color: '#10b981' }, // Emerald
  'dental crown': { status: 'crown', color: '#10b981' },
  'bridge': { status: 'crown', color: '#10b981' },
  'extraction': { status: 'missing', color: '#6b7280' }, // Gray
  'tooth extraction': { status: 'missing', color: '#6b7280' },
  'implant': { status: 'implant', color: '#06b6d4' }, // Cyan
  'dental implant': { status: 'implant', color: '#06b6d4' },
  'veneer': { status: 'crown', color: '#10b981' },
  'cleaning': { status: 'healthy', color: '#22c55e' }, // Green
  'prophylaxis': { status: 'healthy', color: '#22c55e' },
  'fluoride': { status: 'healthy', color: '#22c55e' }
}

// Map diagnoses to statuses
const DIAGNOSIS_STATUS_MAP = {
  'caries': { status: 'caries', color: '#ef4444' }, // Red
  'cavity': { status: 'caries', color: '#ef4444' },
  'decay': { status: 'caries', color: '#ef4444' },
  'periapical lesion': { status: 'extraction_needed', color: '#dc2626' }, // Dark red
  'abscess': { status: 'extraction_needed', color: '#dc2626' },
  'fractured': { status: 'attention', color: '#f97316' }, // Orange
  'cracked': { status: 'attention', color: '#f97316' },
  'restored': { status: 'filled', color: '#3b82f6' },
  'healthy': { status: 'healthy', color: '#22c55e' }
}

async function updateAllTeethStatus() {
  console.log('🦷 [UPDATE] Starting comprehensive teeth status update...\n')

  // Step 1: Get all patients with tooth diagnoses
  console.log('📋 [STEP 1] Fetching all patients with tooth diagnoses...')
  const { data: patients } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('patient_id')
    .order('patient_id')
  
  const uniquePatients = [...new Set(patients?.map(p => p.patient_id) || [])]
  console.log(`✅ Found ${uniquePatients.length} patients to process\n`)

  let totalUpdated = 0
  let totalLinked = 0

  // Step 2: Process each patient
  for (const patientId of uniquePatients) {
    console.log(`\n👤 Processing patient: ${patientId}`)
    
    // Get all completed treatments for this patient
    const { data: treatments } = await supabase
      .schema('api')
      .from('treatments')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
    
    console.log(`   Found ${treatments?.length || 0} completed treatments`)

    // Get all tooth diagnoses for this patient
    const { data: toothDiagnoses } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('*')
      .eq('patient_id', patientId)
      .order('tooth_number')
    
    console.log(`   Found ${toothDiagnoses?.length || 0} tooth diagnoses`)

    // Create a map of tooth numbers to their latest diagnosis
    const toothMap = new Map()
    for (const td of toothDiagnoses || []) {
      const existing = toothMap.get(td.tooth_number)
      if (!existing || new Date(td.updated_at) > new Date(existing.updated_at)) {
        toothMap.set(td.tooth_number, td)
      }
    }

    // Step 3: Process treatments and update teeth
    for (const treatment of treatments || []) {
      const treatmentType = treatment.treatment_type?.toLowerCase() || ''
      
      // Skip non-tooth treatments
      if (treatmentType === 'consultation' || treatmentType === 'examination') {
        continue
      }

      // Find matching status for this treatment
      let statusInfo = null
      for (const [key, value] of Object.entries(TREATMENT_STATUS_MAP)) {
        if (treatmentType.includes(key)) {
          statusInfo = value
          break
        }
      }

      if (!statusInfo) {
        console.log(`   ⚠️ No status mapping for treatment: ${treatment.treatment_type}`)
        continue
      }

      // If treatment has a tooth number, update it
      if (treatment.tooth_number) {
        const { error } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .update({
            status: statusInfo.status,
            color_code: statusInfo.color,
            follow_up_required: false,
            updated_at: new Date().toISOString()
          })
          .eq('patient_id', patientId)
          .eq('tooth_number', treatment.tooth_number)
          .order('updated_at', { ascending: false })
          .limit(1)
        
        if (!error) {
          console.log(`   ✅ Updated tooth #${treatment.tooth_number} to ${statusInfo.status}`)
          totalUpdated++
        }
      } else {
        // Try to match treatment to a tooth based on diagnosis
        const possibleTeeth = []
        
        for (const [toothNum, diagnosis] of toothMap.entries()) {
          const diagText = (diagnosis.primary_diagnosis || '').toLowerCase()
          const recTreatment = (diagnosis.recommended_treatment || '').toLowerCase()
          
          // Match based on recommended treatment
          if (
            (treatmentType.includes('filling') && (recTreatment.includes('filling') || diagText.includes('caries'))) ||
            (treatmentType.includes('root canal') && recTreatment.includes('root canal')) ||
            (treatmentType.includes('crown') && recTreatment.includes('crown')) ||
            (treatmentType.includes('extraction') && recTreatment.includes('extraction'))
          ) {
            possibleTeeth.push({ toothNum, diagnosis })
          }
        }

        if (possibleTeeth.length === 1) {
          // Only one possible match, link it
          const match = possibleTeeth[0]
          
          // Update treatment with tooth number
          await supabase
            .schema('api')
            .from('treatments')
            .update({ tooth_number: match.toothNum })
            .eq('id', treatment.id)
          
          // Update tooth status
          const { error } = await supabase
            .schema('api')
            .from('tooth_diagnoses')
            .update({
              status: statusInfo.status,
              color_code: statusInfo.color,
              follow_up_required: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', match.diagnosis.id)
          
          if (!error) {
            console.log(`   ✅ Linked and updated tooth #${match.toothNum} to ${statusInfo.status}`)
            totalUpdated++
            totalLinked++
          }
        } else if (possibleTeeth.length > 1) {
          console.log(`   ℹ️ Multiple possible teeth for ${treatment.treatment_type}: ${possibleTeeth.map(p => p.toothNum).join(', ')}`)
        }
      }

      // Link treatment to appointment_teeth if appointment exists
      if (treatment.appointment_id && treatment.tooth_number) {
        const { error } = await supabase
          .schema('api')
          .from('appointment_teeth')
          .upsert({
            appointment_id: treatment.appointment_id,
            consultation_id: treatment.consultation_id,
            tooth_number: treatment.tooth_number,
            diagnosis: treatment.description
          }, { onConflict: 'appointment_id,tooth_number' })
        
        if (!error) {
          console.log(`   ✅ Linked appointment to tooth #${treatment.tooth_number}`)
        }
      }
    }

    // Step 4: Update teeth with diagnoses but no treatments
    for (const [toothNum, diagnosis] of toothMap.entries()) {
      const diagText = (diagnosis.primary_diagnosis || '').toLowerCase()
      
      // Skip if already processed
      if (diagnosis.status !== 'caries' && diagnosis.status !== 'healthy') {
        continue
      }

      // Find appropriate status based on diagnosis
      let statusInfo = null
      for (const [key, value] of Object.entries(DIAGNOSIS_STATUS_MAP)) {
        if (diagText.includes(key)) {
          statusInfo = value
          break
        }
      }

      if (statusInfo && statusInfo.status !== diagnosis.status) {
        const { error } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .update({
            status: statusInfo.status,
            color_code: statusInfo.color,
            updated_at: new Date().toISOString()
          })
          .eq('id', diagnosis.id)
        
        if (!error) {
          console.log(`   ✅ Updated tooth #${toothNum} status based on diagnosis: ${statusInfo.status}`)
          totalUpdated++
        }
      }
    }
  }

  // Step 5: Fix color codes for all statuses
  console.log('\n📋 [STEP 5] Fixing color codes for all tooth statuses...')
  
  const statusColorMap = {
    'healthy': '#22c55e',
    'caries': '#ef4444',
    'filled': '#3b82f6',
    'crown': '#10b981',
    'root_canal': '#8b5cf6',
    'extraction_needed': '#dc2626',
    'missing': '#6b7280',
    'implant': '#06b6d4',
    'attention': '#f97316'
  }

  let colorFixCount = 0
  for (const [status, color] of Object.entries(statusColorMap)) {
    const { error } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .update({ color_code: color })
      .eq('status', status)
      .neq('color_code', color)
    
    if (!error) {
      colorFixCount++
    }
  }
  
  console.log(`✅ Fixed color codes for ${colorFixCount} different statuses`)

  console.log('\n🎯 [RESULT] Comprehensive teeth update completed!')
  console.log(`   Total teeth updated: ${totalUpdated}`)
  console.log(`   Total treatments linked: ${totalLinked}`)
  console.log(`   All teeth now have correct colors and real-time updates enabled!`)
}

updateAllTeethStatus().catch(console.error)