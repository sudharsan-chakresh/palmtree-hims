-- CI migration: add performance indexes for patient-journey flows
-- Use {schema} placeholder; the runner will replace {schema} with each tenant schema name

CREATE INDEX IF NOT EXISTS idx_consultation_events_encounter_created_at ON {schema}.consultation_events (encounter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_events_encounter_event_created_at ON {schema}.consultation_events (encounter_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_predictions_encounter ON {schema}.consultation_predictions (encounter_id);

CREATE INDEX IF NOT EXISTS idx_ipd_admissions_admitted_at ON {schema}.ipd_admissions (admitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ipd_notes_admission_created_at ON {schema}.ipd_notes (admission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_queue_source_id ON {schema}.billing_queue (source_id);
CREATE INDEX IF NOT EXISTS idx_encounters_status_created_at ON {schema}.encounters (status, created_at DESC);
