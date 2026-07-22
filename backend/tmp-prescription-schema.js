require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.chdir(__dirname);
const { prisma } = require('./src/config/prisma');
(async () => {
  try {
    const tenantId = '4a54b84a-b0c1-4269-aaef-1c279de908dc';
    const tenants = await prisma.$queryRawUnsafe(`SELECT db_name FROM nexus.tenants WHERE id = '${tenantId}' OR code = '${tenantId}'`);
    console.log('tenant rows', tenants);
    const schema = tenants[0]?.db_name;
    const cols = await prisma.$queryRawUnsafe(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = 'prescriptions' ORDER BY ordinal_position`);
    console.log('prescription columns', cols);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
