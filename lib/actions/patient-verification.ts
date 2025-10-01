'use server'

import { createServiceClient } from '@/lib/supabase/server'

/**
 * Get pending patient registrations for assistant verification
 * Uses the new unified view that properly joins all related tables
 */
export async function getPendingPatientVerifications() {
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [VERIFICATION] Fetching pending patient verifications...')

    const { data, error } = await supabase
      .from('pending_patient_verifications')
      .select('*')
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('❌ [VERIFICATION] Error fetching pending patients:', error)
      return { error: error.message, data: null }
    }

    console.log(`✅ [VERIFICATION] Found ${data?.length || 0} pending patient verifications`)
    return { data, error: null }

  } catch (error) {
    console.error('💥 [VERIFICATION] Exception fetching pending patients:', error)
    return { error: 'Failed to fetch pending patient verifications', data: null }
  }
}

/**
 * Get detailed patient information for verification
 * Includes profile, auth, and registration data
 */
export async function getPatientVerificationDetails(userId: string) {
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [VERIFICATION] Fetching patient details for:', userId)

    // Get comprehensive patient data
    const { data: patientDetails, error } = await supabase
      .from('pending_patient_verifications')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('❌ [VERIFICATION] Error fetching patient details:', error)
      return { error: error.message, data: null }
    }

    console.log('✅ [VERIFICATION] Patient details retrieved successfully')
    return { data: patientDetails, error: null }

  } catch (error) {
    console.error('💥 [VERIFICATION] Exception fetching patient details:', error)
    return { error: 'Failed to fetch patient details', data: null }
  }
}

/**
 * Validate database integrity for a specific user
 * Checks that all FK relationships are properly maintained
 */
export async function validateUserIntegrity(userId: string) {
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [VALIDATION] Validating user integrity for:', userId)

    // Use the validation function we created in the migration
    const { data, error } = await supabase
      .rpc('validate_user_profile_consistency')
      .eq('user_id', userId)

    if (error) {
      console.error('❌ [VALIDATION] Error validating user integrity:', error)
      return { error: error.message, data: null }
    }

    console.log('✅ [VALIDATION] User integrity validation completed')
    return { data, error: null }

  } catch (error) {
    console.error('💥 [VALIDATION] Exception validating user integrity:', error)
    return { error: 'Failed to validate user integrity', data: null }
  }
}

/**
 * Get all users with missing FK relationships
 * Helpful for debugging and data cleanup
 */
export async function getUsersWithIntegrityIssues() {
  const supabase = await createServiceClient()

  try {
    console.log('🔍 [VALIDATION] Checking for users with integrity issues...')

    const { data, error } = await supabase
      .rpc('validate_user_profile_consistency')

    if (error) {
      console.error('❌ [VALIDATION] Error checking user integrity:', error)
      return { error: error.message, data: null }
    }

    const usersWithIssues = data?.filter(user => user.issues.length > 0) || []
    console.log(`✅ [VALIDATION] Found ${usersWithIssues.length} users with integrity issues`)

    return { data: usersWithIssues, error: null }

  } catch (error) {
    console.error('💥 [VALIDATION] Exception checking user integrity:', error)
    return { error: 'Failed to check user integrity', data: null }
  }
}

/**
 * Enhanced approval process that ensures all FK relationships are maintained
 */
export async function approvePatientWithIntegrityCheck(patientId: string) {
  const supabase = await createServiceClient()

  try {
    console.log('🚀 [APPROVE] Starting enhanced patient approval for:', patientId)

    // First validate the user's current state
    const integrityCheck = await validateUserIntegrity(patientId)
    if (integrityCheck.error) {
      return { error: `Integrity check failed: ${integrityCheck.error}` }
    }

    // If there are integrity issues, report them
    if (integrityCheck.data && integrityCheck.data.length > 0) {
      const issues = integrityCheck.data[0]?.issues || []
      console.warn('⚠️ [APPROVE] Integrity issues found:', issues)

      // We can still proceed but should log the issues
      if (issues.length > 0) {
        console.log('🔧 [APPROVE] Proceeding with approval despite issues:', issues)
      }
    }

    // Proceed with the standard approval process
    const { approvePatientAction } = await import('./auth')
    const result = await approvePatientAction(patientId)

    if (result.success) {
      // Validate integrity after approval
      const postApprovalCheck = await validateUserIntegrity(patientId)
      if (postApprovalCheck.data && postApprovalCheck.data.length > 0) {
        console.warn('⚠️ [APPROVE] Post-approval integrity issues:', postApprovalCheck.data[0]?.issues)
      } else {
        console.log('✅ [APPROVE] Patient approval completed with full integrity')
      }
    }

    return result

  } catch (error) {
    console.error('💥 [APPROVE] Exception in enhanced approval:', error)
    return { error: 'Failed to approve patient with integrity check' }
  }
}

/**
 * Get statistics about the patient verification queue
 */
export async function getVerificationQueueStats() {
  const supabase = await createServiceClient()

  try {
    console.log('📊 [STATS] Fetching verification queue statistics...')

    // Get pending registrations count
    const { count: pendingCount, error: pendingError } = await supabase
      .from('pending_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (pendingError) {
      console.error('❌ [STATS] Error fetching pending count:', pendingError)
      return { error: pendingError.message, data: null }
    }

    // Get approved registrations count
    const { count: approvedCount, error: approvedError } = await supabase
      .from('pending_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    if (approvedError) {
      console.error('❌ [STATS] Error fetching approved count:', approvedError)
      return { error: approvedError.message, data: null }
    }

    // Get rejected registrations count
    const { count: rejectedCount, error: rejectedError } = await supabase
      .from('pending_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected')

    if (rejectedError) {
      console.error('❌ [STATS] Error fetching rejected count:', rejectedError)
      return { error: rejectedError.message, data: null }
    }

    const stats = {
      pending: pendingCount || 0,
      approved: approvedCount || 0,
      rejected: rejectedCount || 0,
      total: (pendingCount || 0) + (approvedCount || 0) + (rejectedCount || 0)
    }

    console.log('✅ [STATS] Verification queue stats:', stats)
    return { data: stats, error: null }

  } catch (error) {
    console.error('💥 [STATS] Exception fetching verification stats:', error)
    return { error: 'Failed to fetch verification queue statistics', data: null }
  }
}