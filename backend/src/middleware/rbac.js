'use strict';

const { si } = require('./sanitize');

/**
 * Middleware to enforce dynamic RBAC at the API layer.
 *
 * SECURITY FIXES applied:
 *  - Removed "email contains 'admin'" bypass (trivially exploitable)
 *  - Removed silent next() fallback when RBAC tables are missing in non-production
 *  - SQL identifiers validated via sanitizeIdentifier()
 *  - User email value parameterized with positional $N params
 *
 * @param {string} permissionKey - The key of the permission required (e.g., 'LAB_VIEW')
 */
const checkPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userEmail = req.user?.user || req.user?.email;
      const userRole  = req.user?.role;
      const userPermissions = req.user?.permissions || [];

      // 1. Check explicit permission in the JWT payload
      if (userPermissions && userPermissions.includes(permissionKey)) {
        return next();
      }

      // 2. Allow nexus super-admin role (set only by the server, never by user input)
      if (userRole === 'nexus') {
        return next();
      }

      // SECURITY: Removed the previous "email.includes('admin')" bypass.
      // That pattern allowed any email containing the word 'admin' (e.g., admin@evil.com)
      // to bypass all permission checks. Role checks now use strict equality only.

      // 3. Fallback: Check database for the role's current permissions
      const rawSchema = req.schemaName || req.headers['x-tenant-id']?.toLowerCase();
      if (rawSchema) {
        try {
          const schema = si(rawSchema); // Validate identifier before use in SQL
          const dbPerms = await req.prisma.$queryRawUnsafe(
            `SELECT p.key
             FROM "${schema}".rbac_permissions p
             JOIN "${schema}".rbac_role_permissions rp ON p.id = rp.permission_id
             JOIN "${schema}".rbac_user_roles ur ON rp.role_id = ur.role_id
             JOIN "${schema}".users u ON ur.user_id = u.id
             WHERE u.email = $1 AND p.key = $2`,
            userEmail,
            permissionKey
          );

          if (dbPerms && dbPerms.length > 0) {
            return next();
          }
        } catch (e) {
          // SECURITY: In all environments, a missing RBAC table is a hard failure.
          // Silently bypassing permission checks when tables are missing
          // defeats the purpose of the RBAC system entirely.
          console.error(`[RBAC] Permission check failed for schema "${rawSchema}":`, e.message);
          return res.status(500).json({ error: 'Security validation failed — contact system administrator' });
        }
      }

      return res.status(403).json({
        error: 'Access Denied',
        message: `You do not have the required permission: ${permissionKey}`
      });
    } catch (err) {
      console.error('[RBAC] Shield Error:', err.message);
      res.status(500).json({ error: 'Security validation failed' });
    }
  };
};

module.exports = { checkPermission };