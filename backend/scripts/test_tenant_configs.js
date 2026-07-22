const hospitalRouter = require('../src/modules/hospital');

function findHandler(router, path, method) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods && layer.route.methods[method]) {
      return layer.route.stack[0].handle;
    }
  }
  return null;
}

const getHandler = findHandler(hospitalRouter, '/configs', 'get');
const putHandler = findHandler(hospitalRouter, '/configs', 'put');
if (!getHandler || !putHandler) { console.error('handlers not found'); process.exit(1); }

const mockPrisma = {
  async $executeRawUnsafe(sql) {
    console.log('EXECUTE:', sql.split('\n')[0]);
    return [];
  },
  async $queryRawUnsafe(sql) {
    console.log('QUERY:', sql.split('\n')[0]);
    if (sql.includes('tenant_sensitive_settings')) return [{ settings: {} }];
    if (sql.includes('nexus.tenants')) return [{ sensitive_settings: { AI_API_KEY: 'NEXUS_AI_KEY' } }];
    return [];
  }
};

const req = { prisma: mockPrisma, schemaName: 'public' };
const res = { json: (p) => { console.log('RES JSON:', p); }, status: function(code){ this.code = code; return this; }, }; 

(async () => {
  await getHandler(req, res, (e)=>{if(e)console.error('next',e)});
  await putHandler({ ...req, body: { AI_API_KEY: 'TENANT_KEY' } }, res, (e)=>{if(e)console.error('next',e)});
  await getHandler(req, res, (e)=>{if(e)console.error('next',e)});
})();
