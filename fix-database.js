const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pxpfbeqlqqrjpkiqlxmi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGZiZXFscXFyanBraXFseG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzg0MjcsImV4cCI6MjA3Mjc1NDQyN30.aq2B4BmbDDHXdxCi4_6orgOjEN3Q30vdW74F7O851qk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixInfiniteRecursion() {
    console.log('🔧 Starting database fix for infinite recursion...');
    
    try {
        // Drop problematic policies
        console.log('1. Dropping problematic policies...');
        
        const dropPolicies = `
            DROP POLICY IF EXISTS pending_reg_assistant_read ON api.pending_registrations;
            DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
            DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;  
            DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
            DROP POLICY IF EXISTS profiles_read_own ON public.profiles;
            DROP POLICY IF EXISTS profiles_service_read ON public.profiles;
            DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
            DROP POLICY IF EXISTS profiles_service_update ON public.profiles;
        `;
        
        const { error: dropError } = await supabase.rpc('exec_sql', { sql: dropPolicies });
        if (dropError) {
            console.log('Note: Some policies may not exist, continuing...', dropError);
        }
        
        // Recreate clean policies
        console.log('2. Creating clean policies...');
        
        const createPolicies = `
            -- Non-recursive policy for pending registrations
            CREATE POLICY pending_reg_assistant_read ON api.pending_registrations
                FOR SELECT USING (
                    auth.role() = 'service_role' OR
                    auth.jwt() ->> 'role' = 'assistant'
                );
            
            -- Simple policies for profiles
            CREATE POLICY profiles_read_own ON public.profiles
                FOR SELECT USING (auth.uid() = id);

            CREATE POLICY profiles_service_all ON public.profiles
                FOR ALL USING (auth.role() = 'service_role');

            CREATE POLICY profiles_insert_own ON public.profiles
                FOR INSERT WITH CHECK (auth.uid() = id);

            CREATE POLICY profiles_update_own ON public.profiles
                FOR UPDATE USING (auth.uid() = id);
        `;
        
        const { error: createError } = await supabase.rpc('exec_sql', { sql: createPolicies });
        if (createError) {
            console.error('❌ Error creating policies:', createError);
            return;
        }
        
        // Test the fix
        console.log('3. Testing the fix...');
        const { data, error } = await supabase
            .from('profiles')
            .select('id, role, status, full_name')
            .limit(1);
            
        if (error) {
            console.error('❌ Test failed:', error);
        } else {
            console.log('✅ Test successful! Profiles can be queried:', data);
            console.log('✅ Infinite recursion issue fixed!');
        }
        
    } catch (error) {
        console.error('❌ Script error:', error);
    }
}

// Alternative approach: Use raw SQL queries if RPC doesn't work
async function fixWithRawSQL() {
    console.log('🔧 Attempting fix with raw SQL queries...');
    
    const queries = [
        "DROP POLICY IF EXISTS pending_reg_assistant_read ON api.pending_registrations;",
        "DROP POLICY IF EXISTS profiles_read_own ON public.profiles;",
        "DROP POLICY IF EXISTS profiles_service_read ON public.profiles;",
        "DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;",
        "DROP POLICY IF EXISTS profiles_service_update ON public.profiles;",
        `CREATE POLICY profiles_read_own ON public.profiles FOR SELECT USING (auth.uid() = id);`,
        `CREATE POLICY profiles_service_all ON public.profiles FOR ALL USING (auth.role() = 'service_role');`,
        `CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);`,
        `CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);`
    ];
    
    for (const query of queries) {
        try {
            console.log('Executing:', query.substring(0, 50) + '...');
            const { error } = await supabase.from('_temp_').select().limit(0); // This won't work for DDL
            // We need a different approach
        } catch (e) {
            console.log('Query execution approach not working directly');
        }
    }
}

// Run the fix
fixInfiniteRecursion().then(() => {
    console.log('Script completed');
    process.exit(0);
}).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});