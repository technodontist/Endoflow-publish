'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema
const patientRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  dateOfBirth: z.string().optional(),
  medicalHistory: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

interface ManualPatientRegistrationData {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth?: string
  medicalHistory?: string
  emergencyContact?: string
  emergencyPhone?: string
}

export async function manualPatientRegistration(formData: ManualPatientRegistrationData) {
  console.log('🏥 [MANUAL REGISTRATION] ⚡ ASSISTANT-CREATED PATIENT ⚡ Starting manual patient registration:', formData.email)
  console.log('🏥 [MANUAL REGISTRATION] This patient will get ACTIVE status (can login immediately)')

  try {
    // Validate input data
    const validatedData = patientRegistrationSchema.parse(formData)
    console.log('✅ [MANUAL REGISTRATION] Data validation passed')

    const serviceSupabase = await createServiceClient()
    if (!serviceSupabase) {
      console.error('❌ [MANUAL REGISTRATION] Failed to create service client')
      return { error: 'Database connection failed' }
    }

    // Check if email already exists
    const { data: existingUser } = await serviceSupabase.auth.admin.listUsers()
    const emailExists = existingUser?.users?.some(user => user.email === validatedData.email)

    if (emailExists) {
      console.error('❌ [MANUAL REGISTRATION] Email already exists:', validatedData.email)
      return { error: 'A user with this email already exists' }
    }

    // Generate a temporary password (user will need to reset it)
    const temporaryPassword = Math.random().toString(36).slice(-12) + 'A1!'

    console.log('🔐 [MANUAL REGISTRATION] Creating auth user account...')

    // 1. Create auth user account
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: validatedData.email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email since it's created by staff
      user_metadata: {
        full_name: `${validatedData.firstName} ${validatedData.lastName}`,
        role: 'patient',
        phone: validatedData.phone
      }
    })

    if (authError) {
      console.error('🚨 [MANUAL REGISTRATION] Auth user creation failed:', authError.message)
      return { error: authError.message }
    }

    if (!authData.user) {
      console.error('🚨 [MANUAL REGISTRATION] No user data returned')
      return { error: 'Account creation failed' }
    }

    const userId = authData.user.id
    console.log('✅ [MANUAL REGISTRATION] Auth user created:', userId)

    // 2. Create profile entry with ACTIVE status (critical for assistant-created patients)
    console.log('🏥 [MANUAL REGISTRATION] Creating profile with ACTIVE status...')
    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .insert({
        id: userId,
        role: 'patient',
        status: 'active', // CRITICAL: Directly active since created by staff
        full_name: `${validatedData.firstName} ${validatedData.lastName}`
      })

    if (profileError) {
      if (profileError.code === '23505') {
        console.log('ℹ️ [MANUAL REGISTRATION] Profile already exists (duplicate key) - this is OK')

        // Ensure existing profile has active status
        const { error: updateError } = await serviceSupabase
          .from('profiles')
          .update({ status: 'active' })
          .eq('id', userId)
          .eq('role', 'patient')

        if (updateError) {
          console.error('🚨 [MANUAL REGISTRATION] Failed to update existing profile to active:', updateError.message)
          return { error: 'Failed to set patient status to active: ' + updateError.message }
        } else {
          console.log('✅ [MANUAL REGISTRATION] Existing profile updated to ACTIVE status')
        }
      } else {
        console.error('🚨 [MANUAL REGISTRATION] CRITICAL: Failed to create profile with active status:', profileError.message)
        console.error('🚨 [MANUAL REGISTRATION] This would cause patient to have PENDING status - BLOCKING operation')
        return { error: 'Failed to create active patient profile: ' + profileError.message }
      }
    } else {
      console.log('✅ [MANUAL REGISTRATION] Profile created successfully with ACTIVE status')
    }

    // 3. Create patient record in api.patients table
    const patientData: any = {
      id: userId,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      phone: validatedData.phone,
      email: validatedData.email,
      created_at: new Date().toISOString()
    }

    // Add optional fields if provided
    if (validatedData.dateOfBirth) {
      patientData.date_of_birth = validatedData.dateOfBirth
    }
    if (validatedData.medicalHistory) {
      patientData.medical_history_summary = validatedData.medicalHistory
    }
    if (validatedData.emergencyContact) {
      patientData.emergency_contact_name = validatedData.emergencyContact
    }
    if (validatedData.emergencyPhone) {
      patientData.emergency_contact_phone = validatedData.emergencyPhone
    }

    const { error: patientInsertError } = await serviceSupabase
      .schema('api')
      .from('patients')
      .insert(patientData)

    if (patientInsertError) {
      if (patientInsertError.code === '23505') {
        console.log('ℹ️ [MANUAL REGISTRATION] Patient record already exists (duplicate key)')
      } else {
        console.error('❌ [MANUAL REGISTRATION] Failed to create patient record:', patientInsertError)
        return { error: 'Failed to create patient record: ' + patientInsertError.message }
      }
    } else {
      console.log('✅ [MANUAL REGISTRATION] Patient record created in api.patients table with all fields')
    }

    console.log('✅ [MANUAL REGISTRATION] ⚡ ASSISTANT-CREATED PATIENT COMPLETED ⚡')
    console.log('✅ [MANUAL REGISTRATION] Patient can login immediately with status: ACTIVE')
    console.log('✅ [MANUAL REGISTRATION] Patient registration completed successfully:', userId)

    // Revalidate relevant paths
    revalidatePath('/assistant')
    revalidatePath('/assistant/verify')

    return {
      success: true,
      message: `Patient registered successfully! Temporary login credentials created.`,
      userId: userId,
      temporaryPassword: temporaryPassword,
      email: validatedData.email
    }

  } catch (error) {
    console.error('❌ [MANUAL REGISTRATION] Exception during registration:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return { error: firstError.message }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: `Failed to register patient: ${errorMessage}` }
  }
}