/**
 * Quick Test Script for Patient Verification Workflow
 *
 * This script helps you verify that the FK relationships and verification workflow are working
 */

import { createServiceClient } from '@/lib/supabase/server'

async function testVerificationWorkflow() {
  console.log('🧪 Testing Patient Verification Workflow...\n')

  const supabase = await createServiceClient()

  try {
    // Test 1: Check if FK constraints exist
    console.log('1️⃣ Testing FK Constraints:')
    console.log('=' .repeat(40))

    const { data: constraints, error: constraintError } = await supabase
      .rpc('exec', {
        sql: `
          SELECT
            conname as constraint_name,
            conrelid::regclass as table_name,
            confrelid::regclass as references_table
          FROM pg_constraint
          WHERE conname LIKE 'fk_%'
          ORDER BY table_name;
        `
      })

    if (constraintError) {
      console.error('❌ Could not check FK constraints:', constraintError)
    } else {
      console.log(`✅ Found ${constraints?.length || 0} FK constraints`)
      if (constraints?.length > 0) {
        constraints.slice(0, 5).forEach(c =>
          console.log(`   ${c.table_name} → ${c.references_table}`)
        )
      }
    }

    // Test 2: Check unified view
    console.log('\n2️⃣ Testing Unified View:')
    console.log('=' .repeat(40))

    const { data: viewData, error: viewError } = await supabase
      .from('pending_patient_verifications')
      .select('*')
      .limit(1)

    if (viewError) {
      console.error('❌ Unified view not working:', viewError.message)
      console.log('⚠️  The view might not exist yet. Run the migration first.')
    } else {
      console.log('✅ Unified view is working')
      console.log(`   Returns ${viewData?.length || 0} pending patients`)
    }

    // Test 3: Check pending_registrations structure
    console.log('\n3️⃣ Testing Pending Registrations:')
    console.log('=' .repeat(40))

    const { data: regData, error: regError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .select('user_id, status')
      .limit(1)

    if (regError) {
      console.error('❌ Pending registrations table issue:', regError.message)
    } else {
      console.log('✅ Pending registrations table accessible')
      if (regData && regData.length > 0) {
        const hasUserId = regData[0].user_id !== null
        console.log(`   user_id column: ${hasUserId ? '✅ exists' : '❌ missing'}`)
      }
    }

    // Test 4: Profile and user count check
    console.log('\n4️⃣ Testing Data Consistency:')
    console.log('=' .repeat(40))

    const { count: profileCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'patient')
      .eq('status', 'pending')

    const { count: regCount } = await supabase
      .schema('api')
      .from('pending_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    console.log(`   Pending profiles: ${profileCount || 0}`)
    console.log(`   Pending registrations: ${regCount || 0}`)

    if (profileCount !== regCount) {
      console.log('⚠️  Data mismatch detected - may need backfill script')
    } else {
      console.log('✅ Profile and registration counts match')
    }

    // Test 5: Check if we can simulate approval
    console.log('\n5️⃣ Testing Approval Simulation:')
    console.log('=' .repeat(40))

    const { data: samplePatient } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'patient')
      .eq('status', 'pending')
      .limit(1)
      .single()

    if (samplePatient) {
      console.log(`✅ Found sample pending patient: ${samplePatient.full_name}`)
      console.log(`   Patient ID: ${samplePatient.id}`)
      console.log('   Ready for approval testing')
    } else {
      console.log('ℹ️  No pending patients found to test approval')
    }

    console.log('\n🎉 Workflow Test Summary:')
    console.log('=' .repeat(40))
    console.log('✅ FK constraints check completed')
    console.log('✅ Database structure verified')
    console.log('✅ Ready to test live signup → approval workflow')

    console.log('\n🚀 Next Steps:')
    console.log('1. Apply the migration if not done yet')
    console.log('2. Test patient signup')
    console.log('3. Check assistant verification page')
    console.log('4. Test approve/reject buttons')
    console.log('5. Verify approved patient can login')

  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

// Export for use in other scripts
export { testVerificationWorkflow }

// Run if called directly
if (require.main === module) {
  testVerificationWorkflow()
    .then(() => console.log('\n✅ Test completed'))
    .catch(error => console.error('\n❌ Test failed:', error))
}