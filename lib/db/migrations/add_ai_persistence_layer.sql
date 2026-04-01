-- ================================================================
-- AI PERSISTENCE LAYER — Comprehensive Migration
-- Session 14, Phase D (Extended)
-- ================================================================
-- This migration creates 4 tables that close the persistence gaps
-- across the entire EndoFlow AI pipeline:
--
-- 1. endoflow_sessions      — Master AI session memory (survives restarts)
-- 2. ai_synthesis_results    — Full AI diagnosis/treatment output per tooth
-- 3. gap_analysis_answers    — Dentist Q&A during gap-filling
-- 4. consultation_evidence   — RAG retrieval log linking consultations to literature
--
-- Together these ensure NO AI output is lost between sessions,
-- and PDF reports can pull rich structured data instead of free text.
-- ================================================================


-- ================================================================
-- TABLE 1: endoflow_sessions
-- Master AI session persistence (replaces in-memory Map)
-- ================================================================
-- Currently: master-ai-session.ts uses Map<string, MasterAISession>
--   → Lost on server restart, Vercel cold start, page refresh
-- After: Supabase table with UPSERT, survives everything
-- ================================================================

CREATE TABLE IF NOT EXISTS api.endoflow_sessions (
  -- One session per dentist (UPSERT pattern)
  dentist_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conversation history (sliding window, max 20 messages)
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each message: { role: 'user'|'assistant', content: string, timestamp: string, intent?: string }

  -- Active context (what the dentist is currently working on)
  active_patient JSONB,
  -- { patientId: uuid, patientName: string, lastLookup: timestamp }

  active_consultation JSONB,
  -- { consultationId: uuid, status: string, toothNumbers: string[] }

  current_mode TEXT DEFAULT 'home',
  -- Which dashboard mode the dentist is in: home, clinical, calendar, etc.

  -- Pronoun/reference resolution map
  pronouns_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { "his": "Popatlal Pandey", "that tooth": "46", "the patient": "Popatlal" }

  -- Intent classification log (last 50 intents for analytics)
  intent_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each entry: { intent: string, confidence: number, query: string, timestamp: string }

  -- Session metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION api.update_endoflow_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_endoflow_sessions_updated
  BEFORE UPDATE ON api.endoflow_sessions
  FOR EACH ROW
  EXECUTE FUNCTION api.update_endoflow_session_timestamp();

-- RLS: dentists can only read/write their own session
ALTER TABLE api.endoflow_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dentists own their sessions"
  ON api.endoflow_sessions
  FOR ALL TO authenticated
  USING (dentist_id = auth.uid())
  WITH CHECK (dentist_id = auth.uid());

-- Grant access
GRANT ALL ON api.endoflow_sessions TO authenticated;
GRANT ALL ON api.endoflow_sessions TO service_role;


-- ================================================================
-- TABLE 2: ai_synthesis_results
-- Full AI diagnosis + treatment output per tooth per consultation
-- ================================================================
-- Currently: SynthesisOutput lives in server RAM (activeSessions Map)
--   → Lost when consultation ends or server restarts
--   → Only plain text strings saved to tooth_diagnoses/consultations
-- After: Full structured AI output persisted with confidence scores,
--   differentials, citations, AAE classification, prognosis factors
-- ================================================================

CREATE TABLE IF NOT EXISTS api.ai_synthesis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  consultation_id UUID NOT NULL,       -- References api.consultations.id
  patient_id UUID NOT NULL,            -- References auth.users.id
  dentist_id UUID NOT NULL,            -- References auth.users.id
  tooth_number TEXT NOT NULL,           -- FDI notation (e.g., '36', '46')
  tooth_diagnosis_id UUID,             -- References api.tooth_diagnoses.id (set after save)

  -- Diagnosis output (from SynthesisOutput)
  primary_diagnosis TEXT NOT NULL,
  diagnosis_confidence INTEGER NOT NULL DEFAULT 0,  -- 0-100
  aae_classification TEXT,              -- e.g., 'Symptomatic Irreversible Pulpitis with Symptomatic Apical Periodontitis'

  -- Differential diagnoses with probabilities
  differential_diagnoses JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of: { diagnosis: string, probability: number, reasoning: string }

  -- Treatment output
  recommended_treatment TEXT NOT NULL,
  treatment_confidence INTEGER NOT NULL DEFAULT 0,  -- 0-100
  treatment_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of: { treatment: string, success_rate: number, evidence_level: string,
  --             from_literature: boolean, from_clinic_data: boolean,
  --             indications: string[], contraindications: string[],
  --             supporting_evidence: string, citations: string[] }

  combined_treatment_sequence TEXT,     -- e.g., "1. RCT → 2. Post & core → 3. Crown"

  -- Prognosis
  prognosis TEXT,                       -- excellent/good/fair/poor/hopeless
  prognosis_factors JSONB DEFAULT '[]'::jsonb,  -- string[]

  -- Subspecialty classification
  subspecialty_classification JSONB,
  -- { endodontic: number, restorative: number, periodontic: number, surgical: number, primary: string }

  -- Restorative-specific (dual diagnosis)
  restorative_diagnosis JSONB,
  -- { primary: string, caries_classification: string, surfaces_involved: string,
  --   caries_depth: string, restoration_type: string, restoration_material: string,
  --   confidence: number, treatment_options: [] }

  -- Conductor output (when multi-track)
  conductor_output JSONB,
  -- { treatment_sequence: [], interaction_warnings: [], prognosis_grade: string,
  --   conflicts: [], clinical_summary: string, recommendation: string }

  -- Literature evidence
  literature_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of: { title: string, authors: string, journal: string, year: number,
  --             doi: string, relevance: string }

  -- Clinic-specific outcomes used in synthesis
  clinic_outcomes_summary TEXT,

  -- Pipeline metadata
  pipeline_version TEXT DEFAULT 'v1',   -- Track which pipeline version generated this
  ai_model TEXT,                        -- e.g., 'claude-sonnet-4-20250514', 'gemini-2.5-flash'
  processing_time_ms INTEGER,           -- Total pipeline execution time
  gap_questions_asked INTEGER DEFAULT 0,
  gap_questions_answered INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | accepted | rejected | superseded
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,                     -- References auth.users.id

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_synthesis_consultation
  ON api.ai_synthesis_results(consultation_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_patient_tooth
  ON api.ai_synthesis_results(patient_id, tooth_number);
CREATE INDEX IF NOT EXISTS idx_synthesis_patient
  ON api.ai_synthesis_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_status
  ON api.ai_synthesis_results(status);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION api.update_synthesis_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_synthesis_updated
  BEFORE UPDATE ON api.ai_synthesis_results
  FOR EACH ROW
  EXECUTE FUNCTION api.update_synthesis_timestamp();

-- RLS
ALTER TABLE api.ai_synthesis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dentists manage their synthesis results"
  ON api.ai_synthesis_results
  FOR ALL TO authenticated
  USING (
    dentist_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('dentist', 'assistant')
      AND status = 'active'
    )
  )
  WITH CHECK (dentist_id = auth.uid());

GRANT ALL ON api.ai_synthesis_results TO authenticated;
GRANT ALL ON api.ai_synthesis_results TO service_role;


-- ================================================================
-- TABLE 3: gap_analysis_answers
-- Records every Q&A exchange during diagnostic gap-filling
-- ================================================================
-- Currently: answerHistory[] lives in React component state
--   → Lost when component unmounts or page navigates away
-- After: Full audit trail of what the AI asked, what the dentist
--   answered, and how each answer changed confidence
-- ================================================================

CREATE TABLE IF NOT EXISTS api.gap_analysis_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  synthesis_id UUID NOT NULL,           -- References api.ai_synthesis_results.id
  consultation_id UUID NOT NULL,        -- References api.consultations.id
  patient_id UUID NOT NULL,             -- References auth.users.id
  tooth_number TEXT NOT NULL,            -- FDI notation

  -- Question details
  question_id TEXT NOT NULL,            -- From questionnaire template (e.g., 'pulp_vitality')
  questionnaire_source TEXT,            -- 'aae_endo', 'iadt_trauma', 'aap_perio', 'cracked_tooth'
  question_text TEXT NOT NULL,          -- Human-readable question shown to dentist
  question_category TEXT,               -- 'subjective', 'objective', 'investigation'

  -- Answer details
  raw_answer TEXT NOT NULL,             -- Dentist's raw text/voice answer
  parsed_value TEXT,                    -- AI-extracted structured value
  answer_source TEXT DEFAULT 'manual',  -- 'manual' | 'voice' | 'auto_context' | 'from_consultation'

  -- Diagnostic impact
  diagnostic_weight TEXT,               -- 'diagnosis_changing' | 'confidence_improving' | 'context_enriching'
  confidence_delta NUMERIC(5,2),        -- How much this answer changed overall confidence (e.g., +12.5)
  is_positive_finding BOOLEAN DEFAULT false,  -- Whether this answer is clinically significant

  -- Ordering
  sequence_number INTEGER NOT NULL DEFAULT 0,  -- Order in which questions were asked

  -- Timestamps
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gap_synthesis
  ON api.gap_analysis_answers(synthesis_id);
CREATE INDEX IF NOT EXISTS idx_gap_consultation
  ON api.gap_analysis_answers(consultation_id);
CREATE INDEX IF NOT EXISTS idx_gap_patient_tooth
  ON api.gap_analysis_answers(patient_id, tooth_number);

-- RLS
ALTER TABLE api.gap_analysis_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage gap analysis"
  ON api.gap_analysis_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('dentist', 'assistant')
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('dentist', 'assistant')
      AND status = 'active'
    )
  );

