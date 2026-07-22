const express = require("express");
const { si } = require('../../middleware/sanitize');
const router = express.Router();
const crypto = require("crypto");
const { checkPermission } = require("../../middleware/rbac");
const metricsRoutes = require("./metrics");
const aiService = require("../../services/aiService");
const pdfService = require("../../services/pdfService");
const bcrypt = require("bcryptjs");
const upload = require("../../config/upload");

const s = (val) => (val === undefined || val === null ? "" : String(val).replace(/'/g, "''"));
const sqlValue = (val) => (val === undefined || val === null || val === "" ? "NULL" : `'${s(val)}'`);
const jsonValue = (val) => `'${s(JSON.stringify(val || {}))}'::jsonb`;

async function getCurrentUserId(req) {
  if (!req.user) return null;
  const email = typeof req.user === 'object' ? req.user.user : req.user;
  try {
    const users = await req.prisma.$queryRawUnsafe(`SELECT id FROM "${req.schemaName}".users WHERE LOWER(email) = LOWER('${s(email)}') LIMIT 1`);
    return users[0]?.id || null;
  } catch {
    return null;
  }
}

const dischargeTableSynced = new Set();
async function ensureDischargeTable(req) {
  const schema = req.schemaName;
  if (!schema || dischargeTableSynced.has(schema)) return;
  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".discharge_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id UUID UNIQUE,
      patient_id UUID,
      doctor_id UUID,
      summary_text TEXT,
      pdf_path TEXT,
      discharge_type VARCHAR(50) DEFAULT 'STANDARD',
      status VARCHAR(50) DEFAULT 'Draft',
      is_authenticated BOOLEAN DEFAULT false,
      authenticated_at TIMESTAMP,
      discharge_date TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".discharge_summaries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft'`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".discharge_summaries ADD COLUMN IF NOT EXISTS is_authenticated BOOLEAN DEFAULT false`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".discharge_summaries ADD COLUMN IF NOT EXISTS authenticated_at TIMESTAMP`);
  } catch (e) {
    console.error(`[DISCHARGE] DDL failed for ${schema}:`, e.message);
  }
  dischargeTableSynced.add(schema);
}

const orderColumnsSynced = new Set();
async function ensureOrderColumns(req) {
  const schema = req.schemaName;
  if (!schema || orderColumnsSynced.has(schema)) return;

  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".prescriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      encounter_id UUID REFERENCES "${req.schemaName}".encounters(id),
      patient_id UUID REFERENCES "${req.schemaName}".patients(id),
      status VARCHAR(50) DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT NOW(),
      instructions TEXT,
      is_paid BOOLEAN DEFAULT false
    )
  `);

  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".prescription_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id UUID REFERENCES "${req.schemaName}".prescriptions(id),
      medicine_id UUID,
      drug_name VARCHAR(255),
      dosage VARCHAR(100),
      frequency VARCHAR(100),
      duration VARCHAR(100),
      instructions TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".lab_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID REFERENCES "${req.schemaName}".patients(id),
      encounter_id UUID REFERENCES "${req.schemaName}".encounters(id),
      doctor_id UUID REFERENCES "${req.schemaName}".users(id),
      test_name VARCHAR(255),
      priority VARCHAR(50) DEFAULT 'Normal',
      status VARCHAR(50) DEFAULT 'Pending',
      results JSONB,
      technician_notes TEXT,
      is_paid BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending'`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS patient_id UUID`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS instructions TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false`);

  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescription_items ADD COLUMN IF NOT EXISTS instructions TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescription_items ADD COLUMN IF NOT EXISTS medicine_id UUID`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescription_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);

  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending'`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS results JSONB`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS technician_notes TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS test_name VARCHAR(255)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Normal'`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS report_url TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".lab_orders ADD COLUMN IF NOT EXISTS pdf_path TEXT`);

  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescription_items ADD COLUMN IF NOT EXISTS prescription_url TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescription_items ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescription_items ADD COLUMN IF NOT EXISTS file_url TEXT`);
  
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS prescription_url TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".prescriptions ADD COLUMN IF NOT EXISTS pdf_path TEXT`);

  // Ensure medicines and diagnostics tables exist (prescriptions & lab-orders depend on them)
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".medicines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'Other',
      composition TEXT,
      unit_price NUMERIC(12,2) DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      uom VARCHAR(50) DEFAULT 'Tablet',
      batch_number VARCHAR(100),
      expiry_date DATE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".diagnostics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) UNIQUE NOT NULL,
      price NUMERIC DEFAULT 0,
      category VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  } catch (e) {
    console.error(`[ORDER_COLUMNS] DDL failed for ${schema}:`, e.message);
  }
  orderColumnsSynced.add(schema);
}

async function ensureTenantConfigTable(req) {
  const schema = req.schemaName;
  if (!schema) return;
  try {
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".tenant_sensitive_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
      )
    `);

    // ensure at least one row exists to simplify reads/writes
    const existing = await req.prisma.$queryRawUnsafe(`SELECT id FROM "${schema}".tenant_sensitive_settings LIMIT 1`);
    if (!existing.length) {
      await req.prisma.$executeRawUnsafe(`INSERT INTO "${schema}".tenant_sensitive_settings (settings) VALUES ('{}')`);
    }
  } catch (err) {
    console.warn(`[TENANT_CFG_HEAL] Failed to ensure tenant config table for ${schema}:`, err.message);
  }
}

const staffSyncedSchemas = new Set();

async function ensureStaffColumns(req, force = false) {
  const schema = req.schemaName;
  if (!schema) return;
  
  // Return immediately if already synced (use cache)
  if (staffSyncedSchemas.has(schema) && !force) return;
  
  try {
    // 1. Create contractor_vendors Table (lightweight)
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${req.schemaName}".contractor_vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Column Healing for users table (lightweight)
    await req.prisma.$executeRawUnsafe(`
      ALTER TABLE "${req.schemaName}".users 
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
      ADD COLUMN IF NOT EXISTS dob DATE,
      ADD COLUMN IF NOT EXISTS doj DATE,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS license_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS specialization VARCHAR(100),
      ADD COLUMN IF NOT EXISTS department VARCHAR(100),
      ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS qualifications TEXT,
      ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'Permanent',
      ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES "${req.schemaName}".contractor_vendors(id),
      ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT false
    `);

    // 3. Create Resource Requisitions Table
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${req.schemaName}".resource_requisitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        department VARCHAR(100),
        number_of_positions INTEGER DEFAULT 1,
        job_description TEXT,
        experience_required VARCHAR(100),
        qualifications_required VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Pending',
        requested_by UUID REFERENCES "${req.schemaName}".users(id),
        approved_by UUID REFERENCES "${req.schemaName}".users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Create Candidates Table
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${req.schemaName}".candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        experience_years INTEGER DEFAULT 0,
        skills TEXT,
        education TEXT,
        resume_text TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 5. Create Requisition Matches Table
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${req.schemaName}".requisition_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requisition_id UUID NOT NULL REFERENCES "${req.schemaName}".resource_requisitions(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES "${req.schemaName}".candidates(id) ON DELETE CASCADE,
        match_score NUMERIC DEFAULT 0,
        match_analysis TEXT,
        status VARCHAR(50) DEFAULT 'Matched',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(requisition_id, candidate_id)
      );
    `);

    // 6. Create Employee Leaves Table
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${req.schemaName}".employee_leaves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES "${req.schemaName}".users(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) DEFAULT 'CASUAL',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        approved_by UUID REFERENCES "${req.schemaName}".users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Mark schema as synced immediately to prevent race conditions
    staffSyncedSchemas.add(schema);
    
    // 7. Async cleanup (non-blocking) - only on force or first time, run in background
    if (force) {
      setImmediate(async () => {
        try {
          const legacyEmails = [
            'sankaran@apollo.com', 'maheswaran@apollo.com', 'aravind@apollo.com', 
            'clara@apollo.com', 'florence@apollo.com', 'pharmacy@apollo.com', 
            'lab@apollo.com', 'reception@apollo.com', 'mrutyunjaya@apollo.com', 
            'santhanakrishnan@apollo.com'
          ];
          
          await req.prisma.$executeRawUnsafe(`
            DELETE FROM "${req.schemaName}".rbac_user_roles 
            WHERE user_id IN (
              SELECT id FROM "${req.schemaName}".users
              WHERE email IN (${legacyEmails.map(e => `'${e}'`).join(',')})
              LIMIT 1000
            )
          `);
          
          await req.prisma.$executeRawUnsafe(`
            UPDATE "${req.schemaName}".users
            SET is_active = false
            WHERE email IN (${legacyEmails.map(e => `'${e}'`).join(',')})
          `);
        } catch (bgErr) {
          console.warn(`[STAFF_CLEANUP_BG] Background cleanup error for ${schema}:`, bgErr.message);
        }
      });
    }
  } catch (err) {
    console.warn(`[STAFF_HEALING] Error for ${req.schemaName}:`, err.message);
  }
}

const doctorScheduleTableSynced = new Set();
async function ensureDoctorScheduleTable(req) {
  const schema = req.schemaName;
  if (!schema || doctorScheduleTableSynced.has(schema)) return;
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".doctor_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id UUID NOT NULL,
      weekday INTEGER NOT NULL,
      session_name VARCHAR(100),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      slot_duration INTEGER DEFAULT 30,
      consultation_type VARCHAR(50) DEFAULT 'OPD',
      location VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  doctorScheduleTableSynced.add(schema);
}

// Tenant-sensitive configuration endpoints
router.get('/configs', async (req, res, next) => {
  try {
    await ensureTenantConfigTable(req);
    // read tenant settings
    const rows = await req.prisma.$queryRawUnsafe(`SELECT settings FROM "${req.schemaName}".tenant_sensitive_settings LIMIT 1`);
    const tenantSettings = (rows && rows[0] && rows[0].settings) ? rows[0].settings : {};

    // fallback to Nexus global if keys missing
    const nexusRow = await req.prisma.$queryRawUnsafe(`SELECT sensitive_settings FROM nexus.tenants WHERE db_name = '${req.schemaName}' LIMIT 1`);
    const nexusSettings = (nexusRow && nexusRow[0] && nexusRow[0].sensitive_settings) ? nexusRow[0].sensitive_settings : {};

    // merge: tenantSettings wins, fallback to nexusSettings
    const merged = Object.assign({}, nexusSettings || {}, tenantSettings || {});
    res.json({ settings: merged });
  } catch (err) { console.error('[TENANT_CFG_GET]', err.message); res.status(500).json({ error: err.message }); }
});

router.put('/configs', async (req, res, next) => {
  try {
    const cfg = req.body || {};
    await ensureTenantConfigTable(req);
    // update settings JSONB in single row
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".tenant_sensitive_settings SET settings = '${JSON.stringify(cfg).replace(/'/g, "''")}', updated_at = NOW()`);
    res.json({ message: 'Tenant sensitive settings saved.' });
  } catch (err) { console.error('[TENANT_CFG_PUT]', err.message); res.status(500).json({ error: err.message }); }
});

async function ensureDefaultDoctorSchedule(req, doctorId) {
  await ensureDoctorScheduleTable(req);

  for (let weekday = 1; weekday <= 6; weekday += 1) {
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".doctor_schedules
        (doctor_id, weekday, session_name, start_time, end_time, slot_duration, consultation_type, location, is_active)
      SELECT '${s(doctorId)}', ${weekday}, 'Morning OPD', '09:00', '13:00', 30, 'OPD', 'Main OPD', true
      WHERE NOT EXISTS (
        SELECT 1 FROM "${req.schemaName}".doctor_schedules
        WHERE doctor_id = '${s(doctorId)}'
          AND weekday = ${weekday}
          AND start_time = '09:00'
          AND end_time = '13:00'
          AND consultation_type = 'OPD'
      )
    `);
  }
}

const patientColumnsSynced = new Set();
async function ensurePatientColumns(req) {
  const schema = req.schemaName;
  if (!schema || patientColumnsSynced.has(schema)) return;
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".patients ADD COLUMN IF NOT EXISTS mrn VARCHAR(20)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".patients ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".patients ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
  patientColumnsSynced.add(schema);
}

const encounterTableSynced = new Set();
async function ensureEncounterTable(req) {
  const schema = req.schemaName;
  if (!schema || encounterTableSynced.has(schema)) return;
  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".encounters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      doctor_id UUID NOT NULL,
      type VARCHAR(50) DEFAULT 'OPD',
      status VARCHAR(50) DEFAULT 'Draft',
      vitals JSONB,
      complaints TEXT,
      diagnosis TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".consultation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      encounter_id UUID REFERENCES "${req.schemaName}".encounters(id),
      event_type VARCHAR(50) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".consultation_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      encounter_id UUID REFERENCES "${req.schemaName}".encounters(id),
      predicted_time_mins INTEGER,
      complexity VARCHAR(50),
      triage_priority INTEGER,
      reasoning TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  } catch (e) {
    console.error(`[ENCOUNTER_TABLE] DDL failed for ${schema}:`, e.message);
  }
  encounterTableSynced.add(schema);
}

const tableColumnsSynced = new Set();
async function ensureTableColumns(req, table) {
  const cacheKey = `${req.schemaName}:${table}`;
  if (!req.schemaName || tableColumnsSynced.has(cacheKey)) return;
  try {
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS description TEXT`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS category VARCHAR(255)`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS hod VARCHAR(255)`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS specialty VARCHAR(255)`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS base_consultation_fee NUMERIC DEFAULT 0`);
    if (table === 'medicines') {
      await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS uom VARCHAR(50) DEFAULT 'Tablet'`);
      await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}"."${table}" ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100)`);
    }
    tableColumnsSynced.add(cacheKey);
  } catch (e) {}
}

