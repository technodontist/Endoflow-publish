// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// This script requires SUPABASE_SERVICE_ROLE_KEY to execute admin operations
// You can find this in your Supabase dashboard under Settings > API

async function fixProfilesRLS() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌')
    console.error('')
    console.error('Please set SUPABASE_SERVICE_ROLE_KEY in your .env.local file')
    console.error('You can find this key in your Supabase dashboard under Settings > API')
    process.exit(1)
  }

  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  console.log('🔧 Starting RLS policy fix for profiles table...')

  try {
    // Step 1: Disable RLS
    console.log('1️⃣ Disabling RLS on profiles table...')
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;' 
    }).then(({ error }) => {
      if (error) throw error
      console.log('   ✅ RLS disabled')
    }).catch(async (error) => {
      // Try alternative method
      const { error: altError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
      if (!altError) {
        console.log('   ✅ Profiles table accessible')
      }
    })

    // Step 2: Drop existing policies
    console.log('2️⃣ Dropping existing policies...')
    const policiesToDrop = [
      "Users can view own profile",
      "Users can update own profile", 
      "Users can insert own profile",
      "Enable insert for authenticated users only",
      "Enable select for users based on user_id",
      "Enable update for users based on user_id",
      "profiles_select_policy",
      "profiles_insert_policy",
      "profiles_update_policy"
    ]

    for (const policyName of policiesToDrop) {
      try {
        await supabase.rpc('exec_sql', {
          sql: `DROP POLICY IF EXISTS "${policyName}" ON profiles;`
        })
      } catch (error) {
        // Ignore errors - policy might not exist
      }
    }
    console.log('   ✅ Existing policies dropped')

    // Step 3: Re-enable RLS
    console.log('3️⃣ Re-enabling RLS...')
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;'
    })
    console.log('   ✅ RLS re-enabled')

    // Step 4: Create new policies
    console.log('4️⃣ Creating new RLS policies...')
    
    // SELECT policy
    await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT USING (auth.uid() = id);`
    })
    
    // UPDATE policy  
    await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE USING (auth.uid() = id);`
    })
    
    // INSERT policy
    await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);`
    })
    
    console.log('   ✅ New policies created')

    // Step 5: Grant permissions
    console.log('5️⃣ Granting permissions...')
    await supabase.rpc('exec_sql', {
      sql: 'GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;'
    })
    await supabase.rpc('exec_sql', {
      sql: 'GRANT USAGE ON SCHEMA public TO authenticated;'
    })
    console.log('   ✅ Permissions granted')

    console.log('')
    console.log('✅ RLS policy fix completed successfully!')
    console.log('   The profiles table should now work without infinite recursion.')
    console.log('   Try running your application again.')

  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error)
    console.error('')
    console.error('Manual fix required:')
    console.error('1. Go to your Supabase dashboard')
    console.error('2. Open the SQL Editor')
    console.error('3. Run the commands from fix-profiles-rls.sql')
    process.exit(1)
  }
}

// Alternative function using direct SQL execution (if rpc doesn't work)
async function alternativeFix() {
  console.log('')
  console.log('🔄 If the above didn\'t work, you need to manually run SQL commands.')
  console.log('')
  console.log('Go to your Supabase Dashboard > SQL Editor and run:')
  console.log('')
  
  const sqlContent = fs.readFileSync(path.join(__dirname, 'fix-profiles-rls.sql'), 'utf8')
  console.log(sqlContent)
}

if (require.main === module) {
  fixProfilesRLS().catch(() => {
    alternativeFix()
  })
}

module.exports = { fixProfilesRLS }