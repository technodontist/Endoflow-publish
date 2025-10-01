'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema
const passwordResetSchema = z.object({
  email: z.string().email('Valid email is required'),
})

export async function generateNewPassword(email: string) {
  console.log('🔐 [PASSWORD RESET] Starting password reset for:', email)

  try {
    // Validate input data
    const validatedData = passwordResetSchema.parse({ email })
    console.log('✅ [PASSWORD RESET] Data validation passed')

    const serviceSupabase = await createServiceClient()
    if (!serviceSupabase) {
      console.error('❌ [PASSWORD RESET] Failed to create service client')
      return { error: 'Database connection failed' }
    }

    // Check if user exists
    const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers()
    const user = existingUsers?.users?.find(u => u.email === validatedData.email)

    if (!user) {
      console.error('❌ [PASSWORD RESET] User not found:', validatedData.email)
      return { error: 'User with this email does not exist' }
    }

    // Generate a new temporary password
    const newTemporaryPassword = Math.random().toString(36).slice(-12) + 'A1!'

    console.log('🔐 [PASSWORD RESET] Updating user password...')

    // Update password using admin API
    const { data, error: updateError } = await serviceSupabase.auth.admin.updateUserById(
      user.id,
      { password: newTemporaryPassword }
    )

    if (updateError) {
      console.error('🚨 [PASSWORD RESET] Failed to update password:', updateError.message)
      return { error: updateError.message }
    }

    console.log('✅ [PASSWORD RESET] Password updated successfully for:', validatedData.email)

    return {
      success: true,
      message: 'New temporary password generated successfully!',
      email: validatedData.email,
      temporaryPassword: newTemporaryPassword
    }

  } catch (error) {
    console.error('❌ [PASSWORD RESET] Exception during password reset:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return { error: firstError.message }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: `Failed to reset password: ${errorMessage}` }
  }
}

export async function sendPasswordResetEmail(email: string) {
  console.log('📧 [PASSWORD RESET EMAIL] Starting password reset email for:', email)

  try {
    // Validate input data
    const validatedData = passwordResetSchema.parse({ email })
    console.log('✅ [PASSWORD RESET EMAIL] Data validation passed')

    const serviceSupabase = await createServiceClient()
    if (!serviceSupabase) {
      console.error('❌ [PASSWORD RESET EMAIL] Failed to create service client')
      return { error: 'Database connection failed' }
    }

    // Send password reset email
    const { error: resetError } = await serviceSupabase.auth.resetPasswordForEmail(
      validatedData.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`
      }
    )

    if (resetError) {
      console.error('🚨 [PASSWORD RESET EMAIL] Failed to send reset email:', resetError.message)
      return { error: resetError.message }
    }

    console.log('✅ [PASSWORD RESET EMAIL] Reset email sent successfully to:', validatedData.email)

    return {
      success: true,
      message: 'Password reset email sent successfully!'
    }

  } catch (error) {
    console.error('❌ [PASSWORD RESET EMAIL] Exception during email send:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return { error: firstError.message }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: `Failed to send reset email: ${errorMessage}` }
  }
}