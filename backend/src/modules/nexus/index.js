const express = require("express");
const { si } = require('../../middleware/sanitize');
const router = express.Router();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const bcrypt = require("bcryptjs");

// Helper to safely split SQL file content into complete statements respecting dollar quotes, single quotes, and comments
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      current += char;
      if (char === '\n' || char === '\r') {
        inLineComment = false;
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        current += '/';
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        current += '--';
        i += 2;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        current += '/*';
        i += 2;
        continue;
      }
    }

    if (char === "'" && !inDollarQuote) {
      if (inSingleQuote && nextChar === "'") {
        current += "''";
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
      continue;
    }

    if (char === '$' && !inSingleQuote) {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        const tag = match[0];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
        current += tag;
        i += tag.length;
        continue;
      }
    }

    if (char === ';' && !inSingleQuote && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
}

// --- DATABASE SELF-HEALING (Ensures Nexus Registry is up to date) ---
async function ensureNexusColumns(prisma) {
  try {
    console.log("[NEXUS] Checking Registry Schema...");
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS shard_id VARCHAR(255)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS ui_settings JSONB DEFAULT '{}'::jsonb`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS sensitive_settings JSONB DEFAULT '{}'::jsonb`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS background_color VARCHAR(50) DEFAULT '#ffffff'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS text_color VARCHAR(50) DEFAULT '#1e293b'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS hero_background_color VARCHAR(50) DEFAULT '#f8fafc'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS overall_text_color VARCHAR(50) DEFAULT '#475569'`);
    
    // Support Ticketing Infrastructure
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS nexus.support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255), -- Use VARCHAR to match either UUID or String IDs from Prisma
        subject VARCHAR(255),
        category VARCHAR(50),
        priority VARCHAR(20) DEFAULT 'Medium',
        status VARCHAR(20) DEFAULT 'Open',
        message TEXT,
        response TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.support_tickets ADD COLUMN IF NOT EXISTS response TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

    // Communication Logs Infrastructure
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS nexus.communication_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255),
        subject VARCHAR(255),
        recipient VARCHAR(255),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM nexus.tenants`);
    console.log(`[NEXUS] Registry contains ${countRes[0].count} tenants.`);

    // Resource Utilization Infrastructure
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS nexus.utilization_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255),
        db_size_mb DECIMAL(10,2),
        total_records INT,
        active_users INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log("[NEXUS] Registry Schema is synchronized.");
  } catch (err) {
    console.warn("[NEXUS] Schema sync warning:", err.message);
  }
}

