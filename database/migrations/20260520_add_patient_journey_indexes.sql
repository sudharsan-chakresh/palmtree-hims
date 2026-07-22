-- Adds composite indexes to speed patient-journey queries
CREATE INDEX IF NOT EXISTS idx_consultation_events_encounter_created_at ON consultation_events (encounter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_admitted_at ON ipd_admissions (admitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ipd_notes_admission_created_at ON ipd_notes (admission_id, created_at DESC);
