/**
 * Fix Menu Seeding for Current Tenant
 * ==================================
 * This script manually triggers RBAC menu seeding for debugging
 */

require('dotenv').config();
const { getPrisma } = require('../config/prisma');

async function fixMenuSeeding() {
  const prisma = getPrisma();
  
  try {
    console.log('🔧 Fixing menu seeding for current tenant...\n');
    
    // Get all active tenants
    const tenants = await prisma.$queryRaw`SELECT id, name, db_name FROM nexus.tenants`;
    
    for (const tenant of tenants) {
      console.log(`\n📋 Processing tenant: ${tenant.name} (${tenant.db_name})`);
      
      try {
        // Manually run the menu seeding logic
        await prisma.$executeRawUnsafe(`
          -- Ensure tables exist
          CREATE TABLE IF NOT EXISTS "${tenant.db_name}".rbac_roles (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR(50) NOT NULL,
              description TEXT,
              created_at TIMESTAMP DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS "${tenant.db_name}".rbac_menus (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              label VARCHAR(100) NOT NULL,
              path VARCHAR(100) NOT NULL,
              icon VARCHAR(50),
              required_plan VARCHAR(50) DEFAULT 'basic',
              parent_id UUID,
              sort_order INT DEFAULT 0
          );
          
          CREATE TABLE IF NOT EXISTS "${tenant.db_name}".rbac_permissions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              key VARCHAR(100) NOT NULL,
              description TEXT
          );
          
          CREATE TABLE IF NOT EXISTS "${tenant.db_name}".rbac_role_menus (
              role_id UUID,
              menu_id UUID,
              PRIMARY KEY (role_id, menu_id)
          );

          -- Self-heal: Add missing columns
          ALTER TABLE "${tenant.db_name}".rbac_roles ADD COLUMN IF NOT EXISTS description TEXT;
          ALTER TABLE "${tenant.db_name}".rbac_menus ADD COLUMN IF NOT EXISTS required_plan VARCHAR(50) DEFAULT 'basic';
          
          -- REFACTOR: Update old labels to new labels
          UPDATE "${tenant.db_name}".rbac_menus 
          SET label = 'Doctor Availability and Book Appointments' 
          WHERE label = 'Doctor Calendar';

          -- Seed roles using NOT EXISTS to avoid constraint issues
          INSERT INTO "${tenant.db_name}".rbac_roles (name, description)
          SELECT 'ADMIN', 'Full system access with PII masking for audit purposes'
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_roles WHERE name = 'ADMIN');
          
          INSERT INTO "${tenant.db_name}".rbac_roles (name, description)
          SELECT 'DOCTOR', 'Clinical access to full patient information for treatment'
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_roles WHERE name = 'DOCTOR');
          
          INSERT INTO "${tenant.db_name}".rbac_roles (name, description)
          SELECT 'NURSE', 'Clinical access to patient information for care delivery'
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_roles WHERE name = 'NURSE');
          
          INSERT INTO "${tenant.db_name}".rbac_roles (name, description)
          SELECT 'PHARMACIST', 'Access to pharmacy functions with masked patient PII'
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_roles WHERE name = 'PHARMACIST');
          
          INSERT INTO "${tenant.db_name}".rbac_roles (name, description)
          SELECT 'LAB_ASSISTANT', 'Access to laboratory functions with masked patient PII'
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_roles WHERE name = 'LAB_ASSISTANT');
          
          INSERT INTO "${tenant.db_name}".rbac_roles (name, description)
          SELECT 'RECEPTIONIST', 'Front desk access with limited patient PII'
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_roles WHERE name = 'RECEPTIONIST');
          
          INSERT INTO "${tenant.db_name}".rbac_roles (name, description)
          SELECT 'SUPPORT', 'Administrative support with masked patient PII'
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_roles WHERE name = 'SUPPORT');

          -- Seed menus using NOT EXISTS
          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'OPD Registration', '/tenant/opd/registration', 'UserPlus', 'basic', 1
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'OPD Registration');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'OPD Queue', '/tenant/opd/queue', 'Users', 'basic', 2
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'OPD Queue');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Doctor''s Queue', '/tenant/opd/doctor-queue', 'Activity', 'basic', 3
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Doctor''s Queue');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Consultation Desk', '/tenant/opd/consultation', 'Stethoscope', 'basic', 4
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Consultation Desk');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Appointment List', '/tenant/appointments', 'Calendar', 'basic', 5
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Appointment List');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Doctor Availability and Book Appointments', '/tenant/appointments/doctor-calendar', 'Calendar', 'basic', 6
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Doctor Availability and Book Appointments');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Admission Desk', '/tenant/ipd/admission-desk', 'Building', 'basic', 7
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Admission Desk');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'IPD Bed Map', '/tenant/ipd/beds', 'Map', 'basic', 8
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'IPD Bed Map');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Laboratory', '/tenant/lab', 'FlaskConical', 'standard', 9
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Laboratory');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Pharmacy Dashboard', '/tenant/pharmacy/dashboard', 'Pill', 'standard', 10
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Pharmacy Dashboard');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Stock Inventory', '/tenant/pharmacy/inventory', 'Package', 'standard', 11
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Stock Inventory');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Prescription Queue', '/tenant/pharmacy/queue', 'Receipt', 'standard', 12
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Prescription Queue');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Staff & RBAC', '/tenant/staff', 'Users', 'professional', 13
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Staff & RBAC');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Hospital Settings', '/tenant/masters', 'Settings', 'professional', 14
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Hospital Settings');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Help & Support', '/tenant/support', 'HelpCircle', 'basic', 15
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Help & Support');

          INSERT INTO "${tenant.db_name}".rbac_menus (label, path, icon, required_plan, sort_order)
          SELECT 'Ticketing Management System', '/tenant/support/tickets', 'Ticket', 'basic', 16
          WHERE NOT EXISTS (SELECT 1 FROM "${tenant.db_name}".rbac_menus WHERE label = 'Ticketing Management System');

          -- Benefits, Car Lease Program, Insurance Management, and Recruitment Hub have been removed

          -- Link roles to menus
          INSERT INTO "${tenant.db_name}".rbac_role_menus (role_id, menu_id)
          SELECT r.id, m.id 
          FROM "${tenant.db_name}".rbac_roles r
          CROSS JOIN "${tenant.db_name}".rbac_menus m
          WHERE r.name IN ('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
          AND m.label IN (
            'OPD Registration', 'OPD Queue', 'Doctor''s Queue', 'Consultation Desk', 
            'Appointment List', 'Doctor Availability and Book Appointments', 'Admission Desk', 'IPD Bed Map',
            'Laboratory', 'Pharmacy Dashboard', 'Stock Inventory', 'Prescription Queue',
            'Staff & RBAC', 'Hospital Settings', 'Help & Support', 'Ticketing Management System'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "${tenant.db_name}".rbac_role_menus rm 
            WHERE rm.role_id = r.id AND rm.menu_id = m.id
          );
        `);
        
        // Check what menus exist now
        const menus = await prisma.$queryRawUnsafe(`
          SELECT label, path, sort_order FROM "${tenant.db_name}".rbac_menus 
          ORDER BY sort_order ASC
        `);
        
        console.log(`✅ Menus seeded for ${tenant.name}:`);
        menus.forEach(menu => {
          console.log(`   ${menu.sort_order}. ${menu.label} → ${menu.path}`);
        });
        
      } catch (error) {
        console.error(`❌ Error processing ${tenant.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 Menu seeding completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Clear your browser localStorage');
    console.log('2. Logout and login again');
    console.log('3. Check sidebar for "Doctor Availability and Book Appointments"');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  fixMenuSeeding();
}

module.exports = { fixMenuSeeding };
