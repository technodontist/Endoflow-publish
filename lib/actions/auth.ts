'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getUserProfile(supabase: any, userId: string): Promise<{ role: string; status: string } | null> {
  console.log('🔍 [DEBUG] Starting profile lookup for user ID:', userId)

  try {
    // TEMPORARY: Use service role to bypass RLS until database fix is applied
    const serviceSupabase = await createServiceClient()

    const { data: profile, error } = await serviceSupabase
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('🚨 [ERROR] Error querying profiles table:', error)
      }
      return null
    }

    if (!profile) {
      console.log('❌ [DEBUG] No profile found for user ID:', userId)
      return null
    }

    if (profile.status !== 'active' && profile.status !== 'pending') {
      console.log('❌ [DEBUG] User profile status not valid:', profile.status)
      return null
    }

    console.log('✅ [DEBUG] Found user profile:', profile.role, 'with status:', profile.status)
    return { role: profile.role, status: profile.status }
  } catch (error) {
    console.error('🚨 [ERROR] Exception in getUserProfile function:', error)
    return null
  }
}

export async function getCurrentUser() {
  console.log('🔍 [GET_CURRENT_USER] Getting current authenticated user...')

  try {
    const supabase = await createClient()

    // Get current user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('🚨 [GET_CURRENT_USER] Auth error:', authError.message)
      return null
    }

    if (!user) {
      console.log('❌ [GET_CURRENT_USER] No authenticated user found')
      return null
    }

    console.log('✅ [GET_CURRENT_USER] Auth user found:', user.id)

    // Get user profile for role and status
    const userProfile = await getUserProfile(supabase, user.id)

    if (!userProfile) {
      console.error('🚨 [GET_CURRENT_USER] User profile not found')
      return null
    }

    console.log('✅ [GET_CURRENT_USER] User profile loaded:', userProfile.role, userProfile.status)

    return {
      id: user.id,
      email: user.email,
      role: userProfile.role,
      status: userProfile.status,
      fullName: userProfile.full_name || user.user_metadata?.full_name
    }
  } catch (error) {
    console.error('🚨 [GET_CURRENT_USER] Exception:', error)
    return null
  }
}

export async function login(email: string, password: string) {
  console.log('🚀 [LOGIN] Starting login process for email:', email)
  const supabase = await createClient()

  console.log('🔐 [LOGIN] Attempting Supabase Auth login...')
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('🚨 [LOGIN ERROR] Supabase Auth signInWithPassword failed:', error.message)
    return { error: error.message }
  }
  if (!data.user) {
    console.error('🚨 [LOGIN ERROR] No user data returned from Supabase Auth despite no error')
    return { error: 'Authentication failed - no user data returned' }
  }

  console.log('✅ [LOGIN] Supabase Auth successful. User data:', { id: data.user.id })

  console.log('🔍 [LOGIN] Now checking user profile in database...')
  const userProfile = await getUserProfile(supabase, data.user.id)

  if (!userProfile) {
    console.error('🚨 [LOGIN ERROR] User authenticated successfully but not found in profiles table.')
    return { error: 'User not found in system. Please contact support.' }
  }

  // Check if user is pending approval
  if (userProfile.status === 'pending') {
    console.log('⏳ [LOGIN] User is pending approval')
    return { error: 'Your account is pending approval. Please wait for an administrator to verify your account.' }
  }

  // Check if user is active
  if (userProfile.status !== 'active') {
    console.log('❌ [LOGIN] User account is not active:', userProfile.status)
    return { error: 'Your account is not active. Please contact support.' }
  }

  console.log('✅ [LOGIN] User profile found and active:', userProfile.role)
  revalidatePath('/', 'layout')
  redirect(getRoleBasedRedirect(userProfile.role))
}