GRANT ALL ON api.gap_analysis_answers TO authenticated;
GRANT ALL ON api.gap_analysis_answers TO service_role;


-- ================================================================
-- TABLE 4: consultation_evidence
-- Links consultations to literature retrieved via RAG
-- ================================================================
-- Currently: RAG retrieval results (document IDs, similarity scores)
--   are used once during synthesis and discarded
-- After: Permanent evidence trail for each consultation/tooth
--   → PDF reports pull citation lists from this table
--   → Research module can analyze which literature is most cited
--   → Longitudinal: see evidence used across visits for same tooth
-- ================================================================

CREATE TABLE IF NOT EXISTS api.consultation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  synthesis_id UUID,                    -- References api.ai_synthesis_results.id
  consultation_id UUID NOT NULL,        -- References api.consultations.id
  patient_id UUID NOT NULL,             -- References auth.users.id
  tooth_number TEXT,                    -- FDI notation (nullable for general questions)

  -- Source document reference
  medical_knowledge_id UUID,            -- References api.medical_knowledge.id (if from our library)

  -- Citation details (denormalized for fast PDF generation)
  citation_title TEXT NOT NULL,
  citation_authors TEXT,
  citation_journal TEXT,
  citation_year INTEGER,
  citation_doi TEXT,
  citation_url TEXT,

  -- Retrieval metadata
  similarity_score NUMERIC(5,4),        -- Cosine similarity (0.0000 - 1.0000)
  search_mode TEXT,                     -- 'vector' | 'bm25' | 'hybrid'
  relevance_note TEXT,                  -- Why this citation was relevant
  retrieval_rank INTEGER,               -- Position in retrieval results (1 = most similar)

  -- Usage context
  used_for TEXT DEFAULT 'diagnosis',    -- 'diagnosis' | 'treatment' | 'prognosis' | 'general'

  -- Timestamps
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evidence_synthesis
  ON api.consultation_evidence(synthesis_id);
