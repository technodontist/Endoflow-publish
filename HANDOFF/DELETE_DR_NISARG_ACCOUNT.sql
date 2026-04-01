-- DELETE dr.nisarg@endoflow.com account and consolidate to nisarg@endoflow.com
-- Run this in Supabase SQL Editor
-- Date: 2026-03-26
--
-- KEEPING: nisarg@endoflow.com (ID: 5e1c48db-...)
-- DELETING: dr.nisarg@endoflow.com (ID: 86bb73d5-...)
--
-- IMPORTANT: Run Step 1 first, review output, then run remaining steps.

-- ============================================================
-- STEP 1: IDENTIFY BOTH ACCOUNTS (run this first to get full UUIDs)
-- ============================================================
SELECT id, email, created_at FROM auth.users
WHERE email IN ('dr.nisarg@endoflow.com', 'nisarg@endoflow.com');

SELECT id, role, status, full_name, clinic_id FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email IN ('dr.nisarg@endoflow.com', 'nisarg@endoflow.com')
);

-- ============================================================
-- STEP 2: CHECK DATA OWNED BY dr.nisarg@endoflow.com
-- Run this to see what data needs reassignment before deletion
-- Replace the UUID below with the actual full UUID from Step 1
-- ============================================================

-- Find the dr.nisarg UUID
DO $$
DECLARE
  dr_nisarg_id UUID;
  nisarg_id UUID;
BEGIN
  SELECT id INTO dr_nisarg_id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com';
  SELECT id INTO nisarg_id FROM auth.users WHERE email = 'nisarg@endoflow.com';

  IF dr_nisarg_id IS NULL THEN
    RAISE NOTICE 'dr.nisarg@endoflow.com not found - may already be deleted';
    RETURN;
  END IF;

  RAISE NOTICE 'dr.nisarg@endoflow.com ID: %', dr_nisarg_id;
  RAISE NOTICE 'nisarg@endoflow.com ID: %', nisarg_id;
END $$;

-- Check all tables for data owned by dr.nisarg
-- Appointments
SELECT 'appointments' AS table_name, COUNT(*) AS count FROM api.appointments WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Consultations
SELECT 'consultations' AS table_name, COUNT(*) AS count FROM api.consultations WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Treatments
SELECT 'treatments' AS table_name, COUNT(*) AS count FROM api.treatments WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Voice sessions
SELECT 'voice_sessions' AS table_name, COUNT(*) AS count FROM api.voice_sessions WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Clinical templates
SELECT 'clinical_templates' AS table_name, COUNT(*) AS count FROM api.clinical_templates WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Research projects
SELECT 'research_projects' AS table_name, COUNT(*) AS count FROM api.research_projects WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Assistant tasks (created by)
SELECT 'assistant_tasks' AS table_name, COUNT(*) AS count FROM api.assistant_tasks WHERE created_by IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Patient files (uploaded by)
SELECT 'patient_files' AS table_name, COUNT(*) AS count FROM api.patient_files WHERE uploaded_by IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Medical knowledge
SELECT 'medical_knowledge' AS table_name, COUNT(*) AS count FROM api.medical_knowledge WHERE uploaded_by IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Messages
SELECT 'messages' AS table_name, COUNT(*) AS count FROM api.messages WHERE sender_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Notifications
SELECT 'notifications' AS table_name, COUNT(*) AS count FROM api.notifications WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Tooth diagnoses
SELECT 'tooth_diagnoses' AS table_name, COUNT(*) AS count FROM api.tooth_diagnoses WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Patient prescriptions
SELECT 'patient_prescriptions' AS table_name, COUNT(*) AS count FROM api.patient_prescriptions WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');
-- Clinic analysis sessions
SELECT 'clinic_analysis_sessions' AS table_name, COUNT(*) AS count FROM api.clinic_analysis_chat_sessions WHERE dentist_id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');

-- ============================================================
-- STEP 3: REASSIGN ALL DATA from dr.nisarg to nisarg@endoflow.com
-- Only run after reviewing Step 2 output
-- ============================================================

DO $$
DECLARE
  old_id UUID;
  new_id UUID;
BEGIN
  SELECT id INTO old_id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com';
  SELECT id INTO new_id FROM auth.users WHERE email = 'nisarg@endoflow.com';

  IF old_id IS NULL OR new_id IS NULL THEN
    RAISE EXCEPTION 'Could not find both accounts';
  END IF;

  RAISE NOTICE 'Reassigning data from % to %', old_id, new_id;

  -- Reassign dentist-owned data
  UPDATE api.appointments SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.consultations SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.treatments SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.voice_sessions SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.clinical_templates SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.research_projects SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.tooth_diagnoses SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.patient_prescriptions SET dentist_id = new_id WHERE dentist_id = old_id;
  UPDATE api.clinic_analysis_chat_sessions SET dentist_id = new_id WHERE dentist_id = old_id;

  -- Reassign general user-owned data
  UPDATE api.assistant_tasks SET created_by = new_id WHERE created_by = old_id;
  UPDATE api.patient_files SET uploaded_by = new_id WHERE uploaded_by = old_id;
  UPDATE api.medical_knowledge SET uploaded_by = new_id WHERE uploaded_by = old_id;
  UPDATE api.messages SET sender_id = new_id WHERE sender_id = old_id;
  UPDATE api.notifications SET user_id = new_id WHERE user_id = old_id;

  -- Reassign task comments and activity
  UPDATE api.task_comments SET author_id = new_id WHERE author_id = old_id;
  UPDATE api.task_activity_log SET user_id = new_id WHERE user_id = old_id;

  RAISE NOTICE 'All data reassigned successfully';
END $$;

-- ============================================================
-- STEP 4: DELETE the old account
-- This cascades: profiles row deleted via FK, then auth.identities, etc.
-- ============================================================

-- Delete from api.dentists first (no cascade from auth.users)
DELETE FROM api.dentists WHERE id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');

-- Delete profile (may cascade-delete from auth.users, but be explicit)
DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'dr.nisarg@endoflow.com');

-- Delete auth user (this also deletes auth.identities via cascade)
DELETE FROM auth.users WHERE email = 'dr.nisarg@endoflow.com';

-- ============================================================
-- STEP 5: VERIFY
-- ============================================================

-- Should return 0
SELECT COUNT(*) AS remaining_dr_nisarg FROM auth.users WHERE email = 'dr.nisarg@endoflow.com';

-- Should show nisarg@endoflow.com as active dentist
SELECT p.id, p.role, p.status, p.full_name, p.clinic_id, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'nisarg@endoflow.com';

-- Should show nisarg in api.dentists
SELECT * FROM api.dentists WHERE id IN (SELECT id FROM auth.users WHERE email = 'nisarg@endoflow.com');

RAISE NOTICE 'Account deletion complete. nisarg@endoflow.com is now the sole Dr. Nisarg account.';