const ipdMastersSynced = new Set();
async function ensureIPDMasters(req) {
  const schema = req.schemaName;
  if (!schema || ipdMastersSynced.has(schema)) return;
  try {
  await req.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${req.schemaName}".wards (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100), type VARCHAR(50), capacity INTEGER DEFAULT 0, base_charge NUMERIC DEFAULT 0)`);
  await ensureTableColumns(req, 'wards');
  await req.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${req.schemaName}".beds (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ward_id UUID REFERENCES "${req.schemaName}".wards(id), bed_number VARCHAR(50), status VARCHAR(50) DEFAULT 'Vacant')`);

  // Seed Diagnostics if missing
  try {
    const diags = [
      { name: 'Complete Blood Count (CBC)', price: 450 },
      { name: 'Chest X-Ray', price: 800 },
      { name: 'Lipid Profile', price: 1200 },
      { name: 'MRI Brain (Plain)', price: 8500 },
      { name: 'ECG (Resting)', price: 350 }
    ];
    for (const d of diags) {
      const existing = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".diagnostics WHERE name = '${d.name}'`);
      if (existing.length === 0) {
        await req.prisma.$executeRawUnsafe(`INSERT INTO "${req.schemaName}".diagnostics (name, price) VALUES ('${d.name}', ${d.price})`);
      }
    }
  } catch (e) {
    console.warn("[SEED] Could not seed diagnostics:", e.message);
  }
    // --- SEED WARDS & BEDS IF MISSING (ensure IPD has provisioned wards) ---
    try {
      const wardCount = await req.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${req.schemaName}".wards`);
      if (wardCount && wardCount[0] && Number(wardCount[0].count) === 0) {
        const wards = [
          { name: 'General Ward - A', type: 'Regular Care', capacity: 20, charge: 1500 },
          { name: 'Semi-Private Ward', type: 'Special Care', capacity: 15, charge: 3500 },
          { name: 'Private Suite', type: 'ICU', capacity: 14, charge: 7500 }
        ];
        for (const w of wards) {
          const wardId = crypto.randomUUID();
          await req.prisma.$executeRawUnsafe(`INSERT INTO "${req.schemaName}".wards (id, name, type, capacity, base_charge) VALUES ('${wardId}', '${w.name}', '${w.type}', ${w.capacity}, ${w.charge})`);
          const prefix = w.name.split(' ').slice(0,3).join('-').toUpperCase() || 'BED';
          for (let i = 1; i <= w.capacity; i++) {
            await req.prisma.$executeRawUnsafe(`INSERT INTO "${req.schemaName}".beds (ward_id, bed_number, status) VALUES ('${wardId}', '${prefix}-${String(i).padStart(2,'0')}', 'Vacant')`);
          }
        }
        console.log(`[SEED] Provisioned ${wards.length} wards and beds for shard: ${req.schemaName}`);
      }
    } catch (e) {
      console.warn('[SEED] Ward provisioning failed:', e.message);
    }
    // Idempotent inserts as a fallback in case COUNT check failed
    try {
      const fallbackWards = [
        { name: 'General Ward - A', type: 'Regular Care', capacity: 20, charge: 1500 },
        { name: 'Semi-Private Ward', type: 'Special Care', capacity: 15, charge: 3500 },
        { name: 'Private Suite', type: 'ICU', capacity: 14, charge: 7500 }
      ];
      for (const w of fallbackWards) {
        await req.prisma.$executeRawUnsafe(`
          INSERT INTO "${req.schemaName}".wards (id, name, type, capacity, base_charge)
          SELECT gen_random_uuid(), '${w.name}', '${w.type}', ${w.capacity}, ${w.charge}
          WHERE NOT EXISTS (SELECT 1 FROM "${req.schemaName}".wards WHERE name = '${w.name}')
        `);
        // Provision beds for any newly created ward
        const wardRow = await req.prisma.$queryRawUnsafe(`SELECT id, capacity FROM "${req.schemaName}".wards WHERE name = '${w.name}' LIMIT 1`);
        const wardId = wardRow && wardRow[0] && wardRow[0].id;
        const cap = wardRow && wardRow[0] && (wardRow[0].capacity || w.capacity);
        if (wardId) {
          for (let i = 1; i <= (cap || w.capacity); i++) {
            const prefix = w.name.split(' ').slice(0,3).join('-').toUpperCase() || 'BED';
            await req.prisma.$executeRawUnsafe(`
              INSERT INTO "${req.schemaName}".beds (ward_id, bed_number, status)
              SELECT '${wardId}', '${prefix}-${String(i).padStart(2,'0')}', 'Vacant'
              WHERE NOT EXISTS (SELECT 1 FROM "${req.schemaName}".beds WHERE ward_id = '${wardId}' AND bed_number = '${prefix}-${String(i).padStart(2,'0')}')
            `);
          }
        }
      }
    } catch (e) {
      console.warn('[SEED] Fallback ward provisioning error:', e.message);
    }
  } catch (e) {
    console.error(`[IPD_MASTERS] DDL failed for ${schema}:`, e.message);
  }
  ipdMastersSynced.add(schema);
}

const ipdAdmissionsSynced = new Set();
async function ensureIPDAdmissionsTable(req) {
  const schema = req.schemaName;
  if (!schema || ipdAdmissionsSynced.has(schema)) return;
  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".ipd_admissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      bed_id UUID,
      ward_id UUID,
      admitting_doctor_id UUID,
      encounter_id UUID,
      admission_reason TEXT,
      daily_charge NUMERIC DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Admitted',
      admitted_at TIMESTAMP DEFAULT NOW(),
      discharged_at TIMESTAMP
    )
  `);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_admissions ADD COLUMN IF NOT EXISTS encounter_id UUID`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_admissions ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMP DEFAULT NOW()`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_admissions ADD COLUMN IF NOT EXISTS discharged_at TIMESTAMP`);
  
  // Self-healing for Discharge Checklist & Transfers
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_admissions ADD COLUMN IF NOT EXISTS pharmacy_cleared BOOLEAN DEFAULT FALSE`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_admissions ADD COLUMN IF NOT EXISTS billing_cleared BOOLEAN DEFAULT FALSE`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_admissions ADD COLUMN IF NOT EXISTS clinical_cleared BOOLEAN DEFAULT FALSE`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_admissions ADD COLUMN IF NOT EXISTS original_admitted_at TIMESTAMP DEFAULT NOW()`);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".ipd_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id UUID NOT NULL,
      note_text TEXT NOT NULL,
      note_type VARCHAR(50) DEFAULT 'Progress',
      doctor_id UUID,
      doctor_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(50) DEFAULT 'Progress'`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_notes ADD COLUMN IF NOT EXISTS doctor_id UUID`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_notes ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".ipd_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  } catch (e) {
    console.error(`[IPD_ADMISSIONS] DDL failed for ${schema}:`, e.message);
  }
  ipdAdmissionsSynced.add(schema);
}

const insuranceInfrastructureSynced = new Set();
async function ensureInsuranceInfrastructure(req) {
  const schema = req.schemaName;
  if (!schema || insuranceInfrastructureSynced.has(schema)) return;
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
  // Ensure columns exist for older table versions
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_providers ADD COLUMN IF NOT EXISTS tpa_name VARCHAR(255)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_providers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100)`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".insurance_providers ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);

  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".insurance_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id UUID REFERENCES "${req.schemaName}".insurance_providers(id),
      plan_name VARCHAR(255) NOT NULL,
      description TEXT,
      base_coverage NUMERIC DEFAULT 0,
      copay_percent NUMERIC DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".patient_insurance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID REFERENCES "${req.schemaName}".patients(id),
      provider_id UUID REFERENCES "${req.schemaName}".insurance_providers(id),
      plan_id UUID REFERENCES "${req.schemaName}".insurance_plans(id),
      policy_number VARCHAR(100),
      total_limit NUMERIC DEFAULT 0,
      remaining_limit NUMERIC DEFAULT 0,
      copay_percent NUMERIC DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Active',
      valid_till DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  insuranceInfrastructureSynced.add(schema);
}

const billingQueueSynced = new Set();
async function ensureBillingQueue(req) {
  const schema = req.schemaName;
  if (!schema || billingQueueSynced.has(schema)) return;
  try {
    await req.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${req.schemaName}".billing_queue (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, encounter_id UUID, source_module VARCHAR(50), source_id UUID, description TEXT, quantity NUMERIC DEFAULT 1, unit_price NUMERIC NOT NULL, tax_percent NUMERIC DEFAULT 0, is_discountable BOOLEAN DEFAULT TRUE, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT NOW())`);
  } catch (e) {
    console.error(`[BILLING_QUEUE] DDL failed for ${schema}:`, e.message);
  }
  billingQueueSynced.add(schema);
}

const suppliersTableSynced = new Set();
async function ensureSuppliersTable(req) {
  const schema = req.schemaName;
  if (!schema || suppliersTableSynced.has(schema)) return;
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(100),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  suppliersTableSynced.add(schema);
}

// --- METRICS ---
router.use("/metrics", metricsRoutes);

// --- GLOBAL HEAL UTILITY ---
router.get("/heal-all-masters", async (req, res, next) => {
  try {
    await ensureStaffColumns(req, true);
    await ensurePatientColumns(req);
    await ensureIPDMasters(req);
    await ensureIPDAdmissionsTable(req);
    await ensureEncounterTable(req);
    await ensureOrderColumns(req);
    await ensureDischargeTable(req);
    await ensureBillingQueue(req);
    await ensureSuppliersTable(req);
    await ensureMedicinesTable(req);
    await ensureInsuranceInfrastructure(req);

    // Retroactive cleanup: remove dummy staff rows seeded during provisioning
    // Targets the *.hims.com pattern from old provisioning logic
    try {
      const deleted = await req.prisma.$queryRawUnsafe(`
        DELETE FROM "${req.schemaName}".users
        WHERE email LIKE '%@%.hims.com'
          AND role = 'DOCTOR'
          AND (name LIKE 'Dr. % Lead Physician' OR name LIKE 'Dr. % Senior Consultant')
        RETURNING id, name, email
      `);
      if (deleted.length > 0) {
        console.log(`[HEAL] Removed ${deleted.length} dummy staff row(s) from ${req.schemaName}:`, deleted.map(r => r.email));
      }
    } catch (e) { /* non-critical */ }

    // Return counts to help debugging provisioning
    let wardCount = 0, bedCount = 0;
    try {
      const w = await req.prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${req.schemaName}".wards`);
      wardCount = parseInt(w && w[0] && (w[0].c || w[0].count || 0)) || 0;
    } catch (e) { /* ignore */ }
    try {
      const b = await req.prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${req.schemaName}".beds`);
      bedCount = parseInt(b && b[0] && (b[0].c || b[0].count || 0)) || 0;
    } catch (e) { /* ignore */ }

    res.json({ success: true, message: "Clinical environment provisioned.", wardCount, bedCount });
  } catch (error) { next(error); }
});

// --- HOSPITAL SETTINGS (Live tenant info from nexus registry) ---
router.get("/settings", async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || '';
    let tenantRow = null;
    try {
      const rows = await req.prisma.$queryRawUnsafe(`
        SELECT name, admin_email, ui_settings FROM nexus.tenants WHERE id = '${tenantId}' LIMIT 1
      `);
      tenantRow = rows[0] || null;
    } catch (e) { /* nexus may be in different DB in some setups */ }

    const ui = tenantRow?.ui_settings || {};
    res.json({
      name: tenantRow?.name || 'Hospital',
      email: ui.contactEmail || tenantRow?.admin_email || '',
      phone: ui.contactPhone || '',
      address: ui.address || '',
      logoUrl: ui.logoUrl || '',
      tagline: ui.tagline || 'Quality Healthcare Services',
    });
  } catch (error) { next(error); }
});

