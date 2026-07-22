require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getPrisma } = require('./src/config/prisma');

(async () => {
  const prisma = getPrisma();
  try {
    const tenants = await prisma.$queryRawUnsafe(`SELECT id, db_name, name FROM nexus.tenants LIMIT 10`);
    if (!tenants || tenants.length === 0) {
      console.error('No tenants found in nexus.tenants');
      process.exit(1);
    }

    // prefer wellness_clinics___standard if present
    let tenant = tenants.find(t => (t.db_name || '').toLowerCase().includes('wellness')) || tenants[0];
    console.log('Using tenant:', tenant);

    const schema = tenant.db_name.toLowerCase();
    const patients = await prisma.$queryRawUnsafe(`SELECT id, name FROM "${schema}".patients LIMIT 1`);
    if (!patients || patients.length === 0) {
      console.error(`No patients found in tenant schema ${schema}`);
      process.exit(1);
    }

    const patient = patients[0];
    console.log('Found patient:', patient);

    // Post complaint via fetch
    const resp = await fetch(`http://localhost:4000/api/public/patients/${patient.id}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenant.id.toString(),
      },
      body: JSON.stringify({ complaint: 'Automated test complaint from tmp script', notes: 'Test notes' }),
    });

    const body = await resp.text();
    console.log('Response status:', resp.status);
    console.log('Response body:', body);
  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    try { await prisma.$disconnect(); } catch(e){}
  }
})();
