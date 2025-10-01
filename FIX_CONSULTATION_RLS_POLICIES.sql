-- =============================================
-- ENDOFLOW - FIX CONSULTATION RLS POLICIES
-- =============================================
-- This script fixes the Row Level Security policies to allow proper access
-- Run this in your Supabase SQL Editor to enable consultation functionality

-- =============================================
-- 1. DROP EXISTING PROBLEMATIC POLICIES
-- =============================================
-- Drop existing policies that might be blocking access
DO $$
BEGIN
    -- Drop consultation policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'api' AND tablename = 'consultations' AND policyname = 'Staff can manage tooth diagnoses') THEN
        DROP POLICY "Staff can manage tooth diagnoses" ON api.consultations;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'api' AND tablename = 'consultations' AND policyname = 'Dentists can create consultations') THEN
        DROP POLICY "Dentists can create consultations" ON api.consultations;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'api' AND tablename = 'consultations' AND policyname = 'Dentists can view their consultations') THEN
        DROP POLICY "Dentists can view their consultations" ON api.consultations;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'api' AND tablename = 'consultations' AND policyname = 'Dentists can update their consultations') THEN
        DROP POLICY "Dentists can update their consultations" ON api.consultations;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'api' AND tablename = 'consultations' AND policyname = 'Patients can view their consultations') THEN
        DROP POLICY "Patients can view their consultations" ON api.consultations;
    END IF;

    -- Drop tooth diagnoses policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'api' AND tablename = 'tooth_diagnoses' AND policyname = 'Staff can manage tooth diagnoses') THEN
        DROP POLICY "Staff can manage tooth diagnoses" ON api.tooth_diagnoses;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'api' AND tablename = 'tooth_diagnoses' AND policyname = 'Patients can view their tooth diagnoses') THEN
        DROP POLICY "Patients can view their tooth diagnoses" ON api.tooth_diagnoses;
    END IF;

    RAISE NOTICE 'Existing policies dropped successfully';
END $$;

-- =============================================
-- 2. CREATE PROPER RLS POLICIES FOR CONSULTATIONS
-- =============================================

-- Allow service role full access (for server actions)
CREATE POLICY "Service role full access to consultations" ON api.consultations
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Dentists can create consultations
CREATE POLICY "Dentists can create consultations" ON api.consultations
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
);

-- Staff can view consultations (dentists see all, assistants see all)
CREATE POLICY "Staff can view consultations" ON api.consultations
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('dentist', 'assistant')
        AND status = 'active'
    )
);

-- Dentists can update consultations
CREATE POLICY "Dentists can update consultations" ON api.consultations
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
);

-- Patients can view their own consultations
CREATE POLICY "Patients can view their own consultations" ON api.consultations
FOR SELECT TO authenticated
USING (
    patient_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'patient'
        AND status = 'active'
    )
);

-- =============================================
-- 3. CREATE PROPER RLS POLICIES FOR TOOTH DIAGNOSES
-- =============================================

-- Allow service role full access (for server actions)
CREATE POLICY "Service role full access to tooth diagnoses" ON api.tooth_diagnoses
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Staff can manage tooth diagnoses
CREATE POLICY "Staff can manage tooth diagnoses" ON api.tooth_diagnoses
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('dentist', 'assistant')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('dentist', 'assistant')
        AND status = 'active'
    )
);

-- Patients can view their own tooth diagnoses
CREATE POLICY "Patients can view their own tooth diagnoses" ON api.tooth_diagnoses
FOR SELECT TO authenticated
USING (
    patient_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'patient'
        AND status = 'active'
    )
);

-- =============================================
-- 4. ENSURE RLS IS ENABLED
-- =============================================
ALTER TABLE api.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. CREATE HELPFUL FUNCTIONS FOR CONSULTATION ACCESS
-- =============================================

-- Function to check if user can access consultation data
CREATE OR REPLACE FUNCTION api.can_access_consultations(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id
        AND role IN ('dentist', 'assistant')
        AND status = 'active'
    );
END;
$$;

-- =============================================
-- 6. GRANT NECESSARY PERMISSIONS
-- =============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO service_role;

-- Grant table permissions
GRANT ALL ON api.consultations TO service_role;
GRANT ALL ON api.tooth_diagnoses TO service_role;

GRANT SELECT, INSERT, UPDATE ON api.consultations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.tooth_diagnoses TO authenticated;

-- =============================================
-- 7. VERIFICATION SCRIPT
-- =============================================
DO $$
DECLARE
    policy_count integer;
BEGIN
    -- Count policies on consultations table
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'consultations';

    RAISE NOTICE 'Consultations table has % policies', policy_count;

    -- Count policies on tooth_diagnoses table
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'tooth_diagnoses';

    RAISE NOTICE 'Tooth_diagnoses table has % policies', policy_count;

    RAISE NOTICE 'RLS policy fix completed successfully!';
END $$;