-- ==========================================
-- DEBUG PENDING REGISTRATIONS ISSUE
-- Run this in Supabase SQL Editor to diagnose the problem
-- ==========================================

-- 1. Check current data in profiles table
SELECT 'PROFILES TABLE' as table_name, 
       id, role, status, full_name, created_at
FROM public.profiles 
WHERE role = 'patient'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check current data in pending_registrations table
SELECT 'PENDING_REGISTRATIONS TABLE' as table_name,
       id, 
       LEFT(form_data, 100) as form_data_preview,
       status, 
       submitted_at
FROM api.pending_registrations 
ORDER BY submitted_at DESC
LIMIT 10;

-- 3. Check for pending patients in profiles table
SELECT 'PENDING PATIENTS IN PROFILES' as check_type,
       COUNT(*) as count,
       ARRAY_AGG(full_name) as names
FROM public.profiles 
WHERE role = 'patient' AND status = 'pending';

-- 4. Check for pending registrations in pending_registrations table
SELECT 'PENDING IN PENDING_REGISTRATIONS' as check_type,
       COUNT(*) as count,
       ARRAY_AGG(id) as registration_ids
FROM api.pending_registrations 
WHERE status = 'pending';

-- 5. Check RLS policies on profiles table
SELECT 'PROFILES RLS POLICIES' as check_type,
       schemaname, tablename, policyname, 
       cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 6. Check RLS policies on pending_registrations table
SELECT 'PENDING_REGISTRATIONS RLS POLICIES' as check_type,
       schemaname, tablename, policyname, 
       cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE schemaname = 'api' AND tablename = 'pending_registrations';

-- 7. Check if RLS is enabled on both tables
SELECT 'RLS STATUS' as check_type,
       schemaname, tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname IN ('public', 'api') 
AND tablename IN ('profiles', 'pending_registrations');

-- 8. Test assistant permissions by checking what they can see
-- This simulates what the assistant dashboard query should return
SELECT 'ASSISTANT VIEW TEST' as check_type,
       'profiles' as source_table,
       id, full_name, status, created_at
FROM public.profiles 
WHERE role = 'patient' AND status = 'pending';

-- 9. Test pending_registrations visibility
SELECT 'ASSISTANT VIEW TEST' as check_type,
       'pending_registrations' as source_table,
       id, status, submitted_at,
       LEFT(form_data, 50) as form_data_preview
FROM api.pending_registrations 
WHERE status = 'pending';

-- 10. Check auth.users table for any auth-related issues
SELECT 'AUTH USERS CHECK' as check_type,
       au.id, au.email, au.created_at as auth_created,
       p.full_name, p.status, p.created_at as profile_created
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.created_at > NOW() - INTERVAL '7 days'
ORDER BY au.created_at DESC
LIMIT 10;