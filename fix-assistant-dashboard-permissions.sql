-- ==========================================
-- FIX ASSISTANT DASHBOARD PERMISSIONS
-- Run this in Supabase SQL Editor to fix assistant access to pending registrations
-- ==========================================

-- First, let's ensure the api.pending_registrations table exists and has proper structure
CREATE SCHEMA IF NOT EXISTS api;

-- Create the pending_registrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS api.pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_data JSONB NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending'
);

-- Enable RLS on the api.pending_registrations table
ALTER TABLE api.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS pending_reg_insert ON api.pending_registrations;
DROP POLICY IF EXISTS pending_reg_assistant_read ON api.pending_registrations;
DROP POLICY IF EXISTS pending_reg_service_read ON api.pending_registrations;
DROP POLICY IF EXISTS pending_reg_service_update ON api.pending_registrations;
DROP POLICY IF EXISTS pending_reg_service_delete ON api.pending_registrations;

-- Allow anyone to insert pending registrations (for signup)
-- This allows new users to create registration entries
CREATE POLICY pending_reg_insert ON api.pending_registrations
    FOR INSERT WITH CHECK (true);

-- Allow assistants and service role to read all pending registrations
-- This is the key policy for the assistant dashboard
CREATE POLICY pending_reg_read ON api.pending_registrations
    FOR SELECT USING (
        -- Allow service role (for server-side operations)
        auth.role() = 'service_role' OR
        -- Allow authenticated assistants to read pending registrations
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role = 'assistant' 
            AND status = 'active'
        )
    );

-- Allow service role to update pending registrations (for approval/rejection process)
CREATE POLICY pending_reg_service_update ON api.pending_registrations
    FOR UPDATE USING (auth.role() = 'service_role');

-- Allow service role to delete pending registrations (cleanup)
CREATE POLICY pending_reg_service_delete ON api.pending_registrations
    FOR DELETE USING (auth.role() = 'service_role');

-- ==========================================
-- ENSURE PROFILES TABLE HAS PROPER POLICIES FOR ASSISTANTS
-- ==========================================

-- Drop existing assistant-related policies on profiles
DROP POLICY IF EXISTS profiles_assistant_read ON public.profiles;

-- Allow assistants to read all profiles (needed for verification workflow)
CREATE POLICY profiles_assistant_read ON public.profiles
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles assistant
            WHERE assistant.id = auth.uid() 
            AND assistant.role = 'assistant' 
            AND assistant.status = 'active'
        )
    );

-- ==========================================
-- CREATE A VIEW FOR EASIER ASSISTANT DASHBOARD ACCESS
-- ==========================================

-- Create a view that combines pending data from both tables
CREATE OR REPLACE VIEW api.assistant_pending_view AS
SELECT 
    p.id,
    p.full_name,
    p.role,
    p.status,
    p.created_at,
    'profiles' as source_table,
    NULL as form_data,
    NULL as submitted_at
FROM public.profiles p
WHERE p.role = 'patient' AND p.status = 'pending'

UNION ALL

SELECT 
    pr.id,
    COALESCE(
        (pr.form_data::jsonb)->>'full_name',
        CONCAT((pr.form_data::jsonb)->>'firstName', ' ', (pr.form_data::jsonb)->>'lastName'),
        'Unknown User'
    ) as full_name,
    COALESCE((pr.form_data::jsonb)->>'role', 'patient') as role,
    pr.status,
    pr.submitted_at as created_at,
    'pending_registrations' as source_table,
    pr.form_data::jsonb as form_data,
    pr.submitted_at
FROM api.pending_registrations pr
WHERE pr.status = 'pending';

-- Grant access to the view
GRANT SELECT ON api.assistant_pending_view TO authenticated;

-- ==========================================
-- TEST THE POLICIES
-- ==========================================

-- Test 1: Check if we can read from api.pending_registrations
SELECT 'TEST: Can read pending_registrations' as test_name, COUNT(*) as count
FROM api.pending_registrations
WHERE status = 'pending';

-- Test 2: Check if we can read from profiles
SELECT 'TEST: Can read profiles' as test_name, COUNT(*) as count
FROM public.profiles
WHERE role = 'patient' AND status = 'pending';

-- Test 3: Check the combined view
SELECT 'TEST: Can read assistant_pending_view' as test_name, COUNT(*) as count
FROM api.assistant_pending_view;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Show current pending registrations from both sources
SELECT 
    'PENDING REGISTRATIONS' as source,
    id,
    CASE 
        WHEN source_table = 'profiles' THEN full_name
        ELSE CONCAT((form_data::jsonb)->>'firstName', ' ', (form_data::jsonb)->>'lastName')
    END as display_name,
    status,
    created_at,
    source_table
FROM api.assistant_pending_view
ORDER BY created_at DESC;

-- Show RLS policies that are now active
SELECT 
    'ACTIVE RLS POLICIES' as info_type,
    schemaname, 
    tablename, 
    policyname, 
    cmd as command,
    permissive,
    roles
FROM pg_policies 
WHERE schemaname IN ('api', 'public') 
AND tablename IN ('pending_registrations', 'profiles')
ORDER BY schemaname, tablename, policyname;