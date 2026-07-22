const express = require("express");
const router = express.Router();
const upload = require("../../config/upload");
const aiService = require("../../services/aiService");
const { si } = require('../../middleware/sanitize');

const patientColumnsSynced = new Set();

async function ensurePatientColumns(req) {
  const schema = req.schemaName;
  if (!schema) return;
  if (patientColumnsSynced.has(schema)) return;

  const columns = [
    'mrn VARCHAR(20)',
    'email VARCHAR(255)',
    'gender VARCHAR(20)',
    'age INTEGER DEFAULT 0',
    'dob DATE',
    'blood_group VARCHAR(10)',
    'occupation VARCHAR(100)',
    'address TEXT',
    'guardian_name VARCHAR(255)',
    'guardian_phone VARCHAR(50)',
    'medical_history TEXT',
    'allergies TEXT',
    'ai_summary TEXT',
    'abha_id VARCHAR(50)',
    'abha_number VARCHAR(50)',
    'abha_status VARCHAR(20)',
    'abha_verified BOOLEAN DEFAULT FALSE',
    'abha_linked_at TIMESTAMP',
    'created_at TIMESTAMP DEFAULT NOW()'
  ];
  
  const abhaAuditLogs = [
    'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    'patient_id VARCHAR(100)',
    'api_name VARCHAR(100)',
    'txn_id VARCHAR(100)',
    'status VARCHAR(20)',
    'error_message TEXT',
    'request_payload JSONB',
    'response_payload JSONB',
    'created_at TIMESTAMP DEFAULT NOW()'
  ];

  for (const col of columns) {
    try {
      await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".patients ADD COLUMN IF NOT EXISTS ${col}`);
    } catch (e) {}
  }

  // Ensure encounters table has ABHA columns
  const encounterCols = [
    'abha_linked BOOLEAN DEFAULT FALSE',
    'abha_care_context VARCHAR(100)'
  ];
  for (const col of encounterCols) {
    try {
      await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".encounters ADD COLUMN IF NOT EXISTS ${col}`);
    } catch (e) {}
  }

  // Ensure Audit Log Table exists
  try {
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${req.schemaName}".abha_audit_logs (
        ${abhaAuditLogs.join(', ')}
      )
    `);
  } catch (e) {
    console.error(`[PATIENT_HEAL] ABHA Audit Table failed: ${e.message}`);
  }
  patientColumnsSynced.add(schema);
}

router.get("/", async (req, res, next) => {
  try {
    await ensurePatientColumns(req);
    const search = req.query.search || '';
    const detailed = req.query.detailed === 'true';
    
    const schema = si(req.schemaName);
    let patients;
    if (detailed) {
      // SECURITY: search term from query param — use ILIKE with $1 positional param
      const searchParam = `%${search}%`;
      if (search) {
        patients = await req.prisma.$queryRawUnsafe(
          `SELECT p.*,
            COALESCE(
              (SELECT u.name FROM "${schema}".encounters e JOIN "${schema}".users u ON e.doctor_id = u.id WHERE e.patient_id = p.id GROUP BY u.name, e.doctor_id ORDER BY COUNT(e.id) DESC, MAX(e.created_at) DESC LIMIT 1),
              (SELECT u.name FROM "${schema}".appointments a JOIN "${schema}".users u ON a.doctor_id = u.id WHERE a.patient_id = p.id GROUP BY u.name, a.doctor_id ORDER BY COUNT(a.id) DESC, MAX(a.appointment_time) DESC LIMIT 1)
            ) as primary_doctor,
            COALESCE(
              (SELECT MAX(e.created_at) FROM "${schema}".encounters e WHERE e.patient_id = p.id),
              (SELECT MAX(a.appointment_time) FROM "${schema}".appointments a WHERE a.patient_id = p.id AND a.status = 'Completed')
            ) as last_visit_date
           FROM "${schema}".patients p
           WHERE p.name ILIKE $1 OR p.phone ILIKE $1 OR p.mrn ILIKE $1
           ORDER BY p.name ASC`,
          searchParam
        );
      } else {
        patients = await req.prisma.$queryRawUnsafe(
          `SELECT p.*,
            COALESCE(
              (SELECT u.name FROM "${schema}".encounters e JOIN "${schema}".users u ON e.doctor_id = u.id WHERE e.patient_id = p.id GROUP BY u.name, e.doctor_id ORDER BY COUNT(e.id) DESC, MAX(e.created_at) DESC LIMIT 1),
              (SELECT u.name FROM "${schema}".appointments a JOIN "${schema}".users u ON a.doctor_id = u.id WHERE a.patient_id = p.id GROUP BY u.name, a.doctor_id ORDER BY COUNT(a.id) DESC, MAX(a.appointment_time) DESC LIMIT 1)
            ) as primary_doctor,
            COALESCE(
              (SELECT MAX(e.created_at) FROM "${schema}".encounters e WHERE e.patient_id = p.id),
              (SELECT MAX(a.appointment_time) FROM "${schema}".appointments a WHERE a.patient_id = p.id AND a.status = 'Completed')
            ) as last_visit_date
           FROM "${schema}".patients p ORDER BY p.name ASC`
        );
      }
    } else {
      if (search) {
        const searchParam = `%${search}%`;
        patients = await req.prisma.$queryRawUnsafe(
          `SELECT * FROM "${schema}".patients WHERE name ILIKE $1 OR phone ILIKE $1 OR mrn ILIKE $1 ORDER BY name ASC`,
          searchParam
        );
      } else {
        patients = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${schema}".patients ORDER BY name ASC`);
      }
    }
    res.json(patients);
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    await ensurePatientColumns(req);
    const schema = si(req.schemaName);
    // SECURITY: patient id from URL param — positional param
    const patients = await req.prisma.$queryRawUnsafe(
      `SELECT * FROM "${schema}".patients WHERE id = $1::uuid`,
      String(req.params.id)
    );
    res.json(patients[0] || null);
  } catch (error) { next(error); }
});

