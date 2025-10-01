const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createSecondAssistant() {
  console.log('🏥 Creating second assistant: Sarah Johnson...')

  try {
    // Generate a UUID for the new assistant
    const assistantId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

    // Step 1: Create profile entry
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: assistantId,
        full_name: 'Sarah Johnson',
        role: 'assistant',
        status: 'active'
      })
      .select()
      .single()

    if (profileError) {
      if (profileError.code === '23505') {
        console.log('ℹ️ Assistant already exists, updating...')

        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ status: 'active', full_name: 'Sarah Johnson' })
          .eq('id', assistantId)
          .select()
          .single()

        if (updateError) {
          console.error('❌ Profile update error:', updateError.message)
          return false
        }

        console.log('✅ Updated existing profile:', updatedProfile)
      } else {
        console.error('❌ Profile creation error:', profileError.message)
        return false
      }
    } else {
      console.log('✅ Created new profile:', profile)
    }

    // Step 2: Optionally create assistant-specific entry (not required for task assignment)
    const { data: assistant, error: assistantError } = await supabase
      .schema('api')
      .from('assistants')
      .upsert({
        id: assistantId,
        full_name: 'Sarah Johnson'
      })
      .select()
      .single()

    if (assistantError) {
      console.log('⚠️ Assistant table entry error (this is optional):', assistantError.message)
    } else {
      console.log('✅ Created/updated assistant entry:', assistant)
    }

    // Step 3: Verify the assistant can be found by the getAvailableAssistantsAction
    console.log('\n🔍 Verifying assistant is available for task assignment...')

    const { data: assistants, error: queryError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'assistant')
      .eq('status', 'active')
      .order('full_name')

    if (queryError) {
      console.error('❌ Verification query failed:', queryError.message)
      return false
    }

    console.log('✅ Available assistants for task assignment:')
    assistants.forEach((a, index) => {
      console.log(`  ${index + 1}. ${a.full_name} (ID: ${a.id})`)
    })

    if (assistants.length >= 2) {
      console.log('\n🎉 Successfully created second assistant!')
      console.log('Now you have multiple assistants to test task assignment with.')
    }

    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

createSecondAssistant()
  .then((success) => {
    if (success) {
      console.log('\n✅ Second assistant creation completed successfully!')
      console.log('You can now test task assignment with multiple assistants.')
      process.exit(0)
    } else {
      console.log('\n❌ Assistant creation failed')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Assistant creation failed:', error)
    process.exit(1)
  })