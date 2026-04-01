-- =============================================
-- CONSULTATION LINKAGE COLUMNS
-- Adds bidirectional linking between appointments,
-- consultations, and episodes
-- =============================================
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)

-- =============================================
-- 1. Add consultation_id to appointments
-- Links an appointment to the consultation done during it
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api'
      AND table_name = 'appointments'
      AND column_name = 'consultation_id'
  ) THEN
    ALTER TABLE api.appointments
      ADD COLUMN consultation_id UUID;

    COMMENT ON COLUMN api.appointments.consultation_id IS
      'References api.consultations.id — the consultation performed during this appointment';
  END IF;
END $$;

-- =============================================
-- 2. Add appointment_id to consultations
-- Links a consultation back to its originating appointment
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api'
      AND table_name = 'consultations'
      AND column_name = 'appointment_id'
  ) THEN
    ALTER TABLE api.consultations
      ADD COLUMN appointment_id UUID;

    COMMENT ON COLUMN api.consultations.appointment_id IS
      'References api.appointments.id — the appointment this consultation was conducted during';
  END IF;
END $$;

-- =============================================
-- 3. Add consultation_mode to consultations
-- Tracks which mode the consultation was conducted in
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api'
      AND table_name = 'consultations'
      AND column_name = 'consultation_mode'
  ) THEN
    ALTER TABLE api.consultations
      ADD COLUMN consultation_mode TEXT NOT NULL DEFAULT 'new_consultation'
        CHECK (consultation_mode IN ('new_consultation', 'treatment_visit', 'follow_up', 'emergency'));

    COMMENT ON COLUMN api.consultations.consultation_mode IS
      'The mode used for this consultation: new_consultation, treatment_visit, follow_up, emergency';
  END IF;
END $$;

-- =============================================
-- 4. Add episode_id to consultations
-- Links a consultation to a treatment episode (for treatment/follow-up visits)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api'
      AND table_name = 'consultations'
      AND column_name = 'episode_id'
  ) THEN
    ALTER TABLE api.consultations
      ADD COLUMN episode_id UUID;

    COMMENT ON COLUMN api.consultations.episode_id IS
      'References api.treatment_episodes.id — the episode this consultation is part of';
  END IF;
END $$;

-- =============================================
-- 5. Add image_references to consultations
-- Stores references to patient_files linked to this consultation
-- (placeholder for future X-ray/photo AI processing)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api'
      AND table_name = 'consultations'
      AND column_name = 'image_references'
  ) THEN
    ALTER TABLE api.consultations
      ADD COLUMN image_references JSONB DEFAULT '[]'::jsonb;

    COMMENT ON COLUMN api.consultations.image_references IS
      'JSONB array of patient_files IDs linked to this consultation (X-rays, clinical photos)';
  END IF;
END $$;

-- =============================================
-- INDEXES for new columns
-- =============================================
CREATE INDEX IF NOT EXISTS idx_appointments_consultation_id
  ON api.appointments(consultation_id);

CREATE INDEX IF NOT EXISTS idx_consultations_appointment_id
  ON api.consultations(appointment_id);

CREATE INDEX IF NOT EXISTS idx_consultations_episode_id
  ON api.consultations(episode_id);

CREATE INDEX IF NOT EXISTS idx_consultations_mode
  ON api.consultations(consultation_mode);

-- =============================================
-- VERIFICATION
-- =============================================
-- Run these to verify columns exist:
-- SELECT consultation_id FROM api.appointments LIMIT 0;
-- SELECT appointment_id, consultation_mode, episode_id, image_references FROM api.consultations LIMIT 0;
