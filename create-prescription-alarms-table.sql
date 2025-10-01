-- Create prescription alarms table for patient medication reminders
CREATE TABLE IF NOT EXISTS api.prescription_alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id),

    -- Medication details
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    form TEXT, -- tablet, capsule, liquid, etc.

    -- Schedule configuration
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
    frequency_per_day INTEGER NOT NULL DEFAULT 1,
    specific_times TEXT NOT NULL, -- JSON array of times ["09:00", "21:00"]

    -- Duration settings
    duration_type TEXT NOT NULL CHECK (duration_type IN ('days', 'weeks', 'months', 'ongoing')),
    duration_value INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,

    -- Alarm settings
    alarm_enabled BOOLEAN NOT NULL DEFAULT true,
    alarm_sound TEXT NOT NULL DEFAULT 'default',
    snooze_enabled BOOLEAN NOT NULL DEFAULT true,
    snooze_duration_minutes INTEGER NOT NULL DEFAULT 10,

    -- Additional information
    instructions TEXT,
    additional_notes TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alarm instances table for tracking individual alarm occurrences
CREATE TABLE IF NOT EXISTS api.alarm_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_alarm_id UUID NOT NULL REFERENCES api.prescription_alarms(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id),

    -- Scheduled time details
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    scheduled_datetime TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped', 'missed', 'snoozed')),
    taken_at TIMESTAMP WITH TIME ZONE,
    skipped_at TIMESTAMP WITH TIME ZONE,

    -- Snooze handling
    snooze_count INTEGER DEFAULT 0,
    snooze_until TIMESTAMP WITH TIME ZONE,

    -- Patient notes
    patient_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prescription_alarms_patient_id ON api.prescription_alarms(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_alarms_status ON api.prescription_alarms(status);
CREATE INDEX IF NOT EXISTS idx_prescription_alarms_start_date ON api.prescription_alarms(start_date);

CREATE INDEX IF NOT EXISTS idx_alarm_instances_prescription_alarm_id ON api.alarm_instances(prescription_alarm_id);
CREATE INDEX IF NOT EXISTS idx_alarm_instances_patient_id ON api.alarm_instances(patient_id);
CREATE INDEX IF NOT EXISTS idx_alarm_instances_scheduled_datetime ON api.alarm_instances(scheduled_datetime);
CREATE INDEX IF NOT EXISTS idx_alarm_instances_status ON api.alarm_instances(status);

-- Enable Row Level Security
ALTER TABLE api.prescription_alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.alarm_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prescription_alarms
-- Patients can manage their own alarms
CREATE POLICY "Patients can manage own prescription alarms" ON api.prescription_alarms
    FOR ALL TO authenticated
    USING (patient_id = auth.uid())
    WITH CHECK (patient_id = auth.uid());

-- Staff can view all alarms for assistance
CREATE POLICY "Staff can view prescription alarms" ON api.prescription_alarms
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- RLS Policies for alarm_instances
-- Patients can manage their own alarm instances
CREATE POLICY "Patients can manage own alarm instances" ON api.alarm_instances
    FOR ALL TO authenticated
    USING (patient_id = auth.uid())
    WITH CHECK (patient_id = auth.uid());

-- Staff can view alarm instances for assistance
CREATE POLICY "Staff can view alarm instances" ON api.alarm_instances
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON api.prescription_alarms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.alarm_instances TO authenticated;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prescription_alarms_updated_at
    BEFORE UPDATE ON api.prescription_alarms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alarm_instances_updated_at
    BEFORE UPDATE ON api.alarm_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();