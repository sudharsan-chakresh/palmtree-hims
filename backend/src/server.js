const app = require("./app");
const { prisma } = require("./config/prisma");
const { Client } = require("pg");

const port = process.env.PORT || 4000;

async function healSchema() {
  const dbUrl = process.env.DATABASE_URL || "";

  if (!dbUrl) {
    console.warn("[DB] DATABASE_URL is not configured; skipping nexus.tenants self-healing.");
    return;
  }

  try {
    const client = new Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : false
    });

    await client.connect();
    await client.query("SELECT 1");
    await client.end();

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
    const message = (err && (err.message || String(err))) || "";
    const normalized = message.toLowerCase();
    const isConnectivityIssue = [
      "enotfound",
      "econnrefused",
      "timeout",
      "connection",
      "tenant/user",
      "not found",
      "invalid url"
    ].some((token) => normalized.includes(token));

    if (isConnectivityIssue) {
      console.warn("[DB] Database host is unreachable or the configured DATABASE_URL is stale; skipping nexus.tenants self-healing until the DB is available.");
      return;
    }

    console.error("[DB] Self-healing failed:", message);
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