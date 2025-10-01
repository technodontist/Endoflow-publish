-- Templates Management Database Schema
-- Run this SQL in Supabase SQL Editor

-- 1. Create clinical_templates table
CREATE TABLE IF NOT EXISTS api.clinical_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dentist_id UUID NOT NULL, -- References auth.users.id

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
    'endodontics', 'periodontics', 'oral_surgery', 'restorative',
    'orthodontics', 'general', 'emergency', 'pediatric', 'prosthetics', 'diagnostics'
  )),

  -- Template content and structure
  template_content TEXT NOT NULL, -- JSON string of form fields and structure
  form_fields TEXT NOT NULL DEFAULT '[]', -- JSON array of field definitions
  default_values TEXT, -- JSON object of default field values

  -- Usage and sharing
  is_public BOOLEAN NOT NULL DEFAULT false, -- Can other dentists use this template?
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0, -- How many times used

  -- Clinical relevance
  specialties TEXT, -- JSON array of relevant specialties
  tags TEXT, -- JSON array of searchable tags
  clinical_indications TEXT, -- When to use this template

  -- Version control and collaboration
  version TEXT NOT NULL DEFAULT '1.0',
  parent_template_id UUID, -- References another clinical_templates.id for versions
  collaborators TEXT, -- JSON array of dentist IDs with edit access

  -- Quality and validation
  is_validated BOOLEAN NOT NULL DEFAULT false, -- Reviewed by senior dentist
  validated_by UUID, -- References auth.users.id
  validated_at TIMESTAMP WITH TIME ZONE,
  validation_notes TEXT,

  -- System metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE -- Soft delete timestamp
);

-- 2. Create template_usage_history table
CREATE TABLE IF NOT EXISTS api.template_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL, -- References api.clinical_templates.id
  dentist_id UUID NOT NULL, -- References auth.users.id (user)
  patient_id UUID, -- References auth.users.id (optional - if used for specific patient)
  consultation_id UUID, -- References api.consultations.id (optional)

  -- Usage details
  usage_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completion_status TEXT NOT NULL DEFAULT 'completed' CHECK (completion_status IN (
    'draft', 'completed', 'partially_completed', 'cancelled'
  )),

  -- Performance tracking
  time_to_complete INTEGER, -- in seconds
  modifications TEXT, -- JSON string of field modifications made
  customizations TEXT, -- JSON string of template customizations

  -- Feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
  feedback TEXT, -- User feedback about template
  suggested_improvements TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Create template_categories table
CREATE TABLE IF NOT EXISTS api.template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Visual and organizational
  color_code TEXT NOT NULL DEFAULT '#6b7280', -- Tailwind color for UI
  icon TEXT NOT NULL DEFAULT 'folder', -- Icon name for UI
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Hierarchy support
  parent_category_id UUID, -- References another template_categories.id
  level INTEGER NOT NULL DEFAULT 0, -- Hierarchy level (0 = root)

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  template_count INTEGER NOT NULL DEFAULT 0, -- Updated via triggers

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Enable Row Level Security
ALTER TABLE api.clinical_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.template_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.template_categories ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for clinical_templates

-- Dentists can view their own templates and public templates
CREATE POLICY "Dentists can view templates" ON api.clinical_templates
FOR SELECT TO authenticated
USING (
  dentist_id = auth.uid() OR
  is_public = true OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'dentist'
    AND status = 'active'
  )
);

-- Dentists can create templates
CREATE POLICY "Dentists can create templates" ON api.clinical_templates
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'dentist'
    AND status = 'active'
  )
  AND dentist_id = auth.uid()
);

-- Dentists can update their own templates
CREATE POLICY "Dentists can update own templates" ON api.clinical_templates
FOR UPDATE TO authenticated
USING (dentist_id = auth.uid())
WITH CHECK (dentist_id = auth.uid());

-- 6. Create RLS Policies for template_usage_history

-- Dentists can view their own usage history
CREATE POLICY "Dentists can view own usage history" ON api.template_usage_history
FOR SELECT TO authenticated
USING (dentist_id = auth.uid());

-- Dentists can create usage history entries
CREATE POLICY "Dentists can create usage history" ON api.template_usage_history
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'dentist'
    AND status = 'active'
  )
  AND dentist_id = auth.uid()
);

-- 7. Template categories are public for all authenticated users
CREATE POLICY "All authenticated users can view categories" ON api.template_categories
FOR SELECT TO authenticated
USING (true);

