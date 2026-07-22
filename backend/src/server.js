const app = require("./app");
const { prisma } = require("./config/prisma");

const port = process.env.PORT || 4000;

async function healSchema() {
  try {
    console.log("[DB] Running Self-Healing for nexus.tenants...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS code VARCHAR(255)
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS domain VARCHAR(255)
    `);
    // Add unique constraint on domain if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_domain_key') THEN
          ALTER TABLE nexus.tenants ADD CONSTRAINT tenants_domain_key UNIQUE (domain);
        END IF;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE nexus.tenants SET code = db_name WHERE code IS NULL
    `);
    console.log("[DB] nexus.tenants schema self-healed successfully.");
  } catch (err) {
    console.error("[DB] Self-healing failed:", err.message);
  }
}

function start() {
  healSchema().then(() => {
    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  });
}

module.exports = { start };