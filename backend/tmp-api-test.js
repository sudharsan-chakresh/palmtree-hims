const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = 4000;
const BASE_PATH = '/api';

function req(method, path, token, tenantId, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `${BASE_PATH}${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) options.headers['x-tenant-id'] = tenantId;

    const r = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const parsed = chunks ? JSON.parse(chunks) : null;
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    r.on('error', (e) => reject(e));
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  try {
    console.log('1) Fetching public tenants...');
    const tenantsRes = await req('GET', '/nexus/tenants/public');
    if (tenantsRes.status !== 200) throw new Error('Failed to fetch tenants: ' + JSON.stringify(tenantsRes));
    const tenant = (tenantsRes.body && tenantsRes.body[0]) || tenantsRes.body;
    if (!tenant) throw new Error('No tenant found in registry');
    const tenantId = tenant.id || tenant.code || tenant.dbName || tenant.dbName;
    console.log('  -> Using tenant:', tenantId);

    const adminEmail = process.env.NEXUS_ADMIN_USER || 'admin@hims-sys.com';
    const adminPass = process.env.NEXUS_ADMIN_PASSWORD || 'Admin@123';

    console.log('2) Logging in as tenant admin...');
    const loginRes = await req('POST', '/auth/login', null, null, {
      type: 'tenant',
      facility: tenantId,
      email: adminEmail,
      password: adminPass
    });
    if (loginRes.status !== 200) throw new Error('Login failed: ' + JSON.stringify(loginRes));
    const token = loginRes.body.token;
    console.log('  -> Received token, length:', token ? token.length : 0);

    console.log('3) Healing masters (seed wards/medicines/diagnostics)...');
    const heal = await req('GET', '/hospital/heal-all-masters', token, tenantId);
    console.log('  -> heal status', heal.status, 'body:', JSON.stringify(heal.body));

    console.log('4) Creating a patient...');
    const patientRes = await req('POST', '/patients', token, tenantId, {
      name: 'API Test Patient',
      phone: '9999000111',
      gender: 'Male',
      age: 30
    });
    if (patientRes.status !== 201) throw new Error('Patient creation failed: ' + JSON.stringify(patientRes));
    const patient = patientRes.body;
    console.log('  -> patient id:', patient.id);

    console.log('5) Fetching staff to select a doctor for consultation...');
    const staffResBefore = await req('GET', '/hospital/staff', token, tenantId);
    let consultDoctorId = null;
    if (staffResBefore.status === 200 && Array.isArray(staffResBefore.body) && staffResBefore.body.length > 0) {
      consultDoctorId = staffResBefore.body.find(u => u.role && u.role.toLowerCase().includes('doctor'))?.id || staffResBefore.body[0].id;
    }
    console.log('  -> selected doctor for consultation:', consultDoctorId);

    console.log('6) Creating consultation with prescription (OPD)...');
    const consultRes = await req('POST', '/consultations', token, tenantId, {
      patientId: patient.id,
      doctorId: consultDoctorId,
      diagnosis: 'Test infection',
      notes: 'Automated API test consultation',
      complaints: ['Fever and cough'],
      prescriptions: [{ drugName: 'Paracetamol 500mg', dosage: '500mg', frequency: 'BD', duration: '5 days' }]
    });
    console.log('  -> consult status', consultRes.status, 'body:', consultRes.body);
    const encounterId = consultRes.body && consultRes.body.encounterId;
    if (!encounterId) throw new Error('Consultation did not return encounterId');

    console.log('7) Creating prescription via hospital endpoint...');
    const presRes = await req('POST', `/hospital/encounters/${encounterId}/prescriptions`, token, tenantId, {
      items: [{ name: 'Amoxicillin 250mg', dosage: '250mg', frequency: 'TDS', duration: '5 days' }]
    });
    console.log('  -> pres status', presRes.status, 'body:', presRes.body);

    console.log('8) Creating lab order for the encounter...');
    const labRes = await req('POST', `/hospital/encounters/${encounterId}/lab-orders`, token, tenantId, {
      diagnosticIds: ['Complete Blood Count (CBC)'],
      priority: 'Normal'
    });
    console.log('  -> lab status', labRes.status, 'body:', labRes.body);

    console.log('8) Fetching ward/bed map to pick a bed for admission...');
    const bedmap = await req('GET', '/hospital/ipd/bedmap', token, tenantId);
    if (bedmap.status !== 200) throw new Error('Failed to fetch bedmap: ' + JSON.stringify(bedmap));
    const wards = bedmap.body;
    if (!wards || wards.length === 0) throw new Error('No wards available after healing');
    // Try to find any ward that has at least one bed
    let wardId = null;
    let bedId = null;
    for (const w of wards) {
      const bedsResTry = await req('GET', `/hospital/ipd/wards/${w.id}/beds`, token, tenantId);
      const bedsTry = bedsResTry.body;
      if (Array.isArray(bedsTry) && bedsTry.length > 0) {
        wardId = w.id;
        bedId = bedsTry[0].id;
        break;
      }
    }
    if (!wardId || !bedId) throw new Error('No beds in any ward');
    console.log('  -> selected ward', wardId, 'bed', bedId);

    console.log('9) Fetching staff list to pick admitting doctor...');
    const staffRes = await req('GET', '/hospital/staff', token, tenantId);
    let doctorId = null;
    if (staffRes.status === 200 && Array.isArray(staffRes.body) && staffRes.body.length > 0) {
      doctorId = staffRes.body[0].id;
    }
    console.log('  -> doctor id chosen:', doctorId);

    console.log('10) Creating IPD admission...');
    const admRes = await req('POST', '/hospital/ipd/admissions', token, tenantId, {
      patientId: patient.id,
      bedId,
      wardId,
      admittingDoctorId: doctorId,
      admissionReason: 'Automated test admission',
      dailyCharge: 1500
    });
    console.log('  -> admission status', admRes.status, 'body:', admRes.body);

    console.log('\nAPI Test Summary:');
    console.log('Tenant:', tenantId);
    console.log('Patient ID:', patient.id);
    console.log('Encounter ID:', encounterId);
    console.log('Prescription result:', presRes.status);
    console.log('Lab order result:', labRes.status);
    console.log('Admission result:', admRes.status);

  } catch (err) {
    console.error('ERROR during API test:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

run();
