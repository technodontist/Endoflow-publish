-- =============================================
-- ENDOFLOW - FIX RLS INFINITE RECURSION (CORRECTED)
-- =============================================
-- This script fixes the infinite recursion error in RLS policies
-- AND fixes the "operator does not exist: text ->> unknown" error
-- by properly casting auth.jwt() to json before using ->> operator

-- =============================================
-- 1. DISABLE RLS TEMPORARILY TO CLEAN UP
-- =============================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE api.consultations DISABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_diagnoses DISABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. DROP ALL EXISTING POLICIES
-- =============================================

-- Drop profiles policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
        RAISE NOTICE 'Dropped profiles policy: %', pol.policyname;
    END LOOP;
END $$;

-- Drop consultation policies
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
        RAISE NOTICE 'Dropped consultation policy: %', pol.policyname;
    END LOOP;
END $$;

-- Drop tooth_diagnoses policies
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
        RAISE NOTICE 'Dropped tooth_diagnoses policy: %', pol.policyname;
    END LOOP;
END $$;

-- =============================================
-- 3. CREATE SIMPLE, NON-RECURSIVE POLICIES WITH PROPER CASTING
-- =============================================

-- PROFILES TABLE - Simple policies without recursion
CREATE POLICY "profiles_own_select" ON public.profiles
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_own_update" ON public.profiles
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id);

-- Service role gets full access
CREATE POLICY "profiles_service_role_full" ON public.profiles
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- CONSULTATIONS TABLE - Fixed with proper JSON casting
CREATE POLICY "consultations_service_role_full" ON api.consultations
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Staff can view all consultations (with proper JSON casting)
CREATE POLICY "consultations_staff_select" ON api.consultations
FOR SELECT TO authenticated
USING (
    ((auth.jwt()::json ->> 'user_metadata')::json ->> 'role') IN ('dentist', 'assistant')
    OR
    patient_id = (SELECT auth.uid())
);

-- Only dentists can create/update consultations (with proper JSON casting)
CREATE POLICY "consultations_dentist_insert" ON api.consultations
FOR INSERT TO authenticated
WITH CHECK (
    ((auth.jwt()::json ->> 'user_metadata')::json ->> 'role') = 'dentist'
);

CREATE POLICY "consultations_dentist_update" ON api.consultations
FOR UPDATE TO authenticated
USING (
    ((auth.jwt()::json ->> 'user_metadata')::json ->> 'role') = 'dentist'
);

-- TOOTH DIAGNOSES TABLE - Fixed with proper JSON casting
CREATE POLICY "tooth_diagnoses_service_role_full" ON api.tooth_diagnoses
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Staff can manage tooth diagnoses (with proper JSON casting)
CREATE POLICY "tooth_diagnoses_staff_all" ON api.tooth_diagnoses
FOR ALL TO authenticated
USING (
    ((auth.jwt()::json ->> 'user_metadata')::json ->> 'role') IN ('dentist', 'assistant')
    OR
    patient_id = (SELECT auth.uid())
)
WITH CHECK (
    ((auth.jwt()::json ->> 'user_metadata')::json ->> 'role') IN ('dentist', 'assistant')
);

-- =============================================
-- 4. RE-ENABLE RLS
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. GRANT NECESSARY PERMISSIONS
-- =============================================

-- Grant schema usage
GRANT USAGE ON SCHEMA api TO authenticated, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Grant table permissions
GRANT ALL ON api.consultations TO service_role;
GRANT ALL ON api.tooth_diagnoses TO service_role;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE ON api.consultations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.tooth_diagnoses TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- =============================================
-- 6. VERIFICATION
-- =============================================
DO $$
DECLARE
    profile_policies integer;
    consultation_policies integer;
    tooth_policies integer;
BEGIN
    -- Count policies
    SELECT COUNT(*) INTO profile_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles';

    SELECT COUNT(*) INTO consultation_policies
    FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'consultations';

    SELECT COUNT(*) INTO tooth_policies
    FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'tooth_diagnoses';

    RAISE NOTICE '=========================================';
    RAISE NOTICE 'RLS INFINITE RECURSION FIX COMPLETED!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Profiles table: % policies created', profile_policies;
    RAISE NOTICE 'Consultations table: % policies created', consultation_policies;
    RAISE NOTICE 'Tooth_diagnoses table: % policies created', tooth_policies;
    RAISE NOTICE '';
    RAISE NOTICE 'KEY FIXES APPLIED:';
    RAISE NOTICE '✅ Fixed JSON casting: auth.jwt()::json ->> ''user_metadata''';
    RAISE NOTICE '✅ Added nested JSON casting for role extraction';
    RAISE NOTICE '✅ Used SELECT auth.uid() wrapper for auth.uid() calls';
    RAISE NOTICE '✅ Policies now use simple role checks without recursion';
    RAISE NOTICE '✅ Service role has full access to bypass any issues';
    RAISE NOTICE '=========================================';
END $$;

-- Test the fix by showing current policies
SELECT 
    'CURRENT POLICIES AFTER FIX' as status,
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname IN ('public', 'api') 
AND tablename IN ('profiles', 'consultations', 'tooth_diagnoses')
ORDER BY schemaname, tablename, policyname;