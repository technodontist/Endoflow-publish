-- ==========================================
-- FIX VERIFY BUTTON STATUS UPDATE ISSUE
-- Run this in Supabase SQL Editor to diagnose and fix RLS policies
-- that prevent the verify button from updating patient status to 'active'
-- ==========================================

-- SECTION 1: DIAGNOSTIC QUERIES
-- ==========================================

-- 1.1 Check current RLS policies on profiles table
SELECT
    'CURRENT RLS POLICIES ON PROFILES' as info_type,
    schemaname,
    tablename,
    policyname,
    cmd as command,
    permissive,
    roles,
    qual as condition
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 1.2 Check if RLS is enabled on profiles table
SELECT
    'RLS STATUS' as info_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 1.3 Check service role permissions
SELECT
    'SERVICE ROLE INFO' as info_type,
    rolname,
    rolsuper,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin,
    rolbypassrls
FROM pg_roles
WHERE rolname = 'service_role';

-- 1.4 Check current pending patients
SELECT
    'CURRENT PENDING PATIENTS' as info_type,
    id,
    full_name,
    email,
    role,
    status,
    created_at
FROM public.profiles
WHERE role = 'patient' AND status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- 1.5 Test current permissions (this will show if service role can update)
-- Note: This is a test query, comment out if you don't want to actually update
-- UPDATE public.profiles
-- SET status = 'active'
-- WHERE role = 'patient' AND status = 'pending'
-- LIMIT 1;

-- SECTION 2: FIX RLS POLICIES
-- ==========================================

-- 2.1 Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_assistant_read" ON public.profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON public.profiles;
DROP POLICY IF EXISTS "users_own_profile" ON public.profiles;

-- 2.2 Temporarily disable RLS to clear any issues
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2.3 Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2.4 Create new, properly structured policies

-- Service role gets full access (critical for verification system)
CREATE POLICY "service_role_full_access" ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can view and update their own profile
CREATE POLICY "users_own_profile_select" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "users_own_profile_update" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow authenticated users to insert their own profile (for signup)
CREATE POLICY "users_own_profile_insert" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow assistants to read all profiles (needed for verification workflow)
CREATE POLICY "assistants_read_all_profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles assistant_profile
            WHERE assistant_profile.id = auth.uid()
            AND assistant_profile.role = 'assistant'
            AND assistant_profile.status = 'active'
        )
    );

-- 2.5 Grant explicit permissions to service role
GRANT ALL PRIVILEGES ON public.profiles TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- SECTION 3: VERIFICATION TESTS
-- ==========================================

-- 3.1 Test if policies are working
SELECT
    'UPDATED RLS POLICIES' as info_type,
    schemaname,
    tablename,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 3.2 Show current pending patients again
SELECT
    'PATIENTS READY FOR VERIFICATION' as info_type,
    id,
    full_name,
    email,
    role,
    status,
    created_at
FROM public.profiles
WHERE role = 'patient' AND status = 'pending'
ORDER BY created_at DESC;

-- 3.3 Test update capability (uncomment to test)
-- This should work now with service role
-- UPDATE public.profiles
-- SET updated_at = NOW()
-- WHERE role = 'patient' AND status = 'pending'
-- LIMIT 1;

-- SECTION 4: ADDITIONAL FIXES
-- ==========================================

-- 4.1 Ensure api.pending_registrations also has proper policies
ALTER TABLE api.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "pending_reg_insert" ON api.pending_registrations;
DROP POLICY IF EXISTS "pending_reg_read" ON api.pending_registrations;
DROP POLICY IF EXISTS "pending_reg_service_update" ON api.pending_registrations;
DROP POLICY IF EXISTS "pending_reg_service_delete" ON api.pending_registrations;

-- Service role full access
CREATE POLICY "service_role_pending_reg_access" ON api.pending_registrations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow anyone to insert (for signup)
CREATE POLICY "public_insert_pending_reg" ON api.pending_registrations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow assistants to read pending registrations
CREATE POLICY "assistants_read_pending_reg" ON api.pending_registrations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'assistant'
            AND status = 'active'
        )
    );

-- Grant permissions
GRANT ALL PRIVILEGES ON api.pending_registrations TO service_role;
GRANT USAGE ON SCHEMA api TO service_role;

-- SECTION 5: FINAL STATUS
-- ==========================================

SELECT
    'SETUP COMPLETE' as status,
    'Run the verification workflow now' as next_step,
    NOW() as completed_at;

-- Show summary of what was fixed
SELECT
    'SUMMARY OF CHANGES' as info_type,
    'Dropped all existing RLS policies' as change_1,
    'Created service_role_full_access policy' as change_2,
    'Created user-specific policies' as change_3,
    'Granted explicit permissions to service_role' as change_4,
    'Fixed api.pending_registrations policies' as change_5;