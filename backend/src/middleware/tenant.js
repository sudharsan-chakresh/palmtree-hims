'use strict';

const { prisma } = require('../config/prisma');
const { si } = require('./sanitize');

const ROOT_DOMAIN = process.env.APP_DOMAIN || process.env.DEV_APP_DOMAIN || 'jioplix.com';
const RESERVED_SUBDOMAINS = ['dev', 'staging', 'stage', 'test', 'www', 'api', 'app', 'mail', 'admin', 'support', 'help', 'docs', 'status', 'uat', 'qa'];

function extractSubdomain(host) {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('::1')) return null;
  const parts = hostname.split('.');
  if (parts.length >= 3 && !RESERVED_SUBDOMAINS.includes(parts[0])) {
    return parts[0];
  }
  return null;
}

async function resolveTenantFromDomain(host) {
  const subdomain = extractSubdomain(host);
  if (!subdomain) return null;
  // SECURITY: subdomain is derived from the Host header; validate before SQL use.
  // Use positional param for the value, not string interpolation.
  const tenants = await prisma.$queryRawUnsafe(
    `SELECT id, db_name, name FROM nexus.tenants WHERE domain = $1`,
    subdomain
  );
  if (tenants && tenants.length > 0) {
    return tenants[0];
  }
  return null;
}

async function tenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || req.body?.facility || req.query.tenantId || req.query.tenant;

  try {
    let resolvedTenant = null;

    // 1. Try to resolve from Host header (domain-based routing)
    if (!tenantId) {
      const hostTenant = await resolveTenantFromDomain(req.headers.host);
      if (hostTenant) {
        resolvedTenant = hostTenant;
        console.log(`[TENANT] Resolved from domain: ${hostTenant.name} (${req.headers.host})`);
      }
    }

    // 2. Fallback to explicit tenant ID / code
    // SECURITY: Use positional parameters — tenantId comes from an HTTP header/query and must never be interpolated.
    if (!resolvedTenant && tenantId) {
      const tenants = await prisma.$queryRawUnsafe(
        `SELECT id, db_name, name FROM nexus.tenants WHERE id::text = $1 OR code = $1`,
        String(tenantId).trim()
      );
      if (tenants && tenants.length > 0) {
        resolvedTenant = tenants[0];
        console.log(`[TENANT] Request for: ${resolvedTenant.name} | Schema: ${resolvedTenant.db_name.toLowerCase()} | Header ID: ${tenantId}`);
      }
    }

    if (!resolvedTenant) {
      console.warn(`[TENANT] Blocking request: No tenant resolved from host or header.`);
      return res.status(400).json({ error: 'Tenant identification missing. Please provide x-tenant-id header or use a tenant-specific domain.' });
    }

    // SECURITY: Validate the schema name is a safe SQL identifier before use in any query.
    const schemaName = si(resolvedTenant.db_name.toLowerCase());

    // Security: Validate JWT tenant matches requested tenant
    if (req.user && req.user.tenantId) {
      if (req.user.tenantId !== resolvedTenant.id && req.user.tenantId !== 'nexus') {
        console.warn(`[TENANT] Cross-tenant access denied: JWT tenantId=${req.user.tenantId}, requested=${resolvedTenant.id} (${resolvedTenant.name})`);
        return res.status(403).json({ error: 'Tenant mismatch. Your session does not belong to this facility.' });
      }
    }

    req.tenantId   = resolvedTenant.id;
    req.schemaName = schemaName;
    req.tenantName = resolvedTenant.name;

    // Force search path (schema name already validated above)
    await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);

    // Self-Healing: Ensure essential tenant-specific tables exist (non-production only)
    if (process.env.NODE_ENV !== 'production' || process.env.FORCE_SYNC === 'true') {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".communications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content TEXT,
            author_name VARCHAR(100),
            created_at TIMESTAMP DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS "${schemaName}".communication_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            recipient VARCHAR(255),
            subject VARCHAR(255),
            type VARCHAR(50),
            status VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW()
          );
        `);
      } catch (healErr) {
        console.warn(`[TENANT] Self-healing failed for ${schemaName}:`, healErr.message);
      }
    }

    next();
  } catch (err) {
    console.error('[TENANT] Middleware error:', err.message);
    // Return 400 for identifier validation errors (user-controlled input), 500 for others
    if (err.message.startsWith('Invalid identifier')) {
      return res.status(400).json({ error: 'Invalid tenant identifier' });
    }
    next(err);
  }
}

module.exports = { tenant };