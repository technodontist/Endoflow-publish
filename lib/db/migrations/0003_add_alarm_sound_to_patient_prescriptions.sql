-- Add missing alarm_sound column to support simple prescription alarms
-- Keeps Drizzle migrations consistent with Supabase migration 20250923_add_alarm_ringtones.sql

ALTER TABLE "api"."patient_prescriptions"
  ADD COLUMN IF NOT EXISTS "alarm_sound" text NOT NULL DEFAULT 'default';
