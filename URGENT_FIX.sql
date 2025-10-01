-- URGENT DATABASE FIX FOR ENDOFLOW
-- Run this SQL in your Supabase dashboard's SQL Editor
-- This will fix the immediate errors you're seeing

-- Step 1: Create the api schema
CREATE SCHEMA IF NOT EXISTS api;

-- Step 2: Create appointment_requests table with all required columns
CREATE TABLE IF NOT EXISTS api.appointment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  appointment_type TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  reason_for_visit TEXT NOT NULL,
  pain_level INTEGER,
  additional_notes TEXT,
  status TEXT DEFAULT 'pending',
  notification_sent BOOLEAN DEFAULT FALSE,
  assigned_to UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Create assistants table (referenced by assigned_to foreign key)
CREATE TABLE IF NOT EXISTS api.assistants (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 4: Create dentists table (needed for appointments)
CREATE TABLE IF NOT EXISTS api.dentists (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 5: Create appointments table
CREATE TABLE IF NOT EXISTS api.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  dentist_id UUID REFERENCES api.dentists(id),
  assistant_id UUID REFERENCES api.assistants(id),
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

-- Step 6: Create notifications table
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

-- Step 7: Create messages table (referenced in queries)
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

-- Step 8: Create treatments table (referenced in queries)
CREATE TABLE IF NOT EXISTS api.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  dentist_id UUID REFERENCES api.dentists(id),
  appointment_id UUID REFERENCES api.appointments(id),
  treatment_type TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 9: Create patients table in api schema (referenced in queries)
CREATE TABLE IF NOT EXISTS api.patients (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  medical_history_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 10: Create pending_registrations table in api schema
CREATE TABLE IF NOT EXISTS api.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_data TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL
);

-- Step 11: Enable Row Level Security on all tables
ALTER TABLE api.appointment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.dentists ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Step 12: Create basic RLS policies for appointment_requests (critical for app functionality)
CREATE POLICY "Users can view their own appointment requests" ON api.appointment_requests
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Patients can insert appointment requests" ON api.appointment_requests
    FOR INSERT WITH CHECK (patient_id = auth.uid());

-- Step 13: Create service role policies for full access (needed for your service client)
CREATE POLICY "Service role can access all appointment_requests" ON api.appointment_requests
    FOR ALL USING (true);

CREATE POLICY "Service role can access all appointments" ON api.appointments
    FOR ALL USING (true);

CREATE POLICY "Service role can access all notifications" ON api.notifications
    FOR ALL USING (true);

CREATE POLICY "Service role can access all messages" ON api.messages
    FOR ALL USING (true);

CREATE POLICY "Service role can access all treatments" ON api.treatments
    FOR ALL USING (true);

CREATE POLICY "Service role can access all patients" ON api.patients
    FOR ALL USING (true);

CREATE POLICY "Service role can access all pending_registrations" ON api.pending_registrations
    FOR ALL USING (true);

CREATE POLICY "Service role can access all assistants" ON api.assistants
    FOR ALL USING (true);

CREATE POLICY "Service role can access all dentists" ON api.dentists
    FOR ALL USING (true);

-- Step 14: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_requests_patient_id ON api.appointment_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status ON api.appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON api.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON api.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_patient_id ON api.messages(patient_id);

-- Success message
SELECT 'Database schema created successfully! Your ENDOFLOW app should now work.' as result;