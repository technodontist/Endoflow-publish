-- UPDATED CONSULTATION SCHEMA FOR DENTAL COLLEGE ASSESSMENT FLOW
-- Run this script after the base ENHANCED_CONSULTATION_SCHEMA.sql

-- =====================================================
-- 1. ADD NEW COLUMNS TO CONSULTATIONS TABLE
-- =====================================================

-- Chief Complaint Details
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS chief_complaint_details JSONB DEFAULT '{
    "primary_complaint": "",
    "onset_duration": "",
    "associated_symptoms": [],
    "severity_scale": 0,
    "location_detail": "",
    "patient_description": ""
}'::jsonb;

-- HOPI (History of Present Illness) Details
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS hopi_details JSONB DEFAULT '{
    "pain_characteristics": {
        "quality": "",
        "severity": 0,
        "timing": "",
        "onset": "",
        "duration": "",
        "frequency": ""
    },
    "aggravating_factors": [],
    "relieving_factors": [],
    "associated_symptoms": [],
    "previous_episodes": "",
    "previous_treatments": [],
    "response_to_treatment": ""
}'::jsonb;

-- Personal History Details
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS personal_history JSONB DEFAULT '{
    "smoking": {
        "status": "never",
        "duration": "",
        "quantity": "",
        "type": ""
    },
    "alcohol": {
        "status": "never",
        "frequency": "",
        "quantity": ""
    },
    "tobacco": {
        "status": "never",
        "type": "",
        "duration": "",
        "frequency": ""
    },
    "dietary_habits": [],
    "oral_hygiene": {
        "brushing_frequency": "",
        "flossing": "",
        "mouthwash": "",
        "last_cleaning": ""
    },
    "other_habits": []
}'::jsonb;

-- Enhanced Clinical Examination
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS extraoral_examination JSONB DEFAULT '{
    "general_appearance": "",
    "facial_symmetry": "",
    "lymph_nodes": "",
    "tmj_examination": "",
    "facial_profile": "",
    "lip_competency": "",
    "facial_height": "",
    "swellings": [],
    "skin_condition": ""
}'::jsonb;

ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS intraoral_examination JSONB DEFAULT '{
    "oral_hygiene": "",
    "gingival_condition": "",
    "periodontal_status": "",
    "tongue_examination": "",
    "palate_examination": "",
    "floor_of_mouth": "",
    "buccal_mucosa": "",
    "lips": "",
    "teeth_present": [],
    "teeth_missing": [],
    "restorations": [],
    "caries": [],
    "mobility": [],
    "occlusion": ""
}'::jsonb;

-- Enhanced Investigations
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS investigations_detailed JSONB DEFAULT '{
    "radiographic": {
        "type": [],
        "findings": "",
        "interpretation": "",
        "uploaded_files": []
    },
    "clinical_tests": {
        "vitality_tests": [],
        "percussion_tests": [],
        "palpation_findings": [],
        "mobility_assessment": []
    },
    "laboratory": {
        "blood_tests": [],
        "other_tests": []
    },
    "special_investigations": []
}'::jsonb;

-- Enhanced Diagnosis Structure
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS diagnosis_detailed JSONB DEFAULT '{
    "provisional_diagnosis": [
        {
            "tooth_number": "",
            "diagnosis": "",
            "reasoning": ""
        }
    ],
    "differential_diagnosis": [],
    "final_diagnosis": [],
    "icd_codes": [],
    "severity": "",
    "prognosis_factors": []
}'::jsonb;

-- Treatment Planning Details
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS treatment_planning JSONB DEFAULT '{
    "immediate_treatment": [],
    "definitive_treatment": [],
    "alternative_treatments": [],
    "treatment_sequence": [],
    "estimated_duration": "",
    "cost_estimate": "",
    "patient_preferences": "",
    "contraindications": [],
    "referrals": []
}'::jsonb;

-- Global Voice Recording
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS global_voice_transcript TEXT;
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS global_voice_processed_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE api.consultations ADD COLUMN IF NOT EXISTS voice_recording_duration INTEGER DEFAULT 0;

-- =====================================================
-- 2. CREATE CONSULTATION TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api.consultation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('chief_complaint', 'hopi', 'medical_history', 'personal_history', 'examination', 'investigations')),
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    is_system_template BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. CREATE CONSULTATION PROGRESS TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS api.consultation_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES api.consultations(id) ON DELETE CASCADE,
    tab_name TEXT NOT NULL,
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    required_fields_completed INTEGER DEFAULT 0,
    total_required_fields INTEGER DEFAULT 0,
    UNIQUE(consultation_id, tab_name)
);

