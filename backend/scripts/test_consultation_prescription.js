// Test script to invoke consultation POST handler with mocked prisma
const path = require('path');
const consultationRouter = require('../src/modules/consultation');

// Find the POST '/' route handler
function findPostRootHandler(router) {
  if (!router || !router.stack) return null;
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === '/' && layer.route.methods && layer.route.methods.post) {
      // return the first handler
      return layer.route.stack[0].handle;
    }
  }
  return null;
}

const handler = findPostRootHandler(consultationRouter);
if (!handler) {
  console.error('Could not find consultation POST / handler');
  process.exit(1);
}

// Mock prisma
const mockPrisma = {
  async $queryRawUnsafe(sql) {
    // simple pattern matches
    if (sql.includes('INSERT INTO') && sql.includes('encounters') && sql.includes('RETURNING id')) {
      return [{ id: 'enc-TEST-1' }];
    }
    if (sql.includes('INSERT INTO') && sql.includes('prescriptions') && sql.includes('RETURNING id')) {
      return [{ id: 'pres-TEST-1' }];
    }
    if (sql.includes('SELECT u.name, s.base_consultation_fee')) {
      return [{ name: 'Dr. Test', fee: 500 }];
    }
    if (sql.includes('SELECT unit_price FROM') && sql.includes('medicines')) {
      return []; // no price found
    }
    if (sql.includes('SELECT patient_id FROM') && sql.includes('encounters')) {
      return [{ patient_id: 'patient-TEST-1' }];
    }
    // default
    return [];
  },
  async $executeRawUnsafe(sql) {
    // pretend success
    return { success: true };
  }
};

// Mock req, res
const req = {
  body: {
    patientId: 'patient-TEST-1',
    doctorId: 'doctor-TEST-1',
    diagnosis: 'Test Dx',
    notes: 'Test notes',
    vitals: { bp: '120/80', pulse: '72', temp: '37.0' },
    complaints: ['cough'],
    prescriptions: [
      { drugName: "Paracetamol 500mg", dosage: '1 Tab', frequency: '1-1-1', duration: '5 Days', instructions: 'After food' }
    ],
    followUpDate: null
  },
  prisma: mockPrisma,
  schemaName: 'public',
  tenantName: 'TestTenant'
};

const res = {
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    console.log('RESPONSE:', this.statusCode || 200, JSON.stringify(payload, null, 2));
    return payload;
  }
};

(async () => {
  try {
    await handler(req, res, (err) => { if (err) console.error('Handler next called with err:', err); });
    console.log('Test completed');
  } catch (e) {
    console.error('Test error:', e);
    process.exit(1);
  }
})();
