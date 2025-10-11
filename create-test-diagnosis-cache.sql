-- Create test AI diagnosis cache entries for testing
-- This allows AI Diagnosis Copilot to work without uploading medical knowledge

-- First, create the cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS api.ai_diagnosis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symptoms_key TEXT NOT NULL,
    symptoms TEXT[] NOT NULL,
    pain_characteristics JSONB,
    clinical_findings TEXT,
    tooth_number TEXT,
    patient_context JSONB,
    suggested_diagnosis TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    reasoning TEXT NOT NULL,
    clinical_significance TEXT NOT NULL,
    differential_diagnoses TEXT[] NOT NULL DEFAULT '{}',
    recommended_tests TEXT[] DEFAULT '{}',
    evidence_sources JSONB NOT NULL DEFAULT '[]',
    ai_model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    processing_time INTEGER,
    hit_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert test cache entries for common symptoms
INSERT INTO api.ai_diagnosis_cache (
    symptoms_key,
    symptoms,
    pain_characteristics,
    tooth_number,
    suggested_diagnosis,
    confidence_score,
    reasoning,
    clinical_significance,
    differential_diagnoses,
    recommended_tests,
    evidence_sources,
    processing_time
) VALUES (
    'Sharp pain, Sensitivity to cold',
    ARRAY['Sharp pain', 'Sensitivity to cold'],
    '{"quality": "Sharp", "intensity": 8, "location": "tooth"}',
    NULL,
    'Irreversible Pulpitis',
    85,
    'Based on the symptoms of sharp, lingering pain and sensitivity to cold, this is characteristic of irreversible pulpitis. The pulp tissue is irreversibly inflamed and cannot heal on its own. This diagnosis is supported by clinical studies showing that prolonged sensitivity to cold stimuli with lingering pain (>30 seconds) is highly indicative of irreversible pulpal inflammation.',
    'Irreversible pulpitis indicates that the dental pulp is irreversibly damaged and requires endodontic treatment (root canal therapy) or extraction. Without treatment, the condition will progress to pulp necrosis and periapical pathology. The prognosis for the tooth is good if treated promptly with root canal therapy.',
    ARRAY['Reversible Pulpitis', 'Acute Apical Periodontitis', 'Cracked Tooth Syndrome'],
    ARRAY['Cold test', 'Electric pulp test', 'Periapical radiograph'],
    '[
        {
            "title": "Endodontic Diagnosis and Treatment Planning",
            "journal": "Journal of Endodontics",
            "year": 2023,
            "doi": "10.1016/j.joen.2023.01.001"
        },
        {
            "title": "Pulpal Pain Diagnosis in Clinical Practice",
            "journal": "International Endodontic Journal",
            "year": 2022,
            "doi": "10.1111/iej.13652"
        }
    ]'::jsonb,
    1247
),
(
    'Pain when chewing, Swelling',
    ARRAY['Pain when chewing', 'Swelling'],
    '{"quality": "Throbbing", "intensity": 7, "location": "gum"}',
    NULL,
    'Acute Apical Abscess',
    90,
    'The combination of pain during mastication and localized swelling strongly suggests an acute apical abscess. This is a suppurative inflammatory process at the tooth apex, typically resulting from pulp necrosis. The presence of swelling indicates active infection with purulent exudate formation.',
    'Acute apical abscess requires immediate treatment including drainage, root canal therapy or extraction, and possible antibiotic therapy if systemic involvement is present. Without treatment, the infection can spread to fascial spaces causing serious complications.',
    ARRAY['Acute Apical Periodontitis', 'Phoenix Abscess', 'Periodontal Abscess'],
    ARRAY['Periapical radiograph', 'Percussion test', 'Vitality test', 'Palpation test'],
    '[
        {
            "title": "Management of Endodontic Infections",
            "journal": "Journal of Endodontics",
            "year": 2023,
            "doi": "10.1016/j.joen.2023.02.015"
        }
    ]'::jsonb,
    1134
),
(
    'Dull ache, Sensitivity to heat',
    ARRAY['Dull ache', 'Sensitivity to heat'],
    '{"quality": "Dull", "intensity": 6, "location": "tooth"}',
    NULL,
    'Chronic Apical Periodontitis',
    80,
    'Dull, persistent pain with sensitivity to heat suggests chronic inflammatory changes at the tooth apex. Unlike acute conditions, chronic apical periodontitis presents with milder symptoms but indicates ongoing periapical pathology. Heat sensitivity, especially if it relieves pain, can indicate necrotic pulp with gas expansion.',
    'Chronic apical periodontitis represents long-standing periapical inflammation, usually associated with pulp necrosis. Treatment involves root canal therapy to eliminate the source of infection and allow periapical healing.',
    ARRAY['Irreversible Pulpitis', 'Acute Apical Periodontitis', 'Condensing Osteitis'],
    ARRAY['Periapical radiograph', 'Vitality test', 'Percussion test'],
    '[
        {
            "title": "Periapical Pathology Diagnosis",
            "journal": "International Endodontic Journal",
            "year": 2022,
            "doi": "10.1111/iej.13789"
        }
    ]'::jsonb,
    1098
);

-- Verify entries were created
SELECT
    suggested_diagnosis,
    confidence_score,
    array_to_string(symptoms, ', ') as symptoms,
    expires_at
FROM api.ai_diagnosis_cache
ORDER BY created_at DESC;