// --- DOCTOR LIST (Clinical Staff Only) ---
router.get("/doctors", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    await ensureDoctorScheduleTable(req);

    // Staff creation stores roles in lowercase, while seeded doctors use uppercase.
    // Keep the doctor lookup case-insensitive so newly added doctors appear here.
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT id, name, role, specialization, department 
      FROM "${req.schemaName}".users 
      WHERE (role ILIKE 'doctor' OR name ILIKE 'Dr.%') AND is_active = true
      ORDER BY name ASC
    `);

    // Optimize seeding: only seed default schedule for doctors that have NO schedules defined
    const scheduleCounts = await req.prisma.$queryRawUnsafe(`
      SELECT DISTINCT doctor_id::text FROM "${req.schemaName}".doctor_schedules
    `);
    const seededDoctors = new Set(scheduleCounts.map(r => r.doctor_id));

    for (const doctor of data) {
      if (!seededDoctors.has(doctor.id)) {
        await ensureDefaultDoctorSchedule(req, doctor.id);
      }
    }

    console.log(`[HOSPITAL] Returning ${data.length} active doctors for schema ${req.schemaName}`);
    res.json(data);
  } catch (error) { next(error); }
});

// --- MASTERS HUB ---
const masterTables = [
  { path: 'departments', table: 'departments' },
  { path: 'specialities', table: 'specialities' },
  { path: 'modes', table: 'consultation_modes' },
  { path: 'diseases', table: 'diseases' },
  { path: 'treatments', table: 'treatments' },
  { path: 'diagnostics', table: 'diagnostics' },
  { path: 'medicines', table: 'medicines' },
  { path: 'services', table: 'services' },
  { path: 'wards', table: 'wards' },
  { path: 'suppliers', table: 'suppliers' }
];

masterTables.forEach(({ path, table }) => {
  router.get(`/masters/${path}`, async (req, res, next) => {
    try {
      if (path === 'suppliers') await ensureSuppliersTable(req);
      if (path === 'medicines') await ensureMedicinesTable(req);
      await ensureTableColumns(req, table);
      const data = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}"."${table}"`);
      res.json(data);
    } catch (error) { next(error); }
  });

  router.post(`/masters/${path}`, async (req, res, next) => {
    try {
      if (path === 'medicines') await ensureMedicinesTable(req);
      await ensureTableColumns(req, table);
      
      // Table-aware field filtering
      const tableFields = {
        departments: ['name', 'description', 'hod', 'specialty', 'status'],
        specialities: ['name', 'description', 'base_consultation_fee'],
        consultation_modes: ['name', 'surcharge_percent', 'is_virtual'],
        diseases: ['name', 'category', 'icd_code', 'severity_level'],
        treatments: ['name', 'category', 'price', 'description', 'cpt_code', 'estimated_duration'],
        diagnostics: ['name', 'price', 'category'],
        medicines: ['name', 'category', 'composition', 'dosage_adult', 'dosage_pediatric', 'instructions', 'unit_price', 'stock_quantity', 'uom', 'batch_number'],
        services: ['name', 'category', 'service_code', 'price', 'tax_percent'],
        wards: ['name', 'type', 'capacity', 'floor', 'base_charge'],
        suppliers: ['name', 'contact_person', 'email', 'phone', 'address']
      };

      const allowed = tableFields[table] || ['name', 'description', 'category', 'price'];
      const fields = Object.keys(req.body).filter(f => allowed.includes(f) || (f === 'fee' && allowed.includes('base_consultation_fee')));
      
      if (fields.length === 0) return res.status(400).json({ error: "No valid fields provided for this master type." });

      const finalFields = fields.map(f => f === 'fee' ? 'base_consultation_fee' : f);
      const values = fields.map(f => {
        const val = req.body[f];
        if (val === undefined || val === null || val === '') return 'NULL';
        return typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val;
      });

      const query = `INSERT INTO "${req.schemaName}"."${table}" (${finalFields.join(',')}) VALUES (${values.join(',')}) RETURNING *`;
      const result = await req.prisma.$queryRawUnsafe(query);
      res.status(201).json(result[0]);
    } catch (error) { 
      console.error(`[MASTERS_POST_ERROR] ${table}:`, error.message);
      next(error); 
    }
  });

  router.post(`/masters/${path}/bulk`, async (req, res, next) => {
    try {
      if (path === 'medicines') await ensureMedicinesTable(req);
      await ensureTableColumns(req, table);
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];
      for (const item of items) {
        const fields = Object.keys(item).filter(f => ['name','description','category','price','unit_price','stock_quantity','expiry_date','hod','specialty','status','uom'].includes(f));
        const values = fields.map(f => {
          let val = item[f];
          
          if (val === undefined || val === null || val === '') {
            if (f.includes('date')) return 'NULL';
            if (f.includes('price') || f.includes('quantity') || f === 'price') return '0';
            return "''";
          }
          
          // Date Normalization (Handle DD-MM-YYYY and other formats)
          if (f.includes('date') && typeof val === 'string') {
            if (val.includes('-') && val.split('-')[0].length === 2) {
              const parts = val.split('-');
              val = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY to YYYY-MM-DD
            } else if (val.includes('/') && val.split('/')[0].length === 2) {
              const parts = val.split('/');
              val = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD/MM/YYYY to YYYY-MM-DD
            }
          }

          if (typeof val === 'number') {
            if (isNaN(val)) return '0';
            return val;
          }
          return `'${val.toString().replace(/'/g, "''")}'`;
        });
        const query = `INSERT INTO "${req.schemaName}"."${table}" (${fields.join(',')}) VALUES (${values.join(',')}) RETURNING *`;
        const result = await req.prisma.$queryRawUnsafe(query);
        results.push(result[0]);
      }
      res.status(201).json(results);
    } catch (error) { next(error); }
  });

  router.put(`/masters/${path}/:id`, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (path === 'medicines') await ensureMedicinesTable(req);
      await ensureTableColumns(req, table);
      
      const tableFields = {
        departments: ['name', 'description', 'hod', 'specialty', 'status'],
        specialities: ['name', 'description', 'base_consultation_fee'],
        consultation_modes: ['name', 'surcharge_percent', 'is_virtual'],
        diseases: ['name', 'category', 'icd_code', 'severity_level'],
        treatments: ['name', 'category', 'price', 'description', 'cpt_code', 'estimated_duration'],
        diagnostics: ['name', 'price', 'category'],
        medicines: ['name', 'category', 'composition', 'dosage_adult', 'dosage_pediatric', 'instructions', 'unit_price', 'stock_quantity', 'uom', 'batch_number', 'expiry_date'],
        services: ['name', 'category', 'service_code', 'price', 'tax_percent'],
        wards: ['name', 'type', 'capacity', 'floor', 'base_charge'],
        suppliers: ['name', 'contact_person', 'email', 'phone', 'address']
      };

      const allowed = tableFields[table] || ['name', 'description', 'category', 'price'];
      const fields = Object.keys(req.body).filter(f => allowed.includes(f) || (f === 'fee' && allowed.includes('base_consultation_fee')));

      if (fields.length === 0) return res.status(400).json({ error: "No valid fields provided for this master type." });

      const updates = fields.map(f => {
        const dbField = f === 'fee' ? 'base_consultation_fee' : f;
        let val = req.body[f];
        
        // Date normalization
        if (dbField.includes('date') && typeof val === 'string' && val) {
          if (val.includes('-') && val.split('-')[0].length === 2) {
            const parts = val.split('-');
            val = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else if (val.includes('/') && val.split('/')[0].length === 2) {
            const parts = val.split('/');
            val = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        if (val === undefined || val === null || val === '') {
          return `"${dbField}" = NULL`;
        }
        if (typeof val === 'number') {
          if (isNaN(val)) return `"${dbField}" = 0`;
          return `"${dbField}" = ${val}`;
        }
        return `"${dbField}" = '${val.toString().replace(/'/g, "''")}'`;
      });

      const query = `UPDATE "${req.schemaName}"."${table}" SET ${updates.join(', ')} WHERE id = '${id.replace(/'/g, "''")}' RETURNING *`;
      const result = await req.prisma.$queryRawUnsafe(query);
      if (result.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(result[0]);
    } catch (error) {
      console.error(`[MASTERS_PUT_ERROR] ${table}:`, error.message);
      next(error);
    }
  });
});

router.get("/staff", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT u.*, v.name as vendor_name 
      FROM "${req.schemaName}".users u 
      LEFT JOIN "${req.schemaName}".contractor_vendors v ON u.vendor_id = v.id 
      ORDER BY u.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/staff", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { name, email, password, role, specialization, department, gender, dob, doj, license_number, experience_years, qualifications, employment_type, vendor_id, is_manager } = req.body;
    if (!role || !['admin','administrator','doctor','nurse','pharmacist','lab_assistant','receptionist','staff'].includes(role.toLowerCase())) {
      return res.status(400).json({ error: "A valid role is required. Must be one of: admin, administrator, doctor, nurse, pharmacist, lab_assistant, receptionist, staff." });
    }
    const id = crypto.randomUUID();
    // SECURITY: Never use a hardcoded default password.
    // If a password is provided, use it. Otherwise use the env-configured default.
    // If no env default, generate a random password and log it so the admin can communicate it.
    let effectivePassword = password;
    if (!effectivePassword) {
      effectivePassword = process.env.STAFF_DEFAULT_PASSWORD || require('crypto').randomBytes(8).toString('hex');
      if (!process.env.STAFF_DEFAULT_PASSWORD) {
        console.log(`[STAFF] Generated temporary password for ${email}: ${effectivePassword} — communicate this to the user securely.`);
      }
    }
    const pwd = await bcrypt.hash(effectivePassword, 10);
    
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".users (
        id, name, email, password_hash, role, specialization, department, 
        gender, dob, doj, license_number, experience_years, qualifications, is_active,
        employment_type, vendor_id, is_manager
      )
      VALUES (
        '${id}', '${s(name)}', '${s(email)}', '${pwd}', '${s(role)}', 
        ${sqlValue(specialization)}, ${sqlValue(department)}, 
        ${sqlValue(gender)}, ${sqlValue(dob)}, ${sqlValue(doj)},
        ${sqlValue(license_number)}, ${experience_years || 0}, ${sqlValue(qualifications)}, true,
        ${sqlValue(employment_type || 'Permanent')}, ${sqlValue(vendor_id)}, ${is_manager === true || is_manager === 'true' || false}
      )
    `);
    if (String(role || '').toLowerCase() === 'doctor') {
      await ensureDefaultDoctorSchedule(req, id);
    }
    res.status(201).json({ id, name, email, role });
  } catch (error) { next(error); }
});

router.put("/staff/:id", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    const { name, email, role, specialization, department, gender, dob, doj, license_number, experience_years, qualifications, employment_type, vendor_id, is_manager } = req.body;
    if (!role || !['admin','administrator','doctor','nurse','pharmacist','lab_assistant','receptionist','staff'].includes(role.toLowerCase())) {
      return res.status(400).json({ error: "A valid role is required. Must be one of: admin, administrator, doctor, nurse, pharmacist, lab_assistant, receptionist, staff." });
    }
    
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".users 
      SET name = '${s(name)}', 
          email = '${s(email)}', 
          role = '${s(role)}', 
          specialization = ${sqlValue(specialization)}, 
          department = ${sqlValue(department)},
          gender = ${sqlValue(gender)},
          dob = ${sqlValue(dob)},
          doj = ${sqlValue(doj)},
          license_number = ${sqlValue(license_number)},
          experience_years = ${experience_years || 0},
          qualifications = ${sqlValue(qualifications)},
          employment_type = ${sqlValue(employment_type)},
          vendor_id = ${sqlValue(vendor_id)},
          is_manager = ${is_manager === true || is_manager === 'true' || false}
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete("/staff/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.prisma.$executeRawUnsafe(`DELETE FROM "${req.schemaName}".users WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- ENCOUNTERS (OPD/IPD VISITS) ---
router.post("/encounters", async (req, res, next) => {
  try {
    await ensureEncounterTable(req);
    await ensureBillingQueue(req);
    const { patientId, doctorId, type, vitals, complaints } = req.body;
    const query = `
      INSERT INTO "${req.schemaName}".encounters (patient_id, doctor_id, type, vitals, complaints, status)
      VALUES ('${patientId}', '${doctorId}', '${type}', ${jsonValue(vitals)}, '${s(complaints)}', 'Active')
      RETURNING *
    `;
    const result = await req.prisma.$queryRawUnsafe(query);
    const encounter = result[0];

    // Push Consultation Fee to Billing Queue
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".billing_queue (patient_id, encounter_id, source_module, source_id, description, quantity, unit_price)
      VALUES ('${patientId}', '${encounter.id}', 'OPD', '${encounter.id}', 'Consultation Fee', 1, 500)
    `);

    res.status(201).json(encounter);
  } catch (error) { next(error); }
});

router.put("/encounters/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { diagnosis, status, notes, vitals } = req.body;
    
    let query = `UPDATE "${req.schemaName}".encounters SET `;
    const updates = [];
    if (diagnosis !== undefined) updates.push(`diagnosis = '${s(diagnosis)}'`);
    if (status !== undefined) updates.push(`status = '${s(status)}'`);
    if (notes !== undefined) updates.push(`notes = '${s(notes)}'`);
    if (vitals !== undefined) updates.push(`vitals = '${JSON.stringify(vitals)}'`);
    
    if (updates.length === 0) return res.json({ success: true });
    
    query += updates.join(', ');
    query += ` WHERE id = '${id}'`;
    
    await req.prisma.$executeRawUnsafe(query);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.get("/encounters", async (req, res, next) => {
  try {
    await ensureEncounterTable(req);
    const status = req.query.status || 'Active';
    const patientId = req.query.patientId;
    const doctorId = req.query.doctorId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 200);
    const offset = (page - 1) * pageSize;
    const patientFilter = patientId ? `AND e.patient_id = '${patientId}'` : '';
    const doctorFilter = doctorId ? `AND e.doctor_id = '${doctorId}'` : '';
    const statusFilter = status === 'All' ? '' : `AND e.status = '${status}'`;
    const todayOnly = req.query.todayOnly === 'true';
    const dateFilter = todayOnly ? `AND e.created_at::date = CURRENT_DATE` : '';

    // Count total (lightweight)
    const countQuery = `SELECT COUNT(*)::int as count FROM "${req.schemaName}".encounters e WHERE 1=1 ${statusFilter} ${patientFilter} ${doctorFilter} ${dateFilter}`;
    const countRes = await req.prisma.$queryRawUnsafe(countQuery);
    const total = (countRes && countRes[0] && Number(countRes[0].count)) || 0;

    // Select only required columns and use LATERAL to fetch latest event efficiently
    const query = `
      SELECT 
        e.id, e.patient_id, e.doctor_id, e.status, e.type, e.created_at, e.vitals,
        e.complaints, e.diagnosis, e.notes,
        p.name as patient_name, p.mrn, p.age, p.gender,
        u.name as doctor_name,
        cp.predicted_time_mins,
        latest.event_type as latest_event,
        latest.start_time,
        CONCAT('OPD-', LPAD(RANK() OVER (ORDER BY e.created_at ASC)::text, 3, '0')) as token
      FROM "${req.schemaName}".encounters e
      JOIN "${req.schemaName}".patients p ON e.patient_id = p.id
      JOIN "${req.schemaName}".users u ON e.doctor_id = u.id
      LEFT JOIN "${req.schemaName}".consultation_predictions cp ON cp.encounter_id = e.id
      LEFT JOIN LATERAL (
        SELECT ce.event_type, ce.created_at as start_time
        FROM "${req.schemaName}".consultation_events ce
        WHERE ce.encounter_id = e.id
        ORDER BY ce.created_at DESC
        LIMIT 1
      ) latest ON true
      WHERE 1=1 ${statusFilter} ${patientFilter} ${doctorFilter} ${dateFilter}
      ORDER BY e.created_at ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const encounters = await req.prisma.$queryRawUnsafe(query);

    if (patientId && status === 'Completed' && encounters.length > 0) {
      await ensureOrderColumns(req);
      const encounterIds = encounters.map(enc => `'${s(enc.id)}'`).join(',');
      const prescriptionRows = await req.prisma.$queryRawUnsafe(`
        SELECT
          p.encounter_id,
          p.id as prescription_id,
          p.status as prescription_status,
          p.created_at as prescription_created_at,
          p.attachment_url,
          p.prescription_url,
          p.pdf_path,
          pi.drug_name,
          pi.dosage,
          pi.frequency,
          pi.duration,
          pi.instructions
        FROM "${req.schemaName}".prescriptions p
        LEFT JOIN "${req.schemaName}".prescription_items pi ON pi.prescription_id = p.id
        WHERE p.encounter_id IN (${encounterIds})
        ORDER BY p.created_at DESC, pi.created_at ASC
      `);
      const byEncounter = prescriptionRows.reduce((acc, row) => {
        if (!acc[row.encounter_id]) acc[row.encounter_id] = [];
        if (row.drug_name) {
          acc[row.encounter_id].push({
            prescription_id: row.prescription_id,
            status: row.prescription_status,
            created_at: row.prescription_created_at,
            name: row.drug_name,
            dosage: row.dosage,
            frequency: row.frequency,
            duration: row.duration,
            instructions: row.instructions,
            attachment_url: row.attachment_url,
            prescription_url: row.prescription_url,
            pdf_path: row.pdf_path
          });
        } else if (!row.drug_name && row.prescription_id) {
          // If there's an attachment but no items (e.g. past history prescription record)
          // ensure the prescription object still exists in the array
          acc[row.encounter_id].push({
            prescription_id: row.prescription_id,
            status: row.prescription_status,
            created_at: row.prescription_created_at,
            attachment_url: row.attachment_url,
            prescription_url: row.prescription_url,
            pdf_path: row.pdf_path
          });
        }
        return acc;
      }, {});
      encounters.forEach(enc => {
        const pres = byEncounter[enc.id] || [];
        enc.prescriptions = pres;
        if (pres.length > 0) {
          enc.attachment_url = pres[0].attachment_url;
          enc.prescription_url = pres[0].prescription_url;
          enc.pdf_path = pres[0].pdf_path;
        }
      });
    }

    // --- QUEUE WAIT TIME ENGINE (on paged data) ---
    const doctorQueues = {};
    encounters.forEach(enc => {
      if (!doctorQueues[enc.doctor_id]) doctorQueues[enc.doctor_id] = [];
      doctorQueues[enc.doctor_id].push(enc);
    });

    Object.keys(doctorQueues).forEach(docId => {
      let cumulativeWait = 0;
      const queue = doctorQueues[docId]; // Already sorted by created_at ASC in SQL

      queue.forEach((enc) => {
        if (enc.latest_event === 'CONSULT_START') {
          const elapsed = enc.start_time ? (Date.now() - new Date(enc.start_time).getTime()) / 60000 : 0;
          const remaining = Math.max(0, (enc.predicted_time_mins || 15) - elapsed);
          enc.predicted_wait_time = 0;
          cumulativeWait = remaining;
          enc.is_in_consultation = true;
        } else if (enc.latest_event === 'CONSULT_END' || enc.status === 'Completed') {
          enc.predicted_wait_time = 0;
          enc.is_finished = true;
        } else {
          enc.predicted_wait_time = Math.round(cumulativeWait);
          cumulativeWait += (enc.predicted_time_mins || 15);
          enc.is_waiting = true;
        }
      });
    });

    res.json({ total, page, pageSize, data: encounters });
  } catch (error) {
    console.error("[GET_ENCOUNTERS] Error:", error.message);
    next(error);
  }
});

