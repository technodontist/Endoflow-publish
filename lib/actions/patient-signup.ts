'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface PatientSignupData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

export async function patientSignup(formData: PatientSignupData) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  console.log(`👤 [PATIENT SIGNUP] 🔒 SELF-REGISTERED PATIENT 🔒 Starting patient registration:`, formData.email)
  console.log(`👤 [PATIENT SIGNUP] This patient will get PENDING status (needs approval)`)

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
      console.error('🚨 [PATIENT SIGNUP ERROR] Auth signup failed:', authError.message)
      return { error: authError.message }
    }

    if (!authData.user) {
      console.error('🚨 [PATIENT SIGNUP ERROR] No user data returned')
      return { error: 'Account creation failed' }
    }

    console.log('✅ [PATIENT SIGNUP] Auth user created:', authData.user.id)

    // 2. Create profile entry (always patient, always pending)
    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: 'patient',
        status: 'pending', // All patients start as pending approval
        full_name: `${formData.firstName} ${formData.lastName}`
      })

    if (profileError && profileError.code !== '23505') { // Ignore unique constraint violations
      console.error('🚨 [PATIENT SIGNUP ERROR] Failed to create profile:', profileError.message)
      return { error: 'Failed to create user profile' }
    } else {
      console.log('✅ [PATIENT SIGNUP] Profile created successfully')
    }

    // 3. Create patient record in api.patients table
    const { error: patientError } = await serviceSupabase
      .schema('api')
      .from('patients')
      .insert({
        id: authData.user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        email: formData.email
      })

    if (patientError && patientError.code !== '23505') {
      console.error('❌ [PATIENT SIGNUP] Failed to create patient record:', patientError)
      return { error: 'Failed to create patient record: ' + patientError.message }
    } else {
      console.log('✅ [PATIENT SIGNUP] Patient record created')
    }

    // 4. Store pending registration for approval workflow
    const registrationData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      full_name: `${formData.firstName} ${formData.lastName}`,
      role: 'patient'
    }

    const { error: pendingError } = await serviceSupabase
      .schema('api')
      .from('pending_registrations')
      .insert({
        user_id: authData.user.id,
        form_data: JSON.stringify(registrationData),
        status: 'pending'
      })

    if (pendingError) {
      console.error('🚨 [PATIENT SIGNUP] Failed to create pending registration:', pendingError.message)
      // Don't fail the whole operation for this
    } else {
      console.log('✅ [PATIENT SIGNUP] Pending registration created')
    }

    console.log('✅ [PATIENT SIGNUP] 🔒 SELF-REGISTERED PATIENT COMPLETED 🔒')
    console.log('✅ [PATIENT SIGNUP] Patient has PENDING status (needs assistant approval)')
    console.log('✅ [PATIENT SIGNUP] Patient registration completed successfully')

    // Revalidate relevant paths
    revalidatePath('/assistant')
    revalidatePath('/assistant/verify')

    return {
      success: true,
      message: 'Account created! Please check your email for verification, then wait for admin approval.'
    }

  } catch (error) {
    console.error('🚨 [PATIENT SIGNUP ERROR] Exception during signup:', error)
    return { error: 'An unexpected error occurred during registration' }
  }
}