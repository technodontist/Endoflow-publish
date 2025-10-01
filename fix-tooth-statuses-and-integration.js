// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

console.log('🔧 [FIX] Fixing Tooth Statuses and Treatment Integration...')

async function fixToothStatusesAndIntegration() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey) {
      console.log('❌ [ERROR] SUPABASE_SERVICE_ROLE_KEY is required')
      return false
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('\n1️⃣ Finding "final patient"...')
    
    // Find the final patient
    const { data: patients, error: patientsError } = await supabase
      .schema('api')
      .from('patients')
      .select('id, first_name, last_name')
      .or('first_name.ilike.%final%,last_name.ilike.%final%')
      .limit(1)
    
    if (patientsError || !patients || patients.length === 0) {
      console.log('❌ [ERROR] Final patient not found')
      return false
    }
    
    const finalPatient = patients[0]
    console.log(`✅ [SUCCESS] Using patient: ${finalPatient.first_name} ${finalPatient.last_name}`)
    
    console.log('\n2️⃣ Fixing status mismatches based on diagnoses and treatments...')
    
    // Define fixes based on diagnosis and completed treatments
    const statusFixes = [
      {
        tooth_number: '31',
        new_status: 'root_canal',
        new_color_code: '#8b5cf6', // Purple
        reason: 'Irreversible Pulpitis + Root Canal Treatment completed'
      },
      {
        tooth_number: '11',
        new_status: 'root_canal', 
        new_color_code: '#8b5cf6', // Purple
        reason: 'Moderate Caries + Root Canal Treatment completed'
      },
      {
        tooth_number: '17',
        new_status: 'filled',
        new_color_code: '#3b82f6', // Blue
        reason: 'Moderate Caries + Treatment completed'
      },
      {
        tooth_number: '24',
        new_status: 'root_canal',
        new_color_code: '#8b5cf6', // Purple
        reason: 'Deep Caries + RCT completed'
      },
      {
        tooth_number: '26',
        new_status: 'root_canal',
        new_color_code: '#8b5cf6', // Purple
        reason: 'Deep Caries + RCT completed/in progress'
      },
      {
        tooth_number: '36',
        new_status: 'attention',
        new_color_code: '#f97316', // Orange
        reason: 'Deep Caries + Root Canal Treatment pending'
      },
      {
        tooth_number: '46',
        new_status: 'filled',
        new_color_code: '#3b82f6', // Blue
        reason: 'Deep Caries + Treatment completed'
      }
    ]
    
    let fixedCount = 0
    
    for (const fix of statusFixes) {
      console.log(`\n🔧 [FIXING] Tooth #${fix.tooth_number}: ${fix.reason}`)
      
      const { data, error } = await supabase
        .schema('api')
        .from('tooth_diagnoses')
        .update({
          status: fix.new_status,
          color_code: fix.new_color_code,
          updated_at: new Date().toISOString()
        })
        .eq('patient_id', finalPatient.id)
        .eq('tooth_number', fix.tooth_number)
        .select()
      
      if (error) {
        console.log(`❌ [ERROR] Failed to fix tooth #${fix.tooth_number}:`, error.message)
      } else if (data && data.length > 0) {
        console.log(`✅ [SUCCESS] Fixed tooth #${fix.tooth_number}: ${fix.new_status} (${fix.new_color_code})`)
        fixedCount++
      } else {
        console.log(`⚠️  [WARNING] No records updated for tooth #${fix.tooth_number}`)
      }
    }
    
    console.log(`\n🎉 [SUMMARY] Fixed ${fixedCount} tooth statuses`)
    
    console.log('\n3️⃣ Testing real-time integration by creating a test appointment...')
    
    // Create a test appointment for tooth #15 (currently caries)
    const testAppointmentData = {
      patient_id: finalPatient.id,
      dentist_id: finalPatient.id, // Using patient as dentist for testing
      scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      scheduled_time: '10:00:00',
      duration_minutes: 60,
      appointment_type: 'Composite Filling',
      status: 'scheduled',
      notes: 'Test appointment for FDI color integration - tooth #15'
    }
    
    const { data: testAppointment, error: appointmentError } = await supabase
      .schema('api')
      .from('appointments')
      .insert(testAppointmentData)
      .select()
      .single()
    
    if (appointmentError) {
      console.log('❌ [ERROR] Failed to create test appointment:', appointmentError.message)
    } else {
      console.log(`✅ [SUCCESS] Created test appointment: ${testAppointment.id}`)
      
      // Create a treatment linked to this appointment
      const testTreatmentData = {
        patient_id: finalPatient.id,
        dentist_id: finalPatient.id,
        appointment_id: testAppointment.id,
        treatment_type: 'Composite Filling',
        tooth_number: '15',
        status: 'pending',
        notes: 'Test treatment for tooth #15 - FDI color integration',
        total_visits: 1,
        completed_visits: 0
      }
      
      const { data: testTreatment, error: treatmentError } = await supabase
        .schema('api')
        .from('treatments')
        .insert(testTreatmentData)
        .select()
        .single()
      
      if (treatmentError) {
        console.log('❌ [ERROR] Failed to create test treatment:', treatmentError.message)
      } else {
        console.log(`✅ [SUCCESS] Created test treatment: ${testTreatment.id}`)
        
        console.log('\n🧪 [INTEGRATION TEST] Simulating appointment workflow...')
        
        // Step 1: Set appointment to in_progress
        console.log('   Step 1: Setting appointment to in_progress...')
        const { error: progressError } = await supabase
          .schema('api')
          .from('appointments')
          .update({ status: 'in_progress' })
          .eq('id', testAppointment.id)
        
        if (progressError) {
          console.log('❌ [ERROR] Failed to set in_progress:', progressError.message)
        } else {
          console.log('✅ [SUCCESS] Appointment set to in_progress')
          console.log('   Expected: Tooth #15 should show ORANGE (attention) color')
        }
        
        // Wait for backend processing
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Step 2: Set appointment to completed
        console.log('   Step 2: Setting appointment to completed...')
        const { error: completedError } = await supabase
          .schema('api')
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', testAppointment.id)
        
        if (completedError) {
          console.log('❌ [ERROR] Failed to set completed:', completedError.message)
        } else {
          console.log('✅ [SUCCESS] Appointment set to completed')
          console.log('   Expected: Tooth #15 should show BLUE (filled) color')
        }
        
        // Wait for backend processing
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check if tooth status was updated
        console.log('   Step 3: Checking if tooth status was updated...')
        const { data: updatedTooth, error: checkError } = await supabase
          .schema('api')
          .from('tooth_diagnoses')
          .select('status, color_code, updated_at')
          .eq('patient_id', finalPatient.id)
          .eq('tooth_number', '15')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()
        
        if (checkError) {
          console.log('❌ [ERROR] Failed to check tooth status:', checkError.message)
        } else {
          console.log(`📊 [RESULT] Tooth #15 current status: ${updatedTooth.status} (${updatedTooth.color_code})`)
          
          if (updatedTooth.status === 'filled' && updatedTooth.color_code === '#3b82f6') {
            console.log('🎉 [SUCCESS] Integration working! Tooth status updated correctly.')
          } else {
            console.log('⚠️  [ISSUE] Integration may not be working. Status should be "filled" with blue color.')
          }
        }
      }
    }
    
    console.log('\n4️⃣ Final verification - checking all tooth statuses...')
    
    const { data: finalDiagnoses, error: finalError } = await supabase
      .schema('api')
      .from('tooth_diagnoses')
      .select('tooth_number, status, color_code, primary_diagnosis')
      .eq('patient_id', finalPatient.id)
      .order('tooth_number')
    
    if (finalError) {
      console.log('❌ [ERROR] Failed final verification:', finalError.message)
    } else {
      console.log('📊 [FINAL STATE] All tooth diagnoses:')
      
      const statusCounts = {}
      finalDiagnoses?.forEach(tooth => {
        const statusIcon = {
          'healthy': '🟢',
          'caries': '🔴', 
          'filled': '🔵',
          'crown': '🟡',
          'attention': '🟠',
          'root_canal': '🟣',
          'extraction_needed': '🔺',
          'missing': '⚫'
        }[tooth.status] || '❓'
        
        console.log(`   ${statusIcon} Tooth #${tooth.tooth_number}: ${tooth.status} (${tooth.color_code}) - "${tooth.primary_diagnosis}"`)
        statusCounts[tooth.status] = (statusCounts[tooth.status] || 0) + 1
      })
      
      console.log('\n📈 [STATISTICS] Status distribution:')
      Object.entries(statusCounts).forEach(([status, count]) => {
        const statusIcon = {
          'healthy': '🟢',
          'caries': '🔴', 
          'filled': '🔵',
          'crown': '🟡',
          'attention': '🟠',
          'root_canal': '🟣',
          'extraction_needed': '🔺',
          'missing': '⚫'
        }[status] || '❓'
        console.log(`   ${statusIcon} ${status}: ${count}`)
      })
    }
    
    console.log('\n🎯 [EXPECTED RESULTS] After refresh, you should see:')
    console.log('   🟣 PURPLE teeth (root canal): #11, #24, #26, #31')
    console.log('   🔵 BLUE teeth (filled): #17, #21, #22, #46, and possibly #15 if integration worked')
    console.log('   🟠 ORANGE tooth (attention): #36')
    console.log('   🔴 RED teeth (caries): #15, #16, #48 (unless #15 was updated by test)')
    console.log('   🟡 YELLOW tooth (crown): #37')
    console.log('   🔺 DARK RED teeth (extraction): #18, #28')
    
    console.log('\n🔄 [NEXT STEP] Refresh your FDI chart to see the corrected colors!')
    
    return true
    
  } catch (error) {
    console.error('❌ [FATAL] Fix operation failed:', error.message)
    return false
  }
}

// Run the fix
fixToothStatusesAndIntegration()
  .then(success => {
    if (success) {
      console.log('\n🎯 [RESULT] Tooth Status Fix and Integration Test Completed!')
    } else {
      console.log('\n💥 [RESULT] Tooth Status Fix and Integration Test Failed')
    }
  })
  .catch(error => {
    console.error('❌ [FATAL ERROR]:', error)
  })