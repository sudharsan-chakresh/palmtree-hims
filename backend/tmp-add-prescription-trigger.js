require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { prisma } = require('./src/config/prisma');
(async () => {
  const schema = 'wellness_clinics___standard';
  const sql = `SET search_path TO "${schema}", public;

ALTER TABLE "${schema}".prescriptions
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES "${schema}".patients(id);

CREATE OR REPLACE FUNCTION sync_prescription_patient()
RETURNS trigger AS $$
BEGIN
  IF NEW.patient_id IS NULL AND NEW.encounter_id IS NOT NULL THEN
    SELECT patient_id INTO NEW.patient_id FROM "${schema}".encounters WHERE id = NEW.encounter_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prescriptions_set_patient ON "${schema}".prescriptions;
CREATE TRIGGER prescriptions_set_patient
  BEFORE INSERT OR UPDATE ON "${schema}".prescriptions
  FOR EACH ROW EXECUTE FUNCTION sync_prescription_patient();`;

  try {
    console.log('[DB] Applying trigger SQL to schema:', schema);
    await prisma.$executeRawUnsafe(sql);
    console.log('[DB] Trigger applied successfully');
  } catch (e) {
    console.error('[DB] Trigger application failed:', e.message || e);
  } finally {
    await prisma.$disconnect();
  }
})();
