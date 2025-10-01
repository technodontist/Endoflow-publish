# 🔧 CRITICAL: Apply FK Migration to Fix Patient Verification

## ⚠️ IMPORTANT: Your database currently has NO foreign key relationships!

This is why the verification workflow is broken. Follow these steps **exactly** to fix it.

## Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

## Step 2: Apply Migration Sections

Copy and paste **ONE SECTION AT A TIME** from `scripts/apply-fk-migration.sql` and execute each section:

### ✅ SECTION 1: Core FK Constraints (Run this first)
```sql
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
```

### ✅ SECTION 2: Fix Pending Registrations (Run after Section 1)
```sql
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
```

### ✅ SECTION 3: Appointment System FKs (Run after Section 2)
```sql
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
```

### ✅ SECTION 4: Messages & Other FKs (Run after Section 3)
```sql
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
```

### ✅ SECTION 5: Performance Indexes (Run after Section 4)
```sql
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
```

### ✅ SECTION 6: Unified Verification View (Run this last)
```sql
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
```

## Step 3: Verify Migration Success

After running all sections, execute this query to check if everything worked:

```sql
-- Check if FK constraints exist
SELECT
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as references_table
FROM pg_constraint
WHERE conname LIKE 'fk_%'
ORDER BY table_name;

-- Check if the view exists and works
SELECT COUNT(*) as pending_patients_count
FROM api.pending_patient_verifications;

-- Check if user_id column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'api'
AND table_name = 'pending_registrations';
```

## ⚠️ Expected Results:
- You should see multiple FK constraints listed
- The view query should work (even if it returns 0 rows)
- `pending_registrations` should have a `user_id` column

## 🚨 If You Get Errors:
- **"relation already exists"** → Ignore, continue with next section
- **"column already exists"** → Ignore, continue with next section
- **"constraint already exists"** → Ignore, continue with next section
- **Any other error** → Stop and check the error message

## Next Steps:
After applying the migration, run: `npm run dev` to test the updated verification workflow.

---

**This migration fixes:**
✅ FK relationships between all tables
✅ Patient verification workflow
✅ Approve/reject button functionality
✅ Data integrity across the entire system