router.get("/:id/timeline", async (req, res, next) => {
  const patientId = req.params.id;
  try {
    let encounters = [];
    const schema = si(req.schemaName);
    try {
      // SECURITY: patientId from URL param — positional param
      encounters = await req.prisma.$queryRawUnsafe(
        `SELECT e.*, u.name as doctor_name FROM "${schema}".encounters e LEFT JOIN "${schema}".users u ON e.doctor_id = u.id WHERE e.patient_id = $1::uuid ORDER BY e.created_at DESC`,
        String(patientId)
      );
    } catch (e) { console.warn("Timeline encounters query failed:", e.message); }

    let labOrders = [];
    try {
      labOrders = await req.prisma.$queryRawUnsafe(
        `SELECT l.*, u.name as doctor_name FROM "${schema}".lab_orders l LEFT JOIN "${schema}".users u ON l.doctor_id = u.id WHERE l.patient_id = $1::uuid ORDER BY l.created_at DESC`,
        String(patientId)
      );
    } catch (e) { console.warn("Timeline lab_orders query failed:", e.message); }

    let admissions = [];
    try {
      admissions = await req.prisma.$queryRawUnsafe(
        `SELECT a.*, u.name as doctor_name, w.name as ward_name, b.bed_number FROM "${schema}".ipd_admissions a LEFT JOIN "${schema}".users u ON a.admitting_doctor_id = u.id LEFT JOIN "${schema}".wards w ON a.ward_id = w.id LEFT JOIN "${schema}".beds b ON a.bed_id = b.id WHERE a.patient_id = $1::uuid ORDER BY a.admitted_at DESC`,
        String(patientId)
      );
    } catch (e) { console.warn("Timeline ipd_admissions query failed:", e.message); }

    const timeline = [];

    encounters.forEach(e => {
      timeline.push({
        id: e.id,
        type: 'OPD Consultation',
        date: e.created_at,
        author: e.doctor_name || 'Dr. Practitioner',
        note: e.notes || `OPD consultation recorded. Diagnosis: ${e.diagnosis || 'None specified'}.`,
        details: {
          diagnosis: e.diagnosis,
          vitals: e.vitals,
          notes: e.notes,
          status: e.status
        }
      });
    });

    labOrders.forEach(l => {
      let resultsSummary = '';
      if (l.results) {
        try {
          const resObj = typeof l.results === 'string' ? JSON.parse(l.results) : l.results;
          if (Array.isArray(resObj)) {
            resultsSummary = resObj.map(r => `${r.name || r.parameter}: ${r.value} ${r.unit || ''} (${r.status || 'Normal'})`).join(', ');
          } else if (typeof resObj === 'object') {
            resultsSummary = Object.entries(resObj).map(([k, v]) => `${k}: ${v}`).join(', ');
          }
        } catch (_) {}
      }
      timeline.push({
        id: l.id,
        type: 'Lab Report',
        date: l.created_at,
        author: l.doctor_name || 'Diagnostic Lab',
        note: `Ordered Test: ${l.test_name}. Status: ${l.status || 'Pending'}. priority: ${l.priority}.` + 
              (resultsSummary ? ` Results: ${resultsSummary}` : '') + 
              (l.technician_notes ? ` Notes: ${l.technician_notes}` : ''),
        details: {
          testName: l.test_name,
          priority: l.priority,
          status: l.status,
          results: l.results,
          technicianNotes: l.technician_notes
        }
      });
    });

    admissions.forEach(a => {
      const location = [a.ward_name, a.bed_number].filter(Boolean).join(' - ');
      timeline.push({
        id: a.id,
        type: 'Admission',
        date: a.admitted_at,
        author: a.doctor_name || 'Admitting Office',
        note: `Admitted to ${location || 'Ward'}. Reason: ${a.admission_reason || 'Not specified'}. Status: ${a.status}.` +
              (a.discharged_at ? ` Discharged at: ${new Date(a.discharged_at).toLocaleDateString()}` : ''),
        details: {
          wardName: a.ward_name,
          bedNumber: a.bed_number,
          reason: a.admission_reason,
          status: a.status,
          admittedAt: a.admitted_at,
          dischargedAt: a.discharged_at
        }
      });
    });

    // Sort descending by date
    timeline.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    res.json(timeline);
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.array('history_files', 5), async (req, res, next) => {
  console.log(`[PATIENT] Incoming registration request for schema: ${req.schemaName}`);
  try {
    await ensurePatientColumns(req);

    const { 
      name, phone, email, gender, age, dob, 
      blood_group, occupation, address, 
      guardian_name, guardian_phone, 
      medical_history, allergies, 
      abhaId, abhaNumber, abhaStatus, abhaVerified
    } = req.body;
    
    // Healthcare Standard MRN Generation: MRN-[YYMM]-[6-Digit Sequence]
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    
    const sequence = String(Date.now()).slice(-6);
    
    const mrn = `MRN-${yy}${mm}-${sequence}`;
    
    const schema = si(req.schemaName);
    // SQL Sanitization: use positional params for all user values
    let aiSummary = '';
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(f => f.path);
      aiSummary = await aiService.generatePatientHistorySummary(filePaths);
    }

    // SECURITY: All patient field values are passed as positional parameters
    const result = await req.prisma.$queryRawUnsafe(
      `INSERT INTO "${schema}".patients
        (mrn, name, phone, email, gender, age, dob,
         blood_group, occupation, address,
         guardian_name, guardian_phone,
         medical_history, allergies, ai_summary,
         abha_id, abha_number, abha_status, abha_verified, abha_linked_at)
       VALUES
        ($1,$2,$3,$4,$5,$6,
         ${dob ? `$7::date` : 'NULL'},
         $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
         ${abhaVerified ? 'NOW()' : 'NULL'})
       RETURNING *`,
      mrn,
      String(name || ''),
      String(phone || ''),
      String(email || ''),
      String(gender || ''),
      parseInt(age) || 0,
      dob ? String(dob) : null,
      String(blood_group || ''),
      String(occupation || ''),
      String(address || ''),
      String(guardian_name || ''),
      String(guardian_phone || ''),
      String(medical_history || ''),
      String(allergies || ''),
      String(aiSummary || ''),
      String(abhaId || ''),
      String(abhaNumber || ''),
      String(abhaStatus || ''),
      abhaVerified ? true : false
    );
    res.status(201).json(result[0]);
  } catch (error) { 
    console.error("[PATIENT] Registration failed:", error);
    res.status(500).json({ 
      error: "Registration failed", 
      message: error.message,
      details: error.code === 'P2010' ? "Database schema mismatch (possibly missing ai_summary column)" : error.message
    });
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    await ensurePatientColumns(req);
    const schema = si(req.schemaName);
    const {
      name, phone, email, gender, age, dob,
      blood_group, occupation, address,
      guardian_name, guardian_phone,
      medical_history, allergies,
      abhaId, abhaNumber, abhaStatus, abhaVerified
    } = req.body;

    const abha_id      = abhaId      || req.body.abha_id      || '';
    const abha_number  = abhaNumber  || req.body.abha_number  || '';
    const abha_status  = abhaStatus  || req.body.abha_status  || '';
    const abha_verified = abhaVerified !== undefined ? abhaVerified : (req.body.abha_verified || false);

    // SECURITY: All user values as positional params
    await req.prisma.$executeRawUnsafe(
      `UPDATE "${schema}".patients SET
        name=$1, phone=$2, email=$3, gender=$4, age=$5,
        dob=${dob ? '$6::date' : 'NULL'},
        blood_group=$7, occupation=$8, address=$9,
        guardian_name=$10, guardian_phone=$11,
        medical_history=$12, allergies=$13,
        abha_id=$14, abha_number=$15, abha_status=$16,
        abha_verified=$17,
        abha_linked_at=${abha_verified ? 'NOW()' : 'NULL'}
       WHERE id=$18::uuid`,
      String(name||''), String(phone||''), String(email||''), String(gender||''),
      parseInt(age)||0,
      dob ? String(dob) : null,
      String(blood_group||''), String(occupation||''), String(address||''),
      String(guardian_name||''), String(guardian_phone||''),
      String(medical_history||''), String(allergies||''),
      String(abha_id), String(abha_number), String(abha_status),
      abha_verified ? true : false,
      String(req.params.id)
    );
    res.json({ message: 'Patient updated successfully' });
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const schema = si(req.schemaName);
    // SECURITY: id from URL param — positional param
    await req.prisma.$executeRawUnsafe(
      `DELETE FROM "${schema}".patients WHERE id = $1::uuid`,
      String(req.params.id)
    );
    res.sendStatus(204);
  } catch (error) { next(error); }
});

module.exports = router;
