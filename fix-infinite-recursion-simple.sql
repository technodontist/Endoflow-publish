-- ==========================================
-- FIX INFINITE RECURSION IN PROFILES TABLE (SIMPLIFIED)
-- Run this in Supabase SQL Editor
-- ==========================================

-- The issue is in the pending_reg_assistant_read policy which references profiles table
-- This creates circular dependency when querying profiles

-- First, let's drop all problematic policies on pending_registrations that reference profiles
DROP POLICY IF EXISTS pending_reg_assistant_read ON api.pending_registrations;

-- Create a simple policy that allows authenticated users to read pending registrations
-- We'll handle role-based access in the application layer to avoid recursion
CREATE POLICY pending_reg_authenticated_read ON api.pending_registrations
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        auth.uid() IS NOT NULL
    );

-- Clean up profiles table policies to avoid any recursion
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
    'Current Policies' as info,
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname IN ('api', 'public') 
  AND tablename IN ('profiles', 'pending_registrations')
ORDER BY schemaname, tablename, policyname;

-- Test query that was failing
SELECT 'Testing profiles query...' as status;
SELECT count(*) as profile_count FROM public.profiles;