-- ==========================================
-- FIX INFINITE RECURSION IN PROFILES TABLE
-- Run this in Supabase SQL Editor
-- ==========================================

-- The issue is in the pending_reg_assistant_read policy which references profiles table
-- This creates circular dependency when querying profiles

-- First, let's drop all problematic policies on pending_registrations that reference profiles
DROP POLICY IF EXISTS pending_reg_assistant_read ON api.pending_registrations;

-- Recreate the policy without referencing profiles table to avoid recursion
-- Instead, we'll use a simpler approach that checks if the user is authenticated
-- and has the assistant role through raw user metadata or JWT claims
CREATE POLICY pending_reg_assistant_read ON api.pending_registrations
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant' OR
        (auth.jwt() ->> 'role') = 'assistant'
    );

-- Alternative approach: Let's also ensure profiles table policies are clean
-- Drop any potentially problematic policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;  
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_read_own ON public.profiles;
DROP POLICY IF EXISTS profiles_service_read ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_service_update ON public.profiles;

-- Recreate simple, non-recursive policies for profiles
CREATE POLICY profiles_read_own ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_service_all ON public.profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Allow users to insert their own profile
CREATE POLICY profiles_insert_own ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ==========================================
-- VERIFICATION
-- ==========================================

-- Check current policies to ensure no circular references
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname IN ('api', 'public') 
  AND tablename IN ('profiles', 'pending_registrations')
ORDER BY schemaname, tablename, policyname;

-- Test query that was failing
SELECT 'Testing profiles query...' as status;
SELECT id, role, status, full_name FROM public.profiles LIMIT 1;