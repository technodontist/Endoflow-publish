-- QUICK FIX: Minimal changes to get verification working immediately
-- Run this in Supabase SQL Editor

-- 1. First, add the user_id column to pending_registrations if it doesn't exist
ALTER TABLE api.pending_registrations
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Update existing records to populate user_id from form_data
UPDATE api.pending_registrations
SET user_id = (form_data::json->>'user_id')::uuid
WHERE user_id IS NULL
AND form_data::json->>'user_id' IS NOT NULL;

-- 3. Create the simplified unified view
CREATE OR REPLACE VIEW api.pending_patient_verifications AS
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

-- 4. Grant permissions
GRANT SELECT ON api.pending_patient_verifications TO authenticated;

-- 5. Remove duplicate FK constraints that are causing conflicts
ALTER TABLE api.appointments DROP CONSTRAINT IF EXISTS appointments_dentist_id_fkey;
ALTER TABLE api.treatments DROP CONSTRAINT IF EXISTS treatments_dentist_id_fkey;

-- 6. Test the view works
SELECT COUNT(*) as pending_count FROM api.pending_patient_verifications;