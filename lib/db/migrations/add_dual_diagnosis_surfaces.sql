-- ============================================================
-- Migration: Dual-Diagnosis + Surface Conditions
-- Session 7: Adds restorative diagnosis fields and surface-level
-- caries tracking to the tooth_diagnoses table.
-- All columns are nullable — zero impact on existing data.
-- ============================================================

-- 1. Endodontic diagnosis (separated from generic primary_diagnosis)
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS endodontic_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS endodontic_confidence INTEGER;

-- 2. Restorative diagnosis
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS restorative_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS restorative_confidence INTEGER;

-- 3. Caries surface classification
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS caries_surfaces TEXT; -- e.g., 'MOD', 'OB', 'DO'

-- 4. Caries depth
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS caries_depth TEXT; -- superficial_enamel, into_dentin, deep_dentin, near_pulp, into_pulp

-- 5. Restoration planning
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS restoration_type TEXT; -- direct_composite, indirect_onlay, indirect_crown, etc.
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS restoration_material TEXT; -- composite, zirconia, emax, pfm, etc.

-- 6. Surface conditions (per-surface detail as JSONB)
-- Structure: {"O": {"condition": "caries", "color": "#ef4444"}, "M": {"condition": "healthy", "color": "#d1fae5"}, ...}
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS surface_conditions JSONB;

-- 7. Combined treatment sequence (endo + restorative treatment plan)
ALTER TABLE api.tooth_diagnoses
  ADD COLUMN IF NOT EXISTS combined_treatment_sequence TEXT;

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE ON api.tooth_diagnoses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api.tooth_diagnoses TO service_role;

-- 9. Add index on surface_conditions for queries filtering by surface data
CREATE INDEX IF NOT EXISTS idx_tooth_diagnoses_has_surface_conditions
  ON api.tooth_diagnoses ((surface_conditions IS NOT NULL))
  WHERE surface_conditions IS NOT NULL;

-- Done! Run in Supabase SQL Editor.
