-- =============================================
-- ENDOFLOW: Complete Test User Seeding
-- =============================================
-- Seeds all user types (dentists, assistants, patients) for comprehensive testing
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    -- Dentist UUIDs
    dentist_1_id UUID := '550e8400-e29b-41d4-a716-446655440001';
    dentist_2_id UUID := '550e8400-e29b-41d4-a716-446655440002';
    dentist_3_id UUID := '550e8400-e29b-41d4-a716-446655440003';

    -- Assistant UUIDs
    assistant_1_id UUID := '550e8400-e29b-41d4-a716-446655440011';
    assistant_2_id UUID := '550e8400-e29b-41d4-a716-446655440012';

    -- Test Patient UUIDs
    patient_1_id UUID := '550e8400-e29b-41d4-a716-446655440021';
    patient_2_id UUID := '550e8400-e29b-41d4-a716-446655440022';
BEGIN
    RAISE NOTICE 'Starting comprehensive user seeding...';

    -- =============================================
    -- 0. CREATE AUTH USERS FIRST (FK REQUIREMENT)
    -- =============================================

    -- Create auth users for dentists
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role) VALUES
        (dentist_1_id, '00000000-0000-0000-0000-000000000000', 'sarah.wilson@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
        (dentist_2_id, '00000000-0000-0000-0000-000000000000', 'michael.chen@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
        (dentist_3_id, '00000000-0000-0000-0000-000000000000', 'emily.rodriguez@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- Create auth users for assistants
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role) VALUES
        (assistant_1_id, '00000000-0000-0000-0000-000000000000', 'jessica.martinez@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
        (assistant_2_id, '00000000-0000-0000-0000-000000000000', 'david.kim@endoflow.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- Create auth users for test patients
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role) VALUES
        (patient_1_id, '00000000-0000-0000-0000-000000000000', 'john.doe@example.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
        (patient_2_id, '00000000-0000-0000-0000-000000000000', 'jane.smith@example.com', '$2a$10$dummy.encrypted.password.hash.for.testing', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- =============================================
    -- 1. SEED DENTISTS
    -- =============================================

    -- Insert dentist profiles
    INSERT INTO public.profiles (id, role, status, full_name, created_at) VALUES
        (dentist_1_id, 'dentist', 'active', 'Dr. Sarah Wilson', NOW()),
        (dentist_2_id, 'dentist', 'active', 'Dr. Michael Chen', NOW()),
        (dentist_3_id, 'dentist', 'active', 'Dr. Emily Rodriguez', NOW())
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        full_name = EXCLUDED.full_name;

    -- Insert dentist records
    INSERT INTO api.dentists (id, full_name, specialty, created_at) VALUES
        (dentist_1_id, 'Dr. Sarah Wilson', 'General Dentistry', NOW()),
        (dentist_2_id, 'Dr. Michael Chen', 'Endodontics', NOW()),
        (dentist_3_id, 'Dr. Emily Rodriguez', 'Orthodontics', NOW())
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        specialty = EXCLUDED.specialty;

    RAISE NOTICE 'Seeded 3 dentists successfully';

    -- =============================================
    -- 2. SEED ASSISTANTS
    -- =============================================

    -- Insert assistant profiles
    INSERT INTO public.profiles (id, role, status, full_name, created_at) VALUES
        (assistant_1_id, 'assistant', 'active', 'Jessica Martinez', NOW()),
        (assistant_2_id, 'assistant', 'active', 'David Thompson', NOW())
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        full_name = EXCLUDED.full_name;

    -- Insert assistant records
    INSERT INTO api.assistants (id, full_name, created_at) VALUES
        (assistant_1_id, 'Jessica Martinez', NOW()),
        (assistant_2_id, 'David Thompson', NOW())
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name;

    RAISE NOTICE 'Seeded 2 assistants successfully';

    -- =============================================
    -- 3. SEED TEST PATIENTS
    -- =============================================

    -- Insert patient profiles
    INSERT INTO public.profiles (id, role, status, full_name, created_at) VALUES
        (patient_1_id, 'patient', 'active', 'John Smith', NOW()),
        (patient_2_id, 'patient', 'active', 'Maria Garcia', NOW())
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        full_name = EXCLUDED.full_name;

    -- Insert patient records
    INSERT INTO api.patients (id, first_name, last_name, created_at) VALUES
        (patient_1_id, 'John', 'Smith', NOW()),
        (patient_2_id, 'Maria', 'Garcia', NOW())
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name;

    RAISE NOTICE 'Seeded 2 test patients successfully';

    -- =============================================
    -- 4. SEED SAMPLE APPOINTMENTS (Optional)
    -- =============================================

    -- Create some test appointments to demonstrate the system
    INSERT INTO api.appointments (
        id,
        patient_id,
        dentist_id,
        appointment_type,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        status,
        created_at
    ) VALUES
        (
            gen_random_uuid(),
            patient_1_id,
            dentist_1_id,
            'Regular Checkup',
            CURRENT_DATE + INTERVAL '3 days',
            '10:00:00',
            60,
            'scheduled',
            NOW()
        ),
        (
            gen_random_uuid(),
            patient_2_id,
            dentist_2_id,
            'Root Canal Treatment',
            CURRENT_DATE + INTERVAL '5 days',
            '14:00:00',
            90,
            'scheduled',
            NOW()
        )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Seeded sample appointments successfully';

    RAISE NOTICE 'SEEDING COMPLETE! ✅';
END $$;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check all user counts by role
SELECT
    'SUMMARY' as report_type,
    role,
    COUNT(*) as user_count,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
FROM public.profiles
WHERE role IN ('dentist', 'assistant', 'patient')
GROUP BY role
ORDER BY role;

-- Verify dentists are available for appointment booking
SELECT
    '🦷 AVAILABLE DENTISTS' as section,
    d.full_name,
    d.specialty,
    p.status
FROM api.dentists d
JOIN public.profiles p ON d.id = p.id
WHERE p.status = 'active'
ORDER BY d.full_name;

-- Show upcoming appointments
SELECT
    '📅 UPCOMING APPOINTMENTS' as section,
    a.appointment_type,
    p_patient.full_name as patient_name,
    d.full_name as dentist_name,
    a.scheduled_date,
    a.scheduled_time,
    a.status
FROM api.appointments a
JOIN public.profiles p_patient ON a.patient_id = p_patient.id
JOIN api.dentists d ON a.dentist_id = d.id
WHERE a.scheduled_date >= CURRENT_DATE
ORDER BY a.scheduled_date, a.scheduled_time;

COMMIT;