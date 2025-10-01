-- ===============================================
-- PATIENT DASHBOARD NEW FEATURES SCHEMA
-- ===============================================
-- Run this in Supabase SQL Editor to enable:
-- 1. Family & Friend Referral System
-- 2. Prescription Alarm/Reminder System
-- 3. Enhanced Patient-Dentist Messaging

-- 1. Patient Referrals table for family & friend referral tracking
CREATE TABLE IF NOT EXISTS api.patient_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL,
    referral_code TEXT NOT NULL UNIQUE,

    -- Sharing details
    shared_via TEXT NOT NULL CHECK (shared_via IN ('whatsapp', 'sms', 'email', 'facebook', 'twitter', 'link', 'other')),
    recipient_contact TEXT,
    recipient_name TEXT,

    -- Tracking and success
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    clicked_at TIMESTAMP WITH TIME ZONE,
    registered_referral_id UUID,
    reward_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending', 'eligible', 'awarded', 'expired')),

    -- Metadata
    custom_message TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT fk_patient_referrals_referrer
        FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_patient_referrals_registered
        FOREIGN KEY (registered_referral_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Patient Prescriptions table for medication management
CREATE TABLE IF NOT EXISTS api.patient_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    dentist_id UUID NOT NULL,
    consultation_id UUID,

    -- Medication details
    medication_name TEXT NOT NULL,
    brand_name TEXT,
    dosage TEXT NOT NULL,
    strength TEXT,
    form TEXT,

    -- Dosing schedule
    frequency TEXT NOT NULL,
    times_per_day INTEGER NOT NULL DEFAULT 1,
    duration_days INTEGER,
    total_quantity TEXT,

    -- Schedule timing
    start_date DATE NOT NULL,
    end_date DATE,
    reminder_times TEXT NOT NULL, -- JSON array

    -- Instructions and notes
    instructions TEXT,
    side_effects TEXT,
    notes TEXT,

    -- Status and compliance
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued', 'paused')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

    -- Refill information
    refills_remaining INTEGER DEFAULT 0,
    pharmacy_info TEXT, -- JSON string

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT fk_patient_prescriptions_patient
        FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_patient_prescriptions_dentist
        FOREIGN KEY (dentist_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_patient_prescriptions_consultation
        FOREIGN KEY (consultation_id) REFERENCES api.consultations(id) ON DELETE SET NULL
);

-- 3. Medication Reminders table for tracking individual doses
CREATE TABLE IF NOT EXISTS api.medication_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL,
    patient_id UUID NOT NULL,

    -- Reminder details
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    reminder_date_time TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Completion tracking
    taken_at TIMESTAMP WITH TIME ZONE,
    skipped_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped', 'late', 'missed')),

    -- Patient notes and feedback
    patient_notes TEXT,
    side_effects_reported TEXT,

    -- Notification tracking
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT fk_medication_reminders_prescription
        FOREIGN KEY (prescription_id) REFERENCES api.patient_prescriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_medication_reminders_patient
        FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 4. Message Threads table for enhanced patient-dentist communication
CREATE TABLE IF NOT EXISTS api.message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    dentist_id UUID NOT NULL,

    -- Thread details
    subject TEXT NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_message_preview TEXT,

    -- Thread status and priority
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE,

    -- Participant tracking
    patient_unread_count INTEGER NOT NULL DEFAULT 0,
    dentist_unread_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    message_count INTEGER NOT NULL DEFAULT 0,
    tags TEXT, -- JSON array
    related_appointment_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT fk_message_threads_patient
        FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_threads_dentist
        FOREIGN KEY (dentist_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_threads_appointment
        FOREIGN KEY (related_appointment_id) REFERENCES api.appointments(id) ON DELETE SET NULL
);

-- 5. Thread Messages table (enhanced messaging)
CREATE TABLE IF NOT EXISTS api.thread_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'dentist')),

    -- Message content
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice', 'system')),

    -- File attachments
    attachments TEXT, -- JSON array

    -- Message status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Reply/thread functionality
    reply_to_message_id UUID,

    -- System message data
    system_message_type TEXT,
    system_message_data TEXT, -- JSON data

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT fk_thread_messages_thread
        FOREIGN KEY (thread_id) REFERENCES api.message_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_thread_messages_sender
        FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_thread_messages_reply
        FOREIGN KEY (reply_to_message_id) REFERENCES api.thread_messages(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE api.patient_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.patient_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.thread_messages ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- ROW LEVEL SECURITY POLICIES
-- ===============================================

-- Patient Referrals Policies
CREATE POLICY "Patients can view their own referrals" ON api.patient_referrals
FOR SELECT TO authenticated
USING (referrer_id = auth.uid());

CREATE POLICY "Patients can create referrals" ON api.patient_referrals
FOR INSERT TO authenticated
WITH CHECK (
    referrer_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'patient' AND status = 'active'
    )
);

CREATE POLICY "Staff can view all referrals" ON api.patient_referrals
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('assistant', 'dentist') AND status = 'active'
    )
);

-- Patient Prescriptions Policies
CREATE POLICY "Patients can view their own prescriptions" ON api.patient_prescriptions
FOR SELECT TO authenticated
USING (patient_id = auth.uid());

CREATE POLICY "Dentists can create and manage prescriptions" ON api.patient_prescriptions
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'dentist' AND status = 'active'
    )
)
WITH CHECK (
    dentist_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'dentist' AND status = 'active'
    )
);