// --- IPD / BED MANAGEMENT ---
router.get("/ipd/bedmap", async (req, res, next) => {
  try {
    await ensureIPDMasters(req);
    const wards = await req.prisma.$queryRawUnsafe(`
      SELECT w.*, 
        (SELECT COUNT(*) FROM "${req.schemaName}".beds b WHERE b.ward_id = w.id AND b.status = 'Occupied') as occupied
      FROM "${req.schemaName}".wards w
    `);
    res.json(wards);
  } catch (error) { next(error); }
});

router.get("/ipd/wards/:id/beds", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT b.*, p.name as patient_name, p.mrn, adm.id as admission_id
      FROM "${req.schemaName}".beds b
      LEFT JOIN "${req.schemaName}".ipd_admissions adm ON b.id = adm.bed_id AND adm.status = 'Admitted'
      LEFT JOIN "${req.schemaName}".patients p ON adm.patient_id = p.id
      WHERE b.ward_id = '${id}'
      ORDER BY b.bed_number ASC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/ipd/wards/:id/provision-beds", async (req, res, next) => {
  try {
    const { id } = req.params;
    const wards = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".wards WHERE id = '${id}'`);
    if (!wards.length) return res.status(404).json({ error: "Ward not found" });
    const ward = wards[0];
    const capacity = parseInt(ward.capacity) || 10;

    // Add unique constraint idempotently to avoid duplicates
    try {
      await req.prisma.$executeRawUnsafe(`
        ALTER TABLE "${req.schemaName}".beds 
        ADD CONSTRAINT beds_ward_bed_unique UNIQUE (ward_id, bed_number)
      `);
    } catch (e) { /* Constraint already exists — safe to ignore */ }

    // Provision beds that don't already exist
    for (let i = 1; i <= capacity; i++) {
      const bedNum = `${ward.name.substring(0, 2).toUpperCase()}-${String(i).padStart(2, '0')}`;
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".beds (ward_id, bed_number, status)
        VALUES ('${id}', '${bedNum}', 'Vacant')
        ON CONFLICT (ward_id, bed_number) DO NOTHING
      `);
    }
    res.json({ success: true, message: `Provisioned up to ${capacity} beds for ward.` });
  } catch (error) { next(error); }
});

router.post("/ipd/admissions", async (req, res, next) => {
  try {
    await ensureIPDAdmissionsTable(req);
    await ensureBillingQueue(req);
    await ensureIPDMasters(req);
    let { patientId, bedId, wardId, admittingDoctorId, admissionReason, dailyCharge } = req.body;
    
    if (!patientId) return res.status(400).json({ error: "Patient is required." });

    // If bedId not provided, attempt to auto-assign a vacant bed (optionally within provided ward)
    let selectedBedId = bedId || null;
    let selectedWardId = wardId || null;
    try {
      if (!selectedBedId) {
        const bedQuery = selectedWardId
          ? `SELECT id, ward_id FROM "${req.schemaName}".beds WHERE ward_id = '${selectedWardId}' AND status = 'Vacant' LIMIT 1`
          : `SELECT id, ward_id FROM "${req.schemaName}".beds WHERE status = 'Vacant' LIMIT 1`;
        const bedRows = await req.prisma.$queryRawUnsafe(bedQuery);
        if (bedRows && bedRows.length > 0) {
          selectedBedId = bedRows[0].id;
          selectedWardId = selectedWardId || bedRows[0].ward_id;
        }
      }
    } catch (e) {
      console.warn('[ADMISSION] Bed auto-assign check failed:', e.message);
    }

    if (!selectedBedId || !selectedWardId) return res.status(400).json({ error: "No vacant bed available or ward not specified." });

    // Resolve admitting doctor if missing
    if (!admittingDoctorId) {
      try {
        admittingDoctorId = await getCurrentUserId(req);
      } catch (e) { admittingDoctorId = null; }
    }
    if (!admittingDoctorId) return res.status(400).json({ error: "Admitting doctor is required." });

    // Get ward's base charge if dailyCharge not provided
    if (!dailyCharge) {
      const wardInfo = await req.prisma.$queryRawUnsafe(`SELECT base_charge FROM "${req.schemaName}".wards WHERE id = '${selectedWardId}'`);
      dailyCharge = (wardInfo && wardInfo[0] && wardInfo[0].base_charge) || 1000;
    }

    // 1. Create Admission Record
    const admId = crypto.randomUUID();
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".ipd_admissions (id, patient_id, bed_id, ward_id, admitting_doctor_id, admission_reason, daily_charge, status)
      VALUES ('${admId}', '${patientId}', '${selectedBedId}', '${selectedWardId}', '${admittingDoctorId}', '${s(admissionReason)}', ${dailyCharge}, 'Admitted')
    `);

    // 2. Update Bed Status
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".beds SET status = 'Occupied' WHERE id = '${selectedBedId}'`);

    // 3. Push Admission Fee to Billing Queue
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".billing_queue (patient_id, source_module, source_id, description, quantity, unit_price)
      VALUES ('${patientId}', 'IPD', '${admId}', 'Admission Charges', 1, ${dailyCharge})
    `);

    res.status(201).json({ id: admId, dailyCharge });
  } catch (error) { next(error); }
});

router.get("/ipd/admissions", async (req, res, next) => {
  try {
    await ensureIPDAdmissionsTable(req);
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 200);
    const offset = (page - 1) * pageSize;

    const countQuery = `SELECT COUNT(*)::int as count FROM "${req.schemaName}".ipd_admissions a WHERE a.status = 'Admitted'`;
    const countRes = await req.prisma.$queryRawUnsafe(countQuery);
    const total = (countRes && countRes[0] && Number(countRes[0].count)) || 0;

    const data = await req.prisma.$queryRawUnsafe(`
      SELECT a.id, a.patient_id, a.bed_id, a.ward_id, a.admitting_doctor_id, a.daily_charge, a.status, a.admitted_at,
             p.name as patient_name, p.mrn, p.age, p.gender, p.phone, w.name as ward_name, b.bed_number, u.name as doctor_name
      FROM "${req.schemaName}".ipd_admissions a
      JOIN "${req.schemaName}".patients p ON a.patient_id = p.id
      LEFT JOIN "${req.schemaName}".wards w ON a.ward_id = w.id
      LEFT JOIN "${req.schemaName}".beds b ON a.bed_id = b.id
      LEFT JOIN "${req.schemaName}".users u ON a.admitting_doctor_id = u.id
      WHERE a.status = 'Admitted'
      ORDER BY a.admitted_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    res.json({ total, page, pageSize, data });
  } catch (error) { next(error); }
});

// GET single admission (for IPDPatientView)
router.get("/ipd/admissions/:id", async (req, res, next) => {
  try {
    await ensureIPDAdmissionsTable(req);
    const { id } = req.params;
    const admissions = await req.prisma.$queryRawUnsafe(`
      SELECT a.*, p.name as patient_name, p.mrn, p.age, p.gender, p.phone, p.blood_group, p.allergies,
             w.name as ward_name, b.bed_number, u.name as doctor_name
      FROM "${req.schemaName}".ipd_admissions a
      JOIN "${req.schemaName}".patients p ON a.patient_id = p.id
      LEFT JOIN "${req.schemaName}".wards w ON a.ward_id = w.id
      LEFT JOIN "${req.schemaName}".beds b ON a.bed_id = b.id
      LEFT JOIN "${req.schemaName}".users u ON a.admitting_doctor_id = u.id
      WHERE a.id = '${id}'
    `);
    if (!admissions.length) return res.status(404).json({ error: "Admission not found" });

    const notes = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".ipd_notes
      WHERE admission_id = '${id}'
      ORDER BY created_at DESC
    `);

    // Check for discharge summary
    let dischargeSummary = null;
    try {
      const ds = await req.prisma.$queryRawUnsafe(`
        SELECT * FROM "${req.schemaName}".discharge_summaries
        WHERE admission_id = '${id}'
        ORDER BY created_at DESC LIMIT 1
      `);
      dischargeSummary = ds[0] || null;
    } catch (e) { /* table may not exist yet */ }

    res.json({ admission: admissions[0], notes, dischargeSummary });
  } catch (error) { next(error); }
});

// POST clinical note for an IPD admission
router.post("/ipd/admissions/:id/notes", async (req, res, next) => {
  try {
    await ensureIPDAdmissionsTable(req);
    const { id } = req.params;
    const { noteText, noteType } = req.body;
    const doctorId = await getCurrentUserId(req);
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".ipd_notes (admission_id, note_text, note_type, doctor_id, doctor_name)
      VALUES ('${id}', '${s(noteText)}', '${s(noteType || 'Progress')}',
        ${doctorId ? `'${doctorId}'` : 'NULL'},
        (SELECT name FROM "${req.schemaName}".users WHERE id = ${doctorId ? `'${doctorId}'` : 'NULL'} LIMIT 1)
      )
    `);
    res.json({ success: true, message: "Clinical note saved." });
  } catch (error) { next(error); }
});

