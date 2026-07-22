// [HEARTBEAT] Clinical Infrastructure Sync - 2026-05-05
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const routes = require("./routes");
const { prisma } = require("./config/prisma");
const { audit } = require("./middleware/audit");
const { register, metrics } = require("./config/metrics");

const app = express();

// ─── SECURITY: HTTP Headers ──────────────────────────────────────────────────
// helmet sets X-Frame-Options, X-Content-Type-Options, HSTS, CSP, and more.
app.use(helmet({
  contentSecurityPolicy: false, // Disabled — frontend SPA served from same origin
  crossOriginEmbedderPolicy: false,
}));

// ─── SECURITY: CORS Whitelist ─────────────────────────────────────────────────
// origin: true (reflect any origin) was replaced with an explicit allow-list.
// This prevents CSRF attacks from arbitrary third-party domains.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4000',
  `https://${process.env.APP_DOMAIN || 'jioplix.com'}`,
  `https://www.${process.env.APP_DOMAIN || 'jioplix.com'}`,
  `https://${process.env.DEV_APP_DOMAIN || 'dev.jioplix.com'}`,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow any subdomain of the configured domains (tenant routing)
    const rootDomain = process.env.APP_DOMAIN || 'jioplix.com';
    const devDomain  = process.env.DEV_APP_DOMAIN || 'dev.jioplix.com';
    const isSubdomain = origin.endsWith(`.${rootDomain}`) || origin.endsWith(`.${devDomain}`);
    
    // Explicitly allow any vercel.app domains dynamically
    const isVercelDomain = origin.endsWith('.vercel.app');
    
    // Allow any localhost port for local development (e.g. Flutter Web random ports)
    const isLocalhost = origin.startsWith('http://localhost:');

    if (ALLOWED_ORIGINS.includes(origin) || isSubdomain || isVercelDomain || isLocalhost) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  credentials: true,
}));

