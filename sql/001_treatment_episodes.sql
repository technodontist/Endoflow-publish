-- =============================================
-- LONGITUDINAL PATIENT TRACKING SYSTEM
-- Phase 1: Treatment Episodes, Episode Visits, Tooth Timeline
-- =============================================
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)

-- =============================================
-- 1. TREATMENT EPISODES TABLE
-- Groups related visits under one clinical unit
-- (single tooth or prosthetic unit like a bridge)
-- =============================================
CREATE TABLE IF NOT EXISTS api.treatment_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,       -- References auth.users.id
  dentist_id UUID NOT NULL,       -- References auth.users.id
  clinic_id UUID,                 -- References public.clinics.id (multi-tenant)

  -- Episode classification
  episode_type TEXT NOT NULL DEFAULT 'single_tooth'
    CHECK (episode_type IN ('single_tooth', 'prosthetic_unit', 'surgical', 'periodontal')),
  linked_teeth TEXT[] NOT NULL DEFAULT '{}',  -- FDI tooth numbers, e.g., ARRAY['44','45','46']

  -- Original diagnosis context
  original_diagnosis TEXT NOT NULL,
  original_diagnosis_consultation_id UUID,  -- FK to api.consultations.id
  treatment_plan TEXT NOT NULL,
  combined_treatment_sequence TEXT,         -- e.g., "1. RCT → 2. Post & Core → 3. Crown"

  -- Visit tracking
  planned_visits INTEGER NOT NULL DEFAULT 1,
  completed_visits INTEGER NOT NULL DEFAULT 0,

  -- Status and priority
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'on_hold', 'failed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('urgent', 'high', 'medium', 'low')),

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_date DATE,

  -- Outcome tracking
  outcome TEXT CHECK (outcome IN ('success', 'partial_success', 'failure', 'ongoing') OR outcome IS NULL),
  outcome_notes TEXT,
  ai_prognosis JSONB,  -- AI assessment JSON

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for treatment_episodes
CREATE INDEX IF NOT EXISTS idx_treatment_episodes_patient
  ON api.treatment_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_episodes_patient_status
  ON api.treatment_episodes(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_treatment_episodes_status
  ON api.treatment_episodes(status);
CREATE INDEX IF NOT EXISTS idx_treatment_episodes_linked_teeth
  ON api.treatment_episodes USING GIN(linked_teeth);

-- =============================================
-- 2. EPISODE VISITS TABLE
-- Individual visits within a treatment episode
-- =============================================
CREATE TABLE IF NOT EXISTS api.episode_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES api.treatment_episodes(id) ON DELETE CASCADE,
  consultation_id UUID,   -- References api.consultations.id
  appointment_id UUID,    -- References api.appointments.id

  -- Visit details
  visit_number INTEGER NOT NULL DEFAULT 1,
  visit_type TEXT NOT NULL DEFAULT 'treatment'
    CHECK (visit_type IN ('treatment', 'follow_up', 'emergency', 'review')),

  -- Clinical data
  procedures_done JSONB DEFAULT '[]'::jsonb,    -- Array of procedure descriptions
  materials_used JSONB DEFAULT '{}'::jsonb,      -- Materials/instruments used
  complications TEXT,
  clinical_notes TEXT,
  next_visit_plan TEXT,

  -- AI tracking assessment
  ai_progress_assessment JSONB,  -- Tracking pipeline output
  dentist_confirmed BOOLEAN NOT NULL DEFAULT false,  -- Human-in-the-loop gate

  -- Timing
  visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for episode_visits
CREATE INDEX IF NOT EXISTS idx_episode_visits_episode
  ON api.episode_visits(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_visits_consultation
  ON api.episode_visits(consultation_id);
CREATE INDEX IF NOT EXISTS idx_episode_visits_appointment
  ON api.episode_visits(appointment_id);

-- =============================================
-- 3. TOOTH TIMELINE TABLE
-- Chronological event log for each tooth
-- =============================================
CREATE TABLE IF NOT EXISTS api.tooth_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,      -- References auth.users.id
  tooth_number TEXT NOT NULL,     -- FDI notation

  -- Event classification
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'diagnosis',
      'treatment_start',
      'treatment_visit',
      'treatment_complete',
      'follow_up',
      'new_finding',
      'status_change'
    )),

  -- References
  episode_id UUID REFERENCES api.treatment_episodes(id) ON DELETE SET NULL,
  consultation_id UUID,   -- References api.consultations.id

  -- Event data
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL,       -- Human-readable summary
  previous_status TEXT,            -- Tooth status before this event
  new_status TEXT,                 -- Tooth status after this event
  data_snapshot JSONB,             -- Relevant clinical data at this point

  -- Audit
  created_by UUID,                 -- User who triggered the event
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tooth_timeline
CREATE INDEX IF NOT EXISTS idx_tooth_timeline_patient
  ON api.tooth_timeline(patient_id);
CREATE INDEX IF NOT EXISTS idx_tooth_timeline_patient_tooth
  ON api.tooth_timeline(patient_id, tooth_number);
CREATE INDEX IF NOT EXISTS idx_tooth_timeline_episode
  ON api.tooth_timeline(episode_id);
CREATE INDEX IF NOT EXISTS idx_tooth_timeline_event_date
  ON api.tooth_timeline(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_tooth_timeline_event_type
  ON api.tooth_timeline(event_type);

-- =============================================
-- 4. UPDATED_AT TRIGGERS
-- Auto-update updated_at on row modification
-- =============================================
CREATE OR REPLACE FUNCTION api.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for treatment_episodes
DROP TRIGGER IF EXISTS update_treatment_episodes_updated_at ON api.treatment_episodes;
CREATE TRIGGER update_treatment_episodes_updated_at
  BEFORE UPDATE ON api.treatment_episodes
  FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

-- Trigger for episode_visits
DROP TRIGGER IF EXISTS update_episode_visits_updated_at ON api.episode_visits;
CREATE TRIGGER update_episode_visits_updated_at
  BEFORE UPDATE ON api.episode_visits
  FOR EACH ROW EXECUTE FUNCTION api.update_updated_at_column();

-- =============================================
-- VERIFICATION
-- =============================================
-- Run these to verify the tables were created:
-- SELECT count(*) FROM api.treatment_episodes;  -- Should return 0
-- SELECT count(*) FROM api.episode_visits;       -- Should return 0
-- SELECT count(*) FROM api.tooth_timeline;       -- Should return 0
