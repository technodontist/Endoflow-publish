'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface MultiRoleSignupData {
  // Basic info (all roles)
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  role: 'patient' | 'assistant' | 'dentist'

  // Role-specific fields
  specialty?: string // For dentists
  licenseNumber?: string // For dentists
  experience?: string // For assistants/dentists
}

export async function multiRoleSignup(formData: MultiRoleSignupData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  console.log(`🚀 [MULTI-ROLE SIGNUP] Starting signup process for ${formData.role}:`, formData.email)

  try {
    // 1. Create auth user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: `${formData.firstName} ${formData.lastName}`,
          role: formData.role,
          phone: formData.phone
        }
      }
    })

    if (authError) {
      console.error('🚨 [MULTI-ROLE SIGNUP ERROR] Auth signup failed:', authError.message)
      return { error: authError.message }
    }

    if (!authData.user) {
      console.error('🚨 [MULTI-ROLE SIGNUP ERROR] No user data returned')
      return { error: 'Account creation failed' }
    }

    console.log('✅ [MULTI-ROLE SIGNUP] Auth user created:', authData.user.id)

    // 2. Create profile entry (central auth table)
    const profileStatus = formData.role === 'patient' ? 'pending' : 'pending' // All roles need approval

    // Determine clinic_id: for now, all new signups go to the default clinic
    // TODO: Support clinic selection during registration for multi-clinic deployments
    const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001'

    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: formData.role,
        status: profileStatus,
        full_name: `${formData.firstName} ${formData.lastName}`,
        clinic_id: DEFAULT_CLINIC_ID
      })

    if (profileError && profileError.code !== '23505') { // Ignore unique constraint violations
      console.error('🚨 [MULTI-ROLE SIGNUP ERROR] Failed to create profile:', profileError.message)
      return { error: 'Failed to create user profile' }
    } else {
      console.log('✅ [MULTI-ROLE SIGNUP] Profile created successfully')
    }

    // 3. Create role-specific records
    await createRoleSpecificRecord(serviceSupabase, authData.user.id, formData)

    // 4. Store pending registration for approval workflow
    if (formData.role === 'patient') {
      await createPendingRegistration(serviceSupabase, authData.user.id, formData)
    } else {
      await createStaffPendingRecord(serviceSupabase, authData.user.id, formData)
    }

    console.log('✅ [MULTI-ROLE SIGNUP] Registration completed successfully')

    return {
      success: true,
      message: getSuccessMessage(formData.role)
    }

  } catch (error) {
    console.error('🚨 [MULTI-ROLE SIGNUP ERROR] Exception during signup:', error)
    return { error: 'An unexpected error occurred during signup' }
  }
}

async function createRoleSpecificRecord(
  supabase: any,
  userId: string,
  formData: MultiRoleSignupData
) {
  switch (formData.role) {
    case 'patient':
      const { error: patientError } = await supabase
        .schema('api')
        .from('patients')
        .insert({
          id: userId,
          first_name: formData.firstName,
          last_name: formData.lastName
        })

      if (patientError && patientError.code !== '23505') {
        console.error('❌ [ROLE RECORD] Failed to create patient record:', patientError)
      } else {
        console.log('✅ [ROLE RECORD] Patient record created')
      }
      break

    case 'assistant':
      const { error: assistantError } = await supabase
        .schema('api')
        .from('assistants')
        .insert({
          id: userId,
          full_name: `${formData.firstName} ${formData.lastName}`
        })

      if (assistantError && assistantError.code !== '23505') {
        console.error('❌ [ROLE RECORD] Failed to create assistant record:', assistantError)
      } else {
        console.log('✅ [ROLE RECORD] Assistant record created')
      }
      break

    case 'dentist':
      const { error: dentistError } = await supabase
        .schema('api')
        .from('dentists')
        .insert({
          id: userId,
          full_name: `${formData.firstName} ${formData.lastName}`,
          specialty: formData.specialty
        })

      if (dentistError && dentistError.code !== '23505') {
        console.error('❌ [ROLE RECORD] Failed to create dentist record:', dentistError)
      } else {
        console.log('✅ [ROLE RECORD] Dentist record created')
      }
      break
  }
}

