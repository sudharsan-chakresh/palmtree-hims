const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { si } = require('../../middleware/sanitize');
const { loginLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// Master credentials from environment
const NEXUS_USER = process.env.NEXUS_ADMIN_USER;
const NEXUS_PASS = process.env.NEXUS_ADMIN_PASSWORD;

const RESERVED_SUBDOMAINS = ['dev', 'staging', 'stage', 'test', 'www', 'api', 'app', 'mail', 'admin', 'support', 'help', 'docs', 'status', 'uat', 'qa'];

function extractSubdomain(host) {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('::1')) return null;
  const parts = hostname.split('.');
  if (parts.length >= 3 && !RESERVED_SUBDOMAINS.includes(parts[0])) return parts[0];
  return null;
}

// SECURITY: Rate limited to 5 attempts per IP per 15 minutes to prevent brute-force attacks.
router.post("/login", loginLimiter, async (req, res) => {
  const { type: incomingType, facility, email, password } = req.body;
  const type = incomingType === "nexus" ? "nexus" : "tenant";
  const landingPage = type === "nexus" ? "/nexus/dashboard" : "/tenant/dashboard";

  try {
    console.log(`[AUTH] Login attempt for ${email} as ${type} in ${facility || 'domain-auto'}`);

    // 1. Master Bypass (For Nexus Login specifically)
    if (email === NEXUS_USER && password === NEXUS_PASS && type === "nexus") {
      console.log(`[AUTH] Master credential bypass triggered for Nexus`);
      const token = jwt.sign({ 
        user: email, 
        tenantId: "nexus", 
        type: "nexus", 
        role: "nexus" 
      }, process.env.JWT_SECRET, { expiresIn: "8h" });

      return res.json({ 
        token, 
        tenantId: "nexus", 
        type: "nexus", 
        landingPage: "/nexus/dashboard", 
        role: "nexus", 
        userName: "Master Admin" 
      });
    }

    // 2. Resolve facility from domain if not provided explicitly
    let resolvedFacility = facility;
    if (type === "tenant" && !resolvedFacility) {
      const subdomain = extractSubdomain(req.headers.host);
      if (subdomain) {
        // SECURITY: subdomain from Host header — use positional param
        const domainTenants = await req.prisma.$queryRawUnsafe(
          `SELECT id FROM nexus.tenants WHERE domain = $1`,
          subdomain
        );
        if (domainTenants && domainTenants.length > 0) {
          resolvedFacility = domainTenants[0].id;
          console.log(`[AUTH] Resolved facility from domain: ${subdomain} -> ${resolvedFacility}`);
        }
      }
    }

    // 3. Standard Tenant Login (with Force-Sync)
    if (type === "tenant" && resolvedFacility) {
      // SECURITY: resolvedFacility from user input — positional param
      const tenants = await req.prisma.$queryRawUnsafe(
        `SELECT db_name, name, code, plan, ui_settings FROM nexus.tenants WHERE id::text = $1 OR code = $1`,
        String(resolvedFacility).trim()
      );
      
      if (tenants && tenants.length > 0) {
        // SECURITY: schema name comes from our own DB record — validate as safe identifier
        const schema = si(tenants[0].db_name.toLowerCase());
        const tenantName = tenants[0].name;

        // SECURITY: email from user input — positional param
        let users = await req.prisma.$queryRawUnsafe(
          `SELECT * FROM "${schema}".users WHERE LOWER(email) = LOWER($1)`,
          String(email).trim()
        );
        
        // --- FORCE SYNC LOGIC (Superadmin Only) ---
        if (email === NEXUS_USER && NEXUS_PASS && password === NEXUS_PASS) {
           const hashedPassword = await bcrypt.hash(password, 10);
           if (users.length === 0) {
              await req.prisma.$executeRawUnsafe(
                `INSERT INTO "${schema}".users (name, email, password_hash, role) VALUES ('System Admin', $1, $2, 'admin')`,
                String(email).trim(), hashedPassword
              );
           } else {
              await req.prisma.$executeRawUnsafe(
                `UPDATE "${schema}".users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)`,
                hashedPassword, String(email).trim()
              );
           }
           users = await req.prisma.$queryRawUnsafe(
             `SELECT * FROM "${schema}".users WHERE LOWER(email) = LOWER($1)`,
             String(email).trim()
           );
        }

        if (users && users.length > 0) {
          const user = users[0];
          const match = await bcrypt.compare(password, user.password_hash);
          if (match) {
            // --- DYNAMIC RBAC LOADING ---
            // Normalize plan to lowercase — DB may store as 'Standard', 'Professional', etc.
            const tenantPlan = (tenants[0].plan || 'basic').toLowerCase();
            
            // --- DEEP SELF-HEALING: Ensure RBAC Infrastructure Exists ---
            try {
              await req.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "${schema}".rbac_roles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(50) UNIQUE NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS "${schema}".rbac_menus (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    label VARCHAR(100) UNIQUE NOT NULL,
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

                -- Ensure uniqueness for ON CONFLICT
                ALTER TABLE "${schema}".rbac_menus ADD CONSTRAINT rbac_menus_label_key UNIQUE (label);
              `);
            } catch (e) {
              if (!e.message.includes("already exists")) {
                 console.warn(`[AUTH] RBAC Schema Hardening skipped or failed for ${schema}: ${e.message}`);
              }
            }

            try {
              await req.prisma.$executeRawUnsafe(`
                -- Seed HIPAA Compliant Roles if empty
                INSERT INTO "${schema}".rbac_roles (name, description) VALUES 
                ('ADMIN', 'Full system access with PII masking for audit purposes'),
                ('DOCTOR', 'Clinical access to full patient information for treatment'),
                ('NURSE', 'Clinical access to patient information for care delivery'),
                ('PHARMACIST', 'Access to pharmacy functions with masked patient PII'),
                ('LAB_ASSISTANT', 'Access to laboratory functions with masked patient PII'),
                ('RECEPTIONIST', 'Front desk access with limited patient PII'),
                ('SUPPORT', 'Administrative support with masked patient PII')
                ON CONFLICT (name) DO NOTHING;

                -- Seed HIPAA Permissions if empty
                INSERT INTO "${schema}".rbac_permissions (key, description) VALUES
                ('PATIENT_PII_VIEW_FULL', 'Ability to view complete unmasked patient information'),
                ('PATIENT_PII_VIEW_MASKED', 'Ability to view masked patient information (limited PII)'),
                ('PATIENT_PII_VIEW_DEIDENTIFIED', 'Ability to view de-identified patient information only'),
                ('CLINICAL_ACCESS_FULL', 'Full clinical access including diagnosis, prescriptions, vitals'),
                ('CLINICAL_ACCESS_LIMITED', 'Limited clinical access with PII masking'),
                ('PHARMACY_ACCESS_FULL', 'Full pharmacy access including patient PII'),
                ('PHARMACY_ACCESS_MASKED', 'Pharmacy access with masked patient PII'),
                ('LAB_ACCESS_FULL', 'Full laboratory access including patient PII'),
                ('LAB_ACCESS_MASKED', 'Laboratory access with masked patient PII'),
                ('FRONT_DESK_ACCESS_FULL', 'Full front desk access including patient PII'),
                ('FRONT_DESK_ACCESS_MASKED', 'Front desk access with masked patient PII'),
                ('USER_MANAGE', 'Ability to manage user accounts and roles'),
                ('ROLE_MANAGE', 'Ability to manage role assignments and permissions'),
                ('SYSTEM_CONFIG', 'Ability to modify system settings and configurations'),
                ('AUDIT_VIEW', 'Ability to view audit logs and compliance reports'),
                ('DATA_EXPORT', 'Ability to export system data (with compliance checks)'),
                ('BILLING_ACCESS_FULL', 'Full access to billing and financial information'),
                ('BILLING_ACCESS_MASKED', 'Limited billing access with PII masking'),
                ('IPD_MANAGE', 'Ability to manage IPD admissions and bed assignments'),
                ('EMERGENCY_OVERRIDE', 'Ability to override access controls in emergency situations')
                ON CONFLICT (key) DO NOTHING;

                -- Seed Menus if empty
                INSERT INTO "${schema}".rbac_menus (label, path, icon, required_plan, sort_order) VALUES
                ('OPD Registration', '/tenant/opd/registration', 'UserPlus', 'basic', 1),
                ('OPD Queue', '/tenant/opd/queue', 'Users', 'basic', 2),
                ('Doctor''s Queue', '/tenant/opd/doctor-queue', 'Activity', 'basic', 3),
                ('Consultation Desk', '/tenant/opd/consultation', 'Stethoscope', 'basic', 4),
                ('Appointment List', '/tenant/appointments', 'Calendar', 'basic', 5),
                ('Doctor Availability and Book Appointments', '/tenant/appointments/doctor-calendar', 'Calendar', 'basic', 6),
                ('Admission Desk', '/tenant/ipd/admission-desk', 'Building', 'basic', 7),
                ('IPD Bed Map', '/tenant/ipd/beds', 'Map', 'basic', 8),
                ('Laboratory', '/tenant/lab', 'FlaskConical', 'standard', 9),
                ('Pharmacy Dashboard', '/tenant/pharmacy/dashboard', 'Pill', 'standard', 10),
                ('Stock Inventory', '/tenant/pharmacy/inventory', 'Package', 'standard', 11),
                ('Prescription Queue', '/tenant/pharmacy/queue', 'Receipt', 'standard', 12),
                ('Staff & RBAC', '/tenant/staff', 'Users', 'professional', 13),
                ('Hospital Settings', '/tenant/masters', 'Settings', 'professional', 14),
                ('Help & Support', '/tenant/support', 'HelpCircle', 'basic', 15),
                ('Ticketing Management System', '/tenant/support/tickets', 'Ticket', 'basic', 16),
                ('Dashboard', '/tenant/dashboard', 'Dashboard', 'basic', 0),
                ('Invoicing & Billing', '/billing', 'Billing', 'basic', 17),
                ('IPD Census & Daycare', '/tenant/ipd/admissions', 'Clipboard', 'professional', 19),
                ('Discharge Summaries', '/tenant/ipd/discharge', 'Receipt', 'professional', 20)
                ON CONFLICT (label) DO NOTHING;

                -- Link All Menus to ADMIN
                INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
                SELECT r.id, m.id 
                FROM "${schema}".rbac_roles r
                CROSS JOIN "${schema}".rbac_menus m
                WHERE r.name = 'ADMIN'
                ON CONFLICT (role_id, menu_id) DO NOTHING;

                -- Link specific Menus to other Roles
                INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
                SELECT r.id, m.id 
                FROM "${schema}".rbac_roles r
                CROSS JOIN "${schema}".rbac_menus m
                WHERE r.name IN ('DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_ASSISTANT')
                AND m.label IN (
                  'Dashboard', 'OPD Registration', 'OPD Queue', 'Doctor''s Queue', 'Consultation Desk', 
                  'Appointment List', 'Doctor Availability and Book Appointments', 'Admission Desk', 'IPD Bed Map',
                  'Laboratory', 'Pharmacy Dashboard', 'Stock Inventory', 'Prescription Queue',
                  'Staff & RBAC', 'Hospital Settings', 'Help & Support', 'Ticketing Management System'
                )
                ON CONFLICT (role_id, menu_id) DO NOTHING;
              `);
            } catch (e) {
              console.warn(`[AUTH] RBAC Schema Hardening skipped or failed for ${schema}: ${e.message}`);
            }

            // Cleanup deprecated menus
            try {
              await req.prisma.$executeRawUnsafe(`
                DELETE FROM "${schema}".rbac_role_menus
                WHERE menu_id IN (SELECT id FROM "${schema}".rbac_menus WHERE label IN ('Insurance Management', 'Recruitment Hub', 'Benefits', 'Car Lease Program'))
              `);
              await req.prisma.$executeRawUnsafe(`
                DELETE FROM "${schema}".rbac_menus
                WHERE label IN ('Insurance Management', 'Recruitment Hub', 'Benefits', 'Car Lease Program')
              `);
            } catch (e) {
              console.warn(`[AUTH] Deprecated menu cleanup skipped for ${schema}: ${e.message}`);
            }

            // 1. Fetch User Role (with Fallback)
            let roleName = user.role;
            let roleId = null;
            console.log(`[AUTH_DEBUG] User role from users table: "${roleName}", schema: "${schema}"`);
            try {
              const roleData = await req.prisma.$queryRawUnsafe(`
                SELECT r.name, r.id 
                FROM "${schema}".rbac_roles r
                JOIN "${schema}".rbac_user_roles ur ON r.id = ur.role_id
                WHERE ur.user_id = '${user.id}'
              `);
              
              if (roleData.length > 0) {
                roleName = roleData[0].name;
                roleId = roleData[0].id;
                console.log(`[AUTH_DEBUG] Found role in rbac_roles: "${roleName}" (ID: ${roleId})`);
              } else {
                // --- SELF-HEALING RBAC ---
                // If link is missing, try to link based on users.role column
                console.log(`[AUTH] RBAC link missing for ${email}, attempting self-healing...`);
                
                // Map legacy roles to HIPAA roles
                const roleMapping = {
                  'admin': 'ADMIN',
                  'administrator': 'ADMIN',
                  'doctor': 'DOCTOR', 
                  'nurse': 'NURSE',
                  'pharmacist': 'PHARMACIST',
                  'lab_tech': 'LAB_ASSISTANT',
                  'lab_assistant': 'LAB_ASSISTANT',
                  'receptionist': 'RECEPTIONIST',
                  'support': 'SUPPORT',
                  'staff': 'SUPPORT'
              };
                
                const mappedRole = roleMapping[user.role?.toLowerCase()] || 'SUPPORT';
                const matchedRoles = await req.prisma.$queryRawUnsafe(`
                  SELECT id, name FROM "${schema}".rbac_roles WHERE LOWER(name) = LOWER('${mappedRole}')
                `);
                if (matchedRoles.length > 0) {
                  roleId = matchedRoles[0].id;
                  roleName = matchedRoles[0].name;
                  await req.prisma.$executeRawUnsafe(`
                    INSERT INTO "${schema}".rbac_user_roles (user_id, role_id) 
                    VALUES ('${user.id}', '${roleId}') 
                    ON CONFLICT DO NOTHING
                  `);
                  console.log(`[AUTH] RBAC self-healed: Linked ${email} to role ${roleName}`);
                }
              }
            } catch (e) {
              console.warn(`[AUTH] RBAC table fetch failed in ${schema}, using legacy role: ${roleName}`);
            }

            // 2. Fetch Authorized Menus (Filtered by 4-Tier Subscription Plan)
            let authorizedMenus = [];
            if (roleId) {
              try {
                // --- DEEP SELF-HEALING: BOOTSTRAP MISSING RBAC DATA ---
                const menuCheck = await req.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${schema}".rbac_menus`);
                if (parseInt(menuCheck[0].count) === 0) {
                  console.log(`[AUTH] RBAC Menus missing in ${schema}, bootstrapping standard set...`);
                  
                  // Bootstrap Menus
                  await req.prisma.$executeRawUnsafe(`
                    INSERT INTO "${schema}".rbac_menus (label, path, icon, sort_order, required_plan) VALUES
                    ('Dashboard', '/tenant/dashboard', 'Dashboard', 1, 'basic'),
                    ('OPD Registration', '/tenant/opd/registration', 'OPD', 2, 'basic'),
                    ('Doctor''s Queue', '/tenant/opd/queue', 'Doctor', 3, 'basic'),
                    ('Doctor Availability and Book Appointments', '/tenant/appointments/doctor-calendar', 'Calendar', 4, 'basic'),
                    ('Invoicing & Billing', '/billing', 'Billing', 10, 'basic'),
                    ('Branding & UI Settings', '/tenant/settings', 'Dashboard', 12, 'basic'),
                    ('Staff & RBAC', '/tenant/staff', 'Doctor', 13, 'basic'),
                    ('Help & Support', '/tenant/support', 'Receipt', 16, 'basic'),
                    ('Laboratory', '/tenant/lab', 'Lab', 4, 'standard'),
                    ('Pharmacy Dashboard', '/tenant/pharmacy/dashboard', 'Pharmacy', 5, 'standard'),
                    ('Stock Inventory', '/tenant/pharmacy/inventory', 'Pill', 6, 'standard'),
                    ('Prescription Queue', '/tenant/pharmacy/queue', 'Receipt', 7, 'standard'),
                    ('Hospital Settings (Masters)', '/tenant/masters', 'Settings', 11, 'standard'),
                    ('IPD Bed Map', '/tenant/ipd/beds', 'Bed', 8, 'professional'),
                    ('IPD Admission Desk', '/tenant/ipd/admission-desk', 'Clipboard', 9, 'professional'),
                    ('IPD Census & Daycare', '/tenant/ipd/admissions', 'Clipboard', 14, 'professional'),
                    ('Discharge Summaries', '/tenant/ipd/discharge', 'Receipt', 15, 'professional')
                    ON CONFLICT (label) DO NOTHING
                  `);

                  // Bootstrap Role-Menu Mappings (Admin)
                  await req.prisma.$executeRawUnsafe(`
                    INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
                    SELECT '${roleId}', id FROM "${schema}".rbac_menus WHERE '${roleName}' = 'ADMIN'
                    ON CONFLICT DO NOTHING
                  `);

                  // Bootstrap Role-Menu Mappings (Doctor)
                  await req.prisma.$executeRawUnsafe(`
                    INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
                    SELECT r.id, m.id FROM "${schema}".rbac_roles r, "${schema}".rbac_menus m 
                    WHERE r.name = 'DOCTOR' AND m.label IN ('Dashboard', 'Doctor''s Queue', 'Laboratory', 'IPD Census', 'Bed Map')
                    ON CONFLICT DO NOTHING
                  `);
                  
                  // Bootstrap Role-Menu Mappings (Nurse/Support)
                  await req.prisma.$executeRawUnsafe(`
                    INSERT INTO "${schema}".rbac_role_menus (role_id, menu_id)
                    SELECT r.id, m.id FROM "${schema}".rbac_roles r, "${schema}".rbac_menus m 
                    WHERE r.name = 'NURSE' AND m.label IN ('Dashboard', 'IPD Census', 'Bed Map')
                    ON CONFLICT DO NOTHING
                  `);

                  // Cleanup deprecated menus
                  await req.prisma.$executeRawUnsafe(`
                    DELETE FROM "${schema}".rbac_role_menus
                    WHERE menu_id IN (SELECT id FROM "${schema}".rbac_menus WHERE label IN ('Insurance Management', 'Recruitment Hub', 'Benefits', 'Car Lease Program'))
                  `);
                  await req.prisma.$executeRawUnsafe(`
                    DELETE FROM "${schema}".rbac_menus
                    WHERE label IN ('Insurance Management', 'Recruitment Hub', 'Benefits', 'Car Lease Program')
                  `);
                }

                const allowedPlans = ['basic'];
                if (['standard', 'professional', 'enterprise'].includes(tenantPlan)) allowedPlans.push('standard');
                if (['professional', 'enterprise'].includes(tenantPlan)) allowedPlans.push('professional');
                if (['enterprise'].includes(tenantPlan)) allowedPlans.push('enterprise');
                console.log(`[AUTH_DEBUG] Plan: ${tenantPlan}, allowed tiers: [${allowedPlans.join(', ')}]`);

                const planFilter = allowedPlans.map(p => `'${p}'`).join(',');

                authorizedMenus = await req.prisma.$queryRawUnsafe(`
                  SELECT m.label, m.path, m.icon 
                  FROM "${schema}".rbac_menus m
                  JOIN "${schema}".rbac_role_menus rm ON m.id = rm.menu_id
                  WHERE rm.role_id = '${roleId}' 
                  AND m.required_plan IN (${planFilter})
                  ORDER BY m.sort_order ASC
                `);
                console.log(`[AUTH_DEBUG] Authorized menus count: ${authorizedMenus.length} for roleId: ${roleId}`);
              } catch (e) {
                console.warn(`[AUTH] RBAC menu tables or bootstrap failed in ${schema}: ${e.message}`);
              }

            }

            // 3. Fetch Permissions
            let permissions = [];
            if (roleId) {
              try {
                const perms = await req.prisma.$queryRawUnsafe(`
                  SELECT p.key 
                  FROM "${schema}".rbac_permissions p
                  JOIN "${schema}".rbac_role_permissions rp ON p.id = rp.permission_id
                  WHERE rp.role_id = '${roleId}'
                `);
                permissions = perms.map(p => p.key);
              } catch (e) {
                console.warn(`[AUTH] RBAC permission tables not found in ${schema}`);
              }
            }

            // Normalize role to lowercase for consistent frontend consumption
            const normalizedRole = roleName ? roleName.toLowerCase() : 'staff';

            const token = jwt.sign({ 
              user: user.email, 
              tenantId: resolvedFacility, 
              type, 
              role: normalizedRole,
              permissions 
            }, process.env.JWT_SECRET, { expiresIn: "8h" });

            return res.json({ 
              token, 
              tenantId: resolvedFacility, 
              tenantName: tenants[0].name || tenantName, 
              tenantPlan,
              type, 
              landingPage, 
              role: normalizedRole, 
              userName: user.name,
              userId: user.id,
              isManager: user.is_manager || false,
              menus: authorizedMenus,
              permissions: permissions,
              uiSettings: tenants[0].ui_settings || {}
            });
          }
        }
      }
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    console.error("[AUTH] Login error:", err.message);
    res.status(500).json({ error: "Authentication service unavailable" });
  }
});

router.get("/me", (req, res) => {
  res.json({ user: req.user || null });
});

module.exports = router;