-- =====================================================
-- 4. INSERT SYSTEM TEMPLATES
-- =====================================================

-- Chief Complaint Templates
INSERT INTO api.consultation_templates (template_name, template_type, template_data, is_system_template) VALUES
('Toothache', 'chief_complaint', '{
    "primary_complaint": "Toothache",
    "common_symptoms": ["Throbbing pain", "Sharp pain", "Dull ache", "Sensitivity to hot/cold"],
    "onset_options": ["Sudden", "Gradual", "After eating", "Spontaneous"],
    "severity_descriptors": ["Mild", "Moderate", "Severe", "Excruciating"]
}', TRUE),
('Swelling', 'chief_complaint', '{
    "primary_complaint": "Facial/Gum swelling",
    "common_symptoms": ["Localized swelling", "Diffuse swelling", "Pain with swelling", "Difficulty opening mouth"],
    "onset_options": ["Overnight", "Few days", "Gradual increase", "After procedure"],
    "severity_descriptors": ["Small", "Moderate", "Large", "Extensive"]
}', TRUE);

-- HOPI Templates
INSERT INTO api.consultation_templates (template_name, template_type, template_data, is_system_template) VALUES
('Acute Pain', 'hopi', '{
    "pain_quality_options": ["Sharp", "Throbbing", "Dull", "Shooting", "Burning", "Aching"],
    "timing_options": ["Constant", "Intermittent", "Only when chewing", "At night", "In morning"],
    "aggravating_factors": ["Hot foods", "Cold foods", "Sweet foods", "Chewing", "Pressure"],
    "relieving_factors": ["Pain medication", "Cold compress", "Warm compress", "Avoiding chewing", "Rest"]
}', TRUE);

-- Medical History Templates
INSERT INTO api.consultation_templates (template_name, template_type, template_data, is_system_template) VALUES
('Standard Medical History', 'medical_history', '{
    "medical_conditions": ["Diabetes", "Hypertension", "Heart Disease", "Asthma", "Thyroid disorders", "Kidney disease", "Liver disease", "Cancer", "Bleeding disorders", "Allergies"],
    "medication_categories": ["Cardiovascular", "Endocrine", "Respiratory", "Gastrointestinal", "Neurological", "Pain medications", "Antibiotics", "Vitamins/Supplements"],
    "allergy_types": ["Drug allergies", "Food allergies", "Environmental allergies", "Latex allergy"]
}', TRUE);

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_consultation_templates_type ON api.consultation_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_consultation_templates_active ON api.consultation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_consultation_progress_consultation ON api.consultation_progress(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_progress_tab ON api.consultation_progress(tab_name);

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Consultation Templates
ALTER TABLE api.consultation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system templates" ON api.consultation_templates
    FOR SELECT TO authenticated
    USING (is_system_template = TRUE);

CREATE POLICY "Users can manage their own templates" ON api.consultation_templates
    FOR ALL TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Consultation Progress
ALTER TABLE api.consultation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage consultation progress" ON api.consultation_progress
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

-- =====================================================
-- 7. UPDATED_AT TRIGGERS
-- =====================================================

CREATE TRIGGER update_consultation_templates_updated_at
    BEFORE UPDATE ON api.consultation_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. HELPFUL VIEWS
-- =====================================================

-- Enhanced consultation summary with new fields
CREATE OR REPLACE VIEW api.consultation_summary_enhanced AS
SELECT
    c.id,
    c.patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    c.dentist_id,
    d.full_name AS dentist_name,
    c.consultation_date,
    c.status,
    c.chief_complaint,
    c.chief_complaint_details->>'primary_complaint' AS primary_complaint,
    c.hopi_details->>'pain_characteristics' AS pain_summary,
    (c.diagnosis_detailed->>'provisional_diagnosis')::jsonb AS provisional_diagnoses,
    c.prognosis,
    c.voice_recording_duration,
    -- Progress calculation
    COALESCE(
        (SELECT AVG(completion_percentage)
         FROM api.consultation_progress
         WHERE consultation_id = c.id), 0
    ) AS overall_completion_percentage,
    c.created_at,
    c.updated_at
FROM api.consultations c
LEFT JOIN api.patients p ON c.patient_id = p.id
LEFT JOIN api.dentists d ON c.dentist_id = d.id;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

SELECT 'Updated Consultation Schema Created Successfully!' AS status;