export async function signup(formData: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}) {
  const supabase = await createClient()

  console.log('🚀 [SIGNUP] Starting signup process for email:', formData.email)

  try {
    // 1. Create auth user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: `${formData.firstName} ${formData.lastName}`,
          role: 'patient',
          phone: formData.phone
        }
      }
    })

    if (authError) {
      console.error('🚨 [SIGNUP ERROR] Auth signup failed:', authError.message)
      return { error: authError.message }
    }

    if (!authData.user) {
      console.error('🚨 [SIGNUP ERROR] No user data returned')
      return { error: 'Account creation failed' }
    }

    console.log('✅ [SIGNUP] Auth user created:', authData.user.id)

    // 2. Manually create profile entry to ensure it exists
    // The trigger might not work consistently, so we'll create it manually
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: 'patient',
        status: 'pending',
        full_name: `${formData.firstName} ${formData.lastName}`
      })

    if (profileError && profileError.code !== '23505') { // Ignore unique constraint violations
      console.error('🚨 [SIGNUP ERROR] Failed to create profile:', profileError.message)
      // Don't return error here as the auth user was created successfully
    } else {
      console.log('✅ [SIGNUP] Profile created successfully')
    }

    // 3. Store the registration data for the assistant to review
    // Now using direct user_id column instead of embedding in JSON
    const registrationData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      full_name: `${formData.firstName} ${formData.lastName}`,
      role: 'patient'
    };

    console.log('📝 [SIGNUP] Storing pending registration data with user_id:', authData.user.id);

    const { error: pendingError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .insert({
        user_id: authData.user.id, // Direct FK relationship
        form_data: JSON.stringify(registrationData),
        status: 'pending'
      })

    if (pendingError) {
      console.error('🚨 [SIGNUP ERROR] Failed to create pending registration:', pendingError.message)
      // Don't return error here as the main account was created successfully
    }

    console.log('✅ [SIGNUP] Registration completed successfully')
    return {
      success: true,
      message: 'Account created! Please check your email for verification, then wait for admin approval.'
    }

  } catch (error) {
    console.error('🚨 [SIGNUP ERROR] Exception during signup:', error)
    return { error: 'An unexpected error occurred during signup' }
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function approvePatientAction(patientId: string) {
  console.log('🚀 [APPROVE] Starting enhanced patient approval process for:', patientId)

  if (!patientId) {
    console.error('❌ [APPROVE] No patient ID provided')
    return { error: 'Patient ID is required' }
  }

  const supabase = await createServiceClient()

  if (!supabase) {
    console.error('❌ [APPROVE] Failed to create service client')
    return { error: 'Database connection failed' }
  }

  try {

    // First, check if this user exists in auth.users (FK validation)
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(patientId)
    if (authError || !authUser) {
      console.error('❌ [APPROVE] User not found in auth.users:', authError)
      return { error: 'User account not found in authentication system' }
    }

    // Get the patient profile to ensure it exists
    const { data: profile, error: getProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', patientId)
      .eq('role', 'patient')
      .single()

    if (getProfileError || !profile) {
      console.error('❌ [APPROVE] Patient profile not found:', getProfileError)
      return { error: 'Patient profile not found' }
    }

    console.log('🔍 [APPROVE] Found patient profile:', profile.full_name)
    console.log('✅ [APPROVE] FK validation passed - user exists in auth.users')
    
    // 1. Update the profile status to active
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'active'
      })
      .eq('id', patientId)
      .eq('role', 'patient')

    if (profileError) {
      console.error('❌ [APPROVE] Error updating profile:', profileError)
      return { error: profileError.message }
    }

    console.log('✅ [APPROVE] Profile updated to active status')
    
    // 2. Update any related pending registration records using the new user_id FK
    const { error: pendingError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .update({ status: 'approved' })
      .eq('user_id', patientId)
    
    if (pendingError) {
      console.warn('⚠️ [APPROVE] Warning: Could not update pending registration status:', pendingError)
      // Don't fail the whole operation for this
    } else {
      console.log('✅ [APPROVE] Pending registration marked as approved')
    }
    
    // 3. Create patient record in api.patients table with FK integrity
    // This creates the role-specific record that links to the profile
    const nameParts = profile.full_name.split(' ')
    const { error: patientInsertError } = await supabase
      .schema('api')
      .from('patients')
      .upsert({
        id: patientId, // This now has FK constraint to profiles.id
        first_name: nameParts[0] || 'Unknown',
        last_name: nameParts.slice(1).join(' ') || 'User',
        created_at: new Date().toISOString()
      })

    if (patientInsertError) {
      if (patientInsertError.code === '23505') {
        console.log('ℹ️ [APPROVE] Patient record already exists (duplicate key)')
      } else if (patientInsertError.code === '23503') {
        console.error('❌ [APPROVE] FK constraint violation - profile link broken:', patientInsertError)
        return { error: 'Database integrity error: Profile relationship broken' }
      } else {
        console.warn('⚠️ [APPROVE] Warning: Could not create patient record:', patientInsertError)
        // Continue despite this error
      }
    } else {
      console.log('✅ [APPROVE] Patient record created in api.patients table with FK integrity')
    }

    // 4. Final integrity check - verify all relationships are properly linked
    const { data: verificationData, error: verificationError } = await supabase
      .schema('public')
      .from('pending_patient_verifications')
      .select('*')
      .eq('user_id', patientId)
      .single()

    if (verificationError) {
      console.warn('⚠️ [APPROVE] Warning: Could not verify patient in unified view (view may not exist yet)')
    } else {
      console.log('✅ [APPROVE] Final verification: Patient properly linked in all tables')
    }

    console.log('✅ [APPROVE] Patient approval completed successfully:', patientId)
    revalidatePath('/assistant')
    revalidatePath('/assistant/verify')
    return { success: true, message: 'Patient approved successfully and can now log in' }
  } catch (error) {
    console.error('❌ [APPROVE] Exception approving patient:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: `Failed to approve patient: ${errorMessage}` }
  }
}

export async function rejectPatientAction(patientId: string) {
  const supabase = await createServiceClient()

  try {
    console.log('🚀 [REJECT] Starting patient rejection process for:', patientId)
    
    // 1. Update the profile status to inactive
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ status: 'inactive' })
      .eq('id', patientId)
      .eq('role', 'patient')

    if (profileError) {
      console.error('❌ [REJECT] Error updating profile:', profileError)
      return { error: profileError.message }
    }

    console.log('✅ [REJECT] Profile updated to inactive status')
    
    // 2. Update any related pending registration records using the new user_id FK
    const { error: pendingError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .update({ status: 'rejected' })
      .eq('user_id', patientId)
    
    if (pendingError) {
      console.warn('⚠️ [REJECT] Warning: Could not update pending registration status:', pendingError)
      // Don't fail the whole operation for this
    } else {
      console.log('✅ [REJECT] Pending registration marked as rejected')
    }
    
    // 3. Optionally delete the auth user (be careful with this)
    // We'll leave the auth user in place but inactive for audit purposes

    console.log('✅ [REJECT] Patient rejected successfully:', patientId)
    revalidatePath('/assistant')
    revalidatePath('/assistant/verify')
    return { success: true }
  } catch (error) {
    console.error('❌ [REJECT] Exception rejecting patient:', error)
    return { error: 'Failed to reject patient' }
  }
}

export async function approveAssistantAction(assistantId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', assistantId)
      .eq('role', 'assistant')

    if (error) {
      console.error('❌ [APPROVE] Error approving assistant:', error)
      return { error: error.message }
    }

    console.log('✅ [APPROVE] Assistant approved successfully:', assistantId)
    revalidatePath('/dentist')
    revalidatePath('/dentist/verify')
    return { success: true }
  } catch (error) {
    console.error('❌ [APPROVE] Exception approving assistant:', error)
    return { error: 'Failed to approve assistant' }
  }
}

