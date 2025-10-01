-- Migration 0004: Fix Foreign Key Relationships and Patient Verification Workflow
-- This migration addresses the FK/PK linking issues preventing proper patient verification

-- Phase 1: Add Missing Foreign Key Constraints
-- Note: These constraints ensure referential integrity across the system

-- 1.1 Add FK constraint for profiles table to auth.users
ALTER TABLE public.profiles
ADD CONSTRAINT fk_profiles_auth_users
FOREIGN KEY (id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 1.2 Add FK constraint for api.patients to public.profiles
ALTER TABLE api.patients
ADD CONSTRAINT fk_patients_profiles
FOREIGN KEY (id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 1.3 Add FK constraint for api.assistants to public.profiles
ALTER TABLE api.assistants
ADD CONSTRAINT fk_assistants_profiles
FOREIGN KEY (id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 1.4 Add FK constraint for api.dentists to public.profiles
ALTER TABLE api.dentists
ADD CONSTRAINT fk_dentists_profiles
FOREIGN KEY (id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Phase 2: Fix Pending Registrations Table Structure
-- This will link pending registrations directly to user accounts

-- 2.1 Add user_id column to pending_registrations
ALTER TABLE api.pending_registrations
ADD COLUMN user_id UUID;

-- 2.2 Add FK constraint for pending_registrations to auth.users
ALTER TABLE api.pending_registrations
ADD CONSTRAINT fk_pending_registrations_auth_users
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 2.3 Update existing pending_registrations records to extract user_id from form_data JSON
UPDATE api.pending_registrations
SET user_id = (form_data::json->>'user_id')::uuid
WHERE user_id IS NULL
AND form_data::json->>'user_id' IS NOT NULL;

-- 2.4 Add NOT NULL constraint to user_id (after data migration)
-- We'll do this in a separate step to ensure all records are updated first
-- ALTER TABLE api.pending_registrations ALTER COLUMN user_id SET NOT NULL;

-- Phase 3: Add Additional FK Constraints for Appointment System

-- 3.1 Ensure appointment_requests references are properly constrained
ALTER TABLE api.appointment_requests
ADD CONSTRAINT fk_appointment_requests_patients
FOREIGN KEY (patient_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE api.appointment_requests
ADD CONSTRAINT fk_appointment_requests_assistants
FOREIGN KEY (assigned_to) REFERENCES api.assistants(id)
ON DELETE SET NULL;

-- 3.2 Ensure appointments table FK constraints
ALTER TABLE api.appointments
ADD CONSTRAINT fk_appointments_patients
FOREIGN KEY (patient_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE api.appointments
ADD CONSTRAINT fk_appointments_dentists
FOREIGN KEY (dentist_id) REFERENCES api.dentists(id)
ON DELETE RESTRICT;

ALTER TABLE api.appointments
ADD CONSTRAINT fk_appointments_assistants
FOREIGN KEY (assistant_id) REFERENCES api.assistants(id)
ON DELETE SET NULL;

ALTER TABLE api.appointments
ADD CONSTRAINT fk_appointments_requests
FOREIGN KEY (appointment_request_id) REFERENCES api.appointment_requests(id)
ON DELETE SET NULL;

-- 3.3 Ensure notifications table FK constraint
ALTER TABLE api.notifications
ADD CONSTRAINT fk_notifications_users
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 3.4 Ensure messages table FK constraints
ALTER TABLE api.messages
ADD CONSTRAINT fk_messages_patients
FOREIGN KEY (patient_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE api.messages
ADD CONSTRAINT fk_messages_senders
FOREIGN KEY (sender_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 3.5 Ensure treatments table FK constraints
ALTER TABLE api.treatments
ADD CONSTRAINT fk_treatments_patients
FOREIGN KEY (patient_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE api.treatments
ADD CONSTRAINT fk_treatments_dentists
FOREIGN KEY (dentist_id) REFERENCES api.dentists(id)
ON DELETE RESTRICT;

ALTER TABLE api.treatments
ADD CONSTRAINT fk_treatments_appointments
FOREIGN KEY (appointment_id) REFERENCES api.appointments(id)
ON DELETE SET NULL;

-- Phase 4: Add Performance Indexes for New FK Relationships

-- 4.1 Indexes for pending_registrations
CREATE INDEX IF NOT EXISTS idx_pending_registrations_user_id
ON api.pending_registrations(user_id);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_status_user_id
ON api.pending_registrations(status, user_id);

-- 4.2 Indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_role_status
ON public.profiles(role, status);

-- 4.3 Indexes for appointments and related tables
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
ON api.appointments(patient_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_appointment_requests_status_created
ON api.appointment_requests(status, created_at);

-- Phase 5: Create a View for Patient Verification Workflow
-- This view will make it easy for assistants to see pending patient registrations

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

-- Grant appropriate permissions for the view
GRANT SELECT ON api.pending_patient_verifications TO authenticated;

-- Phase 6: Add Comments for Documentation
COMMENT ON TABLE api.pending_registrations IS 'Stores patient registration requests awaiting approval, linked to auth.users via user_id';
COMMENT ON COLUMN api.pending_registrations.user_id IS 'References auth.users.id - the user account for this registration';
COMMENT ON VIEW api.pending_patient_verifications IS 'Unified view for assistant dashboard showing pending patient registrations with user details';

-- Create a function to validate data integrity
CREATE OR REPLACE FUNCTION validate_user_profile_consistency()
RETURNS TABLE(
    user_id uuid,
    has_auth_user boolean,
    has_profile boolean,
    has_role_table boolean,
    profile_role text,
    issues text[]
) AS $$
BEGIN
    RETURN QUERY
    WITH user_analysis AS (
        SELECT
            u.id as user_id,
            u.id IS NOT NULL as has_auth_user,
            p.id IS NOT NULL as has_profile,
            CASE
                WHEN p.role = 'patient' THEN (SELECT pat.id IS NOT NULL FROM api.patients pat WHERE pat.id = u.id)
                WHEN p.role = 'assistant' THEN (SELECT ast.id IS NOT NULL FROM api.assistants ast WHERE ast.id = u.id)
                WHEN p.role = 'dentist' THEN (SELECT den.id IS NOT NULL FROM api.dentists den WHERE den.id = u.id)
                ELSE FALSE
            END as has_role_table,
            p.role as profile_role
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
    )
    SELECT
        ua.user_id,
        ua.has_auth_user,
        ua.has_profile,
        ua.has_role_table,
        ua.profile_role,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT ua.has_profile THEN 'Missing profile record' END,
            CASE WHEN ua.has_profile AND NOT ua.has_role_table THEN 'Missing role-specific table record' END,
            CASE WHEN ua.profile_role IS NULL THEN 'Profile missing role' END
        ], NULL) as issues
    FROM user_analysis ua
    WHERE NOT (ua.has_profile AND ua.has_role_table AND ua.profile_role IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the validation function
GRANT EXECUTE ON FUNCTION validate_user_profile_consistency() TO authenticated;

-- Add a trigger to automatically create profile records when users are created
-- This ensures we don't have orphaned auth.users without profiles

CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile if it doesn't exist and user has metadata
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        INSERT INTO public.profiles (id, role, status, full_name, created_at)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
            'pending',
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown User'),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_create_profile_on_user_create ON auth.users;
CREATE TRIGGER trigger_create_profile_on_user_create
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_new_user();

-- Final verification: Check for any constraint violations
DO $$
DECLARE
    violation_count integer;
BEGIN
    -- Check for orphaned records that would violate our new constraints

    -- Check profiles without auth.users
    SELECT COUNT(*) INTO violation_count
    FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

    IF violation_count > 0 THEN
        RAISE WARNING 'Found % profile records without corresponding auth.users records', violation_count;
    END IF;

    -- Check role-specific tables without profiles
    SELECT COUNT(*) INTO violation_count
    FROM api.patients pat
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pat.id);

    IF violation_count > 0 THEN
        RAISE WARNING 'Found % patient records without corresponding profile records', violation_count;
    END IF;

    RAISE NOTICE 'Foreign key relationship migration completed successfully';
END $$;