-- ==================================================
-- FIX PRESCRIPTION ALARMS DATABASE PERMISSIONS
-- ==================================================
-- This script ensures the patient_prescriptions and medication_reminders tables 
-- exist and have proper permissions for the service role

-- First, ensure the tables exist with proper structure
CREATE TABLE IF NOT EXISTS api.patient_prescriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL, -- References auth.users.id
    dentist_id uuid NOT NULL, -- References auth.users.id
    medication_name text NOT NULL,
    dosage text NOT NULL,
    frequency text,
    times_per_day integer DEFAULT 1,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    reminder_times text, -- JSON array of times like ["09:00", "21:00"]
    instructions text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued')),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api.medication_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id uuid NOT NULL, -- References api.patient_prescriptions.id
    patient_id uuid NOT NULL, -- References auth.users.id
    scheduled_date date NOT NULL,
    scheduled_time time NOT NULL,
    reminder_date_time timestamp with time zone NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped', 'missed')),
    taken_at timestamp with time zone,
    skipped_at timestamp with time zone,
    patient_notes text,
    side_effects_reported text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add foreign key for prescription_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'medication_reminders_prescription_id_fkey'
        AND table_name = 'medication_reminders'
        AND table_schema = 'api'
    ) THEN
        ALTER TABLE api.medication_reminders 
        ADD CONSTRAINT medication_reminders_prescription_id_fkey 
        FOREIGN KEY (prescription_id) REFERENCES api.patient_prescriptions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_patient_id ON api.patient_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_status ON api.patient_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_start_end_date ON api.patient_prescriptions(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_medication_reminders_patient_id ON api.medication_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_prescription_id ON api.medication_reminders(prescription_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_scheduled_date ON api.medication_reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_status ON api.medication_reminders(status);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_patient_prescriptions_updated_at ON api.patient_prescriptions;
CREATE TRIGGER update_patient_prescriptions_updated_at
    BEFORE UPDATE ON api.patient_prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medication_reminders_updated_at ON api.medication_reminders;
CREATE TRIGGER update_medication_reminders_updated_at
    BEFORE UPDATE ON api.medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================================================
-- GRANT PERMISSIONS TO SERVICE ROLE (CRITICAL FIX)
-- ==================================================

-- Grant schema usage to service_role
GRANT USAGE ON SCHEMA api TO service_role;

-- Grant ALL permissions on the tables to service_role
GRANT ALL ON TABLE api.patient_prescriptions TO service_role;
GRANT ALL ON TABLE api.medication_reminders TO service_role;

-- Grant permissions on sequences (for auto-generated IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO service_role;

-- Also grant to authenticated users (for RLS policies)
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT ALL ON TABLE api.patient_prescriptions TO authenticated;
GRANT ALL ON TABLE api.medication_reminders TO authenticated;

-- ==================================================
-- ROW LEVEL SECURITY POLICIES
-- ==================================================

-- Enable RLS on both tables
ALTER TABLE api.patient_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.medication_reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Patients can view own prescriptions" ON api.patient_prescriptions;
DROP POLICY IF EXISTS "Patients can create own prescriptions" ON api.patient_prescriptions;
DROP POLICY IF EXISTS "Patients can update own prescriptions" ON api.patient_prescriptions;
DROP POLICY IF EXISTS "Staff can view all prescriptions" ON api.patient_prescriptions;
DROP POLICY IF EXISTS "Staff can create prescriptions" ON api.patient_prescriptions;
DROP POLICY IF EXISTS "Staff can update prescriptions" ON api.patient_prescriptions;

DROP POLICY IF EXISTS "Patients can view own reminders" ON api.medication_reminders;
DROP POLICY IF EXISTS "Patients can create own reminders" ON api.medication_reminders;
DROP POLICY IF EXISTS "Patients can update own reminders" ON api.medication_reminders;
DROP POLICY IF EXISTS "Staff can view all reminders" ON api.medication_reminders;
DROP POLICY IF EXISTS "Staff can create reminders" ON api.medication_reminders;
DROP POLICY IF EXISTS "Staff can update reminders" ON api.medication_reminders;

-- Create RLS policies for patient_prescriptions
CREATE POLICY "Patients can view own prescriptions" ON api.patient_prescriptions
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Patients can create own prescriptions" ON api.patient_prescriptions
    FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update own prescriptions" ON api.patient_prescriptions
    FOR UPDATE USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());

-- Staff can view and manage all prescriptions
CREATE POLICY "Staff can view all prescriptions" ON api.patient_prescriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
    );

CREATE POLICY "Staff can create prescriptions" ON api.patient_prescriptions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
    );

CREATE POLICY "Staff can update prescriptions" ON api.patient_prescriptions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
    );

-- Create RLS policies for medication_reminders
CREATE POLICY "Patients can view own reminders" ON api.medication_reminders
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Patients can create own reminders" ON api.medication_reminders
    FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update own reminders" ON api.medication_reminders
    FOR UPDATE USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());

-- Staff can view and manage all reminders
CREATE POLICY "Staff can view all reminders" ON api.medication_reminders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
    );

CREATE POLICY "Staff can create reminders" ON api.medication_reminders
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
    );

CREATE POLICY "Staff can update reminders" ON api.medication_reminders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
    );

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Check if tables exist and are accessible
SELECT 
    schemaname, 
    tablename, 
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'api' 
AND tablename IN ('patient_prescriptions', 'medication_reminders');

-- Check RLS policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies 
WHERE schemaname = 'api' 
AND tablename IN ('patient_prescriptions', 'medication_reminders');

-- Check permissions on tables
SELECT 
    table_schema,
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_schema = 'api' 
AND table_name IN ('patient_prescriptions', 'medication_reminders')
AND grantee = 'service_role';

-- Success message
SELECT 'DATABASE PERMISSIONS FIXED SUCCESSFULLY! Tables created and service_role permissions granted.' as result;