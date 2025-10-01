-- SIMPLE FIX for ENDOFLOW Database Issues
-- This addresses the specific problems identified in verification

-- 1. Add the missing additional_notes column to appointment_requests
ALTER TABLE api.appointment_requests ADD COLUMN IF NOT EXISTS additional_notes TEXT;

-- 2. Create missing tables that the app needs
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

-- 3. Fix RLS policies - allow service role full access
DROP POLICY IF EXISTS "Service role can access all appointment_requests" ON api.appointment_requests;
CREATE POLICY "Service role can access all appointment_requests" ON api.appointment_requests
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role can access all appointments" ON api.appointments;
CREATE POLICY "Service role can access all appointments" ON api.appointments
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role can access all notifications" ON api.notifications;
CREATE POLICY "Service role can access all notifications" ON api.notifications
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role can access all messages" ON api.messages;
CREATE POLICY "Service role can access all messages" ON api.messages
    FOR ALL TO service_role USING (true);

-- 4. Also allow authenticated users basic access (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can access their appointment_requests" ON api.appointment_requests;
CREATE POLICY "Users can access their appointment_requests" ON api.appointment_requests
    FOR ALL TO authenticated USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Users can access their appointments" ON api.appointments;
CREATE POLICY "Users can access their appointments" ON api.appointments
    FOR ALL TO authenticated USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Users can access their notifications" ON api.notifications;
CREATE POLICY "Users can access their notifications" ON api.notifications
    FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can access their messages" ON api.messages;
CREATE POLICY "Users can access their messages" ON api.messages
    FOR ALL TO authenticated USING (patient_id = auth.uid() OR sender_id = auth.uid());

-- 5. Enable RLS if not already enabled
ALTER TABLE api.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.messages ENABLE ROW LEVEL SECURITY;

-- Success indicator
SELECT 'Simple fix completed! Missing column and tables added, RLS policies fixed.' as status;