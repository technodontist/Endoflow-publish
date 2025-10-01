-- Manual SQL Script to Apply FK Relationships Migration
-- Copy and paste these sections into Supabase SQL Editor one at a time

-- SECTION 1: Add Foreign Key Constraints for Core Tables
-- Run this first to establish basic FK relationships

-- Add FK constraint for profiles table to auth.users
ALTER TABLE public.profiles
ADD CONSTRAINT fk_profiles_auth_users
FOREIGN KEY (id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Add FK constraint for api.patients to public.profiles
ALTER TABLE api.patients
ADD CONSTRAINT fk_patients_profiles
FOREIGN KEY (id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add FK constraint for api.assistants to public.profiles
ALTER TABLE api.assistants
ADD CONSTRAINT fk_assistants_profiles
FOREIGN KEY (id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add FK constraint for api.dentists to public.profiles
ALTER TABLE api.dentists
ADD CONSTRAINT fk_dentists_profiles
FOREIGN KEY (id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- SECTION 2: Fix Pending Registrations Table
-- Run this after Section 1 to add user_id column and FK

-- Add user_id column to pending_registrations
ALTER TABLE api.pending_registrations
ADD COLUMN user_id UUID;

-- Update existing records to extract user_id from form_data JSON
UPDATE api.pending_registrations
SET user_id = (form_data::json->>'user_id')::uuid
WHERE user_id IS NULL
AND form_data::json->>'user_id' IS NOT NULL;

-- Add FK constraint for pending_registrations to auth.users
ALTER TABLE api.pending_registrations
ADD CONSTRAINT fk_pending_registrations_auth_users
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- SECTION 3: Add FK Constraints for Appointment System
-- Run this after Section 2

ALTER TABLE api.appointment_requests
ADD CONSTRAINT fk_appointment_requests_patients
FOREIGN KEY (patient_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE api.appointment_requests
ADD CONSTRAINT fk_appointment_requests_assistants
FOREIGN KEY (assigned_to) REFERENCES api.assistants(id)
ON DELETE SET NULL;

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

-- SECTION 4: Add FK Constraints for Messages and Other Tables
-- Run this after Section 3

ALTER TABLE api.notifications
ADD CONSTRAINT fk_notifications_users
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE api.messages
ADD CONSTRAINT fk_messages_patients
FOREIGN KEY (patient_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE api.messages
ADD CONSTRAINT fk_messages_senders
FOREIGN KEY (sender_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

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

-- SECTION 5: Create Indexes for Performance
-- Run this after all FK constraints are added

CREATE INDEX IF NOT EXISTS idx_pending_registrations_user_id
ON api.pending_registrations(user_id);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_status_user_id
ON api.pending_registrations(status, user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role_status
ON public.profiles(role, status);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
ON api.appointments(patient_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_appointment_requests_status_created
ON api.appointment_requests(status, created_at);

-- SECTION 6: Create the Unified View for Patient Verification
-- Run this last to create the helper view

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

-- Grant permissions for the view
GRANT SELECT ON api.pending_patient_verifications TO authenticated;