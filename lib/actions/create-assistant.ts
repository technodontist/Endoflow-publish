'use server'

import { createServiceClient } from '@/lib/supabase/server'

export async function createAssistantAction(formData: FormData) {
  try {
    const supabase = await createServiceClient()

    const fullName = formData.get('fullName') as string
    const email = formData.get('email') as string || null

    if (!fullName?.trim()) {
      return { error: 'Assistant name is required' }
    }

    let userId = null

    // Step 1: Create auth user if email is provided
    if (email?.trim()) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim(),
        password: 'temppassword123', // They can change this later
        email_confirm: true
      })

      if (authError) {
        console.error('Auth user creation error:', authError.message)
        return { error: 'Failed to create authentication account' }
      }

      userId = authUser.user.id
      console.log(`✅ Created auth user with ID: ${userId}`)
    } else {
      // Generate a UUID for profile-only assistant
      userId = crypto.randomUUID()
      console.log(`📝 Using generated ID: ${userId}`)
    }

    // Step 2: Create profile entry
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName.trim(),
        role: 'assistant',
        status: 'active'
      })
      .select()
      .single()

    if (profileError) {
      console.error('Profile creation error:', profileError.message)
      return { error: 'Failed to create assistant profile' }
    }

    console.log('✅ Created profile:', profile)

    // Step 3: Create assistant-specific entry (optional)
    const { data: assistant, error: assistantError } = await supabase
      .schema('api')
      .from('assistants')
      .insert({
        id: userId,
        full_name: fullName.trim()
      })
      .select()
      .single()

    if (assistantError) {
      console.log('⚠️ Assistant table entry error (this is optional):', assistantError.message)
    } else {
      console.log('✅ Created assistant entry:', assistant)
    }

    return {
      success: true,
      assistant: {
        id: userId,
        full_name: fullName.trim(),
        email: email || null
      }
    }

  } catch (error) {
    console.error('Create assistant error:', error)
    return { error: 'Failed to create assistant' }
  }
}