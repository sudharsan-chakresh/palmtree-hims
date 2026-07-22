/**
 * apply-indexes.js
 * Applies all performance indexes from SHARD_Base_Schema.sql to every existing tenant shard.
 * Run from project root: node backend/src/scripts/apply-indexes.js
 */
require('dotenv').config();
const { getPrisma } = require('../config/prisma');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = getPrisma();
  console.log('[INDEX-SYNC] Starting index application to all tenant shards...');

  // Load and extract only the CREATE INDEX statements
  const schemaPath = path.join(__dirname, '../../../database/SHARD_Base_Schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const indexStatements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.toLowerCase().startsWith('create index'));

  console.log(`[INDEX-SYNC] Found ${indexStatements.length} index statements to apply.`);

  // Get all tenant schemas
  const tenants = await prisma.$queryRawUnsafe(`SELECT name, db_name FROM nexus.tenants`);
  console.log(`[INDEX-SYNC] Found ${tenants.length} tenant(s).`);

  for (const tenant of tenants) {
    const schema = tenant.db_name;
    let created = 0, skipped = 0, errors = 0;

    for (const stmt of indexStatements) {
      // Apply each index inside the tenant schema
      const schemaStmt = `SET search_path TO "${schema}", public; ${stmt}`;
      try {
        await prisma.$executeRawUnsafe(schemaStmt);
        created++;
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('duplicate')) {
          skipped++;
        } else {
          // Table may not exist yet for this shard — non-fatal
          errors++;
          if (!e.message.includes('does not exist')) {
            console.warn(`  [WARN] ${schema} | ${stmt.substring(0, 60)} | ${e.message.substring(0, 80)}`);
          }
        }
      }
    }
    console.log(`  ✓ ${tenant.name} (${schema}): created=${created}, already_existed=${skipped}, table_missing=${errors}`);
  }

  console.log('[INDEX-SYNC] Complete. Restart the backend server to pick up schema healing cache changes.');
  process.exit(0);
}

main().catch(e => {
  console.error('[INDEX-SYNC] Fatal:', e.message);
  process.exit(1);
});