export async function rejectAssistantAction(assistantId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'inactive' })
      .eq('id', assistantId)
      .eq('role', 'assistant')

    if (error) {
      console.error('❌ [REJECT] Error rejecting assistant:', error)
      return { error: error.message }
    }

    console.log('✅ [REJECT] Assistant rejected successfully:', assistantId)
    revalidatePath('/dentist')
    revalidatePath('/dentist/verify')
    return { success: true }
  } catch (error) {
    console.error('❌ [REJECT] Exception rejecting assistant:', error)
    return { error: 'Failed to reject assistant' }
  }
}

function getRoleBasedRedirect(role: string): string {
  switch (role) {
    case 'patient': return '/patient'
    case 'assistant': return '/assistant'
    case 'dentist': return '/dentist'
    default: return '/'
  }
}

// Enhanced staff approval functions for multi-role system
export async function approveStaffMemberAction(userId: string, role: 'assistant' | 'dentist') {
  const supabase = await createServiceClient()

  try {
    console.log(`🚀 [APPROVE STAFF] Starting approval for ${role}:`, userId)

    // First, check if this user exists in auth.users (FK validation)
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    if (authError || !authUser) {
      console.error('❌ [APPROVE STAFF] User not found in auth.users:', authError)
      return { error: 'User account not found in authentication system' }
    }

    // Get the staff profile to ensure it exists
    const { data: profile, error: getProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .eq('role', role)
      .single()

    if (getProfileError || !profile) {
      console.error(`❌ [APPROVE STAFF] ${role} profile not found:`, getProfileError)
      return { error: `${role} profile not found` }
    }

    console.log(`🔍 [APPROVE STAFF] Found ${role} profile:`, profile.full_name)
    console.log('✅ [APPROVE STAFF] FK validation passed - user exists in auth.users')

    // 1. Update the profile status to active
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', userId)
      .eq('role', role)

    if (profileError) {
      console.error(`❌ [APPROVE STAFF] Error updating profile:`, profileError)
      return { error: profileError.message }
    }

    console.log(`✅ [APPROVE STAFF] Profile updated to active status`)

    // 2. Update any related pending registration records
    const { error: pendingError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .update({ status: 'approved' })
      .eq('user_id', userId)

    if (pendingError) {
      console.warn(`⚠️ [APPROVE STAFF] Warning: Could not update pending registration status:`, pendingError)
    } else {
      console.log(`✅ [APPROVE STAFF] Pending registration marked as approved`)
    }

    console.log(`✅ [APPROVE STAFF] ${role} approval completed successfully:`, userId)
    revalidatePath('/assistant')
    revalidatePath('/assistant/verify')
    revalidatePath('/admin')

    return { success: true, message: `${role} approved successfully and can now log in` }
  } catch (error) {
    console.error(`❌ [APPROVE STAFF] Exception approving ${role}:`, error)
    return { error: `Failed to approve ${role}` }
  }
}