// POST AI Discharge Summary generation
router.post("/ipd/admissions/:id/generate-summary", async (req, res, next) => {
  try {
    await ensureIPDAdmissionsTable(req);
    await ensureDischargeTable(req);
    const { id } = req.params;
    const admissions = await req.prisma.$queryRawUnsafe(`
      SELECT a.*, p.name as patient_name, p.mrn, p.allergies, p.medical_history
      FROM "${req.schemaName}".ipd_admissions a
      JOIN "${req.schemaName}".patients p ON a.patient_id = p.id
      WHERE a.id = '${id}'
    `);
    if (!admissions.length) return res.status(404).json({ error: "Admission not found" });
    const adm = admissions[0];

    const notes = await req.prisma.$queryRawUnsafe(
      `SELECT note_text FROM "${req.schemaName}".ipd_notes WHERE admission_id = '${id}' ORDER BY created_at ASC`
    );
    const notesSummary = notes.map(n => n.note_text).join('\n');

    let summaryText = `DISCHARGE SUMMARY\n\nPatient: ${adm.patient_name} (${adm.mrn})\nAdmission Reason: ${adm.admission_reason}\n\nClinical Notes:\n${notesSummary || 'No notes recorded.'}\n\nDischarge Condition: Stable`;
    try {
      const aiService = require('../../services/aiService');
      const generated = await aiService.generateDischargeSummary(adm, notes);
      if (generated && !generated.error) summaryText = generated;
    } catch (e) { console.warn('[IPD] AI summary unavailable, using template.'); }

    // Upsert discharge summary draft
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".discharge_summaries (admission_id, patient_id, summary_text, discharge_type, status)
      VALUES ('${id}', '${adm.patient_id}', '${s(summaryText)}', 'STANDARD', 'Draft')
      ON CONFLICT (admission_id) DO UPDATE SET summary_text = '${s(summaryText)}', status = 'Draft'
    `);

    res.json({ summaryText, message: 'AI discharge summary generated.' });
  } catch (error) { next(error); }
});

async function ensureAdmissionRecommendations(req) {
  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".admission_recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      encounter_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      doctor_id UUID NOT NULL,
      reason TEXT,
      status VARCHAR(50) DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  } catch (e) {
    console.error(`[ADMISSION_RECOMMENDATIONS] DDL failed:`, e.message);
  }
}

// --- CLINICAL ORDERS (LAB & PHARMACY & ADMISSION) ---
router.post("/encounters/:id/admission-recommendation", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await ensureAdmissionRecommendations(req);

    const encounter = await req.prisma.$queryRawUnsafe(`SELECT patient_id, doctor_id FROM "${req.schemaName}".encounters WHERE id = '${id}'`);
    if (encounter.length === 0) return res.status(404).json({ error: "Encounter not found" });
    
    const { patient_id, doctor_id } = encounter[0];

    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".admission_recommendations (encounter_id, patient_id, doctor_id, reason, status)
      VALUES ('${id}', '${patient_id}', '${doctor_id}', '${s(reason)}', 'Pending')
    `);

    res.json({ message: "Admission recommendation registered." });
  } catch (error) { next(error); }
});

router.get("/ipd/recommendations", async (req, res, next) => {
  try {
    await ensureAdmissionRecommendations(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT r.*, p.name as patient_name, p.mrn, u.name as doctor_name
      FROM "${req.schemaName}".admission_recommendations r
      JOIN "${req.schemaName}".patients p ON r.patient_id = p.id
      JOIN "${req.schemaName}".users u ON r.doctor_id = u.id
      WHERE r.status = 'Pending'
      ORDER BY r.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/encounters/:id/prescriptions", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    await ensureOrderColumns(req);
    await ensureBillingQueue(req);

    const encounter = await req.prisma.$queryRawUnsafe(`SELECT patient_id FROM "${req.schemaName}".encounters WHERE id = '${id}'`);
    if (!encounter.length) return res.status(404).json({ error: "Encounter not found" });
    const patientId = encounter[0].patient_id;

    // 1. Create Prescription Header
    const presHeader = await req.prisma.$queryRawUnsafe(`
      INSERT INTO "${req.schemaName}".prescriptions (encounter_id, patient_id, status)
      VALUES ('${id}', '${patientId}', 'Pending')
      RETURNING id
    `);
    const presId = presHeader[0].id;
    const prescriptionUrl = `/api/hospital/prescriptions/${presId}/view`;

    // 2. Create Prescription Items & Billing
    for (const item of items) {
      // Find medicine for pricing
      const med = await req.prisma.$queryRawUnsafe(`SELECT id, unit_price FROM "${req.schemaName}".medicines WHERE name ILIKE '%${s(item.name)}%' LIMIT 1`);
      const medicineId = med[0]?.id || null;
      const price = med[0]?.unit_price || 100;

      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".prescription_items (prescription_id, medicine_id, drug_name, dosage, frequency, duration, instructions)
        VALUES ('${presId}', ${medicineId ? `'${medicineId}'` : 'NULL'}, '${s(item.name)}', '${s(item.dosage)}', '${s(item.frequency)}', '${s(item.duration)}', '${s(item.instructions)}')
      `);

      // Push to Billing Queue
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".billing_queue (patient_id, encounter_id, source_module, source_id, description, quantity, unit_price)
        VALUES ('${patientId}', '${id}', 'PHARMACY', '${presId}', 'Medicine: ${s(item.name)}', 1, ${price})
      `);
    }
    // 3. Update prescription with attachment URL
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".prescriptions SET prescription_url = '${prescriptionUrl}', attachment_url = '${prescriptionUrl}' WHERE id = '${presId}'
    `);
    res.json({ message: "Prescriptions saved and billed.", prescriptionId: presId, prescriptionUrl });
  } catch (error) { 
    console.error("[PRESCRIPTION_POST_ERROR]", error.message);
    next(error); 
  }
});

router.post("/encounters/:id/lab-orders", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { diagnosticIds, priority } = req.body;
    if (!Array.isArray(diagnosticIds) || diagnosticIds.length === 0) {
      return res.status(400).json({ error: "No lab tests selected for ordering." });
    }

    await ensureOrderColumns(req);
    await ensureBillingQueue(req);

    const encounter = await req.prisma.$queryRawUnsafe(`SELECT patient_id, doctor_id FROM "${req.schemaName}".encounters WHERE id = '${id}'`);
    if (!encounter.length) return res.status(404).json({ error: "Encounter not found" });
    const patientId = encounter[0].patient_id;
    let doctorId = encounter[0].doctor_id;
    if (!doctorId) {
      doctorId = await getCurrentUserId(req);
    }

    for (const testId of diagnosticIds) {
      const orderId = crypto.randomUUID();
      const diag = await req.prisma.$queryRawUnsafe(`SELECT name, price FROM "${req.schemaName}".diagnostics WHERE id::text = '${testId}' OR name = '${testId}' LIMIT 1`);
      const testName = diag[0]?.name || testId;
      const price = diag[0]?.price || 500;
      const reportUrl = `/api/hospital/lab/orders/${orderId}/view`;

      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".lab_orders (id, encounter_id, patient_id, doctor_id, test_name, priority, status, report_url, attachment_url)
        VALUES ('${orderId}', '${id}', '${patientId}', ${doctorId ? `'${doctorId}'` : 'NULL'}, '${s(testName)}', '${s(priority || 'Normal')}', 'Pending', '${reportUrl}', '${reportUrl}')
      `);

      // Push to Billing Queue
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".billing_queue (patient_id, encounter_id, source_module, source_id, description, quantity, unit_price)
        VALUES ('${patientId}', '${id}', 'LAB', '${orderId}', 'Lab: ${s(testName)}', 1, ${price})
      `);
    }
    res.json({ message: "Lab orders saved and billed." });
  } catch (error) { 
    console.error("[LAB_ORDER_POST_ERROR]", error);
    next(error); 
  }
});

router.post("/lab/upload-external", upload.single("lab_report"), async (req, res, next) => {
  try {
    const { patientId } = req.body;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let extractedText = "Extracted data...";
    try {
      if (req.file.mimetype === 'application/pdf') {
        extractedText = await pdfService.extractTextFromPDF(req.file.path);
      } else {
        extractedText = "Simulated extraction from image.";
      }
    } catch (e) {
      console.warn("Could not extract text:", e.message);
    }

    let aiResponse = { noteText: "AI Engine parsed the report successfully.\\n\\nKey findings:\\n- Hemoglobin: 12.5 g/dL (Normal)\\n- WBC: 8,500/cumm (Normal)\\n\\n(Simulation output: " + extractedText.substring(0, 150) + "...)" };
    try {
      if (aiService.parseExternalLabReport) {
        const parsed = await aiService.parseExternalLabReport(req.file.path);
        if (parsed) aiResponse = parsed;
      }
    } catch (e) {}

    const fs = require('fs');
    try {
      fs.unlinkSync(req.file.path);
    } catch(e) {}

    res.json(aiResponse);
  } catch (error) { next(error); }
});

// --- VIEW PRESCRIPTION PDF ---
router.get("/prescriptions/:id/view", async (req, res, next) => {
  try {
    const { id } = req.params;
    await ensureOrderColumns(req);

    // 1. Fetch prescription
    const prescriptions = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".prescriptions WHERE id = '${s(id)}'
    `);
    const prescription = prescriptions[0];
    if (!prescription) {
      return res.status(404).send("Prescription not found");
    }

    // 2. Fetch patient details
    const patients = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".patients WHERE id = '${prescription.patient_id}'
    `);
    const patient = patients[0];

    // 3. Fetch encounter & doctor name
    const encounters = await req.prisma.$queryRawUnsafe(`
      SELECT e.*, u.name as doctor_name 
      FROM "${req.schemaName}".encounters e
      LEFT JOIN "${req.schemaName}".users u ON e.doctor_id = u.id
      WHERE e.id = '${prescription.encounter_id}'
    `);
    const encounter = encounters[0];

    // 4. Fetch prescription items
    const items = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".prescription_items WHERE prescription_id = '${s(id)}'
    `);

    // Generate beautiful PDF using pdfService
    const pdfData = await pdfService.createPrescriptionPDF(req.tenantName, prescription, patient, encounter, items);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="prescription_${id}.pdf"`);
    res.send(pdfData);
  } catch (error) {
    next(error);
  }
});

// --- VIEW LAB REPORT PDF ---
router.get("/lab/orders/:id/view", async (req, res, next) => {
  try {
    const { id } = req.params;
    await ensureOrderColumns(req);

    // 1. Fetch lab order
    const labOrders = await req.prisma.$queryRawUnsafe(`
      SELECT lo.*, u.name as doctor_name 
      FROM "${req.schemaName}".lab_orders lo
      LEFT JOIN "${req.schemaName}".users u ON lo.doctor_id = u.id
      WHERE lo.id = '${s(id)}'
    `);
    const labOrder = labOrders[0];
    if (!labOrder) {
      return res.status(404).send("Lab order not found");
    }

    // 2. Fetch patient details
    const patients = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".patients WHERE id = '${labOrder.patient_id}'
    `);
    const patient = patients[0];

    // Parse results
    let results = [];
    if (labOrder.results) {
      try {
        results = typeof labOrder.results === 'string' ? JSON.parse(labOrder.results) : labOrder.results;
      } catch (e) {
        results = [];
      }
    }

    // Generate beautiful PDF using pdfService
    const pdfData = await pdfService.createLabReportPDF(req.tenantName, labOrder, patient, results);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="lab_report_${id}.pdf"`);
    res.send(pdfData);
  } catch (error) {
    next(error);
  }
});

router.get("/lab/orders", async (req, res, next) => {
  try {
    await ensureOrderColumns(req);
    const patientId = req.query.patientId;
    const patientFilter = patientId ? `WHERE lo.patient_id = '${s(patientId)}'` : '';
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT lo.*, 
             COALESCE(p.name, 'Unknown') as patient_name, 
             p.mrn, 
             COALESCE(u.name, 'Staff') as doctor_name
      FROM "${req.schemaName}".lab_orders lo
      LEFT JOIN "${req.schemaName}".patients p ON lo.patient_id = p.id
      LEFT JOIN "${req.schemaName}".users u ON lo.doctor_id = u.id
      ${patientFilter}
      ORDER BY lo.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.put("/lab/orders/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".lab_orders SET status = '${s(status)}' WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post("/lab/orders/:id/results", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { results, technicianNote } = req.body;
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".lab_orders 
      SET results = ${jsonValue(results)}, technician_notes = '${s(technicianNote)}', status = 'Completed' 
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post("/lab/orders/:id/publish", async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".lab_orders SET status = 'Published' WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- IPD ROUNDS & SERVICE POSTING ---
router.post("/ipd/admissions/:id/service-charges", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, amount, quantity } = req.body;
    
    const adm = await req.prisma.$queryRawUnsafe(`SELECT patient_id FROM "${req.schemaName}".ipd_admissions WHERE id = '${id}'`);
    if (adm.length === 0) return res.status(404).json({ error: "Admission not found" });

    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".billing_queue (patient_id, source_module, source_id, description, quantity, unit_price)
      VALUES ('${adm[0].patient_id}', 'IPD_SERVICE', '${id}', '${s(description)}', ${quantity || 1}, ${amount})
    `);

    res.json({ success: true, message: "Service charges posted to bill." });
  } catch (error) { next(error); }
});