// ─── SECURITY: Nexus Admin Route Guard ───────────────────────────────────────
// Verifies that the caller holds a valid nexus-role JWT before allowing access
// to any destructive /api/nexus/fix-* or seed routes.
function requireNexusAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required for admin operations' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'nexus' && decoded.type !== 'nexus') {
      return res.status(403).json({ error: 'Nexus administrator privileges required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

// Global BigInt Serialization Fix
BigInt.prototype.toJSON = function() { return Number(this); };

// --- FULL-SERVICE AUTO-SEED (PROVISIONS SHARDS) ---
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
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

async function seedSamples() {
  console.log("[SEED] Performing Full-Service CLEAN SLATE Sync...");
  const tenants = [
    { name: "City Clinic", code: "city-clinic", plan: "Basic", email: "admin@cityclinic.com" },
    { name: "Metropolis Diagnostics", code: "metro-diag", plan: "Standard", email: "admin@metrodiag.com" },
    { name: "St. Marys Hospital", code: "st-marys", plan: "Professional", email: "admin@stmarys.com" },
    { name: "NHSPL Hospital", code: "nhspl", plan: "Enterprise", email: "admin@nhspl.com" }
  ];
  
  // SECURITY: Read seed password from env — never hardcode credentials in source.
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD || crypto.randomBytes(16).toString('hex');
  const hashedPassword = await bcrypt.hash(seedPassword, 10);
  if (process.env.SEED_DEFAULT_PASSWORD) {
    console.log('[SEED] Using SEED_DEFAULT_PASSWORD from environment for demo users.');
  } else {
    console.log('[SEED] Generated random passwords for demo users (set SEED_DEFAULT_PASSWORD in .env to use a fixed value).');
  }
  const candidatePaths = [
    path.join(__dirname, "SHARD_Base_Schema.sql"),
    path.join(__dirname, "../../database/SHARD_Base_Schema.sql"),
    path.join(__dirname, "../database/SHARD_Base_Schema.sql"),
    path.join(process.cwd(), "database/SHARD_Base_Schema.sql"),
    path.join(process.cwd(), "../database/SHARD_Base_Schema.sql"),
    "/usr/src/database/SHARD_Base_Schema.sql",
    "/usr/src/app/database/SHARD_Base_Schema.sql"
  ];
  const schemaPath = candidatePaths.find(p => fs.existsSync(p));
  if (!schemaPath) {
    console.error("[SEED] Error: SHARD_Base_Schema.sql not found across candidate paths.");
    return;
  }
  const baseSql = fs.readFileSync(schemaPath, "utf8");

  setTimeout(async () => {
    try {
      // 1. Check if we already have tenants. Only seed if empty.
      const tenantCountRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM nexus.tenants`);
      const tenantCount = Number(tenantCountRes[0].count);
      
      if (tenantCount > 0) {
        console.log(`[SEED] Registry already contains ${tenantCount} tenants. Skipping auto-seed to preserve manual changes.`);
        return;
      }

      console.log("[SEED] Registry is empty. Performing First-Time Clinical Setup...");

      for (const t of tenants) {
        const schemaName = t.code.replace(/-/g, '_');
        try {
          const id = crypto.randomUUID();
          
          // 2. DROP & RECREATE SHARD (Deep Wipe)
          console.log(`[SEED] Resetting Shard: ${schemaName}...`);
          await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
          await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);

          // 3. Register in Nexus
          await prisma.$executeRawUnsafe(`
            INSERT INTO nexus.tenants (id, name, code, db_name, plan)
            VALUES ('${id}', '${t.name}', '${t.code}', '${schemaName}', '${t.plan}')
          `);

          // 4. Provision Shard Schema
          const statements = splitSqlStatements(baseSql);
          for (let statement of statements) {
            try {
              await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public; ${statement}`);
            } catch (e) {
              if (!e.message.includes("already exists")) {
                 console.warn(`[SEED] Statement Error in ${schemaName}: ${e.message.substring(0, 50)}`);
              }
            }
          }
          
          // 5. Create Admin User
          await prisma.$executeRawUnsafe(`
            INSERT INTO "${schemaName}".users (name, email, password_hash, role)
            VALUES ('Hospital Admin', '${t.email}', '${hashedPassword}', 'admin')
          `);

          // 6. Seed sample staff for demo tenants
          await prisma.$executeRawUnsafe(`
            INSERT INTO "${schemaName}".users (name, email, password_hash, role, specialization, department, is_active) VALUES
            ('Dr. Sankaran R', 'sankaran@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'DOCTOR', 'Cardiology', 'Cardiology', true),
            ('Dr. Maheswaran R', 'maheswaran@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'DOCTOR', 'Orthopedics', 'Orthopedics', true),
            ('Dr. Aravind Kumar', 'aravind@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'DOCTOR', 'Pediatrics', 'Pediatrics', true),
            ('Nurse Clara Barton', 'clara@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'NURSE', NULL, 'General Ward', true),
            ('Nurse Florence N', 'florence@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'NURSE', NULL, 'ICU', true),
            ('John Pharmacist', 'pharmacy@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'PHARMACIST', NULL, 'Pharmacy', true),
            ('Alice LabTech', 'lab@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'LAB_TECH', NULL, 'Laboratory', true),
            ('Receptionist Sarah', 'reception@apollo.com', '$2a$10$w0M9u9PqR.y.h7p.vO0S.e6O9Yq.O9Yq.O9Yq.O9Yq.O9Yq.O9Yq', 'RECEPTIONIST', NULL, 'Front Desk', true)
            ON CONFLICT DO NOTHING
          `);

          // 7. Seed sample patients for demo tenants
          await prisma.$executeRawUnsafe(`
            INSERT INTO "${schemaName}".patients (name, mrn, gender, age, phone, email, blood_group) VALUES
            ('Sankaran R', 'MRN-2405-000001', 'Male', 45, '9840012345', 'sankaran@demo.com', 'O+'),
            ('Maheswaran R', 'MRN-2405-000002', 'Male', 52, '9840054321', 'mahesh@demo.com', 'A+'),
            ('Priyanka Sharma', 'MRN-2405-000003', 'Female', 29, '9840099887', 'priyanka@demo.com', 'B+'),
            ('Rahul Dravid', 'MRN-2405-000004', 'Male', 48, '9840011223', 'rahul@demo.com', 'O-'),
            ('Anjali Menon', 'MRN-2405-000005', 'Female', 34, '9840044556', 'anjali@demo.com', 'AB+')
            ON CONFLICT DO NOTHING
          `);
          
          console.log(`[SEED] SUCCESS: ${t.name} is clean and live.`);
        } catch (e) {
          console.error(`[SEED] FAILED for ${t.name}:`, e.message);
        }
      }
      console.log(`[SEED] SUCCESS: All tenants are synchronized on a clean slate.`);
    } catch (e) {
      console.error("[SEED] Global Sync Failed:", e.message);
    }
  }, 3000); 
}