async function createPendingRegistration(
  supabase: any,
  userId: string,
  formData: MultiRoleSignupData
) {
  const registrationData = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone,
    full_name: `${formData.firstName} ${formData.lastName}`,
    role: formData.role
  }

  console.log('📝 [PENDING REG] Storing patient registration data')

  const { error: pendingError } = await supabase
    .schema('api')
    .from('pending_registrations')
    .insert({
      user_id: userId,
      form_data: JSON.stringify(registrationData),
      status: 'pending'
    })

  if (pendingError) {
    console.error('🚨 [PENDING REG] Failed to create pending registration:', pendingError.message)
  } else {
    console.log('✅ [PENDING REG] Patient pending registration created')
  }
}

async function createStaffPendingRecord(
  supabase: any,
  userId: string,
  formData: MultiRoleSignupData
) {
  // Create a more detailed pending record for staff (assistants/dentists)
  const staffData = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone,
    role: formData.role,
    specialty: formData.specialty,
    licenseNumber: formData.licenseNumber,
    experience: formData.experience,
    full_name: `${formData.firstName} ${formData.lastName}`
  }

  console.log(`📝 [STAFF PENDING] Storing ${formData.role} application data`)

  // For now, we'll use the same pending_registrations table but with enhanced data
  const { error: pendingError } = await supabase
    .schema('api')
    .from('pending_registrations')
    .insert({
      user_id: userId,
      form_data: JSON.stringify(staffData),
      status: 'pending'
    })

  if (pendingError) {
    console.error(`🚨 [STAFF PENDING] Failed to create ${formData.role} application:`, pendingError.message)
  } else {
    console.log(`✅ [STAFF PENDING] ${formData.role} application submitted`)
  }
}

function getSuccessMessage(role: 'patient' | 'assistant' | 'dentist'): string {
  switch (role) {
    case 'patient':
      return 'Account created! Please check your email for verification, then wait for admin approval.'
    case 'assistant':
      return 'Assistant application submitted! Your credentials will be reviewed by an administrator. You\'ll receive an email notification once approved.'
    case 'dentist':
      return 'Dentist application submitted! Your credentials and license will be reviewed by an administrator. You\'ll receive an email notification once approved.'
    default:
      return 'Account created successfully! Please wait for approval.'
  }
}

// Enhanced approval functions for different roles
export async function approveStaffMember(userId: string, role: 'assistant' | 'dentist') {
  const supabase = await createServiceClient()

  try {
    console.log(`🚀 [APPROVE STAFF] Starting approval for ${role}:`, userId)

    // 1. Update profile status to active
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', userId)
      .eq('role', role)

    if (profileError) {
      console.error(`❌ [APPROVE STAFF] Error updating profile:`, profileError)
      return { error: profileError.message }
    }

    // 2. Update pending registration
    const { error: pendingError } = await supabase
      .schema('api')
      .from('pending_registrations')
      .update({ status: 'approved' })
      .eq('user_id', userId)

    if (pendingError) {
      console.warn(`⚠️ [APPROVE STAFF] Could not update pending registration:`, pendingError)
    }

    console.log(`✅ [APPROVE STAFF] ${role} approved successfully:`, userId)

    // Revalidate relevant pages
    revalidatePath('/assistant')
    revalidatePath('/admin')

    return { success: true, message: `${role} approved successfully and can now log in` }

  } catch (error) {
    console.error(`❌ [APPROVE STAFF] Exception approving ${role}:`, error)
    return { error: `Failed to approve ${role}` }
  }
}

export async function getRoleBasedRedirect(role: string): Promise<string> {
  switch (role) {
    case 'patient': return '/patient'
    case 'assistant': return '/assistant'
    case 'dentist': return '/dentist'
    default: return '/'
  }
}