// --- NEW PROVISIONING: CLINICAL MASTER DATA COPY ---
async function seedTenantMasterData(prisma, schema) {
  try {
    console.log(`[PROVISIONING] Seeding Clinical Masters for ${schema}...`);

    // ── 1. ENSURE SCHEMA STRUCTURE ──────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);
      ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
      ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

      CREATE TABLE IF NOT EXISTS "${schema}".departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        hod VARCHAR(100),
        specialty VARCHAR(100),
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".specialities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        base_consultation_fee NUMERIC DEFAULT 500,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".consultation_modes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        surcharge_percent NUMERIC DEFAULT 0,
        is_virtual BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".diseases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100),
        icd_code VARCHAR(20),
        severity_level VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".treatments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100),
        price NUMERIC DEFAULT 0,
        description TEXT,
        cpt_code VARCHAR(20),
        estimated_duration VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".diagnostics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        price NUMERIC DEFAULT 0,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100),
        service_code VARCHAR(50),
        price NUMERIC DEFAULT 0,
        tax_percent NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".encounters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        doctor_id UUID NOT NULL,
        type VARCHAR(20) DEFAULT 'OPD',
        status VARCHAR(20) DEFAULT 'Active',
        vitals JSONB DEFAULT '{}'::jsonb,
        complaints TEXT,
        diagnosis TEXT,
        notes TEXT,
        token_number SERIAL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".wards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE,
        type VARCHAR(50),
        capacity INTEGER DEFAULT 0,
        base_charge NUMERIC DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS "${schema}".beds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ward_id UUID REFERENCES "${schema}".wards(id),
        bed_number VARCHAR(50),
        status VARCHAR(20) DEFAULT 'Vacant'
      );
    `);

    // ── 2. DEPARTMENTS ───────────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".departments (name, description, status) VALUES
      ('General Medicine',         'Internal medicine & general consultations', 'Active'),
      ('Emergency & Trauma',       'Emergency care and trauma management',      'Active'),
      ('Cardiology',               'Heart and vascular disease management',      'Active'),
      ('Neurology',                'Brain and nervous system disorders',         'Active'),
      ('Orthopedics',              'Bone, joint and musculoskeletal care',       'Active'),
      ('Obstetrics & Gynaecology', 'Women health, maternity and reproduction',  'Active'),
      ('Paediatrics',              'Child health and neonatal care',             'Active'),
      ('Ophthalmology',            'Eye care and vision management',             'Active'),
      ('ENT',                      'Ear, nose and throat care',                  'Active'),
      ('Dermatology',              'Skin, hair and nail disorders',              'Active'),
      ('Pulmonology',              'Respiratory and lung disease management',    'Active'),
      ('Gastroenterology',         'Digestive system disorders',                 'Active'),
      ('Nephrology',               'Kidney disease management',                  'Active'),
      ('Endocrinology',            'Hormonal and metabolic disorders',           'Active'),
      ('Oncology',                 'Cancer diagnosis and treatment',             'Active'),
      ('Urology',                  'Urinary tract and male reproductive health', 'Active'),
      ('Psychiatry',               'Mental health and behavioural disorders',    'Active'),
      ('Radiology & Imaging',      'Diagnostic imaging services',                'Active'),
      ('Pathology & Laboratory',   'Clinical laboratory and diagnostics',        'Active'),
      ('Physiotherapy',            'Physical rehabilitation and therapy',         'Active'),
      ('Dental',                   'Oral health and dental procedures',          'Active'),
      ('Pharmacy',                 'Medication dispensing and management',       'Active'),
      ('Dietetics & Nutrition',    'Clinical nutrition and diet therapy',        'Active'),
      ('Anaesthesiology',          'Perioperative and pain management',          'Active')
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 3. SPECIALITIES ──────────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".specialities (name, description, base_consultation_fee) VALUES
      ('General Physician',         'General medicine consultations',       400),
      ('Cardiologist',              'Heart disease specialist',             800),
      ('Neurologist',               'Brain & nervous system specialist',    900),
      ('Orthopaedic Surgeon',       'Bone & joint specialist',             800),
      ('Gynaecologist',             'Women health specialist',              700),
      ('Paediatrician',             'Child health specialist',              500),
      ('Ophthalmologist',           'Eye specialist',                       600),
      ('ENT Specialist',            'Ear, nose & throat specialist',        600),
      ('Dermatologist',             'Skin disease specialist',              600),
      ('Pulmonologist',             'Lung disease specialist',              700),
      ('Gastroenterologist',        'Digestive system specialist',          800),
      ('Nephrologist',              'Kidney disease specialist',            850),
      ('Endocrinologist',           'Diabetes & hormonal specialist',       750),
      ('Oncologist',                'Cancer specialist',                   1200),
      ('Urologist',                 'Urinary tract specialist',             800),
      ('Psychiatrist',              'Mental health specialist',             900),
      ('Radiologist',               'Diagnostic imaging specialist',        600),
      ('Anaesthesiologist',         'Anaesthesia & pain management',        800),
      ('General Surgeon',           'General surgical procedures',          900),
      ('Physiotherapist',           'Physical rehabilitation specialist',   400),
      ('Dentist',                   'Oral health specialist',               500),
      ('Diabetologist',             'Diabetes management specialist',       650),
      ('Rheumatologist',            'Joint & autoimmune disease specialist',850),
      ('Intensivist (ICU)',          'Critical care specialist',            1000)
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 4. CONSULTATION MODES ────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".consultation_modes (name, surcharge_percent, is_virtual) VALUES
      ('Walk-In OPD',          0,  false),
      ('Scheduled Appointment',0,  false),
      ('Emergency',           50,  false),
      ('Video Consultation',  15,  true),
      ('Phone Consultation',   5,  true),
      ('Home Visit',          30,  false),
      ('Follow-Up',            0,  false),
      ('Second Opinion',      20,  false)
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 5. DISEASES (ICD-10 Common) ──────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".diseases (name, category, icd_code, severity_level) VALUES
      ('Essential (Primary) Hypertension',            'Cardiovascular',    'I10',   'Moderate'),
      ('Type 2 Diabetes Mellitus',                    'Endocrine',         'E11',   'Moderate'),
      ('Acute Myocardial Infarction',                 'Cardiovascular',    'I21',   'Critical'),
      ('Chronic Kidney Disease (Stage 3)',             'Renal',             'N18.3', 'Moderate'),
      ('Asthma (Moderate Persistent)',                'Respiratory',       'J45.1', 'Moderate'),
      ('Community-Acquired Pneumonia',                'Respiratory',       'J18.9', 'Moderate'),
      ('Chronic Obstructive Pulmonary Disease',       'Respiratory',       'J44',   'Moderate'),
      ('Dengue Fever',                                'Infectious',        'A90',   'Moderate'),
      ('Typhoid Fever',                               'Infectious',        'A01.0', 'Moderate'),
      ('Viral Gastroenteritis',                       'Gastrointestinal',  'A08',   'Mild'),
      ('Peptic Ulcer Disease',                        'Gastrointestinal',  'K27',   'Mild'),
      ('Irritable Bowel Syndrome',                    'Gastrointestinal',  'K58',   'Mild'),
      ('Urinary Tract Infection',                     'Urological',        'N39.0', 'Mild'),
      ('Migraine',                                    'Neurological',      'G43',   'Moderate'),
      ('Epilepsy',                                    'Neurological',      'G40',   'Moderate'),
      ('Cerebrovascular Accident (Stroke)',            'Neurological',      'I63',   'Critical'),
      ('Acute Appendicitis',                          'Gastrointestinal',  'K35',   'Severe'),
      ('Iron-Deficiency Anaemia',                     'Haematological',    'D50',   'Mild'),
      ('Hypothyroidism',                              'Endocrine',         'E03',   'Mild'),
      ('Rheumatoid Arthritis',                        'Musculoskeletal',   'M05',   'Moderate'),
      ('Osteoarthritis of Knee',                      'Musculoskeletal',   'M17',   'Mild'),
      ('Lumbar Disc Herniation',                      'Musculoskeletal',   'M51.1', 'Moderate'),
      ('Acute Otitis Media',                          'ENT',               'H66.0', 'Mild'),
      ('Allergic Rhinitis',                           'ENT',               'J30',   'Mild'),
      ('Cataract',                                    'Ophthalmological',  'H26',   'Mild'),
      ('Acute Conjunctivitis',                        'Ophthalmological',  'H10',   'Mild'),
      ('Atopic Dermatitis (Eczema)',                  'Dermatological',    'L20',   'Mild'),
      ('Psoriasis',                                   'Dermatological',    'L40',   'Moderate'),
      ('Pre-Eclampsia',                               'Obstetric',         'O14',   'Severe'),
      ('Gestational Diabetes Mellitus',               'Obstetric',         'O24.4', 'Moderate'),
      ('Anxiety Disorder, Generalized',               'Psychiatric',       'F41.1', 'Mild'),
      ('Major Depressive Disorder',                   'Psychiatric',       'F32',   'Moderate'),
      ('Septicaemia',                                 'Infectious',        'A41',   'Critical'),
      ('COVID-19 (Confirmed)',                         'Infectious',        'U07.1', 'Moderate'),
      ('Malaria (Plasmodium falciparum)',              'Infectious',        'B50',   'Severe')
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 6. TREATMENTS ────────────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".treatments (name, category, price, description, estimated_duration) VALUES
      ('IV Fluid Therapy',                     'Medical',    300,  'Intravenous fluid administration',         '30–60 min'),
      ('Nebulisation Therapy',                 'Medical',    200,  'Medicated aerosol inhalation',             '15 min'),
      ('Wound Dressing & Debridement',         'Surgical',   500,  'Wound cleaning, dressing and care',        '30 min'),
      ('Suturing (up to 5 stitches)',           'Surgical',   800,  'Wound closure with sutures',               '20 min'),
      ('Plaster of Paris (POP) Application',   'Orthopaedic',1000, 'POP cast for fracture immobilisation',     '45 min'),
      ('Nasogastric Tube Insertion',           'Medical',    400,  'NG tube for feeding or gastric drainage',  '15 min'),
      ('Urinary Catheterisation',              'Medical',    500,  'Urinary catheter insertion',               '20 min'),
      ('Oxygen Therapy (per hour)',             'Medical',    150,  'Supplemental oxygen administration',       'Variable'),
      ('Blood Transfusion (per unit)',          'Medical',    1200, 'Packed RBC transfusion',                   '3–4 hrs'),
      ('Physiotherapy Session',                'Rehabilitation',600,'Physical therapy rehabilitation session',  '45 min'),
      ('Surgical Incision & Drainage (I&D)',   'Surgical',   1500, 'Abscess incision and drainage',            '30 min'),
      ('Endoscopy (Upper GI)',                 'Procedural', 4000, 'Upper gastrointestinal endoscopy',         '30 min'),
      ('Colonoscopy',                          'Procedural', 5000, 'Lower gastrointestinal endoscopy',         '45 min'),
      ('Lumbar Puncture',                      'Procedural', 2000, 'CSF collection via spinal tap',            '30 min'),
      ('ECG Monitoring (per session)',          'Diagnostic', 250,  'Cardiac rhythm monitoring',               '10 min'),
      ('Cardiopulmonary Resuscitation (CPR)',   'Emergency',  0,    'Life-saving resuscitation procedure',     'Variable'),
      ('Defibrillation',                       'Emergency',  2500, 'Electrical shock to restore heart rhythm', '5 min'),
      ('Chemotherapy Administration',          'Oncology',   5000, 'Cancer chemotherapy infusion',            '2–6 hrs'),
      ('Dialysis Session (Haemodialysis)',      'Renal',      3500, 'Blood purification via dialysis',         '4 hrs'),
      ('Minor Surgical Procedure',             'Surgical',   2500, 'Minor OT procedure under local anaesthesia','1–2 hrs')
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 7. DIAGNOSTICS (Lab & Radiology) ────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".diagnostics (name, price, category) VALUES
      ('Complete Blood Count (CBC)',           350,  'Haematology'),
      ('Blood Glucose - Fasting (FBS)',        80,   'Biochemistry'),
      ('Blood Glucose - Post Prandial (PPBS)', 80,   'Biochemistry'),
      ('HbA1c (Glycated Haemoglobin)',         350,  'Biochemistry'),
      ('Lipid Profile',                        500,  'Biochemistry'),
      ('Liver Function Test (LFT)',            600,  'Biochemistry'),
      ('Kidney Function Test (KFT/RFT)',       500,  'Biochemistry'),
      ('Serum Electrolytes (Na, K, Cl)',       400,  'Biochemistry'),
      ('Thyroid Function Test (TFT)',          650,  'Biochemistry'),
      ('Urine Routine & Microscopy',           100,  'Microbiology'),
      ('Urine Culture & Sensitivity',          500,  'Microbiology'),
      ('Blood Culture & Sensitivity',          800,  'Microbiology'),
      ('Stool Routine Examination',            150,  'Microbiology'),
      ('Dengue NS1 Antigen',                   500,  'Serology'),
      ('Dengue IgG / IgM',                     400,  'Serology'),
      ('Malaria Antigen (RDT)',                 250,  'Serology'),
      ('Widal Test',                            150,  'Serology'),
      ('HIV Screening (ELISA)',                 200,  'Serology'),
      ('Hepatitis B Surface Antigen (HBsAg)',  200,  'Serology'),
      ('Anti-HCV Antibody',                    300,  'Serology'),
      ('Pregnancy Test (Urine hCG)',            100,  'Serology'),
      ('Prothrombin Time (PT / INR)',           250,  'Haematology'),
      ('ESR (Erythrocyte Sedimentation Rate)', 100,  'Haematology'),
      ('C-Reactive Protein (CRP)',              300,  'Biochemistry'),
      ('Serum Creatinine',                      150,  'Biochemistry'),
      ('Serum Uric Acid',                       200,  'Biochemistry'),
      ('Arterial Blood Gas (ABG)',              400,  'Biochemistry'),
      ('Troponin I / T (Cardiac Marker)',       800,  'Biochemistry'),
      ('D-Dimer',                               900,  'Haematology'),
      ('Chest X-Ray (PA View)',                 400,  'Radiology'),
      ('X-Ray - Extremity (per view)',          300,  'Radiology'),
      ('Ultrasound Abdomen & Pelvis',          1200,  'Radiology'),
      ('Obstetric Ultrasound (OB/GYN)',        1000,  'Radiology'),
      ('CT Scan - Head (Plain)',               4500,  'Radiology'),
      ('CT Scan - Abdomen & Pelvis',           6500,  'Radiology'),
      ('MRI Brain (Plain)',                    8500,  'Radiology'),
      ('MRI Spine (Lumbar)',                   9000,  'Radiology'),
      ('2D Echocardiogram',                    3000,  'Cardiology'),
      ('ECG (Resting 12-Lead)',                 300,  'Cardiology'),
      ('Pulmonary Function Test (PFT)',        1200,  'Pulmonology'),
      ('Bone Mineral Density (DEXA Scan)',     2500,  'Radiology'),
      ('Sputum AFB (TB Smear)',                 200,  'Microbiology'),
      ('CBNAAT / GeneXpert (TB)',               900,  'Microbiology'),
      ('Pap Smear',                             600,  'Cytology'),
      ('Biopsy (specimen processing)',         1500,  'Histopathology')
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 8. MEDICINES (Common Generic Formulary) ──────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".medicines (
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
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS uom VARCHAR(50) DEFAULT 'Tablet'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".medicines ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".medicines (name, category, composition, unit_price, stock_quantity, uom, is_active) VALUES
      ('Paracetamol 500mg',           'Analgesic',         'Paracetamol 500mg',                      2.50,   0, 'Tablet',  true),
      ('Paracetamol 250mg Suspension','Analgesic',         'Paracetamol 250mg/5ml',                  45.00,  0, 'Bottle',  true),
      ('Ibuprofen 400mg',             'NSAID',             'Ibuprofen 400mg',                         5.00,  0, 'Tablet',  true),
      ('Diclofenac 50mg',             'NSAID',             'Diclofenac Sodium 50mg',                  4.50,  0, 'Tablet',  true),
      ('Amoxicillin 500mg',           'Antibiotic',        'Amoxicillin Trihydrate 500mg',             8.00,  0, 'Capsule', true),
      ('Amoxicillin + Clavulanate 625mg','Antibiotic',     'Amoxicillin 500mg + Clavulanate 125mg',  28.00,  0, 'Tablet',  true),
      ('Azithromycin 500mg',          'Antibiotic',        'Azithromycin 500mg',                     18.00,  0, 'Tablet',  true),
      ('Ciprofloxacin 500mg',         'Antibiotic',        'Ciprofloxacin 500mg',                     8.00,  0, 'Tablet',  true),
      ('Metronidazole 400mg',         'Antiprotozoal',     'Metronidazole 400mg',                     3.50,  0, 'Tablet',  true),
      ('Cetirizine 10mg',             'Antihistamine',     'Cetirizine Hydrochloride 10mg',            2.50,  0, 'Tablet',  true),
      ('Loratadine 10mg',             'Antihistamine',     'Loratadine 10mg',                          4.00,  0, 'Tablet',  true),
      ('Atorvastatin 10mg',           'Antihyperlipidaemic','Atorvastatin Calcium 10mg',               9.00,  0, 'Tablet',  true),
      ('Atorvastatin 20mg',           'Antihyperlipidaemic','Atorvastatin Calcium 20mg',              12.00,  0, 'Tablet',  true),
      ('Amlodipine 5mg',              'Antihypertensive',  'Amlodipine Besylate 5mg',                  5.00,  0, 'Tablet',  true),
      ('Telmisartan 40mg',            'Antihypertensive',  'Telmisartan 40mg',                         8.00,  0, 'Tablet',  true),
      ('Enalapril 5mg',               'Antihypertensive',  'Enalapril Maleate 5mg',                    4.00,  0, 'Tablet',  true),
      ('Metoprolol 25mg',             'Antihypertensive',  'Metoprolol Succinate 25mg',                7.00,  0, 'Tablet',  true),
      ('Metformin 500mg',             'Antidiabetic',      'Metformin Hydrochloride 500mg',            3.50,  0, 'Tablet',  true),
      ('Metformin 1000mg',            'Antidiabetic',      'Metformin Hydrochloride 1000mg',           6.00,  0, 'Tablet',  true),
      ('Glimepiride 1mg',             'Antidiabetic',      'Glimepiride 1mg',                          5.00,  0, 'Tablet',  true),
      ('Sitagliptin 100mg',           'Antidiabetic',      'Sitagliptin Phosphate 100mg',            120.00,  0, 'Tablet',  true),
      ('Insulin Regular (Actrapid) 10ml','Antidiabetic',   'Insulin Human Regular 100IU/ml',         200.00,  0, 'Vial',    true),
      ('Levothyroxine 50mcg',         'Thyroid',           'Levothyroxine Sodium 50mcg',               5.00,  0, 'Tablet',  true),
      ('Omeprazole 20mg',             'Antacid',           'Omeprazole 20mg',                          4.00,  0, 'Capsule', true),
      ('Pantoprazole 40mg',           'Antacid',           'Pantoprazole Sodium 40mg',                 7.00,  0, 'Tablet',  true),
      ('Domperidone 10mg',            'Antiemetic',        'Domperidone 10mg',                         3.00,  0, 'Tablet',  true),
      ('Ondansetron 4mg',             'Antiemetic',        'Ondansetron Hydrochloride 4mg',            8.00,  0, 'Tablet',  true),
      ('Ranitidine 150mg',            'Antacid',           'Ranitidine Hydrochloride 150mg',           3.00,  0, 'Tablet',  true),
      ('Salbutamol 100mcg Inhaler',   'Bronchodilator',    'Salbutamol Sulphate 100mcg/dose',        185.00,  0, 'Inhaler', true),
      ('Montelukast 10mg',            'Antiasthmatic',     'Montelukast Sodium 10mg',                 18.00,  0, 'Tablet',  true),
      ('Prednisolone 10mg',           'Corticosteroid',    'Prednisolone 10mg',                        4.00,  0, 'Tablet',  true),
      ('Dexamethasone 4mg Injection', 'Corticosteroid',    'Dexamethasone Sodium Phosphate 4mg/ml',   22.00,  0, 'Vial',    true),
      ('Furosemide 40mg',             'Diuretic',          'Furosemide 40mg',                          3.50,  0, 'Tablet',  true),
      ('Spironolactone 25mg',         'Diuretic',          'Spironolactone 25mg',                      6.00,  0, 'Tablet',  true),
      ('Aspirin 75mg',                'Antiplatelet',      'Acetylsalicylic Acid 75mg',                2.00,  0, 'Tablet',  true),
      ('Clopidogrel 75mg',            'Antiplatelet',      'Clopidogrel Bisulphate 75mg',             12.00,  0, 'Tablet',  true),
      ('Warfarin 2mg',                'Anticoagulant',     'Warfarin Sodium 2mg',                      3.50,  0, 'Tablet',  true),
      ('Ferrous Sulphate 200mg',      'Haematinic',        'Ferrous Sulphate 200mg',                   2.00,  0, 'Tablet',  true),
      ('Folic Acid 5mg',              'Vitamin',           'Folic Acid 5mg',                           1.50,  0, 'Tablet',  true),
      ('Vitamin D3 60000 IU',         'Vitamin',           'Cholecalciferol 60000 IU',                25.00,  0, 'Capsule', true),
      ('Calcium + Vitamin D3 Tablet', 'Supplement',        'Calcium Carbonate 500mg + Vit D3 250IU',   8.00,  0, 'Tablet',  true),
      ('Normal Saline 500ml',         'IV Fluid',          'Sodium Chloride 0.9%',                    45.00,  0, 'Bottle',  true),
      ('Ringer Lactate 500ml',        'IV Fluid',          'Lactated Ringer''s Solution',              50.00,  0, 'Bottle',  true),
      ('Dextrose 5% 500ml',           'IV Fluid',          'Dextrose 5% in Water',                    48.00,  0, 'Bottle',  true),
      ('Metronidazole 500mg IV 100ml','Antiprotozoal',     'Metronidazole 500mg/100ml IV',            65.00,  0, 'Bottle',  true),
      ('Ceftriaxone 1g Injection',    'Antibiotic',        'Ceftriaxone Sodium 1g',                   85.00,  0, 'Vial',    true),
      ('Amikacin 500mg Injection',    'Antibiotic',        'Amikacin Sulphate 500mg/2ml',             80.00,  0, 'Vial',    true),
      ('Tramadol 50mg',               'Opioid Analgesic',  'Tramadol Hydrochloride 50mg',             12.00,  0, 'Capsule', true),
      ('Diazepam 5mg',                'Anxiolytic',        'Diazepam 5mg',                             3.00,  0, 'Tablet',  true),
      ('Alprazolam 0.25mg',           'Anxiolytic',        'Alprazolam 0.25mg',                        3.00,  0, 'Tablet',  true)
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 9. HOSPITAL SERVICES ─────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".services (name, category, service_code, price, tax_percent) VALUES
      ('OPD Consultation',                    'Consultation',    'SVC-OPD-001',   500,  0),
      ('Emergency Consultation',              'Consultation',    'SVC-EMR-001',  1000,  0),
      ('Follow-Up Consultation',              'Consultation',    'SVC-FUP-001',   250,  0),
      ('ICU Bed Charge (per day)',             'Bed Charges',     'SVC-ICU-001',  5000,  0),
      ('Private Room Bed Charge (per day)',    'Bed Charges',     'SVC-PVT-001',  3500,  0),
      ('Semi-Private Room Bed Charge (per day)','Bed Charges',   'SVC-SPR-001',  2000,  0),
      ('General Ward Bed Charge (per day)',    'Bed Charges',     'SVC-GWD-001',  1000,  0),
      ('Operation Theatre (Minor)',            'Surgical',        'SVC-OT-001',   5000, 18),
      ('Operation Theatre (Major)',            'Surgical',        'SVC-OT-002', 20000,  18),
      ('Anaesthesia Charges (per hour)',       'Surgical',        'SVC-ANA-001',  2000,  0),
      ('Nursing Care Charges (per day)',       'Nursing',         'SVC-NRS-001',   500,  0),
      ('Ambulance Service (Local)',            'Transport',       'SVC-AMB-001',  1500,  0),
      ('Ambulance Service (Inter-city)',       'Transport',       'SVC-AMB-002',  5000,  0),
      ('Dietician Consultation',              'Consultation',    'SVC-DIT-001',   400,  0),
      ('Medical Certificate',                 'Administrative',  'SVC-ADM-001',   200,  0),
      ('Medico-Legal Certificate (MLC)',       'Administrative',  'SVC-ADM-002',   500,  0),
      ('Death Certificate',                   'Administrative',  'SVC-ADM-003',   300,  0),
      ('Discharge Summary Printing',          'Administrative',  'SVC-ADM-004',   100,  0),
      ('Blood Bank (per unit)',               'Blood Bank',      'SVC-BBK-001',  1500,  0),
      ('Dialysis Session',                    'Renal',           'SVC-DLY-001',  3500,  0)
      ON CONFLICT (name) DO NOTHING
    `);

    // ── 10. WARDS & BEDS ─────────────────────────────────────────────────────
    const wardsToSeed = [
      { name: 'General Ward - A',   type: 'Regular Care', capacity: 20, charge: 1000 },
      { name: 'General Ward - B',   type: 'Regular Care', capacity: 20, charge: 1000 },
      { name: 'Semi-Private Ward',  type: 'Special Care', capacity: 10, charge: 2000 },
      { name: 'Private Suite',      type: 'Special Care', capacity:  8, charge: 3500 },
      { name: 'ICU - Block 1',      type: 'Critical',     capacity: 10, charge: 5000 },
      { name: 'Neonatal ICU (NICU)', type: 'Critical',    capacity:  8, charge: 4500 },
      { name: 'Emergency Ward',     type: 'Emergency',    capacity: 12, charge: 1500 },
      { name: 'Maternity Ward',     type: 'Obstetric',    capacity: 10, charge: 2000 }
    ];
    for (const w of wardsToSeed) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".wards (id, name, type, capacity, base_charge)
        SELECT gen_random_uuid(), '${w.name}', '${w.type}', ${w.capacity}, ${w.charge}
        WHERE NOT EXISTS (SELECT 1 FROM "${schema}".wards WHERE name = '${w.name}')
      `);
      const wardRow = await prisma.$queryRawUnsafe(`SELECT id, capacity FROM "${schema}".wards WHERE name = '${w.name}' LIMIT 1`);
      if (wardRow && wardRow[0]) {
        const wardId = wardRow[0].id;
        const cap = wardRow[0].capacity || w.capacity;
        const prefix = w.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
        for (let i = 1; i <= cap; i++) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "${schema}".beds (ward_id, bed_number, status)
            SELECT '${wardId}', '${prefix}-${String(i).padStart(2, '0')}', 'Vacant'
            WHERE NOT EXISTS (
              SELECT 1 FROM "${schema}".beds WHERE ward_id = '${wardId}' AND bed_number = '${prefix}-${String(i).padStart(2, '0')}'
            )
          `);
        }
      }
    }

    // ── 11. RETROACTIVE CLEANUP — remove old dummy staff rows ─────────────────
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM "${schema}".users
        WHERE email LIKE '%@%.hims.com'
          AND role = 'DOCTOR'
          AND (name LIKE 'Dr. % Lead Physician' OR name LIKE 'Dr. % Senior Consultant')
      `);
    } catch (cleanupErr) { /* table may not exist on very first provision */ }

    console.log(`[PROVISIONING] Clinical Masters fully seeded for ${schema}.`);
  } catch (err) {
    console.error(`[PROVISIONING] Seeding FAILED for ${schema}:`, err.message);
  }
}

// Only run self-healing in development or if forced
router.use(async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || process.env.FORCE_SYNC === 'true') {
    await ensureNexusColumns(req.prisma);
  }
  next();
});

router.get("/tenants", async (req, res, next) => {
  try {
    const tenants = await req.prisma.$queryRawUnsafe(`
      SELECT id, name, db_name as "dbName", shard_id as "shardId", plan, admin_email as "adminEmail"
      FROM nexus.tenants
    `);
    res.json(tenants);
  } catch (error) {
    next(error);
  }
});

router.get("/tenants/public", async (req, res, next) => {
  try {
    const tenants = await req.prisma.$queryRawUnsafe(`
      SELECT id, name, domain
      FROM nexus.tenants
    `);
    res.json(tenants);
  } catch (error) {
    next(error);
  }
});

router.get('/tenants/:id', async (req, res, next) => {
  try {
    // SECURITY: id from URL param — positional param
    const tenants = await req.prisma.$queryRawUnsafe(
      `SELECT id, name, code, db_name, shard_id, plan, admin_email, created_at, background_color, text_color, hero_background_color, overall_text_color
       FROM nexus.tenants WHERE id = $1::uuid LIMIT 1`,
      String(req.params.id)
    );
    if (!tenants || tenants.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenants[0]);
  } catch (error) { next(error); }
});

router.put('/tenants/:id/branding', async (req, res, next) => {
  try {
    const { id } = req.params;
    const settings = req.body;
    try {
      await req.prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS ui_settings JSONB DEFAULT '{}'::jsonb`);
      await req.prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255)`);
    } catch (e) { console.warn('[NEXUS] Branding healing warning:', e.message); }

    // SECURITY: all values as positional params
    await req.prisma.$executeRawUnsafe(
      `UPDATE nexus.tenants SET ui_settings = $1::jsonb, name = $2 WHERE id = $3::uuid`,
      JSON.stringify(settings),
      String(settings.hospitalName || 'Jioplix Hospital'),
      String(id)
    );
    res.json({ message: 'Branding updated successfully in global registry' });
  } catch (error) { next(error); }
});

router.put('/tenants/:id/plan', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;
    // SECURITY: plan and id as positional params
    await req.prisma.$executeRawUnsafe(
      `UPDATE nexus.tenants SET plan = $1 WHERE id = $2::uuid`,
      String(plan), String(id)
    );
    res.json({ message: `Tenant plan upgraded to ${plan}` });
  } catch (error) { next(error); }
});

router.post("/tenants", async (req, res, next) => {
  const { name, dbName, plan, contactName, contactEmail, adminEmail, adminPassword, uiSettings, domain } = req.body;
  const normalizedDbName = (dbName || "").toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const tenantCode = normalizedDbName;
  const schemaName = normalizedDbName;
  const passwordToUse = adminPassword || "Admin@" + Math.random().toString(36).slice(-4);

  if (!name || !tenantCode || !contactName || !contactEmail || !adminEmail) {
    return res.status(400).json({ error: "Missing required tenant provisioning fields." });
  }

  try {
    const tenantId = crypto.randomUUID();

    // 1. Create Tenant in Global Registry
    const domainValue = domain ? domain.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : null;
    
    // SECURITY: All tenant registry fields as positional params
    await req.prisma.$executeRawUnsafe(
      `INSERT INTO nexus.tenants (id, code, name, db_name, domain, shard_id, plan, background_color, text_color, hero_background_color, overall_text_color, admin_email)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      tenantId, tenantCode, String(name), schemaName,
      domainValue || null, schemaName, String(plan || 'basic'),
      String(uiSettings?.backgroundColor || '#ffffff'),
      String(uiSettings?.textColor || '#1e293b'),
      String(uiSettings?.heroBackgroundColor || '#f8fafc'),
      String(uiSettings?.overallTextColor || '#475569'),
      String(adminEmail)
    );

    // SECURITY: Contact fields as positional params
    await req.prisma.$executeRawUnsafe(
      `INSERT INTO nexus.tenant_admin_contacts (id, tenant_id, contact_name, email) VALUES ($1::uuid,$2::uuid,$3,$4)`,
      crypto.randomUUID(), tenantId, String(contactName), String(contactEmail)
    );

    // 2. Initialize Shard Schema (Robust Sequential Execution)
    try {
      const candidatePaths = [
        path.join(__dirname, "SHARD_Base_Schema.sql"),
        path.join(__dirname, "../../../../database/SHARD_Base_Schema.sql"),
        path.join(__dirname, "../../../database/SHARD_Base_Schema.sql"),
        path.join(process.cwd(), "database/SHARD_Base_Schema.sql"),
        path.join(process.cwd(), "../database/SHARD_Base_Schema.sql"),
        "/usr/src/database/SHARD_Base_Schema.sql",
        "/usr/src/app/database/SHARD_Base_Schema.sql"
      ];
      const schemaPath = candidatePaths.find(p => fs.existsSync(p));
      console.log(`[PROVISIONING] Attempting to load schema from candidate paths. Found at: ${schemaPath}`);

      if (!schemaPath) {
        throw new Error(`Schema file not found across any candidate paths: ${candidatePaths.join(", ")}`);
      }

      const sqlContent = fs.readFileSync(schemaPath, "utf8");
      const statements = splitSqlStatements(sqlContent);
      console.log(`[PROVISIONING] Found ${statements.length} SQL statements to execute.`);

      await req.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      console.log(`[PROVISIONING] Schema "${schemaName}" created or already exists.`);

      let successCount = 0;
      for (const statement of statements) {
        try {
          await req.prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public; ${statement}`);
          successCount++;
        } catch (stmtErr) {
          console.error(`[PROVISIONING] Statement ${successCount + 1} FAILED:`);
          console.error(`SQL: ${statement.substring(0, 200)}...`);
          console.error(`Error: ${stmtErr.message}`);
          // We continue for now, but maybe we should stop if it's a CREATE TABLE?
        }
      }
      console.log(`[PROVISIONING] Successfully executed ${successCount}/${statements.length} statements.`);

      const loginEmail = adminEmail;
      const hashedAdminPassword = await bcrypt.hash(passwordToUse, 10);

      // SECURITY: admin email and password hash as positional params
      await req.prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}".users (email, password_hash, role, name) VALUES ($1, $2, 'admin', $3)`,
        String(loginEmail), hashedAdminPassword, String(contactName)
      );
      console.log(`[PROVISIONING] Admin user ${loginEmail} created in shard.`);

      // 3. SEED CLINICAL MASTER DATA (The "Hybrid-to-Copy" Move)
      await seedTenantMasterData(req.prisma, schemaName);
      
      // 4. SYNC RBAC & MENUS
      // Reuse logic from debug/rbac-sync for clean setup
      try {
        await req.prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".rbac_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(50) UNIQUE NOT NULL);
          CREATE TABLE IF NOT EXISTS "${schemaName}".rbac_menus (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), label VARCHAR(100) NOT NULL, path VARCHAR(100) NOT NULL, icon VARCHAR(50), required_plan VARCHAR(50) DEFAULT 'basic', sort_order INT DEFAULT 0);
          CREATE TABLE IF NOT EXISTS "${schemaName}".rbac_role_menus (role_id UUID REFERENCES "${schemaName}".rbac_roles(id), menu_id UUID REFERENCES "${schemaName}".rbac_menus(id), PRIMARY KEY (role_id, menu_id));
          CREATE TABLE IF NOT EXISTS "${schemaName}".rbac_user_roles (user_id UUID REFERENCES "${schemaName}".users(id), role_id UUID REFERENCES "${schemaName}".rbac_roles(id), PRIMARY KEY (user_id, role_id));
        `);
        
        await req.prisma.$executeRawUnsafe(`
          INSERT INTO "${schemaName}".rbac_roles (name) VALUES ('ADMIN'), ('DOCTOR'), ('SUPPORT') ON CONFLICT DO NOTHING;
          INSERT INTO "${schemaName}".rbac_menus (label, path, icon, sort_order) VALUES
          ('Dashboard', '/tenant/dashboard', 'Dashboard', 1),
          ('OPD Registration', '/tenant/opd/registration', 'OPD', 2),
          ('Doctor''s Queue', '/tenant/opd/queue', 'Doctor', 3),
          ('Invoicing & Billing', '/billing', 'Billing', 10)
          ON CONFLICT DO NOTHING;
        `);
      } catch (rbacErr) { console.warn("[PROVISIONING] RBAC Setup skipped:", rbacErr.message); }

      if (process.env.RESEND_API_KEY) {
        const fromEmail = process.env.RESEND_FROM;
        const dashboardUrl = process.env.APP_URL || "http://localhost:3000";
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 20px;">
            <h2>Welcome to Jioplix HIMS</h2>
            <p>Your hospital shard <strong>${name}</strong> is ready.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
              <p><strong>Admin Email:</strong> ${loginEmail}</p>
              <p><strong>Initial Password:</strong> ${passwordToUse}</p>
              <p><strong>Tenant Code:</strong> ${tenantCode}</p>
            </div>
            <p>Please log in at: <a href="${dashboardUrl}">Hospital Dashboard</a></p>
          </div>
        `;

        try {
          await axios.post('https://api.resend.com/emails', {
            from: fromEmail,
            to: [contactEmail],
            subject: `HIMS Shard Ready: ${name}`,
            html: emailHtml
          }, {
            headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }
          });
          console.log(`[COMMUNICATION] Welcome email sent to ${contactEmail}`);
        } catch (emailErr) {
          console.error("[COMMUNICATION] Email failed:", emailErr.response?.data || emailErr.message);
        }
      }
    } catch (shardErr) {
      console.error("[PROVISIONING] Critical failure in shard init:", shardErr.message);
      await req.prisma.$executeRawUnsafe(`DELETE FROM nexus.tenant_admin_contacts WHERE tenant_id = $1::uuid`, String(tenantId));
      await req.prisma.$executeRawUnsafe(`DELETE FROM nexus.tenants WHERE id = $1::uuid`, String(tenantId));
      return next(shardErr);
    }

    res.status(201).json({ id: tenantId, name, dbName: schemaName, plan, adminEmail });
  } catch (error) {
    console.error("[NEXUS] CRITICAL PROVISIONING ERROR:", error.message);
    if (error.code === 'P2002') {
       console.error("[NEXUS] ERROR: A tenant with this slug or email already exists in the registry.");
    }
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const users = await req.prisma.user.findMany({ where: { role: "nexus" } });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.delete('/tenants/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    // SECURITY: id as positional param
    const tenants = await req.prisma.$queryRawUnsafe(
      `SELECT db_name FROM nexus.tenants WHERE id = $1::uuid LIMIT 1`,
      String(id)
    );
    if (!tenants || tenants.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    const schemaName = tenants[0].db_name;
    await req.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await req.prisma.$executeRawUnsafe(`DELETE FROM nexus.tenants WHERE id = $1::uuid`, String(id));
    res.json({ message: 'Tenant and schema deleted' });
  } catch (error) { next(error); }
});