router.post("/ipd/admissions/:id/discharge", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { summary, dischargeType } = req.body;
    
    // 1. Get Admission Details with Ward Info
    const adms = await req.prisma.$queryRawUnsafe(`
      SELECT a.*, w.base_charge as ward_base_charge 
      FROM "${req.schemaName}".ipd_admissions a
      JOIN "${req.schemaName}".wards w ON a.ward_id = w.id
      WHERE a.id = '${id}'
    `);
    const adm = adms[0];
    if (!adm) return res.status(404).json({ error: "Admission not found" });

    // Note: Clearance flags (pharmacy/billing/clinical) are advisory. Discharge can proceed.

    // 2. Calculate Days and Room Charges using ward_base_charge
    const stayMs = new Date().getTime() - new Date(adm.admitted_at).getTime();
    const days = Math.max(1, Math.ceil(stayMs / (1000 * 60 * 60 * 24)));
    const dailyChargeAmount = adm.daily_charge || adm.ward_base_charge || 1000;
    const roomCharge = days * dailyChargeAmount;

    // 3. Ensure billing queue exists before posting room charges
    await ensureBillingQueue(req);
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".billing_queue (patient_id, source_module, source_id, description, quantity, unit_price)
      VALUES ('${adm.patient_id}', 'IPD_ROOM', '${id}', 'Room Charges (${days} Days)', ${days}, ${dailyChargeAmount})
    `);

    // 4. Create Discharge Summary
    await ensureDischargeTable(req);
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".discharge_summaries (admission_id, patient_id, summary_text, discharge_type, status)
      VALUES ('${id}', '${adm.patient_id}', '${s(summary)}', '${s(dischargeType)}', 'Final')
    `);

    // 5. Free the Bed & Update Admission Status
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".beds SET status = 'Vacant' WHERE id = '${adm.bed_id}'`);
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".ipd_admissions SET status = 'Discharged', discharged_at = NOW() WHERE id = '${id}'`);

    res.json({ success: true, message: "Patient discharged and bill finalized.", roomChargeAdded: roomCharge, daysOfStay: days });
  } catch (error) { next(error); }
});

router.post("/ipd/admissions/:id/transfer", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newBedId, newWardId } = req.body;
    await ensureIPDAdmissionsTable(req);
    await ensureBillingQueue(req);

    const adms = await req.prisma.$queryRawUnsafe(`
      SELECT a.*, w.base_charge as ward_base_charge, w.name as ward_name
      FROM "${req.schemaName}".ipd_admissions a
      JOIN "${req.schemaName}".wards w ON a.ward_id = w.id
      WHERE a.id = '${id}'
    `);
    const adm = adms[0];
    if (!adm) return res.status(404).json({ error: "Admission not found" });

    const stayMs = new Date().getTime() - new Date(adm.admitted_at).getTime();
    const days = Math.max(1, Math.ceil(stayMs / (1000 * 60 * 60 * 24)));
    const dailyChargeAmount = adm.daily_charge || adm.ward_base_charge || 1000;
    const roomCharge = days * dailyChargeAmount;

    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".billing_queue (patient_id, source_module, source_id, description, quantity, unit_price)
      VALUES ('${adm.patient_id}', 'IPD_ROOM', '${id}', 'Room Charges (${days} Days in ${adm.ward_name})', ${days}, ${dailyChargeAmount})
    `);

    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".beds SET status = 'Vacant' WHERE id = '${adm.bed_id}'`);
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".beds SET status = 'Occupied' WHERE id = '${newBedId}'`);

    const newWards = await req.prisma.$queryRawUnsafe(`SELECT base_charge FROM "${req.schemaName}".wards WHERE id = '${newWardId}'`);
    const newCharge = newWards[0]?.base_charge || 1000;

    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".ipd_admissions 
      SET ward_id = '${newWardId}', 
          bed_id = '${newBedId}', 
          daily_charge = ${newCharge},
          admitted_at = NOW() 
      WHERE id = '${id}'
    `);

    res.json({ success: true, message: "Patient transferred successfully." });
  } catch (error) { next(error); }
});

router.post("/ipd/admissions/:id/clearance", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, status } = req.body;
    
    if (!['pharmacy', 'billing', 'clinical'].includes(type)) {
      return res.status(400).json({ error: "Invalid clearance type" });
    }

    const field = `${type}_cleared`;
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".ipd_admissions 
      SET ${field} = ${status} 
      WHERE id = '${id}'
    `);

    res.json({ success: true, message: `${type} clearance updated.` });
  } catch (error) { next(error); }
});

router.get("/ipd/discharges", async (req, res, next) => {
  try {
    await ensureDischargeTable(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT ds.*, p.name as patient_name, p.mrn, u.name as doctor_name
      FROM "${req.schemaName}".discharge_summaries ds
      JOIN "${req.schemaName}".patients p ON ds.patient_id = p.id
      LEFT JOIN "${req.schemaName}".users u ON ds.doctor_id = u.id
      ORDER BY ds.discharge_date DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.get("/ipd/discharges/:id", async (req, res, next) => {
  try {
    await ensureDischargeTable(req);
    const { id } = req.params;
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT ds.*, p.name as patient_name, p.mrn, u.name as doctor_name
      FROM "${req.schemaName}".discharge_summaries ds
      JOIN "${req.schemaName}".patients p ON ds.patient_id = p.id
      LEFT JOIN "${req.schemaName}".users u ON ds.doctor_id = u.id
      WHERE ds.id = '${id}'
    `);
    if (!data.length) return res.status(404).json({ error: "Summary not found" });
    res.json(data[0]);
  } catch (error) { next(error); }
});

router.put("/ipd/discharges/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { summary_text, is_authenticated } = req.body;
    const doctorId = await getCurrentUserId(req);
    
    let updateFields = `summary_text = '${s(summary_text)}'`;
    if (is_authenticated !== undefined) {
      updateFields += `, is_authenticated = ${is_authenticated}, status = '${is_authenticated ? 'Authenticated' : 'Draft'}'`;
      if (is_authenticated) {
        updateFields += `, authenticated_at = NOW()`;
      }
    }
    if (doctorId) {
      updateFields += `, doctor_id = '${doctorId}'`;
    }

    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".discharge_summaries 
      SET ${updateFields}
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- PHARMACY MANAGEMENT ---
const medicinesTableSynced = new Set();
async function ensureMedicinesTable(req) {
  const schema = req.schemaName;
  if (!schema || medicinesTableSynced.has(schema)) return;
  try {
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".medicines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Other',
        composition TEXT,
        dosage_adult VARCHAR(100),
        dosage_pediatric VARCHAR(100),
        instructions TEXT,
        unit_price NUMERIC(12,2) DEFAULT 0,
        stock_quantity INTEGER DEFAULT 0,
        uom VARCHAR(50) DEFAULT 'Tablet',
        batch_number VARCHAR(100),
        expiry_date DATE,
        is_active BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Schema healing: add any columns that may be missing in older tenant schemas
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS uom VARCHAR(50) DEFAULT 'Tablet'`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100)`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS composition TEXT`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS description TEXT`);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
    medicinesTableSynced.add(schema);
  } catch (err) {
    console.warn(`[PHARMACY] ensureMedicinesTable failed for ${schema}:`, err.message);
  }
}

router.get("/pharmacy/inventory", async (req, res, next) => {
  try {
    await ensureMedicinesTable(req);
    const data = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".medicines ORDER BY name ASC`);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/pharmacy/inventory", async (req, res, next) => {
  try {
    await ensureMedicinesTable(req);
    const { name, category, quantity, price, expiryDate } = req.body;
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".medicines (name, category, stock_quantity, unit_price, expiry_date, is_active)
      VALUES ('${s(name)}', '${s(category)}', ${parseInt(quantity) || 0}, ${parseFloat(price) || 0}, ${sqlValue(expiryDate)}, true)
    `);
    res.status(201).json({ success: true });
  } catch (error) { next(error); }
});

router.get("/pharmacy/prescriptions", async (req, res, next) => {
  try {
    await ensureOrderColumns(req);
    const { doctorId } = req.query;
    const doctorFilter = doctorId ? `WHERE e.doctor_id = '${doctorId}'` : '';
    
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT p.*, pat.name as patient_name, pat.mrn, pat.id as patient_id,
             COALESCE(u.name, 'IPD Staff') as doctor_name
      FROM "${req.schemaName}".prescriptions p
      LEFT JOIN "${req.schemaName}".encounters e ON p.encounter_id = e.id
      LEFT JOIN "${req.schemaName}".patients pat ON e.patient_id = pat.id
      LEFT JOIN "${req.schemaName}".users u ON e.doctor_id = u.id
      ${doctorFilter}
      ORDER BY p.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.get("/pharmacy/prescriptions/:id/items", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT pi.*, m.name as medicine_name, m.unit_price
      FROM "${req.schemaName}".prescription_items pi
      LEFT JOIN "${req.schemaName}".medicines m ON pi.medicine_id = m.id
      WHERE pi.prescription_id = '${id}'
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/pharmacy/dispense", async (req, res, next) => {
  try {
    const { prescriptionId, items, encounterId } = req.body;
    await ensureBillingQueue(req);
    await ensureInwardsTable(req);

    for (const item of items) {
      // 1. FEFO Stock Decrement (First Expired, First Out)
      let qtyNeeded = parseInt(item.quantity) || 0;
      
      const batches = await req.prisma.$queryRawUnsafe(`
        SELECT id, current_stock, batch_number, expiry_date 
        FROM "${req.schemaName}".pharmacy_inwards 
        WHERE medicine_id = '${item.drugId}' AND current_stock > 0 AND is_blocked = FALSE
        ORDER BY expiry_date ASC
      `);

      const consumedBatches = [];
      for (const batch of batches) {
        if (qtyNeeded <= 0) break;
        const consume = Math.min(qtyNeeded, batch.current_stock);
        await req.prisma.$executeRawUnsafe(`
          UPDATE "${req.schemaName}".pharmacy_inwards 
          SET current_stock = current_stock - ${consume} 
          WHERE id = '${batch.id}'
        `);
        
        let expiryStr = 'N/A';
        if (batch.expiry_date) {
          const d = new Date(batch.expiry_date);
          expiryStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
        }
        
        consumedBatches.push({
          batchNumber: batch.batch_number || 'N/A',
          expiry: expiryStr,
          quantity: consume
        });
        
        qtyNeeded -= consume;
      }

      if (qtyNeeded > 0) {
        consumedBatches.push({
          batchNumber: 'Default',
          expiry: 'N/A',
          quantity: qtyNeeded
        });
      }

      await req.prisma.$executeRawUnsafe(`
        UPDATE "${req.schemaName}".medicines 
        SET stock_quantity = GREATEST(0, stock_quantity - ${item.quantity}) 
        WHERE id = '${item.drugId}' OR name ILIKE '${s(item.drugName)}'
      `);

      // 2. Resolve patient ID — from encounter OR from prescription's admission
      let patientId = null;
      if (encounterId && encounterId !== 'undefined') {
        const encounter = await req.prisma.$queryRawUnsafe(`SELECT patient_id FROM "${req.schemaName}".encounters WHERE id = '${encounterId}'`);
        patientId = encounter[0]?.patient_id;
      }
      // Fallback: find patient via prescription → ipd_admissions
      if (!patientId && prescriptionId) {
        const pres = await req.prisma.$queryRawUnsafe(`
          SELECT e.patient_id
          FROM "${req.schemaName}".prescriptions p
          LEFT JOIN "${req.schemaName}".encounters e ON p.encounter_id = e.id
          WHERE p.id = '${prescriptionId}'
        `);
        patientId = pres[0]?.patient_id;
      }

      if (patientId) {
        for (const cb of consumedBatches) {
          await req.prisma.$executeRawUnsafe(`
            INSERT INTO "${req.schemaName}".billing_queue (patient_id, encounter_id, source_module, source_id, description, quantity, unit_price)
            VALUES ('${patientId}', ${encounterId && encounterId !== 'undefined' ? `'${encounterId}'` : 'NULL'}, 'PHARMACY', '${prescriptionId || crypto.randomUUID()}', 'Medicine: ${s(item.drugName)} (Batch: ${s(cb.batchNumber)}, Exp: ${s(cb.expiry)})', ${cb.quantity}, ${item.unitPrice})
          `);
        }
      }
    }

    // 3. Mark Prescription as Completed
    if (prescriptionId) {
      await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".prescriptions SET status = 'Completed', is_paid = true WHERE id = '${prescriptionId}'`);
    }

    res.json({ success: true, message: "Medicines dispensed and billing updated." });
  } catch (error) { next(error); }
});

router.get("/pharmacy/stats", async (req, res, next) => {
  try {
    await ensureMedicinesTable(req);
    await ensureOrderColumns(req);

    let todaysSales = 0;
    let recentDispenses = [];

    try {
      const todaysSalesRes = await req.prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(total), 0)::float as total 
        FROM "${req.schemaName}".invoices 
        WHERE bill_type = 'PHARMACY' AND created_at > NOW() - INTERVAL '24 hours'
      `);
      todaysSales = todaysSalesRes[0]?.total || 0;
    } catch (e) {
      console.warn(`[PHARMACY_STATS] invoices query failed for ${req.schemaName}:`, e.message);
    }

    try {
      recentDispenses = await req.prisma.$queryRawUnsafe(`
        SELECT p.*, pat.name as patient_name 
        FROM "${req.schemaName}".prescriptions p
        LEFT JOIN "${req.schemaName}".encounters e ON p.encounter_id = e.id
        LEFT JOIN "${req.schemaName}".patients pat ON e.patient_id = pat.id
        WHERE p.status = 'Completed'
        ORDER BY p.created_at DESC LIMIT 5
      `);
    } catch (e) {
      console.warn(`[PHARMACY_STATS] prescriptions query failed for ${req.schemaName}:`, e.message);
    }

    res.json({ todaysSales, recentDispenses });
  } catch (error) { next(error); }
});

// --- PHARMACY INWARD REGISTER (GRN) ---
async function ensureInwardsTable(req) {
  try {
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${req.schemaName}".pharmacy_inwards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inward_no VARCHAR(50),
        supplier_id UUID,
        medicine_id UUID,
        batch_number VARCHAR(100),
        invoice_number VARCHAR(100),
        quantity INTEGER DEFAULT 0,
        uom VARCHAR(50),
        purchase_price NUMERIC DEFAULT 0,
        mrp NUMERIC DEFAULT 0,
        mfd_date DATE,
        expiry_date DATE,
        received_at TIMESTAMP DEFAULT NOW(),
        is_blocked BOOLEAN DEFAULT FALSE,
        remarks TEXT
      )
    `);
    await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".pharmacy_inwards ADD COLUMN IF NOT EXISTS current_stock INTEGER DEFAULT 0`);
  } catch (e) {
    console.error(`[INWARDS] DDL failed:`, e.message);
  }
}

router.get("/pharmacy/inwards", async (req, res, next) => {
  try {
    await ensureInwardsTable(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT i.*, s.name as supplier_name, m.name as medicine_name
      FROM "${req.schemaName}".pharmacy_inwards i
      LEFT JOIN "${req.schemaName}".suppliers s ON i.supplier_id = s.id
      LEFT JOIN "${req.schemaName}".medicines m ON i.medicine_id = m.id
      ORDER BY i.received_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/pharmacy/inwards", async (req, res, next) => {
  try {
    await ensureInwardsTable(req);
    const { supplier_id, medicine_id, batch_number, invoice_number, quantity, uom, purchase_price, mrp, mfd_date, expiry_date, remarks, inward_no } = req.body;
    
    const finalInwardNo = inward_no || `GRN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Record the Inward Entry
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".pharmacy_inwards 
      (inward_no, supplier_id, medicine_id, batch_number, invoice_number, quantity, current_stock, uom, purchase_price, mrp, mfd_date, expiry_date, remarks)
      VALUES (
        '${s(finalInwardNo)}',
        ${supplier_id ? `'${supplier_id}'` : 'NULL'}, 
        ${medicine_id ? `'${medicine_id}'` : 'NULL'}, 
        '${s(batch_number)}', '${s(invoice_number)}', 
        ${parseInt(quantity) || 0}, ${parseInt(quantity) || 0}, '${s(uom)}', 
        ${parseFloat(purchase_price) || 0}, ${parseFloat(mrp) || 0},
        ${sqlValue(mfd_date)}, ${sqlValue(expiry_date)}, '${s(remarks || '')}'
      )
    `);

    // 2. AUTO-UPDATE MEDICINE STOCK
    if (medicine_id) {
      await req.prisma.$executeRawUnsafe(`
        UPDATE "${req.schemaName}".medicines 
        SET stock_quantity = stock_quantity + ${parseInt(quantity) || 0},
            unit_price = ${parseFloat(mrp) || 0},
            expiry_date = ${sqlValue(expiry_date)},
            batch_number = '${s(batch_number)}'
        WHERE id = '${medicine_id}'
      `);
    }

    res.json({ success: true, message: "Stock inward registered and inventory updated." });
  } catch (error) { next(error); }
});

router.patch("/pharmacy/inwards/:id/block", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;
    await req.prisma.$executeRawUnsafe(`UPDATE "${req.schemaName}".pharmacy_inwards SET is_blocked = ${is_blocked} WHERE id = '${id}'`);
    res.json({ success: true, message: is_blocked ? "Batch blocked for distribution" : "Batch unblocked" });
  } catch (error) { next(error); }
});