CREATE INDEX IF NOT EXISTS idx_evidence_consultation
  ON api.consultation_evidence(consultation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_patient
  ON api.consultation_evidence(patient_id);
CREATE INDEX IF NOT EXISTS idx_evidence_knowledge
  ON api.consultation_evidence(medical_knowledge_id);
CREATE INDEX IF NOT EXISTS idx_evidence_doi
  ON api.consultation_evidence(citation_doi);

-- RLS
ALTER TABLE api.consultation_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage evidence"
  ON api.consultation_evidence
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('dentist', 'assistant')
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('dentist', 'assistant')
      AND status = 'active'
    )
  );

GRANT ALL ON api.consultation_evidence TO authenticated;
GRANT ALL ON api.consultation_evidence TO service_role;


-- ================================================================
-- VIEW: latest_synthesis_per_tooth
-- Quick lookup: most recent AI synthesis for each patient+tooth
-- ================================================================
-- Use case: When starting a new consultation, pull the previous
-- AI diagnosis for context. Also feeds the dental chart tooltips.
-- ================================================================

CREATE OR REPLACE VIEW api.latest_synthesis_per_tooth AS
SELECT DISTINCT ON (patient_id, tooth_number)
  id,
  consultation_id,
  patient_id,
  dentist_id,
  tooth_number,
  primary_diagnosis,
  diagnosis_confidence,
  aae_classification,
  recommended_treatment,
  treatment_confidence,
  combined_treatment_sequence,
  prognosis,
  status,
  created_at,
  updated_at
FROM api.ai_synthesis_results
WHERE status IN ('draft', 'accepted')
ORDER BY patient_id, tooth_number, created_at DESC;

GRANT SELECT ON api.latest_synthesis_per_tooth TO authenticated;
GRANT SELECT ON api.latest_synthesis_per_tooth TO service_role;


-- ================================================================
-- VIEW: consultation_full_evidence
-- Joins synthesis + evidence for PDF report generation
-- ================================================================

CREATE OR REPLACE VIEW api.consultation_full_evidence AS
SELECT
  s.id AS synthesis_id,
  s.consultation_id,
  s.patient_id,
  s.tooth_number,
  s.primary_diagnosis,
  s.diagnosis_confidence,
  s.recommended_treatment,
  s.treatment_confidence,
  s.literature_citations,
  s.prognosis,
  s.status AS synthesis_status,
  e.citation_title,
  e.citation_authors,
  e.citation_journal,
  e.citation_year,
  e.citation_doi,
  e.similarity_score,
  e.used_for
FROM api.ai_synthesis_results s
LEFT JOIN api.consultation_evidence e ON e.synthesis_id = s.id
ORDER BY s.consultation_id, s.tooth_number, e.retrieval_rank;

GRANT SELECT ON api.consultation_full_evidence TO authenticated;
GRANT SELECT ON api.consultation_full_evidence TO service_role;


-- ================================================================
-- DONE
-- ================================================================
-- After running this migration:
-- 1. Master AI sessions survive restarts (endoflow_sessions)
-- 2. Full AI synthesis output is persisted per tooth (ai_synthesis_results)
-- 3. Gap-filling Q&A history is auditable (gap_analysis_answers)
-- 4. Literature evidence is traceable (consultation_evidence)
-- 5. Views provide fast lookups for dental chart and PDF reports
-- ================================================================
