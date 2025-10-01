-- ENDOFLOW Database Schema Fix Script
-- This script applies all necessary database schema fixes
-- Run this script to fix the appointment booking system errors

-- Step 1: Ensure api schema exists
CREATE SCHEMA IF NOT EXISTS api;

-- Step 2: Create the appointment_requests table with all required columns
-- (This includes the missing additional_notes column)
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
  assigned_to UUID REFERENCES api.assistants(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Create appointments table for confirmed appointments
CREATE TABLE IF NOT EXISTS api.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  dentist_id UUID REFERENCES api.dentists(id),
  assistant_id UUID REFERENCES api.assistants(id),
  appointment_request_id UUID REFERENCES api.appointment_requests(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  appointment_type TEXT,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 4: Create notifications table for real-time alerts
CREATE TABLE IF NOT EXISTS api.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'appointment_request', 'appointment_confirmed', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID, -- Links to appointment_request or appointment
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 5: Create messages table for patient-staff communication
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

-- Step 6: Create treatments table for tracking patient treatment history
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

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointment_requests_patient_id ON api.appointment_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status ON api.appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_notification_sent ON api.appointment_requests(notification_sent);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_assigned_to ON api.appointment_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON api.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON api.appointments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON api.appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON api.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON api.notifications(read);
CREATE INDEX IF NOT EXISTS idx_messages_patient_id ON api.messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON api.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON api.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON api.treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_dentist_id ON api.treatments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_treatments_appointment_id ON api.treatments(appointment_id);

-- Step 8: Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 9: Add updated_at triggers
DROP TRIGGER IF EXISTS update_appointments_updated_at ON api.appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON api.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_treatments_updated_at ON api.treatments;
CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON api.treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Enable Row Level Security (RLS)
ALTER TABLE api.appointment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.treatments ENABLE ROW LEVEL SECURITY;

-- Step 11: Create RLS policies for appointment_requests
DROP POLICY IF EXISTS "Users can view their own appointment requests" ON api.appointment_requests;
CREATE POLICY "Users can view their own appointment requests" ON api.appointment_requests
    FOR SELECT USING (
        patient_id = auth.uid() OR
        assigned_to IN (SELECT id FROM api.assistants WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid()))
    );

DROP POLICY IF EXISTS "Patients can insert appointment requests" ON api.appointment_requests;
CREATE POLICY "Patients can insert appointment requests" ON api.appointment_requests
    FOR INSERT WITH CHECK (
        patient_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'patient')
    );

DROP POLICY IF EXISTS "Assistants can update appointment requests" ON api.appointment_requests;
CREATE POLICY "Assistants can update appointment requests" ON api.appointment_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'assistant')
    );

-- Step 12: Create RLS policies for appointments
DROP POLICY IF EXISTS "Users can view their own appointments" ON api.appointments;
CREATE POLICY "Users can view their own appointments" ON api.appointments
    FOR SELECT USING (
        patient_id = auth.uid() OR
        dentist_id IN (SELECT id FROM api.dentists WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())) OR
        assistant_id IN (SELECT id FROM api.assistants WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid()))
    );

DROP POLICY IF EXISTS "Assistants and dentists can insert appointments" ON api.appointments;
CREATE POLICY "Assistants and dentists can insert appointments" ON api.appointments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('assistant', 'dentist'))
    );

DROP POLICY IF EXISTS "Assistants and dentists can update appointments" ON api.appointments;
CREATE POLICY "Assistants and dentists can update appointments" ON api.appointments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('assistant', 'dentist'))
    );

-- Step 13: Create RLS policies for notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON api.notifications;
CREATE POLICY "Users can view their own notifications" ON api.notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON api.notifications;
CREATE POLICY "System can insert notifications" ON api.notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON api.notifications;
CREATE POLICY "Users can update their own notifications" ON api.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Step 14: Create RLS policies for messages
DROP POLICY IF EXISTS "Users can view their own messages" ON api.messages;
CREATE POLICY "Users can view their own messages" ON api.messages
    FOR SELECT USING (
        patient_id = auth.uid() OR
        sender_id = auth.uid()
    );

DROP POLICY IF EXISTS "Users can insert their own messages" ON api.messages;
CREATE POLICY "Users can insert their own messages" ON api.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
    );

DROP POLICY IF EXISTS "Users can update their own messages" ON api.messages;
CREATE POLICY "Users can update their own messages" ON api.messages
    FOR UPDATE USING (
        sender_id = auth.uid()
    );

-- Step 15: Create RLS policies for treatments
DROP POLICY IF EXISTS "Users can view their own treatments" ON api.treatments;
CREATE POLICY "Users can view their own treatments" ON api.treatments
    FOR SELECT USING (
        patient_id = auth.uid() OR
        dentist_id IN (SELECT id FROM api.dentists WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid()))
    );

DROP POLICY IF EXISTS "Dentists can insert treatments" ON api.treatments;
CREATE POLICY "Dentists can insert treatments" ON api.treatments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dentist')
    );

DROP POLICY IF EXISTS "Dentists can update treatments" ON api.treatments;
CREATE POLICY "Dentists can update treatments" ON api.treatments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dentist')
    );

-- Step 16: Ensure profiles table has the correct columns
-- Add missing columns to profiles table if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Final verification message
SELECT 'Database schema fix completed successfully! All tables, columns, and relationships should now be in place.' as status;