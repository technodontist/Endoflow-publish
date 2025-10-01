-- ==================================================
-- ENHANCE PRESCRIPTION ALARMS SYSTEM
-- ==================================================
-- This script extends the existing medication_reminders table
-- and adds a new prescription_alarms table for enhanced functionality

-- Add new columns to existing medication_reminders table
ALTER TABLE api.medication_reminders ADD COLUMN IF NOT EXISTS alarm_enabled boolean DEFAULT true;
ALTER TABLE api.medication_reminders ADD COLUMN IF NOT EXISTS snooze_count integer DEFAULT 0;
ALTER TABLE api.medication_reminders ADD COLUMN IF NOT EXISTS snooze_until timestamp with time zone;
ALTER TABLE api.medication_reminders ADD COLUMN IF NOT EXISTS alarm_sound text DEFAULT 'default';
ALTER TABLE api.medication_reminders ADD COLUMN IF NOT EXISTS custom_notes text;
ALTER TABLE api.medication_reminders ADD COLUMN IF NOT EXISTS dismissed_at timestamp with time zone;

-- Create prescription_alarms table for user-created custom alarms
CREATE TABLE IF NOT EXISTS api.prescription_alarms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL, -- References auth.users.id

    -- Medication details
    medication_name text NOT NULL,
    dosage text NOT NULL,
    form text, -- tablet, capsule, liquid, etc.

    -- Schedule configuration
    schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
    frequency_per_day integer NOT NULL DEFAULT 1,
    specific_times text NOT NULL, -- JSON array of times ["09:00", "21:00"]

    -- Duration settings
    duration_type text NOT NULL CHECK (duration_type IN ('days', 'weeks', 'months', 'ongoing')),
    duration_value integer, -- Number of days/weeks/months
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date, -- Calculated or manually set

    -- Alarm settings
    alarm_enabled boolean NOT NULL DEFAULT true,
    alarm_sound text NOT NULL DEFAULT 'default',
    snooze_enabled boolean NOT NULL DEFAULT true,
    snooze_duration_minutes integer NOT NULL DEFAULT 10,

    -- Instructions and notes
    instructions text,
    additional_notes text,

    -- Status tracking
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    is_archived boolean NOT NULL DEFAULT false,

    -- Metadata
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create alarm_instances table for tracking individual alarm occurrences
CREATE TABLE IF NOT EXISTS api.alarm_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_alarm_id uuid NOT NULL REFERENCES api.prescription_alarms(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL, -- References auth.users.id

    -- Scheduled time details
    scheduled_date date NOT NULL,
    scheduled_time time NOT NULL,
    scheduled_datetime timestamp with time zone NOT NULL,

    -- Status tracking
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped', 'missed', 'snoozed')),
    taken_at timestamp with time zone,
    skipped_at timestamp with time zone,
    dismissed_at timestamp with time zone,

    -- Snooze tracking
    snooze_count integer NOT NULL DEFAULT 0,
    snooze_until timestamp with time zone,
    original_time timestamp with time zone,

    -- Patient feedback
    patient_notes text,
    side_effects_reported text,

    -- Notification tracking
    notification_sent boolean NOT NULL DEFAULT false,
    notification_sent_at timestamp with time zone,
    browser_notification_id text, -- For managing browser notifications

    -- Metadata
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prescription_alarms_patient_id ON api.prescription_alarms(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_alarms_status ON api.prescription_alarms(status);
CREATE INDEX IF NOT EXISTS idx_prescription_alarms_start_end_date ON api.prescription_alarms(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_alarm_instances_patient_id ON api.alarm_instances(patient_id);
CREATE INDEX IF NOT EXISTS idx_alarm_instances_scheduled_datetime ON api.alarm_instances(scheduled_datetime);
CREATE INDEX IF NOT EXISTS idx_alarm_instances_status ON api.alarm_instances(status);
CREATE INDEX IF NOT EXISTS idx_alarm_instances_prescription_alarm_id ON api.alarm_instances(prescription_alarm_id);

-- Add updated_at trigger for prescription_alarms
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_prescription_alarms_updated_at ON api.prescription_alarms;
CREATE TRIGGER update_prescription_alarms_updated_at
    BEFORE UPDATE ON api.prescription_alarms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alarm_instances_updated_at ON api.alarm_instances;
CREATE TRIGGER update_alarm_instances_updated_at
    BEFORE UPDATE ON api.alarm_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies
ALTER TABLE api.prescription_alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.alarm_instances ENABLE ROW LEVEL SECURITY;

-- Patients can only access their own alarms
DROP POLICY IF EXISTS "Patients can view own prescription alarms" ON api.prescription_alarms;
CREATE POLICY "Patients can view own prescription alarms" ON api.prescription_alarms
    FOR SELECT USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can create own prescription alarms" ON api.prescription_alarms;
CREATE POLICY "Patients can create own prescription alarms" ON api.prescription_alarms
    FOR INSERT WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can update own prescription alarms" ON api.prescription_alarms;
CREATE POLICY "Patients can update own prescription alarms" ON api.prescription_alarms
    FOR UPDATE USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can delete own prescription alarms" ON api.prescription_alarms;
CREATE POLICY "Patients can delete own prescription alarms" ON api.prescription_alarms
    FOR DELETE USING (patient_id = auth.uid());

-- Staff can view all alarms for their assigned patients
DROP POLICY IF EXISTS "Staff can view patient prescription alarms" ON api.prescription_alarms;
CREATE POLICY "Staff can view patient prescription alarms" ON api.prescription_alarms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- Alarm instances policies
DROP POLICY IF EXISTS "Patients can view own alarm instances" ON api.alarm_instances;
CREATE POLICY "Patients can view own alarm instances" ON api.alarm_instances
    FOR SELECT USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can create own alarm instances" ON api.alarm_instances;
CREATE POLICY "Patients can create own alarm instances" ON api.alarm_instances
    FOR INSERT WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can update own alarm instances" ON api.alarm_instances;
CREATE POLICY "Patients can update own alarm instances" ON api.alarm_instances
    FOR UPDATE USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view patient alarm instances" ON api.alarm_instances;
CREATE POLICY "Staff can view patient alarm instances" ON api.alarm_instances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- Function to generate alarm instances based on prescription alarm schedule
CREATE OR REPLACE FUNCTION generate_alarm_instances(
    p_prescription_alarm_id uuid,
    p_start_date date DEFAULT CURRENT_DATE,
    p_end_date date DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    alarm_record api.prescription_alarms%ROWTYPE;
    instance_date date;
    time_slot time;
    time_slots text[];
BEGIN
    -- Get the prescription alarm details
    SELECT * INTO alarm_record
    FROM api.prescription_alarms
    WHERE id = p_prescription_alarm_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription alarm not found';
    END IF;

    -- Parse the specific times
    SELECT string_to_array(replace(replace(alarm_record.specific_times, '[', ''), ']', ''), ',') INTO time_slots;

    -- Set end date if not provided
    IF p_end_date IS NULL THEN
        p_end_date := COALESCE(alarm_record.end_date, p_start_date + INTERVAL '30 days');
    END IF;

    -- Generate instances based on schedule type
    instance_date := GREATEST(p_start_date, alarm_record.start_date);

    WHILE instance_date <= p_end_date LOOP
        -- Generate instances for each time slot
        FOREACH time_slot IN ARRAY time_slots LOOP
            INSERT INTO api.alarm_instances (
                prescription_alarm_id,
                patient_id,
                scheduled_date,
                scheduled_time,
                scheduled_datetime
            ) VALUES (
                p_prescription_alarm_id,
                alarm_record.patient_id,
                instance_date,
                time_slot::time,
                (instance_date || ' ' || time_slot)::timestamp with time zone
            )
            ON CONFLICT DO NOTHING; -- Avoid duplicates
        END LOOP;

        -- Increment date based on schedule type
        CASE alarm_record.schedule_type
            WHEN 'daily' THEN
                instance_date := instance_date + INTERVAL '1 day';
            WHEN 'weekly' THEN
                instance_date := instance_date + INTERVAL '7 days';
            WHEN 'monthly' THEN
                instance_date := instance_date + INTERVAL '1 month';
            ELSE
                instance_date := instance_date + INTERVAL '1 day';
        END CASE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create view for easy alarm querying
CREATE OR REPLACE VIEW api.active_alarms_today AS
SELECT
    ai.*,
    pa.medication_name,
    pa.dosage,
    pa.instructions,
    pa.alarm_sound,
    pa.snooze_enabled,
    pa.snooze_duration_minutes
FROM api.alarm_instances ai
JOIN api.prescription_alarms pa ON ai.prescription_alarm_id = pa.id
WHERE ai.scheduled_date = CURRENT_DATE
  AND ai.status IN ('pending', 'snoozed')
  AND pa.status = 'active'
  AND pa.alarm_enabled = true
ORDER BY ai.scheduled_time;

COMMENT ON TABLE api.prescription_alarms IS 'Patient-created custom medication alarms with flexible scheduling';
COMMENT ON TABLE api.alarm_instances IS 'Individual alarm occurrences generated from prescription alarms';
COMMENT ON VIEW api.active_alarms_today IS 'View of all active alarms for today';