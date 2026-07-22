const express = require("express");
const { si } = require('../../middleware/sanitize');
const router = express.Router();

const s = (val) => (val === undefined || val === null ? "" : String(val).replace(/'/g, "''"));
const sqlValue = (val) => (val === undefined || val === null || val === "" ? "NULL" : `'${s(val)}'`);

const insuranceTablesSynced = new Set();

async function ensureInsuranceTables(req) {
  const schema = req.schemaName;
  if (!schema) return;
  if (insuranceTablesSynced.has(schema)) return;
  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".insurance_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) UNIQUE NOT NULL,
      tpa_name VARCHAR(255),
      contact_person VARCHAR(100),
      email VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".insurance_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      provider_id UUID,
      policy_number VARCHAR(100),
      insurer_id VARCHAR(100),
      claim_type VARCHAR(50) DEFAULT 'CASHLESS',
      billed_amount NUMERIC DEFAULT 0,
      sanctioned_amount NUMERIC DEFAULT 0,
      reference_number VARCHAR(100),
      claim_number VARCHAR(100),
      status VARCHAR(50) DEFAULT 'PRE-AUTH PENDING',
      remarks TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".insurance_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id UUID NOT NULL,
      plan_name VARCHAR(255) NOT NULL,
      description TEXT,
      base_coverage NUMERIC DEFAULT 0,
      copay_percent NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".insurance_patient_mapping (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      provider_id UUID NOT NULL,
      plan_id UUID NOT NULL,
      policy_number VARCHAR(100) NOT NULL,
      total_limit NUMERIC DEFAULT 0,
      remaining_limit NUMERIC DEFAULT 0,
      copay_percent NUMERIC DEFAULT 0,
      valid_till DATE,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_providers ADD COLUMN IF NOT EXISTS tpa_name VARCHAR(255)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_providers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_providers ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_providers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_claims ADD COLUMN IF NOT EXISTS provider_id UUID`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_claims ADD COLUMN IF NOT EXISTS billed_amount NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_claims ADD COLUMN IF NOT EXISTS sanctioned_amount NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await req.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_insurance_patient_mapping_patient ON "${req.schemaName}".insurance_patient_mapping (patient_id)`);
  } catch (e) {
    console.error(`[INSURANCE_TABLES] DDL failed for ${schema}:`, e.message);
  }
  insuranceTablesSynced.add(schema);
}

