const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { metrics, dbQueryDuration, dbErrors } = require('./metrics');

let prisma;

function getPrisma() {
  if (!prisma) {
    console.log("[DB] Lazily Initializing Prisma Client with PG Adapter (SSL Bypass)...");
    
    // Clean the connection string to prevent conflicts with Pool options
    const rawUrl = process.env.DATABASE_URL || "";
    
    // FORCED SSL BYPASS: Required for Vercel -> Supabase/Managed DB connectivity
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const pool = new Pool({ 
      connectionString: rawUrl,
      ssl: rawUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
      max: 3
    });
    
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // Instrument Prisma raw query methods to capture timings and errors
    try {
      if (prisma.$queryRawUnsafe) {
        const origQuery = prisma.$queryRawUnsafe.bind(prisma);
        prisma.$queryRawUnsafe = async function (...args) {
          const end = dbQueryDuration.startTimer({ query_type: 'query_raw' });
          try {
            const res = await origQuery(...args);
            end();
            return res;
          } catch (err) {
            end();
            try { dbErrors.inc({ query_type: 'query_raw', error_type: err.code || 'UNKNOWN' }); } catch(e){}
            console.error('[DB] $queryRawUnsafe error:', err.message || err);
            throw err;
          }
        };
      }

      if (prisma.$executeRawUnsafe) {
        const origExec = prisma.$executeRawUnsafe.bind(prisma);
        prisma.$executeRawUnsafe = async function (...args) {
          const end = dbQueryDuration.startTimer({ query_type: 'execute_raw' });
          try {
            const res = await origExec(...args);
            end();
            return res;
          } catch (err) {
            end();
            try { dbErrors.inc({ query_type: 'execute_raw', error_type: err.code || 'UNKNOWN' }); } catch(e){}
            console.error('[DB] $executeRawUnsafe error:', err.message || err);
            throw err;
          }
        };
      }
    } catch (wrapErr) {
      console.error('[DB] Failed to instrument Prisma methods:', wrapErr.message || wrapErr);
    }
  }
  return prisma;
}

module.exports = {
  get prisma() { return getPrisma(); },
  getPrisma,
};