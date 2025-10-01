-- =============================================
-- MIGRATION: Add ringtone support for simple alarms
-- Use with Supabase CLI: place in supabase/migrations and push
-- =============================================

-- 1) Add alarm_sound column to patient_prescriptions (used by simple alarms)
ALTER TABLE api.patient_prescriptions
  ADD COLUMN IF NOT EXISTS alarm_sound text NOT NULL DEFAULT 'default';

-- 2) (Optional) Add alarm_sound to medication_reminders for future per-instance overrides
ALTER TABLE api.medication_reminders
  ADD COLUMN IF NOT EXISTS alarm_sound text;

-- 3) Catalog of available alarm sounds
CREATE TABLE IF NOT EXISTS api.alarm_sounds (
  key text PRIMARY KEY,
  name text NOT NULL,
  audio_url text, -- optional hosted audio file
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed common sounds (idempotent)
INSERT INTO api.alarm_sounds (key, name, audio_url, is_default)
VALUES
  ('default', 'Default', NULL, true),
  ('gentle',  'Gentle',  NULL, false),
  ('urgent',  'Urgent',  NULL, false),
  ('chime',   'Chime',   NULL, false)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  audio_url = EXCLUDED.audio_url,
  is_default = EXCLUDED.is_default;

-- 4) Grants (service role always needs full access; authenticated can read catalog)
GRANT USAGE ON SCHEMA api TO service_role;
GRANT SELECT ON TABLE api.alarm_sounds TO authenticated;
GRANT ALL ON TABLE api.alarm_sounds TO service_role;

-- Ensure service_role can read/write updated tables
GRANT ALL ON TABLE api.patient_prescriptions TO service_role;
GRANT ALL ON TABLE api.medication_reminders TO service_role;
