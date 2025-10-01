require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function fixMissingProfile() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌')
    console.error('')
    console.error('Using anon key as fallback...')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  console.log('🔍 Checking for missing profile records...')

  try {
    // First, let's check all auth users
    console.log('1️⃣ Fetching all auth users...')
    
    // We'll use a SQL query to check both auth.users and profiles tables
    const { data: usersWithoutProfiles, error: queryError } = await supabase
      .rpc('get_users_without_profiles')
      .catch(async () => {
        // Fallback: manually check profiles table
        console.log('   Fallback: Checking profiles table directly...')
        return await supabase.from('profiles').select('*')
      })

    if (queryError && !usersWithoutProfiles) {
      console.error('❌ Error querying database:', queryError)
      console.log('')
      console.log('Manual fix required:')
      console.log('1. Go to your Supabase Dashboard')
      console.log('2. Go to Authentication > Users')
      console.log('3. Note the user ID: 75f070da-1019-4412-8af3-6e66086b9818')
      console.log('4. Go to Database > Table Editor > profiles table')
      console.log('5. Check if a record exists with that ID')
      console.log('6. If not, create a new record with:')
      console.log('   - id: 75f070da-1019-4412-8af3-6e66086b9818')
      console.log('   - email: assistant1@endoflow.com')
      console.log('   - role: assistant (or appropriate role)')
      console.log('   - status: active')
      console.log('   - full_name: Assistant User (or appropriate name)')
      return
    }

    // Let's specifically create a profile for the user we know exists
    const userId = '75f070da-1019-4412-8af3-6e66086b9818'
    const email = 'assistant1@endoflow.com'

    console.log('2️⃣ Creating profile for user:', userId)

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        first_name: 'Assistant',
        last_name: 'User',
        phone: '+1234567890', // Default phone
        role: 'assistant',
        status: 'active', // Make them active immediately
        full_name: 'Assistant User'
      })

    if (insertError) {
      if (insertError.code === '23505') {
        console.log('✅ Profile already exists for this user')
        
        // Maybe the profile exists but has wrong status - let's update it
        console.log('3️⃣ Updating profile status to active...')
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ status: 'active' })
          .eq('id', userId)

        if (updateError) {
          console.error('❌ Error updating profile status:', updateError)
        } else {
          console.log('✅ Profile status updated to active')
        }
      } else {
        console.error('❌ Error creating profile:', insertError)
        console.log('')
        console.log('Manual fix required - run this SQL in your Supabase Dashboard:')
        console.log(`
INSERT INTO profiles (id, email, first_name, last_name, phone, role, status, full_name)
VALUES (
  '${userId}',
  '${email}',
  'Assistant',
  'User', 
  '+1234567890',
  'assistant',
  'active',
  'Assistant User'
)
ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  role = 'assistant';`)
        return
      }
    } else {
      console.log('✅ Profile created successfully')
    }

    console.log('')
    console.log('✅ Profile fix completed!')
    console.log('   Try logging in again - the error should be resolved.')

  } catch (error) {
    console.error('❌ Error fixing profile:', error)
    console.log('')
    console.log('Manual fix required:')
    console.log('1. Go to your Supabase Dashboard > Database > Table Editor')
    console.log('2. Open the profiles table')
    console.log('3. Click "Insert row" and add:')
    console.log('   - id: 75f070da-1019-4412-8af3-6e66086b9818')
    console.log('   - email: assistant1@endoflow.com')
    console.log('   - first_name: Assistant')
    console.log('   - last_name: User')
    console.log('   - phone: +1234567890')
    console.log('   - role: assistant')
    console.log('   - status: active')
    console.log('   - full_name: Assistant User')
  }
}

if (require.main === module) {
  fixMissingProfile()
}

module.exports = { fixMissingProfile }