-- Medication Reminders Policies
CREATE POLICY "Patients can manage their medication reminders" ON api.medication_reminders
FOR ALL TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Dentists can view patient reminders" ON api.medication_reminders
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'dentist' AND status = 'active'
    )
);

-- Message Threads Policies
CREATE POLICY "Participants can view their threads" ON api.message_threads
FOR SELECT TO authenticated
USING (patient_id = auth.uid() OR dentist_id = auth.uid());

CREATE POLICY "Participants can create threads" ON api.message_threads
FOR INSERT TO authenticated
WITH CHECK (
    (patient_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'patient' AND status = 'active'
    )) OR
    (dentist_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dentist' AND status = 'active'
    ))
);

CREATE POLICY "Participants can update threads" ON api.message_threads
FOR UPDATE TO authenticated
USING (patient_id = auth.uid() OR dentist_id = auth.uid())
WITH CHECK (patient_id = auth.uid() OR dentist_id = auth.uid());

-- Thread Messages Policies
CREATE POLICY "Thread participants can view messages" ON api.thread_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM api.message_threads
        WHERE id = thread_id AND (patient_id = auth.uid() OR dentist_id = auth.uid())
    )
);

CREATE POLICY "Thread participants can send messages" ON api.thread_messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM api.message_threads
        WHERE id = thread_id AND (patient_id = auth.uid() OR dentist_id = auth.uid())
    )
);

CREATE POLICY "Senders can update their messages" ON api.thread_messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Referrals indexes
CREATE INDEX IF NOT EXISTS idx_patient_referrals_referrer ON api.patient_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_patient_referrals_code ON api.patient_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_patient_referrals_shared_at ON api.patient_referrals(shared_at);

-- Prescriptions indexes
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_patient ON api.patient_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_dentist ON api.patient_prescriptions(dentist_id);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_status ON api.patient_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_dates ON api.patient_prescriptions(start_date, end_date);

-- Medication reminders indexes
CREATE INDEX IF NOT EXISTS idx_medication_reminders_prescription ON api.medication_reminders(prescription_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_patient ON api.medication_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_datetime ON api.medication_reminders(reminder_date_time);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_status ON api.medication_reminders(status);

-- Message threads indexes
CREATE INDEX IF NOT EXISTS idx_message_threads_patient ON api.message_threads(patient_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_dentist ON api.message_threads(dentist_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message ON api.message_threads(last_message_at);
CREATE INDEX IF NOT EXISTS idx_message_threads_status ON api.message_threads(status);

-- Thread messages indexes
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON api.thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_sender ON api.thread_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_created ON api.thread_messages(created_at);

-- ===============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ===============================================

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at columns
CREATE TRIGGER set_timestamp_patient_prescriptions
    BEFORE UPDATE ON api.patient_prescriptions
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_medication_reminders
    BEFORE UPDATE ON api.medication_reminders
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_message_threads
    BEFORE UPDATE ON api.message_threads
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_thread_messages
    BEFORE UPDATE ON api.thread_messages
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- ===============================================
-- FUNCTIONS FOR MANAGING MEDICATION REMINDERS
-- ===============================================

-- Function to generate daily medication reminders
CREATE OR REPLACE FUNCTION generate_medication_reminders(
    prescription_uuid UUID,
    start_date_param DATE,
    end_date_param DATE
)
RETURNS INTEGER AS $$
DECLARE
    prescription_record RECORD;
    reminder_times_array TEXT[];
    loop_date DATE;
    reminder_time TEXT;
    reminder_datetime TIMESTAMP WITH TIME ZONE;
    reminders_created INTEGER := 0;
BEGIN
    -- Get prescription details
    SELECT * INTO prescription_record
    FROM api.patient_prescriptions
    WHERE id = prescription_uuid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription not found';
    END IF;

    -- Parse reminder times JSON
    SELECT array_agg(elem::TEXT)
    INTO reminder_times_array
    FROM json_array_elements_text(prescription_record.reminder_times::json) AS elem;

    -- Generate reminders for each day
    loop_date := start_date_param;
    WHILE loop_date <= end_date_param LOOP
        -- Generate reminder for each time of day
        FOREACH reminder_time IN ARRAY reminder_times_array LOOP
            reminder_datetime := (loop_date || ' ' || reminder_time)::TIMESTAMP WITH TIME ZONE;

            INSERT INTO api.medication_reminders (
                prescription_id,
                patient_id,
                scheduled_date,
                scheduled_time,
                reminder_date_time
            ) VALUES (
                prescription_uuid,
                prescription_record.patient_id,
                loop_date,
                reminder_time::TIME,
                reminder_datetime
            );

            reminders_created := reminders_created + 1;
        END LOOP;

        loop_date := loop_date + INTERVAL '1 day';
    END LOOP;

    RETURN reminders_created;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- SUCCESS MESSAGE
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Patient Dashboard New Features Schema Created Successfully!';
    RAISE NOTICE '📋 Tables Created:';
    RAISE NOTICE '   • api.patient_referrals (Family & Friend Referral System)';
    RAISE NOTICE '   • api.patient_prescriptions (Prescription Management)';
    RAISE NOTICE '   • api.medication_reminders (Medication Alarms)';
    RAISE NOTICE '   • api.message_threads (Enhanced Messaging)';
    RAISE NOTICE '   • api.thread_messages (Thread Messages)';
    RAISE NOTICE '🔒 Row Level Security Policies Applied';
    RAISE NOTICE '📈 Performance Indexes Created';
    RAISE NOTICE '⚡ Auto-update Triggers Configured';
    RAISE NOTICE '🎯 Ready for Patient Dashboard Integration!';
END $$;