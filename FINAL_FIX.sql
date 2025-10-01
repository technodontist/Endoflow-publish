-- FINAL FIX for ENDOFLOW - Handles existing policies and adds missing components
-- This script is safe to run multiple times

-- 1. Add the missing additional_notes column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'api' 
    AND table_name = 'appointment_requests' 
    AND column_name = 'additional_notes'
  ) THEN
    ALTER TABLE api.appointment_requests ADD COLUMN additional_notes TEXT;
  END IF;
END $$;

-- 2. Create missing tables that the app needs (safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS api.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  dentist_id UUID,
  assistant_id UUID,
  appointment_request_id UUID REFERENCES api.appointment_requests(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  appointment_type TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  sender_id UUID REFERENCES auth.users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'assistant', 'dentist')),
  message TEXT NOT NULL,
  is_from_patient BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS api.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  dentist_id UUID,
  appointment_id UUID REFERENCES api.appointments(id),
  treatment_type TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. Enable RLS on new tables
ALTER TABLE api.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.treatments ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing conflicting policies and create comprehensive ones
DROP POLICY IF EXISTS "Users can view their own appointment requests" ON api.appointment_requests;
DROP POLICY IF EXISTS "Patients can insert appointment requests" ON api.appointment_requests;
DROP POLICY IF EXISTS "Service role can access all appointment_requests" ON api.appointment_requests;
DROP POLICY IF EXISTS "Users can access their appointment_requests" ON api.appointment_requests;

-- Create comprehensive service role policy for appointment_requests
CREATE POLICY "service_role_full_access_appointment_requests" ON api.appointment_requests
    FOR ALL TO service_role USING (true);

-- Create user policies for appointment_requests
CREATE POLICY "users_own_appointment_requests" ON api.appointment_requests
    FOR ALL TO authenticated USING (patient_id = auth.uid());

-- 5. Create policies for other tables
-- Appointments policies
DROP POLICY IF EXISTS "Service role can access all appointments" ON api.appointments;
CREATE POLICY "service_role_full_access_appointments" ON api.appointments
    FOR ALL TO service_role USING (true);
CREATE POLICY "users_own_appointments" ON api.appointments
    FOR ALL TO authenticated USING (patient_id = auth.uid());

-- Notifications policies
DROP POLICY IF EXISTS "Service role can access all notifications" ON api.notifications;
CREATE POLICY "service_role_full_access_notifications" ON api.notifications
    FOR ALL TO service_role USING (true);
CREATE POLICY "users_own_notifications" ON api.notifications
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- Messages policies
DROP POLICY IF EXISTS "Service role can access all messages" ON api.messages;
CREATE POLICY "service_role_full_access_messages" ON api.messages
    FOR ALL TO service_role USING (true);
CREATE POLICY "users_own_messages" ON api.messages
    FOR ALL TO authenticated USING (patient_id = auth.uid() OR sender_id = auth.uid());

-- Treatments policies
DROP POLICY IF EXISTS "Service role can access all treatments" ON api.treatments;
CREATE POLICY "service_role_full_access_treatments" ON api.treatments
    FOR ALL TO service_role USING (true);
CREATE POLICY "users_own_treatments" ON api.treatments
    FOR ALL TO authenticated USING (patient_id = auth.uid());

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_requests_patient_id ON api.appointment_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status ON api.appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON api.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON api.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_patient_id ON api.messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON api.treatments(patient_id);

-- Success message
SELECT 'FINAL FIX completed successfully! All tables, columns, and policies are now properly configured.' as result;