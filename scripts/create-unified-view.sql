-- Create the missing unified view that the app is looking for
-- Run this in Supabase SQL Editor to fix the "table not found" error

-- 1. First, ensure user_id column exists in pending_registrations
ALTER TABLE api.pending_registrations
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Update existing records to populate user_id from form_data
UPDATE api.pending_registrations
SET user_id = (form_data::json->>'user_id')::uuid
WHERE user_id IS NULL
AND form_data IS NOT NULL
AND form_data != ''
AND form_data::json->>'user_id' IS NOT NULL;

-- 3. Add FK constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_pending_registrations_auth_users'
    ) THEN
        ALTER TABLE api.pending_registrations
        ADD CONSTRAINT fk_pending_registrations_auth_users
        FOREIGN KEY (user_id) REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Create the unified view that the app expects
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
    -- Extract key info from form_data JSON (safely handle null/empty text)
    CASE
        WHEN pr.form_data IS NOT NULL AND pr.form_data != ''
        THEN pr.form_data::json->>'firstName'
        ELSE NULL
    END as first_name,
    CASE
        WHEN pr.form_data IS NOT NULL AND pr.form_data != ''
        THEN pr.form_data::json->>'lastName'
        ELSE NULL
    END as last_name,
    CASE
        WHEN pr.form_data IS NOT NULL AND pr.form_data != ''
        THEN pr.form_data::json->>'phone'
        ELSE NULL
    END as phone
FROM api.pending_registrations pr
LEFT JOIN public.profiles p ON pr.user_id = p.id
LEFT JOIN auth.users u ON pr.user_id = u.id
WHERE pr.status = 'pending'
AND p.role = 'patient'
ORDER BY pr.submitted_at DESC;

-- 5. Grant proper permissions
GRANT SELECT ON api.pending_patient_verifications TO authenticated;
GRANT SELECT ON api.pending_patient_verifications TO service_role;

-- 6. Test the view works
SELECT
    'View created successfully' as status,
    COUNT(*) as pending_patients_count
FROM api.pending_patient_verifications;