-- 8. Insert default template categories
INSERT INTO api.template_categories (name, display_name, color_code, sort_order, description)
VALUES
  ('endodontics', 'Endodontics', '#ef4444', 1, 'Templates for endodontics procedures and documentation'),
  ('periodontics', 'Periodontics', '#3b82f6', 2, 'Templates for periodontics procedures and documentation'),
  ('oral_surgery', 'Oral Surgery', '#8b5cf6', 3, 'Templates for oral surgery procedures and documentation'),
  ('restorative', 'Restorative', '#10b981', 4, 'Templates for restorative procedures and documentation'),
  ('orthodontics', 'Orthodontics', '#f97316', 5, 'Templates for orthodontics procedures and documentation'),
  ('general', 'General', '#6b7280', 6, 'Templates for general procedures and documentation'),
  ('emergency', 'Emergency', '#dc2626', 7, 'Templates for emergency procedures and documentation'),
  ('pediatric', 'Pediatric', '#22c55e', 8, 'Templates for pediatric procedures and documentation'),
  ('prosthetics', 'Prosthetics', '#6366f1', 9, 'Templates for prosthetics procedures and documentation'),
  ('diagnostics', 'Diagnostics', '#eab308', 10, 'Templates for diagnostics procedures and documentation')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  color_code = EXCLUDED.color_code,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

-- 9. Create some sample templates (will only work if dentists exist in the database)
-- First, get the first dentist ID
DO $$
DECLARE
    first_dentist_id UUID;
BEGIN
    SELECT id INTO first_dentist_id FROM api.dentists LIMIT 1;

    IF first_dentist_id IS NOT NULL THEN
        -- Insert sample templates
        INSERT INTO api.clinical_templates (
            dentist_id, name, description, category, template_content, form_fields,
            specialties, tags, clinical_indications
        ) VALUES
        (
            first_dentist_id,
            'Root Canal Assessment',
            'Standard template for root canal treatment evaluation and planning',
            'endodontics',
            '# Root Canal Assessment Template

## Patient Information
- Patient Name: _______________
- Date: _______________
- Tooth Number: _______________

## Clinical Examination
### Visual Inspection
- Crown condition: _______________
- Gum condition: _______________

### Percussion Test
- Result: _______________

### Palpation Test
- Result: _______________

### Thermal Test
- Cold response: _______________
- Heat response: _______________

## Radiographic Findings
- Periapical status: _______________
- Root morphology: _______________
- Canal anatomy: _______________

## Diagnosis
- Primary diagnosis: _______________
- Secondary diagnosis: _______________

## Treatment Plan
1. _______________
2. _______________
3. _______________

## Prognosis
- Expected outcome: _______________

## Notes
_______________',
            '[
                {"type": "text", "name": "patient_name", "label": "Patient Name", "required": true},
                {"type": "date", "name": "assessment_date", "label": "Date", "required": true},
                {"type": "text", "name": "tooth_number", "label": "Tooth Number", "required": true},
                {"type": "textarea", "name": "clinical_findings", "label": "Clinical Examination", "required": true},
                {"type": "textarea", "name": "diagnosis", "label": "Diagnosis", "required": true},
                {"type": "textarea", "name": "treatment_plan", "label": "Treatment Plan", "required": true}
            ]',
            '["Endodontics"]',
            '["root_canal", "assessment", "endodontics", "evaluation"]',
            'Use for comprehensive root canal treatment planning and documentation'
        ),
        (
            first_dentist_id,
            'Periodontal Evaluation',
            'Comprehensive periodontal assessment template for gum health evaluation',
            'periodontics',
            '# Periodontal Evaluation Template

## Patient Information
- Name: _______________
- Date: _______________

## Chief Complaint
_______________

## Medical History Review
- Diabetes: Y/N
- Smoking: Y/N
- Medications: _______________

## Clinical Examination
### Gingival Assessment
- Color: _______________
- Consistency: _______________
- Bleeding on probing: Y/N

### Periodontal Probing
- Pocket depths recorded: Y/N
- Attachment levels: _______________

### Mobility Assessment
- Teeth with mobility: _______________

## Radiographic Analysis
- Bone levels: _______________
- Calculus deposits: _______________

## Diagnosis
- Periodontal status: _______________

## Treatment Plan
1. _______________
2. _______________

## Home Care Instructions
_______________',
            '[
                {"type": "text", "name": "patient_name", "label": "Patient Name", "required": true},
                {"type": "date", "name": "evaluation_date", "label": "Date", "required": true},
                {"type": "textarea", "name": "chief_complaint", "label": "Chief Complaint", "required": true},
                {"type": "textarea", "name": "clinical_examination", "label": "Clinical Examination", "required": true},
                {"type": "textarea", "name": "diagnosis", "label": "Periodontal Diagnosis", "required": true},
                {"type": "textarea", "name": "treatment_plan", "label": "Treatment Plan", "required": true}
            ]',
            '["Periodontics"]',
            '["periodontal", "gum_health", "assessment", "evaluation"]',
            'Use for comprehensive periodontal health assessment and treatment planning'
        );

        RAISE NOTICE 'Sample templates created successfully';
    ELSE
        RAISE NOTICE 'No dentists found - sample templates not created';
    END IF;
END $$;