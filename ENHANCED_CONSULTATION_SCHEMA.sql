-- ENHANCED CONSULTATION SYSTEM DATABASE SCHEMA
-- Run this script in Supabase SQL Editor to create required tables

-- =====================================================
-- 1. CONSULTATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api.consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dentist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consultation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),

    -- Pain Assessment Section
    chief_complaint TEXT,
    pain_assessment JSONB DEFAULT '{
        "location": "",
        "intensity": 0,
        "duration": "",
        "character": "",
        "triggers": [],
        "relief": []
    }'::jsonb,

    -- Medical History Section
    medical_history JSONB DEFAULT '{
        "history": [],
        "medications": [],
        "allergies": [],
        "previousTreatments": []
    }'::jsonb,

    -- Clinical Examination Section
    clinical_examination JSONB DEFAULT '{
        "extraoral": "",
        "intraoral": "",
        "periodontal": "",
        "occlusion": ""
    }'::jsonb,

    -- Investigations Section
    investigations JSONB DEFAULT '{
        "radiographic": "",
        "vitality": "",
        "percussion": "",
        "palpation": ""
    }'::jsonb,

    -- Diagnosis Section
    diagnosis JSONB DEFAULT '{
        "provisional": [],
        "differential": [],
        "final": []
    }'::jsonb,

    -- Treatment Plan Section
    treatment_plan JSONB DEFAULT '{
        "procedures": [],
        "timeline": "",
        "cost_estimate": "",
        "notes": ""
    }'::jsonb,

    -- Prognosis
    prognosis TEXT CHECK (prognosis IN ('excellent', 'good', 'fair', 'poor', 'hopeless')),

    -- Voice/AI Integration
    voice_transcript JSONB DEFAULT '[]'::jsonb,
    ai_parsed_data JSONB DEFAULT '{}'::jsonb,
    voice_session_active BOOLEAN DEFAULT FALSE,

    -- Prescription & Follow-up references
    prescription_data JSONB DEFAULT '{}'::jsonb,
    follow_up_data JSONB DEFAULT '{}'::jsonb,

    -- Additional Notes
    additional_notes TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TOOTH DIAGNOSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api.tooth_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES api.consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tooth_number TEXT NOT NULL,

    -- Tooth Status
    status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN (
        'healthy', 'caries', 'filled', 'crown', 'missing',
        'attention', 'root_canal', 'extraction_needed', 'implant'
    )),

    -- Diagnosis Details
    primary_diagnosis TEXT,
    diagnosis_details TEXT,
    symptoms TEXT[] DEFAULT '{}',

    -- Treatment Information
    recommended_treatment TEXT,
    treatment_priority TEXT DEFAULT 'medium' CHECK (treatment_priority IN (
        'urgent', 'high', 'medium', 'low', 'routine'
    )),
    treatment_details TEXT,
    estimated_duration INTEGER, -- in minutes
    estimated_cost DECIMAL(10,2),

    -- Visual Properties
    color_code TEXT DEFAULT '#22c55e', -- Green for healthy

    -- Scheduling
    scheduled_date DATE,
    follow_up_required BOOLEAN DEFAULT FALSE,

    -- Metadata
    examination_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique tooth per consultation
    UNIQUE(consultation_id, tooth_number)
);

-- =====================================================
-- 3. VOICE SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api.voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES api.consultations(id) ON DELETE CASCADE,
    dentist_id UUID NOT NULL REFERENCES auth.users(id),

    -- Session Details
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Voice Data
    transcript JSONB DEFAULT '[]'::jsonb,
    raw_audio_url TEXT, -- Supabase Storage URL if we store audio

    -- Processing Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'processing', 'completed', 'failed')),

    -- N8N Integration
    n8n_webhook_url TEXT,
    n8n_session_id UUID,

    -- Processed Data
    processed_data JSONB DEFAULT '{
        "pain_assessment": {},
        "clinical_examination": {},
        "investigations": {},
        "diagnosis": {},
        "treatment_plan": {}
    }'::jsonb,

    -- AI Confidence Scores
    ai_confidence JSONB DEFAULT '{}'::jsonb,

    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

-- Consultations indexes
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON api.consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_dentist_id ON api.consultations(dentist_id);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON api.consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON api.consultations(status);

-- Tooth diagnoses indexes
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_consultation_id ON api.tooth_diagnoses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_patient_id ON api.tooth_diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_tooth_number ON api.tooth_diagnoses(tooth_number);
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_status ON api.tooth_diagnoses(status);

-- Voice sessions indexes
CREATE INDEX IF NOT EXISTS idx_voice_sessions_consultation_id ON api.voice_sessions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_dentist_id ON api.voice_sessions(dentist_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON api.voice_sessions(status);

-- =====================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE api.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.tooth_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.voice_sessions ENABLE ROW LEVEL SECURITY;

-- Consultations policies
CREATE POLICY "Dentists can manage all consultations" ON api.consultations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

CREATE POLICY "Patients can view their own consultations" ON api.consultations
    FOR SELECT TO authenticated
    USING (
        patient_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- Tooth diagnoses policies
CREATE POLICY "Staff can manage tooth diagnoses" ON api.tooth_diagnoses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

CREATE POLICY "Patients can view their tooth diagnoses" ON api.tooth_diagnoses
    FOR SELECT TO authenticated
    USING (
        patient_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('assistant', 'dentist')
            AND status = 'active'
        )
    );

-- Voice sessions policies
CREATE POLICY "Dentists can manage voice sessions" ON api.voice_sessions
    FOR ALL TO authenticated
    USING (
        dentist_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'dentist'
            AND status = 'active'
        )
    );

-- =====================================================
-- 6. UPDATED_AT TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_consultations_updated_at
    BEFORE UPDATE ON api.consultations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tooth_diagnoses_updated_at
    BEFORE UPDATE ON api.tooth_diagnoses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_sessions_updated_at
    BEFORE UPDATE ON api.voice_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. HELPFUL VIEWS
-- =====================================================

-- View for complete consultation with tooth data
CREATE OR REPLACE VIEW api.consultation_summary AS
SELECT
    c.id,
    c.patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    c.dentist_id,
    d.full_name AS dentist_name,
    c.consultation_date,
    c.status,
    c.chief_complaint,
    c.prognosis,
    COUNT(td.id) AS teeth_diagnosed,
    COUNT(CASE WHEN td.status != 'healthy' THEN 1 END) AS teeth_with_issues,
    c.created_at,
    c.updated_at
FROM api.consultations c
LEFT JOIN api.patients p ON c.patient_id = p.id
LEFT JOIN api.dentists d ON c.dentist_id = d.id
LEFT JOIN api.tooth_diagnoses td ON c.id = td.consultation_id
GROUP BY c.id, p.first_name, p.last_name, d.full_name;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Test the setup
SELECT 'Enhanced Consultation Schema Created Successfully!' AS status;