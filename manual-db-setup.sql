-- ENDOFLOW Appointment Booking System - Manual Database Setup
-- Execute this SQL manually in your Supabase SQL Editor
-- WARNING: Make sure to backup your database before running this!

-- 1. Create appointment_requests table
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

-- 2. Create appointments table
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

-- 3. Create notifications table
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

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_appointment_requests_notification_sent ON api.appointment_requests(notification_sent);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_assigned_to ON api.appointment_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status ON api.appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_patient_id ON api.appointment_requests(patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON api.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON api.appointments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON api.appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON api.appointments(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON api.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON api.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON api.notifications(type);

-- 5. Create updated_at trigger for appointments table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_appointments_updated_at ON api.appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON api.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable Row Level Security (RLS)
ALTER TABLE api.appointment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.notifications ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for appointment_requests
DROP POLICY IF EXISTS "Users can view their own appointment requests" ON api.appointment_requests;
CREATE POLICY "Users can view their own appointment requests" ON api.appointment_requests
    FOR SELECT USING (
        patient_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('assistant', 'dentist'))
    );

DROP POLICY IF EXISTS "Patients can insert appointment requests" ON api.appointment_requests;
CREATE POLICY "Patients can insert appointment requests" ON api.appointment_requests
    FOR INSERT WITH CHECK (
        patient_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'patient')
    );

DROP POLICY IF EXISTS "Assistants and dentists can update appointment requests" ON api.appointment_requests;
CREATE POLICY "Assistants and dentists can update appointment requests" ON api.appointment_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('assistant', 'dentist'))
    );

-- 8. Create RLS policies for appointments
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

-- 9. Create RLS policies for notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON api.notifications;
CREATE POLICY "Users can view their own notifications" ON api.notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON api.notifications;
CREATE POLICY "System can insert notifications" ON api.notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON api.notifications;
CREATE POLICY "Users can update their own notifications" ON api.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- 10. Insert sample data (optional - for testing)
-- Uncomment the following lines if you want test data

/*
-- Sample appointment requests
INSERT INTO api.appointment_requests (patient_id, appointment_type, preferred_date, preferred_time, reason_for_visit, pain_level, additional_notes, status) VALUES
('00000000-0000-0000-0000-000000000001', 'Consultation', CURRENT_DATE + INTERVAL '1 day', '10:00', 'Routine dental checkup and cleaning', 2, 'No specific concerns, just regular maintenance', 'pending'),
('00000000-0000-0000-0000-000000000002', 'Emergency', CURRENT_DATE, '14:30', 'Severe tooth pain in upper left molar', 8, 'Pain started yesterday evening, getting worse', 'pending');

-- Sample notifications
INSERT INTO api.notifications (user_id, type, title, message, read) VALUES
('00000000-0000-0000-0000-000000000003', 'appointment_request', 'New Appointment Request', 'A new appointment request has been submitted', false),
('00000000-0000-0000-0000-000000000001', 'appointment_confirmed', 'Appointment Confirmed', 'Your appointment has been scheduled', false);
*/

-- Verification queries (run these after executing the above)
-- SELECT 'appointment_requests' as table_name, count(*) as row_count FROM api.appointment_requests
-- UNION ALL
-- SELECT 'appointments' as table_name, count(*) as row_count FROM api.appointments
-- UNION ALL
-- SELECT 'notifications' as table_name, count(*) as row_count FROM api.notifications;

-- Check table structure
-- \d api.appointment_requests
-- \d api.appointments
-- \d api.notifications