// Administrative Route to fix/add menus for existing professional shards
// SECURITY: All /api/nexus/fix-* routes now require a valid nexus JWT.
app.get("/api/nexus/fix-professional-menus", requireNexusAuth, async (req, res) => {
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants WHERE plan IN ('Professional', 'Enterprise')`);
    let updated = 0;
    
    for (const t of tenants) {
      const schema = t.db_name;
      
      // 0. Ensure RBAC Infrastructure exists in this shard
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schema}".rbac_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(50) UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT NOW());
          CREATE TABLE IF NOT EXISTS "${schema}".rbac_menus (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), label VARCHAR(100) NOT NULL, path VARCHAR(100) NOT NULL, icon VARCHAR(50), required_plan VARCHAR(50) DEFAULT 'basic', sort_order INT DEFAULT 0);
          CREATE TABLE IF NOT EXISTS "${schema}".rbac_role_menus (role_id UUID REFERENCES "${schema}".rbac_roles(id), menu_id UUID REFERENCES "${schema}".rbac_menus(id), PRIMARY KEY (role_id, menu_id));
          INSERT INTO "${schema}".rbac_roles (name) 
          SELECT 'ADMIN' WHERE NOT EXISTS (SELECT 1 FROM "${schema}".rbac_roles WHERE name = 'ADMIN')
          UNION ALL
          SELECT 'DOCTOR' WHERE NOT EXISTS (SELECT 1 FROM "${schema}".rbac_roles WHERE name = 'DOCTOR') 
          UNION ALL
          SELECT 'SUPPORT' WHERE NOT EXISTS (SELECT 1 FROM "${schema}".rbac_roles WHERE name = 'SUPPORT');
        `);
      } catch (e) { console.warn(`RBAC init failed for ${schema}:`, e.message); continue; }

      // 1. Ensure Menu exists
      const existing = await prisma.$queryRawUnsafe(`SELECT id FROM "${schema}".rbac_menus WHERE label = 'Admission Desk'`);
      let menuId;
      if (existing.length === 0) {
        const result = await prisma.$queryRawUnsafe(`
          INSERT INTO "${schema}".rbac_menus (label, path, icon, sort_order, required_plan)
          VALUES ('Admission Desk', '/tenant/ipd/admission-desk', 'Bed', 7, 'professional')
          RETURNING id
        `);
        menuId = result[0].id;
      } else {
        menuId = existing[0].id;
      }
      
      // 2. Link to ADMIN, DOCTOR, and SUPPORT roles
      await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
        SELECT id, '${menuId}' FROM "${schema}".rbac_roles 
        WHERE name IN ('ADMIN', 'DOCTOR', 'SUPPORT')
        ON CONFLICT DO NOTHING
      `);
      updated++;
    }
    res.json({ message: `Successfully synchronized Admission Desk for ${updated} professional shards.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Administrative Route to fix/add system menus for all shards
