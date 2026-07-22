const { prisma } = require('../config/prisma');

async function main() {
  try {
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'nexus' AND table_name = 'tenants'
    `);
    console.log('Columns in nexus.tenants:', cols);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
