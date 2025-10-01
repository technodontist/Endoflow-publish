-- Live Appointment Booking System - Database Schema
-- Phase 1: Database Schema Enhancement

-- 1.1 Create appointment_requests table (base table first)
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

-- 1.2 Create appointments table for confirmed appointments
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

-- 1.3 Create notifications table for real-time alerts
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

-- 1.4 Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointment_requests_notification_sent ON api.appointment_requests(notification_sent);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_assigned_to ON api.appointment_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON api.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON api.appointments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON api.appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON api.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON api.notifications(read);

-- 1.5 Add updated_at trigger for appointments table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON api.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1.6 Enable Row Level Security (RLS)
ALTER TABLE api.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.notifications ENABLE ROW LEVEL SECURITY;

-- 1.7 Create RLS policies for appointments
CREATE POLICY "Users can view their own appointments" ON api.appointments
    FOR SELECT USING (
        patient_id = auth.uid() OR
        dentist_id IN (SELECT id FROM api.dentists WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())) OR
        assistant_id IN (SELECT id FROM api.assistants WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Assistants and dentists can insert appointments" ON api.appointments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('assistant', 'dentist'))
    );

CREATE POLICY "Assistants and dentists can update appointments" ON api.appointments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('assistant', 'dentist'))
    );

-- 1.8 Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON api.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON api.notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON api.notifications
    FOR UPDATE USING (user_id = auth.uid());