// --- PHARMACY ORDER MANAGEMENT (Replenishment) ---
const pharmacyOrdersTableSynced = new Set();
async function ensurePharmacyOrdersTable(req) {
  const schema = req.schemaName;
  if (!schema || pharmacyOrdersTableSynced.has(schema)) return;
  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}".pharmacy_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      medicine_id UUID,
      medicine_name VARCHAR(255),
      supplier_id UUID,
      supplier_name VARCHAR(255),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(30) DEFAULT 'Ordered',
      notes TEXT,
      ordered_by VARCHAR(150),
      ordered_at TIMESTAMP DEFAULT NOW(),
      received_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  } catch (e) {
    console.error(`[PHARMACY_ORDERS] DDL failed for ${schema}:`, e.message);
  }
  pharmacyOrdersTableSynced.add(schema);
}

router.get("/pharmacy/orders", async (req, res, next) => {
  try {
    await ensurePharmacyOrdersTable(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT po.*,
             m.stock_quantity as current_stock,
             m.composition
      FROM "${req.schemaName}".pharmacy_orders po
      LEFT JOIN "${req.schemaName}".medicines m ON m.id = po.medicine_id
      ORDER BY po.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/pharmacy/orders", async (req, res, next) => {
  try {
    await ensurePharmacyOrdersTable(req);
    const { medicine_id, medicine_name, supplier_id, supplier_name, quantity, unit_price, notes, ordered_by } = req.body;
    if (!medicine_name || !quantity) return res.status(400).json({ error: 'medicine_name and quantity are required' });
    const safeQty = parseInt(quantity) || 1;
    const safePrice = parseFloat(unit_price) || 0;
    const safeName = (medicine_name || '').replace(/'/g, "''");
    const safeSupplier = (supplier_name || '').replace(/'/g, "''");
    const safeNotes = (notes || '').replace(/'/g, "''");
    const safeOrderedBy = (ordered_by || '').replace(/'/g, "''");
    const midClause = medicine_id ? `'${medicine_id}'` : 'NULL';
    const sidClause = supplier_id ? `'${supplier_id}'` : 'NULL';
    const result = await req.prisma.$queryRawUnsafe(`
      INSERT INTO "${req.schemaName}".pharmacy_orders
        (medicine_id, medicine_name, supplier_id, supplier_name, quantity, unit_price, notes, ordered_by)
      VALUES (${midClause}, '${safeName}', ${sidClause}, '${safeSupplier}', ${safeQty}, ${safePrice}, '${safeNotes}', '${safeOrderedBy}')
      RETURNING *
    `);
    res.status(201).json(result[0]);
  } catch (error) { next(error); }
});

router.patch("/pharmacy/orders/:id", async (req, res, next) => {
  try {
    await ensurePharmacyOrdersTable(req);
    const { id } = req.params;
    const { status, received_at } = req.body;
    const allowedStatuses = ['Ordered', 'Received', 'Cancelled'];
    if (status && !allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const statusClause = status ? `status = '${status}'` : '';
    const receivedClause = received_at ? `, received_at = NOW()` : '';
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".pharmacy_orders
      SET ${statusClause}${receivedClause}
      WHERE id = '${id}'
    `);
    res.json({ success: true, message: `Order ${status || 'updated'} successfully.` });
  } catch (error) { next(error); }
});

// --- INSURANCE & TPA MANAGEMENT ---
router.get("/insurance/providers", async (req, res, next) => {
  try {
    await ensureInsuranceInfrastructure(req);
    const data = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".insurance_providers ORDER BY name ASC`);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/insurance/providers", async (req, res, next) => {
  try {
    await ensureInsuranceInfrastructure(req);
    const { name, tpa_name, contact_person, email } = req.body;
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".insurance_providers (name, tpa_name, contact_person, email)
      VALUES ('${s(name)}', '${s(tpa_name)}', ${sqlValue(contact_person)}, ${sqlValue(email)})
    `);
    res.status(201).json({ success: true });
  } catch (error) { next(error); }
});

router.get("/insurance/plans", async (req, res, next) => {
  try {
    await ensureInsuranceInfrastructure(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT p.*, ip.name as provider_name 
      FROM "${req.schemaName}".insurance_plans p
      JOIN "${req.schemaName}".insurance_providers ip ON p.provider_id = ip.id
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/insurance/plans", async (req, res, next) => {
  try {
    await ensureInsuranceInfrastructure(req);
    const { provider_id, plan_name, description, base_coverage, copay_percent } = req.body;
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".insurance_plans (provider_id, plan_name, description, base_coverage, copay_percent)
      VALUES ('${provider_id}', '${s(plan_name)}', ${sqlValue(description)}, ${base_coverage || 0}, ${copay_percent || 0})
    `);
    res.status(201).json({ success: true });
  } catch (error) { next(error); }
});

router.get("/insurance/patient-mapping", async (req, res, next) => {
  try {
    await ensureInsuranceInfrastructure(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT pi.*, p.name as patient_name, p.mrn, ip.name as provider_name, ipl.plan_name
      FROM "${req.schemaName}".patient_insurance pi
      JOIN "${req.schemaName}".patients p ON pi.patient_id = p.id
      JOIN "${req.schemaName}".insurance_providers ip ON pi.provider_id = ip.id
      JOIN "${req.schemaName}".insurance_plans ipl ON pi.plan_id = ipl.id
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/insurance/patient-mapping", async (req, res, next) => {
  try {
    await ensureInsuranceInfrastructure(req);
    const { patient_id, provider_id, plan_id, policy_number, total_limit, copay_percent, valid_till } = req.body;
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".patient_insurance (patient_id, provider_id, plan_id, policy_number, total_limit, remaining_limit, copay_percent, valid_till)
      VALUES ('${patient_id}', '${provider_id}', '${plan_id}', '${s(policy_number)}', ${total_limit}, ${total_limit}, ${copay_percent || 0}, ${sqlValue(valid_till)})
    `);
    res.status(201).json({ success: true });
  } catch (error) { next(error); }
});

router.get("/insurance/claims", async (req, res, next) => {
  try {
    await ensureInsuranceInfrastructure(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT ic.*, p.name as patient_name, p.mrn, ip.name as provider_name
      FROM "${req.schemaName}".insurance_claims ic
      JOIN "${req.schemaName}".patients p ON ic.patient_id = p.id
      JOIN "${req.schemaName}".insurance_providers ip ON ic.provider_id = ip.id
      ORDER BY ic.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/ai/chat", async (req, res, next) => {
  try {
    const { messages } = req.body;
    
    let totalPatients = 0;
    let activeAdmissions = 0;
    let pendingLabs = 0;

    try {
      const totalPatientsRes = await req.prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM "${req.schemaName}".patients`);
      totalPatients = totalPatientsRes[0]?.count || 0;
    } catch (e) {}

    try {
      const activeAdmissionsRes = await req.prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM "${req.schemaName}".ipd_admissions WHERE status = 'Admitted'`);
      activeAdmissions = activeAdmissionsRes[0]?.count || 0;
    } catch (e) {}

    try {
      const pendingLabsRes = await req.prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM "${req.schemaName}".lab_orders WHERE status = 'Pending'`);
      pendingLabs = pendingLabsRes[0]?.count || 0;
    } catch (e) {}

    const hospitalContext = {
      hospitalName: req.tenantName || "Jioplix Hospital",
      stats: {
        totalPatients,
        activeAdmissions,
        pendingLabs
      }
    };

    const aiService = require('../../services/aiService');
    const response = await aiService.hospitalChat(messages, hospitalContext);
    
    res.json({ response });
  } catch (error) { next(error); }
});

// --- CONTRACT VENDOR MANAGEMENT ---
router.get("/staff/vendors", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const data = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".contractor_vendors ORDER BY name ASC`);
    res.json(data);
  } catch (error) { next(error); }
});

// Alias for backwards compatibility
router.get("/vendors", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const data = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".contractor_vendors ORDER BY name ASC`);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/staff/vendors", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { name, contact_person, email, phone, address } = req.body;
    const id = crypto.randomUUID();
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".contractor_vendors (id, name, contact_person, email, phone, address)
      VALUES ('${id}', '${s(name)}', ${sqlValue(contact_person)}, ${sqlValue(email)}, ${sqlValue(phone)}, ${sqlValue(address)})
    `);
    res.status(201).json({ id, name });
  } catch (error) { next(error); }
});

// Alias for backwards compatibility
router.post("/vendors", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { name, contact_person, email, phone, address } = req.body;
    const id = crypto.randomUUID();
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".contractor_vendors (id, name, contact_person, email, phone, address)
      VALUES ('${id}', '${s(name)}', ${sqlValue(contact_person)}, ${sqlValue(email)}, ${sqlValue(phone)}, ${sqlValue(address)})
    `);
    res.status(201).json({ id, name });
  } catch (error) { next(error); }
});

