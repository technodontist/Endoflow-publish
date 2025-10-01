require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function createProfile() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('URL:', supabaseUrl ? '✅' : '❌')
  console.log('Key:', anonKey ? '✅' : '❌')

  const supabase = createClient(supabaseUrl, anonKey)

  console.log('🚀 Creating profile for assistant1@endoflow.com...')

  const userId = '75f070da-1019-4412-8af3-6e66086b9818'
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        role: 'assistant',
        status: 'active',
        full_name: 'Assistant User'
      })
      .select()

    if (error) {
      if (error.code === '23505') {
        console.log('✅ Profile already exists, updating status...')
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ status: 'active' })
          .eq('id', userId)

        if (updateError) {
          console.error('❌ Update error:', updateError)
        } else {
          console.log('✅ Profile updated to active')
        }
      } else {
        console.error('❌ Insert error:', error)
      }
    } else {
      console.log('✅ Profile created:', data)
    }

  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

createProfile()