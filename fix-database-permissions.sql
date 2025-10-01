-- ==========================================
-- FIX DATABASE PERMISSIONS FOR ENDOFLOW
-- Run this in Supabase SQL Editor
-- ==========================================

-- First, make sure the profiles table exists and has proper RLS
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('patient', 'assistant', 'dentist')) NOT NULL,
    status TEXT CHECK (status IN ('active', 'pending', 'inactive')) NOT NULL DEFAULT 'pending',
    full_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS profiles_read_own ON public.profiles;
DROP POLICY IF EXISTS profiles_service_read ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_service_update ON public.profiles;

-- Allow users to read their own profile
CREATE POLICY profiles_read_own ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Allow service role to read all profiles (for server-side operations)
CREATE POLICY profiles_service_read ON public.profiles
    FOR SELECT USING (auth.role() = 'service_role');

-- Allow users to insert their own profile during signup
CREATE POLICY profiles_insert_own ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow service role to update profiles (for verification process)
CREATE POLICY profiles_service_update ON public.profiles
    FOR UPDATE USING (auth.role() = 'service_role');

-- ==========================================
-- FIX PENDING REGISTRATIONS PERMISSIONS
-- ==========================================

-- Allow anyone to insert pending registrations (for signup)
DROP POLICY IF EXISTS pending_reg_insert ON api.pending_registrations;
CREATE POLICY pending_reg_insert ON api.pending_registrations
    FOR INSERT WITH CHECK (true);

-- Allow assistants to read all pending registrations (for verification workflow)
DROP POLICY IF EXISTS pending_reg_service_read ON api.pending_registrations;
CREATE POLICY pending_reg_assistant_read ON api.pending_registrations
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM api.assistants
            WHERE id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'assistant' AND status = 'active'
        )
    );

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS pending_reg_service_update ON api.pending_registrations;
DROP POLICY IF EXISTS pending_reg_service_delete ON api.pending_registrations;

-- Allow service role to update and delete pending registrations (for approval/rejection)
CREATE POLICY pending_reg_service_update ON api.pending_registrations
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY pending_reg_service_delete ON api.pending_registrations
    FOR DELETE USING (auth.role() = 'service_role');

-- ==========================================
-- ENSURE API TABLES HAVE PROPER PERMISSIONS
-- ==========================================

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS patients_service_insert ON api.patients;
DROP POLICY IF EXISTS assistants_service_insert ON api.assistants;
DROP POLICY IF EXISTS dentists_service_insert ON api.dentists;

-- Allow service role to insert into api tables (for patient approval process)
CREATE POLICY patients_service_insert ON api.patients
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY assistants_service_insert ON api.assistants
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY dentists_service_insert ON api.dentists
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ==========================================
-- CREATE TEST DATA
-- ==========================================

-- Insert a test pending registration to verify the system works
INSERT INTO api.pending_registrations (form_data, status) 
VALUES (
    '{"firstName":"John","lastName":"Doe","email":"john.doe@test.com","phone":"555-0123","password":"testpass123","role":"patient"}',
    'pending'
) ON CONFLICT DO NOTHING;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Check if all tables exist
SELECT 'Tables Check' as check_type, table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('api', 'public') 
AND table_name IN ('profiles', 'pending_registrations', 'patients', 'assistants', 'dentists')
ORDER BY table_schema, table_name;

-- Check RLS policies
SELECT 'RLS Policies' as check_type, schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname IN ('api', 'public') 
AND tablename IN ('profiles', 'pending_registrations', 'patients', 'assistants', 'dentists')
ORDER BY schemaname, tablename;

-- Check pending registrations data
SELECT 'Pending Registrations Data' as check_type, id, 
       LEFT(form_data, 50) as form_data_preview,
       status, submitted_at
FROM api.pending_registrations
ORDER BY submitted_at DESC;