-- =============================================
-- ENDOFLOW - SAFE FIX CONSULTATION RLS POLICIES
-- =============================================
-- This script safely fixes the Row Level Security policies
-- Handles existing policies without errors

-- =============================================
-- 1. SAFELY DROP ALL EXISTING POLICIES
-- =============================================

-- Drop all existing policies on consultations table
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'api' AND tablename = 'consultations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON api.consultations', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Drop all existing policies on tooth_diagnoses table
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'api' AND tablename = 'tooth_diagnoses'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON api.tooth_diagnoses', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- =============================================
-- 2. CREATE SERVICE ROLE POLICIES (HIGHEST PRIORITY)
-- =============================================

-- Service role gets full access to consultations
CREATE POLICY "service_role_full_access_consultations" ON api.consultations
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Service role gets full access to tooth_diagnoses
CREATE POLICY "service_role_full_access_tooth_diagnoses" ON api.tooth_diagnoses
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- 3. CREATE USER POLICIES FOR CONSULTATIONS
-- =============================================

-- Dentists can create consultations
CREATE POLICY "dentists_can_create_consultations" ON api.consultations
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
);

-- Staff (dentists + assistants) can view all consultations
CREATE POLICY "staff_can_view_all_consultations" ON api.consultations
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
CREATE POLICY "dentists_can_update_consultations" ON api.consultations
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'dentist'
        AND status = 'active'
    )
);

-- Patients can view their own consultations only
CREATE POLICY "patients_view_own_consultations" ON api.consultations
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
-- 4. CREATE USER POLICIES FOR TOOTH DIAGNOSES
-- =============================================

-- Staff can fully manage tooth diagnoses
CREATE POLICY "staff_manage_tooth_diagnoses" ON api.tooth_diagnoses
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
CREATE POLICY "patients_view_own_tooth_diagnoses" ON api.tooth_diagnoses
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
-- 5. ENSURE RLS IS ENABLED
-- =============================================
ALTER TABLE api.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. GRANT PERMISSIONS TO ROLES
-- =============================================

-- Grant schema usage
GRANT USAGE ON SCHEMA api TO authenticated, service_role;

-- Grant table permissions
GRANT ALL ON api.consultations TO service_role;
GRANT ALL ON api.tooth_diagnoses TO service_role;

GRANT SELECT, INSERT, UPDATE ON api.consultations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.tooth_diagnoses TO authenticated;

-- =============================================
-- 7. FINAL VERIFICATION
-- =============================================
DO $$
DECLARE
    consultation_policies integer;
    tooth_policies integer;
BEGIN
    -- Count policies
    SELECT COUNT(*) INTO consultation_policies
    FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'consultations';

    SELECT COUNT(*) INTO tooth_policies
    FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'tooth_diagnoses';

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'RLS POLICY FIX COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Consultations table: % policies created', consultation_policies;
    RAISE NOTICE 'Tooth_diagnoses table: % policies created', tooth_policies;
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Test the consultation save functionality';
    RAISE NOTICE 'Run: node test-complete-integration.js';
    RAISE NOTICE '===========================================';
END $$;