// Database migration to fix tooth status based on diagnosis
// Run this script to update existing tooth records with incorrect status

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  console.error('URL:', supabaseUrl ? 'Found' : 'Missing')
  console.error('Key:', supabaseServiceKey ? 'Found' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function getStatusFromDiagnosis(diagnosis) {
  if (!diagnosis) return 'healthy'
  
  const diagnosisLower = diagnosis.toLowerCase()
  
  if (diagnosisLower.includes('caries') || diagnosisLower.includes('cavity') || diagnosisLower.includes('decay')) {
    return 'caries'
  }
  if (diagnosisLower.includes('filled') || diagnosisLower.includes('filling') || diagnosisLower.includes('restoration')) {
    return 'filled'
  }
  if (diagnosisLower.includes('crown')) {
    return 'crown'
  }
  if (diagnosisLower.includes('missing') || diagnosisLower.includes('extracted') || diagnosisLower.includes('absent')) {
    return 'missing'
  }
  if (diagnosisLower.includes('root canal') || diagnosisLower.includes('rct') || diagnosisLower.includes('endodontic')) {
    return 'root_canal'
  }
  if (diagnosisLower.includes('implant')) {
    return 'implant'
  }
  if (diagnosisLower.includes('extraction needed') || diagnosisLower.includes('hopeless')) {
    return 'extraction_needed'
  }
  if (diagnosisLower.includes('attention') || diagnosisLower.includes('watch') || diagnosisLower.includes('monitor')) {
    return 'attention'
  }
  
  return 'healthy'
}

function getColorForStatus(status) {
  const colors = {
    'healthy': '#22c55e',
    'caries': '#ef4444',
    'filled': '#3b82f6',
    'crown': '#a855f7',
    'missing': '#6b7280',
    'root_canal': '#f97316',
    'bridge': '#8b5cf6',
    'implant': '#06b6d4',
    'extraction_needed': '#dc2626',
    'attention': '#eab308'
  }
  return colors[status] || '#22c55e'
}

async function fixToothStatuses() {
  console.log('🔧 Fixing tooth statuses in database...')
  console.log('📊 Connecting to Supabase...')
  
  // Fetch all tooth diagnoses
  const { data: teeth, error } = await supabase
    .schema('api')
    .from('tooth_diagnoses')
    .select('*')
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching teeth:', error)
    return
  }
  
  console.log(`Found ${teeth.length} tooth records to check`)
  
  let updated = 0
  let alreadyCorrect = 0
  
  for (const tooth of teeth) {
    const expectedStatus = getStatusFromDiagnosis(tooth.primary_diagnosis)  // snake_case
    const expectedColor = getColorForStatus(expectedStatus)
    
    // Check if update is needed
    if (tooth.status !== expectedStatus || tooth.color_code !== expectedColor) {  // snake_case
      console.log(`\nTooth #${tooth.tooth_number} (Patient: ${tooth.patient_id})`)
      console.log(`  Diagnosis: "${tooth.primary_diagnosis}"`)
      console.log(`  Current status: "${tooth.status}" -> Should be: "${expectedStatus}"`)
      console.log(`  Current color: "${tooth.color_code}" -> Should be: "${expectedColor}"`)
      
      const { error: updateError } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .update({ 
          status: expectedStatus,
          color_code: expectedColor  // Note: snake_case for DB column
        })
        .eq('id', tooth.id)
        
      if (updateError) {
        console.error(`  ❌ Error updating tooth ${tooth.tooth_number}:`, updateError)
      } else {
        console.log(`  ✅ Updated successfully`)
        updated++
      }
    } else {
      alreadyCorrect++
    }
  }
  
  console.log('\n📊 Summary:')
  console.log(`  ✅ Updated ${updated} tooth records`)
  console.log(`  ✓ ${alreadyCorrect} records were already correct`)
  console.log(`  Total processed: ${teeth.length}`)
}

fixToothStatuses().catch(console.error)