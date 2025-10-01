const { createClient } = require('@supabase/supabase-js')

async function debugUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    console.log('🔍 Checking auth.users table...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
    } else {
      console.log('✅ Auth users found:', authUsers.users.length)
      authUsers.users.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id}) - Created: ${user.created_at}`)
      })
    }

    console.log('\n🔍 Checking profiles table...')
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')

    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError)
    } else {
      console.log('✅ Profiles found:', profiles.length)
      profiles.forEach(profile => {
        console.log(`   - ${profile.id} - Role: ${profile.role} - Status: ${profile.status} - Name: ${profile.full_name}`)
      })
    }

    console.log('\n🔍 Checking dentists table...')
    const { data: dentists, error: dentistError } = await supabase
      .from('dentists')
      .select('*')

    if (dentistError) {
      console.error('❌ Error fetching dentists:', dentistError)
    } else {
      console.log('✅ Dentists found:', dentists.length)
      dentists.forEach(dentist => {
        console.log(`   - ID: ${dentist.id} - Name: ${dentist.full_name} - Specialty: ${dentist.specialty}`)
      })
    }

  } catch (error) {
    console.error('🚨 Exception:', error)
  }
}

debugUsers()