app.get("/api/nexus/fix-system-menus", requireNexusAuth, async (req, res) => {
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants`);
    let updated = 0;
    
    for (const t of tenants) {
      const schema = t.db_name;

      // 0. Ensure Communications table exists
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schema}".communications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      const menusToAdd = [
        { label: 'Admission Desk', path: '/tenant/ipd/admission-desk', icon: 'Bed', sort: 7, plan: 'professional' },
        { label: 'OPD Billing & Revenue Center', path: '/billing?type=OPD', icon: 'Billing', sort: 10, plan: 'basic' },
        { label: 'Laboratory Billing', path: '/tenant/lab/billing', icon: 'Billing', sort: 11, plan: 'basic' },
        { label: 'Pharmacy Billing', path: '/billing?type=PHARMACY', icon: 'Billing', sort: 12, plan: 'basic' },
        { label: 'IPD & Discharge Billing', path: '/billing?type=IPD', icon: 'Billing', sort: 13, plan: 'professional' },
        { label: 'Discharge Summaries', path: '/tenant/ipd/discharge', icon: 'Receipt', sort: 15, plan: 'professional' },
        { label: 'Message Board', path: '/tenant/communication', icon: 'Dashboard', sort: 17, plan: 'basic' },
        { label: 'Mail Management', path: '/tenant/mail', icon: 'Receipt', sort: 18, plan: 'basic' },
        { label: 'Ticketing Management System', path: '/tenant/support', icon: 'Receipt', sort: 16, plan: 'basic' },
        { label: 'AI Lab Assistant', path: '/tenant/lab/ai', icon: 'Lab', sort: 9, plan: 'professional' },
        { label: 'Consultation Desk', path: '/tenant/opd/consultation', icon: 'Doctor', sort: 5, plan: 'basic' },
        { label: 'Staff & RBAC', path: '/tenant/staff', icon: 'Settings', sort: 20, plan: 'basic' },
      ];

      for (const menu of menusToAdd) {
        const existing = await prisma.$queryRawUnsafe(`SELECT id FROM "${schema}".rbac_menus WHERE label = '${menu.label}'`);
        let menuId;
        if (existing.length === 0) {
          const result = await prisma.$queryRawUnsafe(`
            INSERT INTO "${schema}".rbac_menus (label, path, icon, sort_order, required_plan)
            VALUES ('${menu.label}', '${menu.path}', '${menu.icon}', ${menu.sort}, '${menu.plan}')
            RETURNING id
          `);
          menuId = result[0].id;
        } else {
          menuId = existing[0].id;
        }

        // Link to ADMIN, DOCTOR and LAB roles
        await prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
          SELECT id, '${menuId}' FROM "${schema}".rbac_roles 
          WHERE name IN ('ADMIN', 'DOCTOR', 'LAB_TECH', 'LAB_ASSISTANT', 'NURSE', 'System Admin', 'Administrator', 'SUPERADMIN')
          ON CONFLICT DO NOTHING
        `);
      }

      // Delete deprecated menus from existing databases
      await prisma.$executeRawUnsafe(`
        DELETE FROM "${schema}".rbac_role_menus
        WHERE menu_id IN (SELECT id FROM "${schema}".rbac_menus WHERE label IN ('Insurance Management', 'Recruitment Hub', 'Benefits', 'Car Lease Program'))
      `);
      await prisma.$executeRawUnsafe(`
        DELETE FROM "${schema}".rbac_menus
        WHERE label IN ('Insurance Management', 'Recruitment Hub', 'Benefits', 'Car Lease Program')
      `);

      updated++;
    }
    res.json({ message: `Successfully synchronized system menus and tables for ${updated} shards. Please LOGOUT and LOGIN again to see changes.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Administrative Route to synchronize staff and patient schema across all shards
app.get("/api/nexus/fix-staff-and-patients", requireNexusAuth, async (req, res) => {
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants`);
    let updated = 0;
    
    // Also ensure Nexus registry is healed
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS ui_settings JSONB DEFAULT '{}'::jsonb`);
    await prisma.$executeRawUnsafe(`ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255)`);

    for (const t of tenants) {
      const schema = t.db_name;
      try {
        // Fix Patients table
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS ai_summary TEXT`);
        
        // Fix Users table (Staff)
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS age INTEGER`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS qualifications TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS experience_years INTEGER`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS specialization VARCHAR(100)`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS department VARCHAR(100)`);
        
        updated++;
      } catch (shardErr) {
        console.error(`Failed to heal shard ${schema}:`, shardErr.message);
      }
    }
    res.json({ message: `Successfully healed ${updated} shards. Staff fields and AI Summary columns are now present.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Administrative Route to synchronize ward categories for existing shards
app.get("/api/nexus/fix-ward-categories", requireNexusAuth, async (req, res) => {
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants WHERE plan IN ('Professional', 'Enterprise')`);
    let updated = 0;
    
    for (const t of tenants) {
      const schema = t.db_name;

      // 0. Ensure schema consistency
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${schema}".wards ADD COLUMN IF NOT EXISTS base_charge NUMERIC DEFAULT 0;
        ALTER TABLE "${schema}".wards ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 10;
        ALTER TABLE "${schema}".wards ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'Regular Care';
        ALTER TABLE "${schema}".wards ADD COLUMN IF NOT EXISTS floor VARCHAR(50);
      `);

      // 1. Update existing wards to standard categories for testing/demo
      await prisma.$executeRawUnsafe(`
        UPDATE "${schema}".wards SET type = 'Emergency' WHERE name ILIKE '%Emergency%' OR type = 'Critical Care';
        UPDATE "${schema}".wards SET type = 'ICU' WHERE name ILIKE '%ICU%';
        UPDATE "${schema}".wards SET type = 'Regular Care' WHERE name ILIKE '%General%' OR type = 'General' OR type IS NULL;
        UPDATE "${schema}".wards SET type = 'Daycare' WHERE name ILIKE '%Day%' OR type = 'Pediatric';
        UPDATE "${schema}".wards SET type = 'Special Care' WHERE name ILIKE '%Premium%' OR type = 'Premium';
        
        -- If no wards exist, create defaults
        INSERT INTO "${schema}".wards (name, floor, type, capacity, base_charge)
        SELECT 'Emergency Unit', 'Ground Floor', 'Emergency', 10, 2500 WHERE NOT EXISTS (SELECT 1 FROM "${schema}".wards WHERE type = 'Emergency');
        INSERT INTO "${schema}".wards (name, floor, type, capacity, base_charge)
        SELECT 'Main ICU', '1st Floor', 'ICU', 8, 5000 WHERE NOT EXISTS (SELECT 1 FROM "${schema}".wards WHERE type = 'ICU');
        INSERT INTO "${schema}".wards (name, floor, type, capacity, base_charge)
        SELECT 'Medical Ward A', '2nd Floor', 'Regular Care', 20, 1500 WHERE NOT EXISTS (SELECT 1 FROM "${schema}".wards WHERE type = 'Regular Care');
        INSERT INTO "${schema}".wards (name, floor, type, capacity, base_charge)
        SELECT 'Pediatric Daycare', 'Ground Floor', 'Daycare', 5, 1000 WHERE NOT EXISTS (SELECT 1 FROM "${schema}".wards WHERE type = 'Daycare');
      `);
      updated++;
    }
    res.json({ message: `Successfully synchronized ward categories for ${updated} shards.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Administrative Route to synchronize billing infrastructure (Queue & Discounts)
app.get("/api/nexus/fix-billing-infrastructure", requireNexusAuth, async (req, res) => {
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants`);
    let updated = 0;
    
    for (const t of tenants) {
      const schema = t.db_name;
      try {
        // 1. Create Billing Queue Table
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schema}".billing_queue (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              patient_id UUID NOT NULL,
              encounter_id UUID,
              source_module VARCHAR(50), 
              source_id UUID,            
              description TEXT,
              quantity NUMERIC DEFAULT 1,
              unit_price NUMERIC NOT NULL,
              tax_percent NUMERIC DEFAULT 0,
              is_discountable BOOLEAN DEFAULT TRUE,
              status VARCHAR(20) DEFAULT 'PENDING', 
              created_at TIMESTAMP DEFAULT NOW()
          );
        `);

        // 2. Add Discount Columns to Invoices
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".invoice_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".invoice_items ADD COLUMN IF NOT EXISTS source_queue_id UUID`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".invoice_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
        
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".lab_orders ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES "${schema}".patients(id)`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".lab_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".ipd_admissions ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMP DEFAULT NOW()`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".ipd_admissions ADD COLUMN IF NOT EXISTS discharged_at TIMESTAMP`);
        
        // 4. Comprehensive Patient Profile Healing
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS dob DATE`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS occupation VARCHAR(100)`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS address TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255)`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50)`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS medical_history TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}".patients ADD COLUMN IF NOT EXISTS allergies TEXT`);
        
        // 5. Insurance & TPA Infrastructure
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schema}".insurance_providers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) UNIQUE NOT NULL,
            tpa_name VARCHAR(255),
            contact_person VARCHAR(100),
            email VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS "${schema}".insurance_claims (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID REFERENCES "${schema}".patients(id),
            invoice_id UUID, -- Will link to invoices
            provider_id UUID REFERENCES "${schema}".insurance_providers(id),
            policy_number VARCHAR(100),
            insurer_id VARCHAR(100), -- Family/Individual ID
            claim_type VARCHAR(50), -- Cashless, Co-pay, Corporate, etc.
            status VARCHAR(50) DEFAULT 'PRE-AUTH PENDING',
            billed_amount NUMERIC DEFAULT 0,
            sanctioned_amount NUMERIC DEFAULT 0,
            reference_number VARCHAR(100), -- Billing Ref
            claim_number VARCHAR(100), -- TPA Claim ID
            remarks TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          );

          -- Seed default providers if empty
          INSERT INTO "${schema}".insurance_providers (name, tpa_name)
          VALUES 
            ('Star Health Insurance', 'Star TPA'),
            ('HDFC ERGO', 'HDFC TPA'),
            ('ICICI Lombard', 'Lombard TPA'),
            ('Apollo Munich', 'Apollo TPA'),
            ('Government Health Scheme', 'Govt TPA')
          ON CONFLICT DO NOTHING;
        `);

        updated++;
      } catch (shardErr) {
        console.error(`Failed to upgrade billing for shard ${schema}:`, shardErr.message);
      }
    }
    res.json({ message: `Successfully upgraded billing and insurance infrastructure for ${updated} shards.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Administrative Route to synchronize enterprise scheduling across all shards
