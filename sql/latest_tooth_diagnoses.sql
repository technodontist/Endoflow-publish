-- View: api.latest_tooth_diagnoses
-- Returns the most recent diagnosis per patient_id + tooth_number across all consultations
CREATE OR REPLACE VIEW api.latest_tooth_diagnoses AS
SELECT DISTINCT ON (td.patient_id, td.tooth_number)
  td.id,
  td.consultation_id,
  td.patient_id,
  td.tooth_number,
  td.status,
  td.primary_diagnosis,
  td.diagnosis_details,
  td.symptoms,
  td.recommended_treatment,
  td.treatment_priority,
  td.treatment_details,
  td.estimated_duration,
  td.estimated_cost,
  td.color_code,
  td.scheduled_date,
  td.follow_up_required,
  td.examination_date,
  td.notes,
  td.created_at,
  td.updated_at
FROM api.tooth_diagnoses td
ORDER BY td.patient_id, td.tooth_number, COALESCE(td.examination_date::timestamp, td.created_at) DESC;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_latest_tooth_diagnoses_patient_tooth ON api.tooth_diagnoses (patient_id, tooth_number);
