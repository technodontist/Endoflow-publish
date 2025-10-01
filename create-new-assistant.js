const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createNewAssistant(fullName, email = null) {
  console.log(`🏥 Creating new assistant: ${fullName}...`)

  try {
    // Step 1: Create a user in auth.users (if email provided)
    let userId = null

    if (email) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: 'temppassword123', // They can change this later
        email_confirm: true
      })

      if (authError) {
        console.error('❌ Auth user creation error:', authError.message)
        return false
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
        full_name: fullName,
        role: 'assistant',
        status: 'active'
      })
      .select()
      .single()

    if (profileError) {
      console.error('❌ Profile creation error:', profileError.message)
      return false
    }

    console.log('✅ Created profile:', profile)

    // Step 3: Create assistant-specific entry
    const { data: assistant, error: assistantError } = await supabase
      .schema('api')
      .from('assistants')
      .insert({
        id: userId,
        full_name: fullName
      })
      .select()
      .single()

    if (assistantError) {
      console.log('⚠️ Assistant table entry error (this is optional):', assistantError.message)
    } else {
      console.log('✅ Created assistant entry:', assistant)
    }

    console.log(`🎉 Successfully created assistant: ${fullName}`)
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Get assistant name from command line args or use default
const assistantName = process.argv[2] || 'New Assistant User'
const assistantEmail = process.argv[3] || null

console.log('🔧 Creating new assistant...')
console.log(`Name: ${assistantName}`)
console.log(`Email: ${assistantEmail || 'None (profile only)'}`)

createNewAssistant(assistantName, assistantEmail)
  .then((success) => {
    if (success) {
      console.log('\n✅ Assistant creation completed successfully')
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