app.get("/api/nexus/fix-enterprise-scheduling", requireNexusAuth, async (req, res) => {
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants`);
    let updated = 0;
    
    for (const t of tenants) {
      const schema = t.db_name;
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schema}".doctor_schedules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id UUID NOT NULL REFERENCES "${schema}".users(id),
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
          );

          CREATE TABLE IF NOT EXISTS "${schema}".doctor_leaves (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id UUID NOT NULL REFERENCES "${schema}".users(id),
            leave_type VARCHAR(50) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            start_time TIME,
            end_time TIME,
            reason TEXT,
            is_emergency BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS "${schema}".doctor_overrides (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id UUID NOT NULL REFERENCES "${schema}".users(id),
            override_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            is_available BOOLEAN DEFAULT true,
            reason TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);
        updated++;
      } catch (shardErr) {
        console.error(`Failed to upgrade scheduling for shard ${schema}:`, shardErr.message);
      }
    }
    res.json({ message: `Successfully synchronized Enterprise Scheduling infrastructure for ${updated} shards.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Administrative Route to synchronize Predictive & Event Infrastructure
app.get("/api/nexus/fix-predictive-infrastructure", requireNexusAuth, async (req, res) => {
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants`);
    let updated = 0;
    
    for (const t of tenants) {
      const schema = t.db_name;
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schema}".consultation_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            encounter_id UUID REFERENCES "${schema}".encounters(id),
            event_type VARCHAR(50) NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS "${schema}".consultation_predictions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            encounter_id UUID REFERENCES "${schema}".encounters(id),
            predicted_time_mins INTEGER,
            complexity VARCHAR(50),
            triage_priority INTEGER,
            reasoning TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `);
        updated++;
      } catch (shardErr) {
        console.error(`Failed to upgrade predictive infra for shard ${schema}:`, shardErr.message);
      }
    }
    res.json({ message: `Successfully synchronized Predictive & Event Infrastructure for ${updated} shards.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Seeding Endpoint (to prevent startup timeouts)

app.get("/api/nexus/seed-database", requireNexusAuth, async (req, res) => {
  try {
    console.log("[SEED] Production Clinical Setup Triggered...");
    await seedSamples();
    res.json({ message: "Production database seeding started. Please wait 10 seconds and refresh your app." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CORS configuration - Dynamic Origin for Multi-Platform Sync
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
  credentials: true
}));

app.use(express.json());

// Response Interceptor Middleware for rephrasing technical errors
// Skip AI rephrasing for ABHA/ABDM external API responses — these errors come
// from India's NHA ABDM gateway and should be passed through verbatim.
app.use((req, res, next) => {
  const isAbhaRoute = req.path.startsWith('/api/abha/');
  if (isAbhaRoute) return next();

  const originalJson = res.json;
  res.json = function (body) {
    if (res.statusCode >= 400 && body && body.error && typeof body.error === 'string') {
      const { rephraseError } = require("./services/aiService");
      rephraseError({ message: body.error, code: body.details, status: res.statusCode })
        .then((polishedMsg) => {
          body.error = polishedMsg;
          originalJson.call(res, body);
        })
        .catch((err) => {
          console.error("[ERROR_INTERCEPTOR] Rephrasing failed:", err.message);
          originalJson.call(res, body);
        });
      return res;
    }
    return originalJson.call(this, body);
  };
  next();
});

// Attach Prisma to req globally
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Health check before other middleware
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/health-db", async (req, res) => {
  try {
    const { Pool } = require('pg');
    const { dbQueryDuration, dbErrors } = require('./config/metrics').metrics || require('./config/metrics');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : false });
    const end = dbQueryDuration ? dbQueryDuration.startTimer({ query_type: 'health_check' }) : () => {};
    try {
      const result = await pool.query('SELECT current_schema(), now()');
      if (end) end();
      await pool.end();
      res.json({ 
        status: "ok", 
        db: "Raw Connection Success", 
        details: result.rows[0],
        url: process.env.DATABASE_URL ? "URL is present" : "URL is MISSING"
      });
    } catch (err) {
      if (end) end();
      try { dbErrors && dbErrors.inc({ query_type: 'health_check', error_type: err.code || 'UNKNOWN' }); } catch(e){}
      await pool.end().catch(()=>{});
      res.status(500).json({ 
        status: "error", 
        message: "Raw Connection Failed", 
        error: err.message,
        stack: err.stack?.substring(0, 100)
      });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Domain redirection middleware (domains configured via APP_DOMAIN / DEV_APP_DOMAIN env vars)
// Allows subdomain-based tenant routing (e.g., {tenant}.jioplix.com)
app.use((req, res, next) => {
  const host = req.headers.host || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1");
  const isExcludedPath = req.path.startsWith("/health") || 
                         req.path.startsWith("/api") || 
                         req.path.startsWith("/uploads") || 
                         req.path.startsWith("/metrics");

  if (isLocal || isExcludedPath) {
    return next();
  }

  const prodDomain = process.env.APP_DOMAIN;
  const devDomain = process.env.DEV_APP_DOMAIN;
  const isDevEnv = host.includes("-dev-") || host.startsWith("dev.");

  // Skip redirect if host has a subdomain (tenant-specific routing)
  const hostname = host.split(':')[0].toLowerCase();
  const parts = hostname.split('.');
  const hasSubdomain = parts.length >= 3 && !parts[0].startsWith('www');

  if (isDevEnv) {
    if (devDomain && !hasSubdomain && host !== devDomain && host !== `www.${devDomain}`) {
      return res.redirect(301, `https://${devDomain}${req.originalUrl}`);
    }
  } else {
    if (prodDomain && !hasSubdomain && host !== prodDomain && host !== `www.${prodDomain}`) {
      return res.redirect(301, `https://${prodDomain}${req.originalUrl}`);
    }
  }
  next();
});

