-- Backfill Script: Create missing pending_registrations for existing users
-- Run this AFTER applying the main FK migration

-- This script handles cases where users exist in profiles but not in pending_registrations

-- Step 1: Check current state
SELECT
    'Profiles with pending status' as table_name,
    COUNT(*) as count
FROM public.profiles
WHERE role = 'patient' AND status = 'pending'

UNION ALL

SELECT
    'Pending registrations' as table_name,
    COUNT(*) as count
FROM api.pending_registrations
WHERE status = 'pending';

-- Step 2: Find patients in profiles but missing from pending_registrations
-- (This identifies the disconnect)
SELECT
    p.id,
    p.full_name,
    p.created_at,
    p.status,
    CASE
        WHEN pr.user_id IS NULL THEN 'MISSING from pending_registrations'
        ELSE 'EXISTS in pending_registrations'
    END as registration_status
FROM public.profiles p
LEFT JOIN api.pending_registrations pr ON p.id = pr.user_id
WHERE p.role = 'patient'
AND p.status = 'pending'
ORDER BY p.created_at DESC;

-- Step 3: Create missing pending_registrations for existing pending patients
-- This backfills the missing link between profiles and pending_registrations

INSERT INTO api.pending_registrations (user_id, form_data, submitted_at, status)
SELECT
    p.id as user_id,
    jsonb_build_object(
        'firstName', COALESCE(split_part(p.full_name, ' ', 1), 'Unknown'),
        'lastName', COALESCE(split_part(p.full_name, ' ', 2), 'User'),
        'email', u.email,
        'phone', '',
        'full_name', p.full_name,
        'role', 'patient',
        'backfilled', true,
        'note', 'Auto-created during FK migration backfill'
    )::text as form_data,
    p.created_at as submitted_at,
    'pending' as status
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
LEFT JOIN api.pending_registrations pr ON p.id = pr.user_id
WHERE p.role = 'patient'
AND p.status = 'pending'
AND pr.user_id IS NULL;  -- Only insert if missing

-- Step 4: Verify backfill results
SELECT
    'After backfill - Profiles pending' as description,
    COUNT(*) as count
FROM public.profiles
WHERE role = 'patient' AND status = 'pending'

UNION ALL

SELECT
    'After backfill - Pending registrations' as description,
    COUNT(*) as count
FROM api.pending_registrations
WHERE status = 'pending'

UNION ALL

SELECT
    'Backfilled registrations' as description,
    COUNT(*) as count
FROM api.pending_registrations
WHERE form_data::json->>'backfilled' = 'true';

-- Step 5: Test the unified view
SELECT
    'Unified view test' as description,
    COUNT(*) as count
FROM api.pending_patient_verifications;

-- Step 6: Show sample backfilled data
SELECT
    'Sample of backfilled data:' as info;

SELECT
    pr.user_id,
    pr.form_data::json->>'firstName' as first_name,
    pr.form_data::json->>'lastName' as last_name,
    pr.form_data::json->>'email' as email,
    pr.status as registration_status,
    p.status as profile_status,
    pr.submitted_at
FROM api.pending_registrations pr
JOIN public.profiles p ON pr.user_id = p.id
WHERE pr.form_data::json->>'backfilled' = 'true'
LIMIT 5;