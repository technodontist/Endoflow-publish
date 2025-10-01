-- =============================================
-- DEPRECATED: Use create-real-dentists.sql instead
-- =============================================
-- This file is deprecated. Please use create-real-dentists.sql
-- for Dr. Nisarg and Dr. Pranav profiles

-- First, let's check if we have any existing dentists
-- SELECT COUNT(*) as existing_dentists FROM api.dentists;

-- Create test dentist UUIDs (using gen_random_uuid() for uniqueness)
DO $$
DECLARE
    dentist_1_id UUID := '550e8400-e29b-41d4-a716-446655440001';
    dentist_2_id UUID := '550e8400-e29b-41d4-a716-446655440002';
    dentist_3_id UUID := '550e8400-e29b-41d4-a716-446655440003';
BEGIN
    -- First, create auth users (required for FK constraint)
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role) VALUES
        (dentist_1_id, '00000000-0000-0000-0000-000000000000', 'sarah.wilson@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
        (dentist_2_id, '00000000-0000-0000-0000-000000000000', 'michael.chen@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
        (dentist_3_id, '00000000-0000-0000-0000-000000000000', 'emily.rodriguez@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- Insert dentist profiles in public.profiles (FK requirement satisfied)
    INSERT INTO public.profiles (id, role, status, full_name, created_at) VALUES
        (dentist_1_id, 'dentist', 'active', 'Dr. Sarah Wilson', NOW()),
        (dentist_2_id, 'dentist', 'active', 'Dr. Michael Chen', NOW()),
        (dentist_3_id, 'dentist', 'active', 'Dr. Emily Rodriguez', NOW())
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        full_name = EXCLUDED.full_name;

    -- Insert dentist records in api.dentists
    INSERT INTO api.dentists (id, full_name, specialty, created_at) VALUES
        (dentist_1_id, 'Dr. Sarah Wilson', 'General Dentistry', NOW()),
        (dentist_2_id, 'Dr. Michael Chen', 'Endodontics', NOW()),
        (dentist_3_id, 'Dr. Emily Rodriguez', 'Orthodontics', NOW())
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        specialty = EXCLUDED.specialty;

    -- Log success
    RAISE NOTICE 'Successfully seeded 3 test dentists';
END $$;

-- Verify the data was inserted
SELECT 'PROFILES' as table_name, COUNT(*) as dentist_count
FROM public.profiles
WHERE role = 'dentist'
UNION ALL
SELECT 'DENTISTS' as table_name, COUNT(*) as dentist_count
FROM api.dentists;

-- Show the created dentists
SELECT
    d.id,
    d.full_name,
    d.specialty,
    p.status,
    d.created_at
FROM api.dentists d
LEFT JOIN public.profiles p ON d.id = p.id
ORDER BY d.full_name;

-- Test query that the appointment booking will use
SELECT
    id,
    full_name,
    specialty,
    created_at
FROM api.dentists
ORDER BY full_name;

COMMIT;