router.get("/debug/tenants", async (req, res) => {
  try {
    const { schema } = req.query;
    if (schema) {
       const users = await req.prisma.$queryRawUnsafe(`SELECT id, name, email, role FROM "${schema}".users`);
       const roles = await req.prisma.$queryRawUnsafe(`SELECT id, name FROM "${schema}".rbac_roles`);
       const menus = await req.prisma.$queryRawUnsafe(`SELECT id, label, required_plan FROM "${schema}".rbac_menus`);
       const userRoles = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${schema}".rbac_user_roles`);
       const roleMenus = await req.prisma.$queryRawUnsafe(`SELECT * FROM "${schema}".rbac_role_menus`);
       return res.json({ users, roles, menus, userRoles, roleMenus });
    }
    const tenants = await req.prisma.$queryRawUnsafe(`SELECT id, name, db_name, plan FROM nexus.tenants`);
    res.json(tenants);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/debug/rbac-sync", async (req, res) => {
  try {
    const { schema } = req.query;
    if (!schema) return res.status(400).json({ error: "Schema param required" });
    
    console.log(`[NEXUS_DEBUG] Triggering RBAC Sync for ${schema}`);

    // 1. Ensure Schema-Level RBAC Tables Exist
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".rbac_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".rbac_menus (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          label VARCHAR(100) NOT NULL,
          path VARCHAR(100) NOT NULL,
          icon VARCHAR(50),
          required_plan VARCHAR(50) DEFAULT 'basic',
          parent_id UUID REFERENCES "${schema}".rbac_menus(id),
          sort_order INT DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS "${schema}".rbac_permissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key VARCHAR(100) UNIQUE NOT NULL,
          description TEXT
      );
      CREATE TABLE IF NOT EXISTS "${schema}".rbac_role_menus (
          role_id UUID REFERENCES "${schema}".rbac_roles(id),
          menu_id UUID REFERENCES "${schema}".rbac_menus(id),
          PRIMARY KEY (role_id, menu_id)
      );
      CREATE TABLE IF NOT EXISTS "${schema}".rbac_role_permissions (
          role_id UUID REFERENCES "${schema}".rbac_roles(id),
          permission_id UUID REFERENCES "${schema}".rbac_permissions(id),
          PRIMARY KEY (role_id, permission_id)
      );
      CREATE TABLE IF NOT EXISTS "${schema}".rbac_user_roles (
          user_id UUID REFERENCES "${schema}".users(id),
          role_id UUID REFERENCES "${schema}".rbac_roles(id),
          PRIMARY KEY (user_id, role_id)
      );
    `);

    // 2. Ensure Roles exist
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".rbac_roles (name, description) VALUES 
      ('ADMIN', 'Full access'), ('DOCTOR', 'Clinical access'), ('NURSE', 'Nursing access'), 
      ('PHARMACIST', 'Pharmacy access'), ('LAB_TECH', 'Lab access'), ('SUPPORT', 'Front desk')
      ON CONFLICT (name) DO NOTHING
    `);

    // 3. Ensure Menus exist
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".rbac_menus (label, path, icon, sort_order, required_plan) VALUES
      ('Dashboard', '/tenant/dashboard', 'Dashboard', 1, 'basic'),
      ('OPD Registration', '/tenant/opd/registration', 'OPD', 2, 'basic'),
      ('Doctor''s Queue', '/tenant/opd/queue', 'Doctor', 3, 'basic'),
      ('Invoicing & Billing', '/billing', 'Billing', 10, 'basic'),
      ('Branding & UI Settings', '/tenant/settings', 'Dashboard', 12, 'basic'),
      ('Staff & RBAC', '/tenant/staff', 'Doctor', 13, 'basic'),
      ('Laboratory', '/tenant/lab', 'Lab', 4, 'standard'),
      ('Pharmacy Dashboard', '/tenant/pharmacy/dashboard', 'Pharmacy', 5, 'standard'),
      ('Stock Inventory', '/tenant/pharmacy/inventory', 'Pill', 6, 'standard'),
      ('Prescription Queue', '/tenant/pharmacy/queue', 'Receipt', 7, 'standard'),
      ('Hospital Settings (Masters)', '/tenant/masters', 'Settings', 11, 'basic'),
      ('IPD Bed Map', '/tenant/ipd/beds', 'Bed', 8, 'professional'),
      ('IPD Census & Daycare', '/tenant/ipd/admissions', 'Clipboard', 9, 'professional'),
      ('Discharge Summaries', '/tenant/ipd/discharge', 'Receipt', 15, 'professional')
      ON CONFLICT (label) DO NOTHING
    `);

    // 4. Link ADMIN to all menus
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
      SELECT r.id, m.id FROM "${schema}".rbac_roles r, "${schema}".rbac_menus m 
      WHERE r.name = 'ADMIN'
      ON CONFLICT DO NOTHING
    `);

    // 5. Link DOCTOR to clinical menus
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
      SELECT r.id, m.id FROM "${schema}".rbac_roles r, "${schema}".rbac_menus m 
      WHERE r.name = 'DOCTOR' AND m.label IN ('Dashboard', 'Doctor''s Queue', 'Laboratory', 'IPD Census', 'Bed Map')
      ON CONFLICT DO NOTHING
    `);

    // 6. Ensure current users are linked to their roles based on users.role column
    const users = await req.prisma.$queryRawUnsafe(`SELECT id, role FROM "${schema}".users`);
    for (const u of users) {
       if (u.role) {
         await req.prisma.$executeRawUnsafe(`
           INSERT INTO "${schema}".rbac_user_roles (user_id, role_id)
           SELECT '${u.id}', id FROM "${schema}".rbac_roles WHERE LOWER(name) = LOWER('${u.role}')
           ON CONFLICT DO NOTHING
         `);
       }
    }

    res.json({ message: `RBAC Sync successful for ${schema}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/debug/sync-all-shards", async (req, res) => {
  try {
    console.log("[NEXUS] Starting Global Schema Sync via API...");
    const schemaPath = path.join(__dirname, "../../../../database/SHARD_Base_Schema.sql");
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    const sqlContent = fs.readFileSync(schemaPath, "utf8");
    const statements = splitSqlStatements(sqlContent);

    const tenants = await req.prisma.$queryRawUnsafe(`SELECT name, db_name FROM nexus.tenants`);
    const results = [];

    for (const tenant of tenants) {
      const schemaName = tenant.db_name;
      let successCount = 0;
      let errorCount = 0;
      
      for (const statement of statements) {
        try {
          await req.prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public; ${statement}`);
          successCount++;
        } catch (e) {
          if (!e.message.includes("already exists") && !e.message.includes("multiple primary keys")) {
            errorCount++;
          }
        }
      }
      results.push({ tenant: tenant.name, schema: schemaName, successCount, errorCount });
    }

    res.json({ message: "Global sync complete", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TICKETING SYSTEM ---

router.post('/tickets', async (req, res, next) => {
  try {
    const { tenantId, subject, category, priority, message } = req.body;
    // SECURITY: all body values as positional params
    const result = await req.prisma.$queryRawUnsafe(
      `INSERT INTO nexus.support_tickets (tenant_id, subject, category, priority, message)
       VALUES ($1::uuid, $2, $3, $4, $5) RETURNING *`,
      String(tenantId), String(subject || ''), String(category || ''), String(priority || 'Medium'), String(message || '')
    );
    const ticket = result[0];
    if (process.env.RESEND_API_KEY) {
      try {
        await axios.post('https://api.resend.com/emails', {
          from: process.env.RESEND_FROM || 'HIMS Support',
          to: [process.env.ADMIN_EMAIL || 'admin@hims-sys.com'],
          subject: `[NEW TICKET] ${category}: ${subject}`,
          html: `<p>A new support ticket has been raised by tenant <strong>${tenantId}</strong>.</p><p><strong>Message:</strong> ${String(message || '').substring(0, 500)}</p>`
        }, { headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' } });
      } catch (e) { console.error('Email notification failed', e.message); }
    }
    res.status(201).json(ticket);
  } catch (error) { next(error); }
});

// 2. List Tickets (Nexus Side or Tenant Side)
router.get("/tickets", async (req, res, next) => {
  try {
    const { tenantId } = req.query;
    let query = `
      SELECT t.*, n.name as tenant_name 
      FROM nexus.support_tickets t
      JOIN nexus.tenants n ON t.tenant_id = n.id
    `;
    if (tenantId) query += ` WHERE t.tenant_id = '${tenantId}'`;
    query += ` ORDER BY t.created_at DESC`;

    const data = await req.prisma.$queryRawUnsafe(query);
    res.json(data);
  } catch (error) { next(error); }
});

// 3. Update/Respond to Ticket (Nexus Side)
router.patch("/tickets/:id", async (req, res, next) => {
  const id = req.params.id?.trim();
  const { status, response } = req.body;
  
  try {
    console.log(`[NEXUS_SUPPORT] Attempting to update ticket: ${id} to status: ${status}`);

    // 1. Verify ticket exists first
    const checkResult = await req.prisma.$queryRawUnsafe(`SELECT id FROM nexus.support_tickets WHERE id::text = $1`, id);
    if (!checkResult || checkResult.length === 0) {
       console.error(`[NEXUS_SUPPORT] Pre-check failed: No ticket found with ID ${id}`);
       return res.status(404).json({ error: "Ticket record not found in database" });
    }

    // 2. Perform Update
    const result = await req.prisma.$queryRawUnsafe(`
      UPDATE nexus.support_tickets 
      SET status = $1, response = $2, updated_at = NOW()
      WHERE id::text = $3
      RETURNING *
    `, status || 'Open', response || '', id);

    if (!result || result.length === 0) {
       console.error(`[NEXUS_SUPPORT] Update executed but returned no rows for ID: ${id}`);
       return res.status(500).json({ error: "Update failed to apply changes" });
    }

    const ticket = result[0];
    console.log(`[NEXUS_SUPPORT] Ticket ${id} updated successfully to ${ticket.status}`);

    // 3. Notification Email to Tenant (Non-blocking)
    if (process.env.RESEND_API_KEY && ticket) {
      try {
        const tenant = await req.prisma.$queryRawUnsafe(`SELECT admin_email FROM nexus.tenants WHERE id = $1`, ticket.tenant_id);
        if (tenant[0]?.admin_email) {
          await axios.post('https://api.resend.com/emails', {
            from: process.env.RESEND_FROM || "HIMS Support",
            to: [tenant[0].admin_email],
            subject: `[TICKET UPDATED] ${ticket.subject}`,
            html: `<p>Your support ticket status has been updated to: <strong>${status}</strong>.</p><p><strong>Response from Support:</strong> ${response || "No comment."}</p>`
          }, { headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' } });
        }
      } catch (e) { console.error("[NEXUS_SUPPORT] Email notification failed:", e.message); }
    }

    res.json(ticket);
  } catch (err) {
    console.error(`[NEXUS_SUPPORT] CRITICAL ERROR during ticket update:`, err.message);
    res.status(500).json({ error: "Database transaction failed", details: err.message });
  }
});

// --- SYSTEM SIGNAL TRIGGERS (Email Password Reset, Upgrade, Discounts) ---
router.post("/send-signal", async (req, res, next) => {
  try {
    const { tenantId, type, subject, message, recipientOverride } = req.body;
    
    // 1. Resolve Recipient
    let recipient = recipientOverride;
    let tenantName = "System";
    
    if (tenantId) {
       const tenant = await req.prisma.$queryRawUnsafe(`SELECT admin_email, name FROM nexus.tenants WHERE id = '${tenantId}' LIMIT 1`);
       if (tenant[0]) {
         recipient = recipient || tenant[0].admin_email;
         tenantName = tenant[0].name;
       }
    }

    if (!recipient) return res.status(400).json({ error: "Recipient could not be resolved." });

    // 2. Prepare Template
    let html = `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">`;
    if (type === 'PASSWORD_RESET') {
      html += `<h2 style="color: #ef4444;">Password Reset Request</h2><p>A password reset has been initiated for your HIMS admin account.</p><div style="background: #f8fafc; padding: 16px; border-radius: 8px; font-weight: bold; text-align: center;">RESET_TOKEN_PENDING</div>`;
    } else if (type === 'UPGRADE') {
      html += `<h2 style="color: #3b82f6;">Unlock New Capabilities</h2><p>Expand your hospital's operations with our latest features.</p><div style="background: #eff6ff; padding: 16px; border-radius: 8px;">${message}</div>`;
    } else if (type === 'DISCOUNT') {
      html += `<h2 style="color: #10b981;">Exclusive Upgrade Offer</h2><p>Upgrade your plan today and save on your next billing cycle.</p><div style="background: #ecfdf5; padding: 16px; border-radius: 8px;"><strong>OFFER:</strong> ${message}</div>`;
    } else {
      html += `<h2>${subject}</h2><p>${message}</p>`;
    }
    html += `<hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" /><p style="font-size: 11px; color: #94a3b8;">HIMS Nexus System Automation</p></div>`;

    // 3. Send via Resend
    if (process.env.RESEND_API_KEY) {
       await axios.post('https://api.resend.com/emails', {
         from: process.env.RESEND_FROM || "HIMS Nexus",
         to: [recipient],
         subject: `[SIGNAL] ${subject}`,
         html
       }, { headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' } });
    }

    // 4. Log Communication
    await req.prisma.$executeRawUnsafe(`
      INSERT INTO nexus.communication_logs (tenant_id, subject, recipient, status)
      VALUES ('${tenantId || "SYSTEM"}', '${subject.replace(/'/g, "''")}', '${recipient}', 'SENT')
    `);

    res.json({ message: "Signal dispatched successfully" });
  } catch (error) { next(error); }
});

// --- RESOURCE UTILIZATION TRACKING ---

router.get("/utilization", async (req, res, next) => {
  try {
    const tenants = await req.prisma.$queryRawUnsafe(`SELECT id, name, db_name as "dbName", plan FROM nexus.tenants`);
    const utilizationData = [];

    for (const tenant of tenants) {
      const schemaName = tenant.dbName;
      
      // Calculate DB Size
      const sizeResult = await req.prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))), 0) / 1024 / 1024 AS size_mb
        FROM pg_stat_user_tables
        WHERE schemaname = '${schemaName}'
      `);
      
      // Calculate Key Metrics (Activity)
      let recordCount = 0;
      let userCount = 0;
      try {
        const counts = await req.prisma.$queryRawUnsafe(`
          SELECT 
            (SELECT COUNT(*) FROM "${schemaName}".users) as users,
            (SELECT COUNT(*) FROM "${schemaName}".patients) as patients,
            (SELECT COUNT(*) FROM "${schemaName}".encounters) as encounters
        `);
        userCount = Number(counts[0].users || 0);
        recordCount = Number(counts[0].patients || 0) + Number(counts[0].encounters || 0);
      } catch (e) {
        console.warn(`Could not fetch metrics for ${schemaName}:`, e.message);
      }

      const planLimits = {
        'basic': 1024, // 1GB
        'standard': 5120, // 5GB
        'professional': 20480, // 20GB
        'enterprise': 102400 // 100GB
      };

      const limit = planLimits[tenant.plan?.toLowerCase()] || 1024;
      const sizeMb = parseFloat(sizeResult[0]?.size_mb || 0);

      utilizationData.push({
        id: tenant.id,
        name: tenant.name,
        dbName: schemaName,
        plan: tenant.plan,
        storageUsedMb: sizeMb.toFixed(2),
        storageLimitMb: limit,
        usagePercentage: ((sizeMb / limit) * 100).toFixed(2),
        activeUsers: userCount,
        totalRecords: recordCount,
        status: sizeMb > (limit * 0.9) ? 'CRITICAL' : sizeMb > (limit * 0.7) ? 'WARNING' : 'HEALTHY'
      });
    }

    res.json(utilizationData);
  } catch (error) {
    next(error);
  }
});

router.post("/utilization/snapshot", async (req, res, next) => {
  try {
    const tenants = await req.prisma.$queryRawUnsafe(`SELECT id, db_name as "dbName" FROM nexus.tenants`);
    
    for (const tenant of tenants) {
      const schemaName = tenant.dbName;
      const sizeResult = await req.prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))), 0) / 1024 / 1024 AS size_mb
        FROM pg_stat_user_tables
        WHERE schemaname = '${schemaName}'
      `);
      
      let recordCount = 0;
      let userCount = 0;
      try {
        const counts = await req.prisma.$queryRawUnsafe(`
          SELECT 
            (SELECT COUNT(*) FROM "${schemaName}".users) as users,
            (SELECT COUNT(*) FROM "${schemaName}".patients) as patients
        `);
        userCount = Number(counts[0].users || 0);
        recordCount = Number(counts[0].patients || 0);
      } catch (e) {}

      await req.prisma.$executeRawUnsafe(`
        INSERT INTO nexus.utilization_logs (tenant_id, db_size_mb, total_records, active_users)
        VALUES ('${tenant.id}', ${parseFloat(sizeResult[0]?.size_mb || 0)}, ${recordCount}, ${userCount})
      `);
    }

    res.json({ message: "Utilization snapshot captured for all shards." });
  } catch (error) {
    next(error);
  }
});

router.get("/utilization/history", async (req, res, next) => {
  try {
    const { tenantId } = req.query;
    let query = `
      SELECT created_at as date, SUM(db_size_mb) as total_size_mb, COUNT(DISTINCT tenant_id) as tenant_count
      FROM nexus.utilization_logs
    `;
    
    if (tenantId) {
      query = `
        SELECT created_at as date, db_size_mb as size_mb, total_records, active_users
        FROM nexus.utilization_logs
        WHERE tenant_id = '${tenantId}'
      `;
    }
    
    query += ` GROUP BY created_at ORDER BY created_at ASC LIMIT 100`;
    
    // Fallback if no history yet
    const history = await req.prisma.$queryRawUnsafe(query);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
