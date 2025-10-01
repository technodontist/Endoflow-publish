-- =============================================
-- ENDOFLOW: Create Auth Users for Existing Dentist Profiles
-- =============================================
-- This script creates ONLY the auth.users entries for dentists
-- since profiles and api.dentists already exist
-- Run this in Supabase SQL Editor

-- Get the existing dentist IDs from profiles table
DO $$
DECLARE
    nisarg_id UUID;
    pranav_id UUID;
BEGIN
    -- Get existing profile IDs
    SELECT id INTO nisarg_id FROM public.profiles WHERE full_name = 'Dr. Nisarg' AND role = 'dentist';
    SELECT id INTO pranav_id FROM public.profiles WHERE full_name = 'Dr. Pranav' AND role = 'dentist';

    IF nisarg_id IS NULL OR pranav_id IS NULL THEN
        RAISE EXCEPTION 'Dentist profiles not found in profiles table';
    END IF;

    RAISE NOTICE 'Found existing dentist profile IDs:';
    RAISE NOTICE '  Dr. Nisarg: %', nisarg_id;
    RAISE NOTICE '  Dr. Pranav: %', pranav_id;

    -- Create auth.users entries with the SAME IDs as profiles
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
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        updated_at = NOW();

    RAISE NOTICE 'Successfully created auth.users entries for Dr. Nisarg and Dr. Pranav';
    RAISE NOTICE 'Login credentials:';
    RAISE NOTICE '  Dr. Nisarg: dr.nisarg@endoflow.com / endoflow123';
    RAISE NOTICE '  Dr. Pranav: dr.pranav@endoflow.com / endoflow123';
END $$;

-- Verify the auth users were created
SELECT
    'AUTH_USERS_CHECK' as table_name,
    COUNT(*) as count,
    STRING_AGG(email, ', ' ORDER BY email) as emails
FROM auth.users
WHERE email IN ('dr.nisarg@endoflow.com', 'dr.pranav@endoflow.com');

COMMIT;