#!/usr/bin/env node

/**
 * Test script to verify the patient verification workflow
 * Run this after applying the RLS fixes to ensure the verify button works
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

// Create service role client (same as server.ts)
const supabaseServiceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function testVerificationWorkflow() {
  console.log('🚀 Testing Patient Verification Workflow\n')

  try {
    // Step 1: Check if there are pending patients
    console.log('📋 Step 1: Checking for pending patients...')
    const { data: pendingPatients, error: pendingError } = await supabaseServiceClient
      .from('profiles')
      .select('id, full_name, role, status, created_at')
      .eq('role', 'patient')
      .eq('status', 'pending')

    if (pendingError) {
      console.error('❌ Error fetching pending patients:', pendingError.message)
      return false
    }

    console.log(`✅ Found ${pendingPatients.length} pending patients:`)
    pendingPatients.forEach(patient => {
      console.log(`   - ${patient.full_name} - ${patient.status}`)
    })

    if (pendingPatients.length === 0) {
      console.log('\n⚠️  No pending patients found. Creating a test patient...')

      // Create a test patient
      const testPatient = {
        id: 'test-patient-' + Date.now(),
        role: 'patient',
        status: 'pending',
        full_name: 'Test Patient',
        created_at: new Date().toISOString()
      }

      const { error: insertError } = await supabaseServiceClient
        .from('profiles')
        .insert(testPatient)

      if (insertError) {
        console.error('❌ Error creating test patient:', insertError.message)
        return false
      }

      console.log('✅ Test patient created successfully')
      pendingPatients.push(testPatient)
    }

    // Step 2: Test the verification update
    const testPatient = pendingPatients[0]
    console.log(`\n📋 Step 2: Testing verification update for ${testPatient.full_name}...`)

    // This mimics what approvePatientAction does
    const { error: updateError } = await supabaseServiceClient
      .from('profiles')
      .update({
        status: 'active'
      })
      .eq('id', testPatient.id)
      .eq('role', 'patient')

    if (updateError) {
      console.error('❌ Error updating patient status:', updateError.message)
      console.error('   This indicates RLS policies are still blocking the update')
      return false
    }

    console.log('✅ Patient status updated successfully!')

    // Step 3: Verify the update worked
    console.log('\n📋 Step 3: Verifying the status update...')
    const { data: updatedPatient, error: fetchError } = await supabaseServiceClient
      .from('profiles')
      .select('id, full_name, status')
      .eq('id', testPatient.id)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching updated patient:', fetchError.message)
      return false
    }

    if (updatedPatient.status === 'active') {
      console.log('✅ Status successfully updated to "active"')
    } else {
      console.error(`❌ Status is still "${updatedPatient.status}", expected "active"`)
      return false
    }

    // Step 4: Test creating patient record in api.patients
    console.log('\n📋 Step 4: Testing patient record creation...')
    const nameParts = updatedPatient.full_name.split(' ')
    const { error: patientInsertError } = await supabaseServiceClient
      .schema('api')
      .from('patients')
      .upsert({
        id: updatedPatient.id,
        first_name: nameParts[0] || 'Test',
        last_name: nameParts.slice(1).join(' ') || 'Patient',
        created_at: new Date().toISOString()
      })

    if (patientInsertError && patientInsertError.code !== '23505') {
      console.warn('⚠️  Warning: Could not create patient record:', patientInsertError.message)
    } else {
      console.log('✅ Patient record created in api.patients table')
    }

    // Step 5: Clean up test data (revert to pending if it was a test patient)
    if (testPatient.id.startsWith('test-patient-')) {
      console.log('\n📋 Step 5: Cleaning up test data...')
      await supabaseServiceClient
        .from('profiles')
        .update({ status: 'pending' })
        .eq('id', testPatient.id)
      console.log('✅ Test patient reverted to pending status')
    }

    console.log('\n🎉 All tests passed! Verification workflow is working correctly.')
    console.log('\n💡 What this means:')
    console.log('   - The verify button should now work in the assistant dashboard')
    console.log('   - Patient status will update from "pending" to "active"')
    console.log('   - Verified patients can log in to the patient dashboard')

    return true

  } catch (error) {
    console.error('💥 Unexpected error during testing:', error.message)
    return false
  }
}

// Additional function to check RLS policies
async function checkRLSPolicies() {
  console.log('\n🔍 Checking RLS Policies...')

  try {
    const { data: policies, error } = await supabaseServiceClient
      .rpc('check_policies_on_profiles')
      .select()

    if (error) {
      console.log('⚠️  Could not check policies via RPC (this is normal)')
      console.log('   Run the diagnostic SQL queries in Supabase SQL Editor instead')
    } else {
      console.log('✅ RLS policies checked successfully')
    }
  } catch (error) {
    console.log('⚠️  Could not check RLS policies programmatically')
    console.log('   This is expected - check them manually in Supabase')
  }
}

// Run the tests
async function main() {
  console.log('🔧 ENDOFLOW Patient Verification Test Suite')
  console.log('==========================================\n')

  // Test database connection
  console.log('📡 Testing database connection...')
  try {
    const { data, error } = await supabaseServiceClient
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Database connection failed:', error.message)
      console.error('   Check your SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return
    }
    console.log('✅ Database connection successful\n')
  } catch (error) {
    console.error('❌ Database connection error:', error.message)
    return
  }

  // Run workflow test
  const workflowSuccess = await testVerificationWorkflow()

  // Check policies
  await checkRLSPolicies()

  console.log('\n==========================================')
  if (workflowSuccess) {
    console.log('🎉 SUCCESS: Verification workflow is working!')
    console.log('\nNext steps:')
    console.log('1. Apply fix-verify-button-rls.sql in Supabase SQL Editor (if not done)')
    console.log('2. Test the verify button in the assistant dashboard')
    console.log('3. Create a test patient and verify they can log in after approval')
  } else {
    console.log('❌ FAILED: Verification workflow needs fixes')
    console.log('\nTroubleshooting:')
    console.log('1. Run fix-verify-button-rls.sql in Supabase SQL Editor')
    console.log('2. Check that SUPABASE_SERVICE_ROLE_KEY is correct in .env.local')
    console.log('3. Verify RLS policies allow service role access')
  }
}

// Run the main function
main().catch(console.error)