// --- PROMETHEUS METRICS ENDPOINT (Vercel Optimized - Reads from DB) ---
// SECURITY: Prometheus metrics endpoint protected by bearer token.
// Set METRICS_TOKEN in .env. Prometheus scraper must include: Authorization: Bearer <token>
app.get("/metrics", async (req, res) => {
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken) {
    const provided = req.headers.authorization?.split(' ')[1];
    if (!provided || provided !== metricsToken) {
      return res.status(401).set('WWW-Authenticate', 'Bearer realm="metrics"').send('Unauthorized');
    }
  }
  try {
    // 1. Clear previous in-memory values to avoid stale data from previous invocations
    metrics.tenantDbSize.reset();
    metrics.tenantActiveUsers.reset();
    metrics.tenantTotalRecords.reset();

    // 2. Fetch latest actuals from the database
    const latestLogs = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT ON (tenant_id) l.*, t.name as tenant_name, t.plan
      FROM nexus.utilization_logs l
      JOIN nexus.tenants t ON l.tenant_id = t.id
      ORDER BY tenant_id, created_at DESC
    `);

    // 3. Populate Gauges for the current response
    for (const log of latestLogs) {
      metrics.tenantDbSize.set({ tenant_id: log.tenant_id, tenant_name: log.tenant_name, plan: log.plan }, parseFloat(log.db_size_mb));
      metrics.tenantActiveUsers.set({ tenant_id: log.tenant_id, tenant_name: log.tenant_name }, log.active_users);
      metrics.tenantTotalRecords.set({ tenant_id: log.tenant_id, tenant_name: log.tenant_name }, log.total_records);
    }

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    console.error("[METRICS] Failed to serve Prometheus metrics:", ex.message);
    res.status(500).end(ex.message);
  }
});

// --- BACKGROUND METRICS SYNC (Triggerable via Cron or Manual) ---
async function syncPrometheusMetrics() {
  try {
    console.log("[METRICS] Triggering Infrastructure-wide Actuals Sync...");
    const tenants = await prisma.$queryRawUnsafe(`SELECT id, name, db_name, plan FROM nexus.tenants`);
    
    for (const tenant of tenants) {
      const schema = tenant.db_name;
      const sizeResult = await prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))), 0) / 1024 / 1024 AS size_mb
        FROM pg_stat_user_tables
        WHERE schemaname = '${schema}'
      `);
      const sizeMb = parseFloat(sizeResult[0]?.size_mb || 0);
      
      let userCount = 0;
      let recordCount = 0;
      try {
        const counts = await prisma.$queryRawUnsafe(`
          SELECT 
            (SELECT COUNT(*) FROM "${schema}".users) as users,
            (SELECT COUNT(*) FROM "${schema}".patients) as patients
        `);
        userCount = Number(counts[0].users || 0);
        recordCount = Number(counts[0].patients || 0);
      } catch (e) {}

      // PERSIST to Database so /metrics can read it anytime
      await prisma.$executeRawUnsafe(`
        INSERT INTO nexus.utilization_logs (tenant_id, db_size_mb, total_records, active_users)
        VALUES ('${tenant.id}', ${sizeMb}, ${recordCount}, ${userCount})
      `);
    }
    console.log(`[METRICS] Successfully persisted actuals for ${tenants.length} tenants.`);
    return true;
  } catch (err) {
    console.error("[METRICS] Sync failed:", err.message);
    return false;
  }
}

// Route to trigger sync via Vercel Cron
app.get("/api/nexus/utilization/sync-actuals", requireNexusAuth, async (req, res) => {
  const success = await syncPrometheusMetrics();
  res.json({ success, message: success ? "Metrics synchronized" : "Sync failed" });
});

const os = require("os");
const isVercel = !!process.env.VERCEL;
const isAzure = !!process.env.WEBSITE_INSTANCE_ID;

let uploadDir;
if (process.env.STORAGE_PATH) {
  uploadDir = process.env.STORAGE_PATH;
} else if (isAzure) {
  uploadDir = path.join(process.env.HOME || '/home', 'site_uploads');
} else if (isVercel) {
  uploadDir = os.tmpdir();
} else {
  uploadDir = path.join(__dirname, "../uploads");
}

app.use("/uploads", express.static(uploadDir));

app.use(audit);
app.use("/api", routes);

// Serve static assets from React frontend client/dist
app.use(express.static(path.join(__dirname, "../../client/dist")));

// Fallback for SPA routing to serve index.html for any non-API routes
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next();
  }
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

app.use((err, req, res, next) => {
  console.error("--- ERROR ---");
  console.error(err);
  console.error("-------------");
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    details: err.code || null
  });
});

module.exports = app;