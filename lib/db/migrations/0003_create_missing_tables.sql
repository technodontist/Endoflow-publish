-- Create missing tables referenced in queries.ts
-- Messages table for patient-staff communication
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

-- Treatments table for tracking patient treatment history
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_patient_id ON api.messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON api.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON api.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON api.treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_dentist_id ON api.treatments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_treatments_appointment_id ON api.treatments(appointment_id);

-- Add updated_at trigger for treatments table
CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON api.treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE api.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.treatments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for messages
CREATE POLICY "Users can view their own messages" ON api.messages
    FOR SELECT USING (
        patient_id = auth.uid() OR
        sender_id = auth.uid()
    );

CREATE POLICY "Users can insert their own messages" ON api.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
    );

CREATE POLICY "Users can update their own messages" ON api.messages
    FOR UPDATE USING (
        sender_id = auth.uid()
    );

-- Create RLS policies for treatments
CREATE POLICY "Users can view their own treatments" ON api.treatments
    FOR SELECT USING (
        patient_id = auth.uid() OR
        dentist_id IN (SELECT id FROM api.dentists WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Dentists can insert treatments" ON api.treatments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dentist')
    );

CREATE POLICY "Dentists can update treatments" ON api.treatments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dentist')
    );