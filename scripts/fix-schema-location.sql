-- Fix: Create the view in both api and public schemas to resolve the schema cache error
-- Run this in Supabase SQL Editor

-- 1. Drop existing view if it exists
DROP VIEW IF EXISTS api.pending_patient_verifications;
DROP VIEW IF EXISTS public.pending_patient_verifications;

-- 2. Create the view in the PUBLIC schema (where the code is looking for it)
CREATE OR REPLACE VIEW public.pending_patient_verifications AS
SELECT
    pr.id as registration_id,
    pr.user_id,
    pr.form_data,
    pr.submitted_at,
    pr.status as registration_status,
    p.full_name,
    p.status as profile_status,
    p.created_at as profile_created_at,
    u.email,
    u.created_at as user_created_at,
    -- Extract key info from form_data JSON
    (pr.form_data::json->>'firstName') as first_name,
    (pr.form_data::json->>'lastName') as last_name,
    (pr.form_data::json->>'phone') as phone
FROM api.pending_registrations pr
LEFT JOIN public.profiles p ON pr.user_id = p.id
LEFT JOIN auth.users u ON pr.user_id = u.id
WHERE pr.status = 'pending'
AND p.role = 'patient'
ORDER BY pr.submitted_at DESC;

-- 3. Also create it in API schema for consistency
CREATE OR REPLACE VIEW api.pending_patient_verifications AS
SELECT * FROM public.pending_patient_verifications;

-- 4. Grant proper permissions to both views
GRANT SELECT ON public.pending_patient_verifications TO authenticated;
GRANT SELECT ON public.pending_patient_verifications TO service_role;
GRANT SELECT ON api.pending_patient_verifications TO authenticated;
GRANT SELECT ON api.pending_patient_verifications TO service_role;

-- 5. Test both views work
SELECT 'Public view test' as test_name, COUNT(*) as count FROM public.pending_patient_verifications
UNION ALL
SELECT 'API view test' as test_name, COUNT(*) as count FROM api.pending_patient_verifications;