// 1. Fetch Insurance Providers (TPAs)
router.get("/providers", async (req, res, next) => {
  try {
    await ensureInsuranceTables(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".insurance_providers 
      WHERE is_active = TRUE 
      ORDER BY name ASC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/providers", async (req, res, next) => {
  try {
    await ensureInsuranceTables(req);
    const { name, tpa_name, contact_person, email } = req.body;
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".insurance_providers (name, tpa_name, contact_person, email)
      VALUES ('${s(name)}', '${s(tpa_name)}', ${sqlValue(contact_person)}, ${sqlValue(email)})
    `);
    res.status(201).json({ success: true });
  } catch (error) { 
    console.error("[INSURANCE_POST_PROVIDER_ERROR]", error);
    res.status(400).json({ error: error.message }); 
  }
});

// 2. Fetch All Claims with Detailed Status
router.get("/claims", async (req, res, next) => {
  try {
    await ensureInsuranceTables(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT c.*, p.name as patient_name, p.mrn, ip.name as provider_name
      FROM "${req.schemaName}".insurance_claims c
      JOIN "${req.schemaName}".patients p ON c.patient_id = p.id
      JOIN "${req.schemaName}".insurance_providers ip ON c.provider_id = ip.id
      ORDER BY c.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

// 3. Create/Update a Claim
router.post("/claims", async (req, res, next) => {
  try {
    const { 
      patientId, providerId, policyNumber, insurerId, 
      claimType, billedAmount, sanctionedAmount, 
      referenceNumber, claimNumber, status, remarks 
    } = req.body;

    const result = await req.prisma.$queryRawUnsafe(`
      INSERT INTO "${req.schemaName}".insurance_claims 
      (patient_id, provider_id, policy_number, insurer_id, claim_type, billed_amount, sanctioned_amount, reference_number, claim_number, status, remarks)
      VALUES 
      ('${patientId}', '${providerId}', '${policyNumber}', '${insurerId}', '${claimType}', ${billedAmount || 0}, ${sanctionedAmount || 0}, '${referenceNumber || ''}', '${claimNumber || ''}', '${status || 'PRE-AUTH PENDING'}', '${remarks || ''}')
      RETURNING id
    `);

    res.status(201).json({ id: result[0].id, message: "Insurance claim record initialized." });
  } catch (error) { next(error); }
});

// 4. Update Sanctioned Amount / Status
router.put("/claims/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sanctionedAmount, status, claimNumber, remarks } = req.body;

    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".insurance_claims
      SET sanctioned_amount = ${sanctionedAmount || 0},
          status = '${status}',
          claim_number = '${claimNumber || ''}',
          remarks = '${remarks || ''}'
      WHERE id = '${id}'
    `);

    res.json({ message: "Claim status updated successfully." });
  } catch (error) { next(error); }
});

// 5. Fetch Plans
router.get("/plans", async (req, res, next) => {
  try {
    await ensureInsuranceTables(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT p.*, pr.name as provider_name 
      FROM "${req.schemaName}".insurance_plans p
      JOIN "${req.schemaName}".insurance_providers pr ON p.provider_id = pr.id
      ORDER BY p.plan_name ASC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

// 6. Create Plan
router.post("/plans", async (req, res, next) => {
  try {
    await ensureInsuranceTables(req);
    const { provider_id, plan_name, description, base_coverage, copay_percent } = req.body;
    const result = await req.prisma.$queryRawUnsafe(`
      INSERT INTO "${req.schemaName}".insurance_plans (provider_id, plan_name, description, base_coverage, copay_percent)
      VALUES ('${provider_id}', '${plan_name.replace(/'/g, "''")}', '${(description || '').replace(/'/g, "''")}', ${base_coverage || 0}, ${copay_percent || 0})
      RETURNING id
    `);
    res.status(201).json({ id: result[0].id, message: "Plan created." });
  } catch (error) { next(error); }
});

// 7. Fetch Patient Mappings
router.get("/patient-mapping", async (req, res, next) => {
  try {
    await ensureInsuranceTables(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT m.*, p.name as patient_name, p.mrn, pr.name as provider_name, pl.plan_name
      FROM "${req.schemaName}".insurance_patient_mapping m
      JOIN "${req.schemaName}".patients p ON m.patient_id = p.id
      JOIN "${req.schemaName}".insurance_providers pr ON m.provider_id = pr.id
      JOIN "${req.schemaName}".insurance_plans pl ON m.plan_id = pl.id
      ORDER BY m.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

// 8. Create Patient Mapping
router.post("/patient-mapping", async (req, res, next) => {
  try {
    await ensureInsuranceTables(req);
    const { patient_id, provider_id, plan_id, policy_number, total_limit, copay_percent, valid_till } = req.body;
    const result = await req.prisma.$queryRawUnsafe(`
      INSERT INTO "${req.schemaName}".insurance_patient_mapping (patient_id, provider_id, plan_id, policy_number, total_limit, remaining_limit, copay_percent, valid_till)
      VALUES ('${patient_id}', '${provider_id}', '${plan_id}', '${policy_number}', ${total_limit || 0}, ${total_limit || 0}, ${copay_percent || 0}, ${valid_till ? `'${valid_till}'` : 'NULL'})
      RETURNING id
    `);
    res.status(201).json({ id: result[0].id, message: "Policy mapped." });
  } catch (error) { next(error); }
});

module.exports = router;
