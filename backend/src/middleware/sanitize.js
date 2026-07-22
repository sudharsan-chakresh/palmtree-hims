'use strict';

/**
 * Security Utility — SQL Identifier & Value Sanitization
 *
 * PostgreSQL identifiers (schema names, table names) cannot be passed as
 * parameterized values in SQL — they must be embedded in the query string.
 * This module provides strict allow-list validation so that only safe
 * identifier strings reach the database engine.
 *
 * USAGE:
 *   const { si, sv } = require('../middleware/sanitize');
 *   // Schema/table name:  si(req.schemaName)
 *   // User-supplied UUID: use positional params $1, $2 instead of si()
 */

/**
 * Validate a PostgreSQL identifier (schema or table name).
 * Allows: letters, digits, underscores, hyphens (converted to underscores).
 * Rejects anything containing SQL meta-characters.
 *
 * @param {string} name
 * @returns {string} safe identifier
 * @throws {Error} if the identifier is invalid
 */
function sanitizeIdentifier(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('Invalid identifier: must be a non-empty string');
  }
  // PostgreSQL max identifier length
  if (name.length > 63) {
    throw new Error('Invalid identifier: exceeds 63-character PostgreSQL limit');
  }
  // Allow only alphanumeric + underscore (hyphens already converted to underscores on creation)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid identifier: "${name}" contains disallowed characters`);
  }
  // Reject SQL keywords and dangerous patterns
  const forbidden = ['drop', 'delete', 'truncate', 'insert', 'update', 'select', 'union', 'exec', 'execute', '--', ';'];
  const lower = name.toLowerCase();
  for (const kw of forbidden) {
    if (lower === kw) {
      throw new Error(`Invalid identifier: "${name}" is a reserved SQL keyword`);
    }
  }
  return name;
}

/**
 * Alias for sanitizeIdentifier — short form used inline.
 * si = Sanitize Identifier
 */
const si = sanitizeIdentifier;

/**
 * Validate a UUID v4 string.
 * Returns the value if valid, throws otherwise.
 *
 * @param {string} id
 * @param {string} [fieldName] — used in error message
 * @returns {string}
 */
function sanitizeUUID(id, fieldName = 'id') {
  if (typeof id !== 'string') {
    throw new Error(`Invalid ${fieldName}: must be a string`);
  }
  const trimmed = id.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error(`Invalid ${fieldName}: not a valid UUID`);
  }
  return trimmed;
}

/**
 * Alias for sanitizeUUID — short form.
 * su = Sanitize UUID
 */
const su = sanitizeUUID;

/**
 * Validate an alphanumeric code (tenant code, plan name, role name, etc.)
 * Allows: letters, digits, underscores, hyphens, @ signs (for email-like values).
 *
 * @param {string} value
 * @param {string} [fieldName]
 * @returns {string}
 */
function sanitizeAlphanumeric(value, fieldName = 'value') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > 255) {
    throw new Error(`Invalid ${fieldName}: exceeds maximum length`);
  }
  // Allow safe characters for codes, plans, roles
  if (!/^[a-zA-Z0-9_\-@. ]+$/.test(trimmed)) {
    throw new Error(`Invalid ${fieldName}: contains disallowed characters`);
  }
  return trimmed;
}

/**
 * Escape a string value for use in a raw SQL context where parameterization
 * is truly not possible (last resort). Prefer positional params ($1, $2) instead.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeSqlString(value) {
  if (typeof value !== 'string') return '';
  // Escape single quotes by doubling them (standard SQL escaping)
  return value.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

/**
 * Validate that a value is a safe integer (for pagination, counts, etc.)
 *
 * @param {any} value
 * @param {string} [fieldName]
 * @returns {number}
 */
function sanitizeInt(value, fieldName = 'value') {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0 || n > 2147483647) {
    throw new Error(`Invalid ${fieldName}: must be a non-negative integer`);
  }
  return n;
}

module.exports = {
  sanitizeIdentifier,
  si,
  sanitizeUUID,
  su,
  sanitizeAlphanumeric,
  escapeSqlString,
  sanitizeInt,
};
