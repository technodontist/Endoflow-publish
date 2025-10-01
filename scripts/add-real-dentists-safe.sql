-- =============================================
-- ENDOFLOW: Add Real Dentist Profiles (Safe Version)
-- =============================================
-- Creates real dentist profiles for Dr. Nisarg and Dr. Pranav
-- Password: endoflow123 (for both)
-- This version doesn't delete existing data - just adds new dentists
-- Run this in Supabase SQL Editor

-- Create real dentist profiles without deleting existing data
DO $$
DECLARE
    nisarg_id UUID := gen_random_uuid();
    pranav_id UUID := gen_random_uuid();
BEGIN
    -- Create auth.users entries first (FK requirement)
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        aud,
        role
    ) VALUES
        (nisarg_id, '00000000-0000-0000-0000-000000000000', 'dr.nisarg@endoflow.com', '$2b$10$XCpYq67DOxlQN4M99CzLQuOTITojcQ9thsKttDuaqdIgzNJAWXkjK', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
        (pranav_id, '00000000-0000-0000-0000-000000000000', 'dr.pranav@endoflow.com', '$2b$10$6H.FDL9fDDItBfd7rBbooukCEhUk70J3hLXJoUgNCfWeVuwHmpNJC', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (email) DO NOTHING;

    -- Create profiles entries
    INSERT INTO public.profiles (id, role, status, full_name, created_at) VALUES
        (nisarg_id, 'dentist', 'active', 'Dr. Nisarg', NOW()),
        (pranav_id, 'dentist', 'active', 'Dr. Pranav', NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Create dentist records in api.dentists
    INSERT INTO api.dentists (id, full_name, specialty, created_at) VALUES
        (nisarg_id, 'Dr. Nisarg', 'General Dentistry', NOW()),
        (pranav_id, 'Dr. Pranav', 'Endodontics', NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Log success
    RAISE NOTICE 'Successfully created real dentist profiles for Dr. Nisarg and Dr. Pranav';
    RAISE NOTICE 'Login credentials:';
    RAISE NOTICE '  Dr. Nisarg: dr.nisarg@endoflow.com / endoflow123';
    RAISE NOTICE '  Dr. Pranav: dr.pranav@endoflow.com / endoflow123';
END $$;

-- Verify the data was created correctly
SELECT
    'PROFILES' as table_name,
    COUNT(*) as count,
    STRING_AGG(full_name, ', ' ORDER BY full_name) as dentists
FROM public.profiles
WHERE role = 'dentist'
UNION ALL
SELECT
    'DENTISTS' as table_name,
    COUNT(*) as count,
    STRING_AGG(full_name || ' (' || specialty || ')', ', ' ORDER BY full_name) as dentists
FROM api.dentists;

-- Show the created dentist details
SELECT
    d.id,
    d.full_name,
    d.specialty,
    p.status,
    u.email,
    d.created_at
FROM api.dentists d
LEFT JOIN public.profiles p ON d.id = p.id
LEFT JOIN auth.users u ON d.id = u.id
WHERE d.full_name IN ('Dr. Nisarg', 'Dr. Pranav')
ORDER BY d.full_name;

COMMIT;