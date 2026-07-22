const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { prisma } = require('../config/prisma');

async function main() {
  try {
    const tenants = await prisma.$queryRawUnsafe(`
      SELECT id, name, db_name, plan FROM nexus.tenants
    `);
    console.log('--- Active Tenants ---');
    console.log(tenants);

    for (const t of tenants) {
      console.log(`\nChecking schema: "${t.db_name}" (${t.name})`);
      
      // Check if medicines table exists and print count
      try {
        const medCount = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int as count FROM "${t.db_name}".medicines
        `);
        console.log(`- medicines count: ${medCount[0].count}`);
        if (medCount[0].count > 0) {
          const sampleMeds = await prisma.$queryRawUnsafe(`
            SELECT id, name, category, stock_quantity, unit_price FROM "${t.db_name}".medicines LIMIT 5
          `);
          console.log('  Sample medicines:', sampleMeds);
        }
      } catch (err) {
        console.log(`- Error querying medicines: ${err.message}`);
      }

      // Check if pharmacy_inwards exists
      try {
        const inwardCount = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int as count FROM "${t.db_name}".pharmacy_inwards
        `);
        console.log(`- pharmacy_inwards count: ${inwardCount[0].count}`);
      } catch (err) {
        console.log(`- Error querying pharmacy_inwards: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
