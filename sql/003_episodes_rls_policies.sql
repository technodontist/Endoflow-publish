-- =============================================
-- RLS POLICIES FOR LONGITUDINAL TRACKING TABLES
-- =============================================
-- Run this in Supabase SQL Editor after 001 and 002
-- Safe to re-run (uses IF NOT EXISTS pattern via DO blocks)

-- Enable RLS on all three tables
ALTER TABLE api.treatment_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.episode_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_timeline ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TREATMENT EPISODES POLICIES
-- =============================================

-- Staff (dentist/assistant) can view all episodes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'treatment_episodes'
      AND policyname = 'Staff can view treatment episodes'
  ) THEN
    CREATE POLICY "Staff can view treatment episodes"
      ON api.treatment_episodes FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
        OR patient_id = auth.uid()
      );
  END IF;
END $$;

-- Dentists can create episodes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'treatment_episodes'
      AND policyname = 'Dentists can create treatment episodes'
  ) THEN
    CREATE POLICY "Dentists can create treatment episodes"
      ON api.treatment_episodes FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
      );
  END IF;
END $$;

-- Dentists can update episodes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'treatment_episodes'
      AND policyname = 'Dentists can update treatment episodes'
  ) THEN
    CREATE POLICY "Dentists can update treatment episodes"
      ON api.treatment_episodes FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
      );
  END IF;
END $$;

-- =============================================
-- EPISODE VISITS POLICIES
-- =============================================

-- Staff can view episode visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'episode_visits'
      AND policyname = 'Staff can view episode visits'
  ) THEN
    CREATE POLICY "Staff can view episode visits"
      ON api.episode_visits FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM api.treatment_episodes te
          WHERE te.id = episode_id
            AND te.patient_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Dentists can create episode visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'episode_visits'
      AND policyname = 'Dentists can create episode visits'
  ) THEN
    CREATE POLICY "Dentists can create episode visits"
      ON api.episode_visits FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
      );
  END IF;
END $$;

-- Dentists can update episode visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'episode_visits'
      AND policyname = 'Dentists can update episode visits'
  ) THEN
    CREATE POLICY "Dentists can update episode visits"
      ON api.episode_visits FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
      );
  END IF;
END $$;

-- =============================================
-- TOOTH TIMELINE POLICIES
-- =============================================

-- Staff and patients can view tooth timeline
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'tooth_timeline'
      AND policyname = 'Users can view tooth timeline'
  ) THEN
    CREATE POLICY "Users can view tooth timeline"
      ON api.tooth_timeline FOR SELECT TO authenticated
      USING (
        patient_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('dentist', 'assistant')
            AND status = 'active'
        )
      );
  END IF;
END $$;

-- Dentists can create timeline entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'tooth_timeline'
      AND policyname = 'Dentists can create timeline entries'
  ) THEN
    CREATE POLICY "Dentists can create timeline entries"
      ON api.tooth_timeline FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
      );
  END IF;
END $$;

-- =============================================
-- GRANT PERMISSIONS
-- Service role has full access by default.
-- Grant authenticated role access for RLS-based queries.
-- =============================================
GRANT SELECT, INSERT, UPDATE ON api.treatment_episodes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api.episode_visits TO authenticated;
GRANT SELECT, INSERT ON api.tooth_timeline TO authenticated;

-- Also grant to service_role for server actions
GRANT ALL ON api.treatment_episodes TO service_role;
GRANT ALL ON api.episode_visits TO service_role;
GRANT ALL ON api.tooth_timeline TO service_role;

-- =============================================
-- VERIFICATION
-- =============================================
-- Check policies exist:
-- SELECT schemaname, tablename, policyname FROM pg_policies
-- WHERE tablename IN ('treatment_episodes', 'episode_visits', 'tooth_timeline');