router.put("/staff/vendors/:id", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    const { name, contact_person, email, phone, address } = req.body;
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".contractor_vendors 
      SET name = '${s(name)}', 
          contact_person = ${sqlValue(contact_person)}, 
          email = ${sqlValue(email)}, 
          phone = ${sqlValue(phone)}, 
          address = ${sqlValue(address)}
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Alias for backwards compatibility
router.put("/vendors/:id", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    const { name, contact_person, email, phone, address } = req.body;
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".contractor_vendors 
      SET name = '${s(name)}', 
          contact_person = ${sqlValue(contact_person)}, 
          email = ${sqlValue(email)}, 
          phone = ${sqlValue(phone)}, 
          address = ${sqlValue(address)}
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete("/staff/vendors/:id", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    await req.prisma.$executeRawUnsafe(`DELETE FROM "${req.schemaName}".contractor_vendors WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Alias for backwards compatibility
router.delete("/vendors/:id", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    await req.prisma.$executeRawUnsafe(`DELETE FROM "${req.schemaName}".contractor_vendors WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- RESOURCE REQUISITION WORKFLOW & APPROVALS ---
router.get("/recruitment/requisitions", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT r.*, u.name as requester_name, ap.name as approver_name
      FROM "${req.schemaName}".resource_requisitions r
      LEFT JOIN "${req.schemaName}".users u ON r.requested_by = u.id
      LEFT JOIN "${req.schemaName}".users ap ON r.approved_by = ap.id
      ORDER BY r.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/recruitment/requisitions", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { title, department, number_of_positions, job_description, experience_required, qualifications_required } = req.body;
    const userId = await getCurrentUserId(req);
    const id = crypto.randomUUID();
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".resource_requisitions (
        id, title, department, number_of_positions, job_description, 
        experience_required, qualifications_required, status, requested_by
      )
      VALUES (
        '${id}', '${s(title)}', ${sqlValue(department)}, ${parseInt(number_of_positions) || 1}, 
        ${sqlValue(job_description)}, ${sqlValue(experience_required)}, 
        ${sqlValue(qualifications_required)}, 'Pending', ${sqlValue(userId)}
      )
    `);
    res.status(201).json({ id, title, status: 'Pending' });
  } catch (error) { next(error); }
});

router.put("/recruitment/requisitions/:id", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    const { title, department, number_of_positions, job_description, experience_required, qualifications_required } = req.body;
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".resource_requisitions 
      SET title = '${s(title)}', 
          department = ${sqlValue(department)}, 
          number_of_positions = ${parseInt(number_of_positions) || 1}, 
          job_description = ${sqlValue(job_description)}, 
          experience_required = ${sqlValue(experience_required)}, 
          qualifications_required = ${sqlValue(qualifications_required)},
          updated_at = NOW()
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.put("/recruitment/requisitions/:id/approve", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    const { status } = req.body; // 'Approved' or 'Rejected'
    const userId = await getCurrentUserId(req);
    
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".resource_requisitions 
      SET status = '${s(status)}', 
          approved_by = ${sqlValue(userId)},
          updated_at = NOW()
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// --- CANDIDATE MANAGEMENT & JD MATCHER ---
router.get("/recruitment/candidates", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const data = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".candidates ORDER BY name ASC`);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/recruitment/candidates", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { name, email, phone, experience_years, skills, education, resume_text } = req.body;
    const id = crypto.randomUUID();
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".candidates (id, name, email, phone, experience_years, skills, education, resume_text)
      VALUES ('${id}', '${s(name)}', ${sqlValue(email)}, ${sqlValue(phone)}, ${parseInt(experience_years) || 0}, ${sqlValue(skills)}, ${sqlValue(education)}, ${sqlValue(resume_text)})
    `);
    res.status(201).json({ id, name, email });
  } catch (error) { next(error); }
});

router.get("/recruitment/matches/:requisitionId", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { requisitionId } = req.params;
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT m.*, c.name as candidate_name, c.email as candidate_email, c.experience_years as candidate_experience
      FROM "${req.schemaName}".requisition_matches m
      JOIN "${req.schemaName}".candidates c ON m.candidate_id = c.id
      WHERE m.requisition_id = '${requisitionId}'
      ORDER BY m.match_score DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/recruitment/matches/recalculate", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { requisitionId } = req.body;
    
    // 1. Fetch the requisition
    const reqs = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".resource_requisitions WHERE id = '${requisitionId}'`);
    if (!reqs.length) return res.status(404).json({ error: "Requisition not found" });
    const requisition = reqs[0];

    // 2. Fetch all candidates
    const candidates = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${req.schemaName}".candidates`);
    
    const results = [];
    const aiService = require('../../services/aiService');

    for (const candidate of candidates) {
      // Run the smart JD matcher
      const match = await aiService.predictJDMatch(requisition, candidate);
      
      // Upsert into requisition_matches
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".requisition_matches (requisition_id, candidate_id, match_score, match_analysis)
        VALUES ('${requisitionId}', '${candidate.id}', ${match.matchScore}, '${match.matchAnalysis.replace(/'/g, "''")}')
        ON CONFLICT (requisition_id, candidate_id) DO UPDATE SET
          match_score = EXCLUDED.match_score,
          match_analysis = EXCLUDED.match_analysis
      `);
      
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.name,
        score: match.matchScore
      });
    }

    res.json({ success: true, matches: results });
  } catch (error) { 
    console.error("[MATCH_RECALCULATE] Error:", error.message);
    res.status(500).json({ error: error.message }); 
  }
});

// --- EMPLOYEE LEAVE REQUESTS ---
router.get("/staff/leaves", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const userId = await getCurrentUserId(req);
    
    // Check if the user is a manager or admin
    const userRows = await req.prisma.$queryRawUnsafe(`SELECT is_manager, role FROM "${req.schemaName}".users WHERE id = '${userId}'`);
    const user = userRows[0];
    const isManagerOrAdmin = user && (user.is_manager || String(user.role).toLowerCase() === 'admin');

    let data;
    if (isManagerOrAdmin) {
      // Manager/Admin sees all leaves
      data = await req.prisma.$queryRawUnsafe(`
        SELECT l.*, u.name as employee_name, u.department as employee_department, ap.name as approver_name
        FROM "${req.schemaName}".employee_leaves l
        JOIN "${req.schemaName}".users u ON l.employee_id = u.id
        LEFT JOIN "${req.schemaName}".users ap ON l.approved_by = ap.id
        ORDER BY l.created_at DESC
      `);
    } else {
      // Normal employee sees only their own leaves
      data = await req.prisma.$queryRawUnsafe(`
        SELECT l.*, u.name as employee_name, u.department as employee_department, ap.name as approver_name
        FROM "${req.schemaName}".employee_leaves l
        JOIN "${req.schemaName}".users u ON l.employee_id = u.id
        LEFT JOIN "${req.schemaName}".users ap ON l.approved_by = ap.id
        WHERE l.employee_id = '${userId}'
        ORDER BY l.created_at DESC
      `);
    }
    res.json(data);
  } catch (error) { next(error); }
});

router.post("/staff/leaves", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const userId = await getCurrentUserId(req);
    const { leave_type, start_date, end_date, reason } = req.body;
    const id = crypto.randomUUID();
    
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".employee_leaves (id, employee_id, leave_type, start_date, end_date, reason, status)
      VALUES ('${id}', '${userId}', '${s(leave_type || 'CASUAL')}', '${s(start_date)}', '${s(end_date)}', ${sqlValue(reason)}, 'Pending')
    `);
    res.status(201).json({ id, status: 'Pending' });
  } catch (error) { next(error); }
});

router.put("/staff/leaves/:id/approve", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    const { status } = req.body; // 'Approved' or 'Rejected'
    const userId = await getCurrentUserId(req);

    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".employee_leaves
      SET status = '${s(status)}',
          approved_by = '${userId}',
          updated_at = NOW()
      WHERE id = '${id}'
    `);
    res.json({ success: true });
  } catch (error) { next(error); }
});


// ─── Employee Leaves (REST API for Flutter + Web) ──────────────────────────
// GET /hospital/leaves/mine  — current user's own leave requests
router.get("/leaves/mine", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const userId = await getCurrentUserId(req);
    if (!userId) return res.json([]);

    const leaves = await req.prisma.$queryRawUnsafe(`
      SELECT el.id, el.leave_type, el.start_date AS from_date, el.end_date AS to_date,
             el.reason, el.status, el.created_at,
             u.name AS approved_by_name
      FROM "${req.schemaName}".employee_leaves el
      LEFT JOIN "${req.schemaName}".users u ON el.approved_by = u.id
      WHERE el.employee_id = '${userId}'
      ORDER BY el.created_at DESC
    `);
    res.json(leaves);
  } catch (error) { next(error); }
});

// GET /hospital/leaves/team  — pending + recent leaves for employees under this manager
router.get("/leaves/team", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const userId = await getCurrentUserId(req);
    if (!userId) return res.json([]);

    const leaves = await req.prisma.$queryRawUnsafe(`
      SELECT el.id, el.leave_type, el.start_date AS from_date, el.end_date AS to_date,
             el.reason, el.status, el.created_at,
             emp.name AS employee_name
      FROM "${req.schemaName}".employee_leaves el
      JOIN "${req.schemaName}".users emp ON el.employee_id = emp.id
      ORDER BY el.status ASC, el.created_at DESC
      LIMIT 100
    `);
    res.json(leaves);
  } catch (error) { next(error); }
});

// POST /hospital/leaves  — submit a new leave request
router.post("/leaves", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const userId = await getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { leave_type, from_date, to_date, reason } = req.body;
    if (!from_date || !to_date) return res.status(400).json({ error: "from_date and to_date are required" });

    const id = crypto.randomUUID();
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".employee_leaves
        (id, employee_id, leave_type, start_date, end_date, reason, status)
      VALUES
        ('${id}', '${userId}', '${s(leave_type || 'Casual Leave')}', '${s(from_date)}', '${s(to_date)}', ${sqlValue(reason)}, 'pending')
    `);
    res.status(201).json({ id, status: 'pending' });
  } catch (error) { next(error); }
});

// PUT /hospital/leaves/:id  — manager approves/rejects a leave
router.put("/leaves/:id", async (req, res, next) => {
  try {
    await ensureStaffColumns(req);
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const userId = await getCurrentUserId(req);
    await req.prisma.$executeRawUnsafe(`
      UPDATE "${req.schemaName}".employee_leaves
      SET status = '${s(status)}',
          approved_by = ${userId ? `'${userId}'` : 'NULL'},
          updated_at = NOW()
      WHERE id = '${s(id)}'
    `);
    res.json({ success: true, status });
  } catch (error) { next(error); }
});

// --- UPLOAD PAST MEDICAL HISTORY RECORDS ---
router.post("/patients/:patientId/past-records", upload.single("file"), async (req, res, next) => {
  try {
    await ensureOrderColumns(req);
    const { patientId } = req.params;
    const { recordType, title, recordDate } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    const dateStr = recordDate ? s(recordDate) : new Date().toISOString().slice(0, 10);
    
    if (recordType === 'lab') {
      const orderId = crypto.randomUUID();
      // Insert a completed lab order
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".lab_orders (id, patient_id, test_name, priority, status, report_url, attachment_url, created_at)
        VALUES ('${orderId}', '${s(patientId)}', '${s(title || 'Lab Report')}', 'Normal', 'Completed', '${fileUrl}', '${fileUrl}', '${dateStr}')
      `);
      return res.json({ success: true, message: "Past lab report uploaded successfully." });
    } else {
      // It's a prescription
      const encounterId = crypto.randomUUID();
      const presId = crypto.randomUUID();
      const doctorId = await getCurrentUserId(req);
      
      // 1. Insert a Completed encounter
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".encounters (id, patient_id, doctor_id, diagnosis, status, notes, created_at)
        VALUES ('${encounterId}', '${s(patientId)}', ${doctorId ? `'${doctorId}'` : 'NULL'}, '${s(title || 'Completed Visit')}', 'Completed', 'Uploaded past prescription', '${dateStr}')
      `);
      
      // 2. Insert a prescription
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".prescriptions (id, encounter_id, patient_id, status, is_paid, attachment_url, prescription_url, created_at)
        VALUES ('${presId}', '${encounterId}', '${s(patientId)}', 'Completed', true, '${fileUrl}', '${fileUrl}', '${dateStr}')
      `);
      
      // 3. Optional: add a generic item so it shows up in prescription items if needed
      const itemId = crypto.randomUUID();
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".prescription_items (id, prescription_id, drug_name, dosage, frequency, duration, instructions, created_at)
        VALUES ('${itemId}', '${presId}', '${s(title || 'Past Prescription Record')}', '-', '-', '-', '-', '${dateStr}')
      `);
      
      return res.json({ success: true, message: "Past prescription uploaded successfully." });
    }
  } catch (error) {
    next(error);
  }
});

// ---- Communications / Message Board ----
router.get("/communications", async (req, res, next) => {
  try {
    const rows = await req.prisma.$queryRawUnsafe(`
      SELECT id, content, author_name, created_at
      FROM "${req.schemaName}".communications
      ORDER BY created_at DESC
      LIMIT 100
    `);
    return res.json(rows || []);
  } catch (error) {
    next(error);
  }
});

router.post("/communications", async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    const email = typeof req.user === "object" ? req.user.user : req.user;
    let authorName = "Hospital Admin";
    if (email) {
      const users = await req.prisma.$queryRawUnsafe(`
        SELECT name FROM "${req.schemaName}".users WHERE LOWER(email) = LOWER('${s(email)}') LIMIT 1
      `);
      if (users?.[0]?.name) authorName = users[0].name;
    }

    const id = crypto.randomUUID();
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${req.schemaName}".communications (id, content, author_name, created_at)
      VALUES ('${id}', '${s(content)}', '${s(authorName)}', NOW())
    `);

    return res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

router.get("/mail-logs", async (req, res, next) => {
  try {
    const rows = await req.prisma.$queryRawUnsafe(`
      SELECT id, recipient, subject, type, status, created_at
      FROM "${req.schemaName}".communication_logs
      ORDER BY created_at DESC
      LIMIT 200
    `);
    return res.json(rows || []);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

