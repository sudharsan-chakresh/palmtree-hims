const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { prisma } = require('../config/prisma');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Helper to safely split SQL file content into complete statements respecting dollar quotes, single quotes, and comments
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      current += char;
      if (char === '\n' || char === '\r') {
        inLineComment = false;
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        current += '/';
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        current += '--';
        i += 2;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        current += '/*';
        i += 2;
        continue;
      }
    }

    if (char === "'" && !inDollarQuote) {
      if (inSingleQuote && nextChar === "'") {
        current += "''";
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
      continue;
    }

    if (char === '$' && !inSingleQuote) {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        const tag = match[0];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
        current += tag;
        i += tag.length;
        continue;
      }
    }

    if (char === ';' && !inSingleQuote && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
}

async function testCreateTenant() {
  const name = "Test Hospital " + Date.now();
  const dbName = "test_hosp_" + Math.floor(Math.random() * 10000);
  const plan = "Professional";
  const contactName = "Test MD";
  const contactEmail = "testmd@test.com";
  const adminEmail = "admin@testhosp.com";
  const adminPassword = "Password@123";
  const uiSettings = {
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    heroBackgroundColor: "#f8fafc",
    overallTextColor: "#475569"
  };
  const domain = null;

  const normalizedDbName = (dbName || "").toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const tenantCode = normalizedDbName;
  const schemaName = normalizedDbName;
  const passwordToUse = adminPassword;

  const tenantId = crypto.randomUUID();

  console.log(`[TEST] Starting tenant creation for ${schemaName} (${name})...`);

  try {
    // Step 1: Create Tenant in Global Registry
    const domainValue = domain ? domain.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : null;
    console.log("[TEST] Inserting into nexus.tenants...");
    await prisma.$executeRawUnsafe(`
      INSERT INTO nexus.tenants (id, code, name, db_name, domain, shard_id, plan, background_color, text_color, hero_background_color, overall_text_color, admin_email)
      VALUES (
        '${tenantId}',
        '${tenantCode}',
        '${name}',
        '${schemaName}',
        ${domainValue ? `'${domainValue}'` : 'NULL'},
        '${schemaName}',
        '${plan}',
        '${uiSettings?.backgroundColor || "#ffffff"}',
        '${uiSettings?.textColor || "#1e293b"}',
        '${uiSettings?.heroBackgroundColor || "#f8fafc"}',
        '${uiSettings?.overallTextColor || "#475569"}',
        '${adminEmail}'
      )
    `);
    console.log("[TEST] Inserted into nexus.tenants successfully!");

    // Create Contact
    await prisma.$executeRawUnsafe(`
      INSERT INTO nexus.tenant_admin_contacts (id, tenant_id, contact_name, email)
      VALUES ('${crypto.randomUUID()}', '${tenantId}', '${contactName}', '${contactEmail}')
    `);
    console.log("[TEST] Inserted contact successfully!");

    // Step 2: Initialize Shard Schema
    const candidatePaths = [
      path.join(__dirname, "../modules/nexus/SHARD_Base_Schema.sql"),
      path.join(__dirname, "../../../../database/SHARD_Base_Schema.sql"),
      path.join(__dirname, "../../../database/SHARD_Base_Schema.sql"),
      path.join(process.cwd(), "database/SHARD_Base_Schema.sql")
    ];
    const schemaPath = candidatePaths.find(p => fs.existsSync(p));
    console.log(`[TEST] Schema path: ${schemaPath}`);

    const sqlContent = fs.readFileSync(schemaPath, "utf8");
    const statements = splitSqlStatements(sqlContent);
    console.log(`[TEST] Found ${statements.length} SQL statements.`);

    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    console.log(`[TEST] Created schema "${schemaName}"`);

    let successCount = 0;
    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public; ${statement}`);
        successCount++;
      } catch (stmtErr) {
        console.error(`[TEST] Statement ${successCount + 1} FAILED:`, stmtErr.message);
        console.error(`[TEST] Failing SQL: ${statement.substring(0, 300)}...`);
        throw stmtErr;
      }
    }
    console.log(`[TEST] Executed ${successCount}/${statements.length} statements.`);

    // Cleanup test tenant afterwards
    console.log("[TEST] Cleaning up test tenant...");
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await prisma.$executeRawUnsafe(`DELETE FROM nexus.tenant_admin_contacts WHERE tenant_id = '${tenantId}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM nexus.tenants WHERE id = '${tenantId}'`);
    console.log("[TEST] Done!");

  } catch (error) {
    console.error("[TEST] FAILED WITH ERROR:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateTenant();
