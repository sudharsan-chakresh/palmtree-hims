# Jioplix HIMS — Security Compliance Document

**Version:** 2.0 (Post-Hardening)
**Date:** July 2026
**Classification:** Internal / Confidential
**Prepared by:** Engineering & Security Team

---

## 1. Executive Summary

Jioplix HIMS is a multi-tenant Hospital Information Management System (HIMS) that processes sensitive patient health data including Personally Identifiable Information (PII), Protected Health Information (PHI), Aadhaar numbers, and ABHA (Ayushman Bharat Health Account) identifiers.

This document certifies the security controls implemented across the platform following a full security audit and remediation cycle completed in July 2026.

---

## 2. Regulatory Framework

| Regulation / Standard | Applicability | Status |
|---|---|---|
| **DPDP Act 2023** (Digital Personal Data Protection) | All patient PII | ✅ Addressed (see §5) |
| **ABDM / NHA Integration Standards** | ABHA V3 API integration | ✅ Compliant |
| **UIDAI Guidelines** | Aadhaar-based ABHA OTP flow | ✅ Compliant (masked logging) |
| **CERT-In Cybersecurity Directions (2022)** | Vulnerability & breach reporting | ✅ Addressed |
| **IT Act 2000 / SPDI Rules** | Sensitive data handling | ✅ Addressed |

---

## 3. Architecture Overview

### 3.1 Multi-Tenant Shard Architecture

```
Internet
    │
    ▼
[CORS Whitelist] → [Helmet Headers] → [Rate Limiter]
    │
    ▼
[Express API Server]
    │
    ├─ [Auth Middleware]  ← JWT (Authorization: Bearer only)
    ├─ [Tenant Middleware] ← sanitizeIdentifier() validated schema
    └─ [RBAC Middleware]  ← strict role-based permission check
         │
         ▼
   PostgreSQL (multi-schema)
   ┌──────────┬──────────┬──────────┐
   │  nexus   │ hosp_001 │ hosp_002 │  ← isolated per-tenant schemas
   └──────────┴──────────┴──────────┘
```

- Each hospital operates in a **dedicated PostgreSQL schema** (shard isolation).
- The `nexus` schema holds the global tenant registry.
- Cross-tenant access is enforced at both the JWT layer (tenantId claim) and the API middleware layer.

### 3.2 ABHA / ABDM Integration

```
Client → /api/abha/generate-otp  →  ABDM Gateway (Sandbox/Production)
Client → /api/abha/verify-otp    →  ABDM Gateway
Client → /api/abha/*             →  Internal DB (tenant schema)
```

All ABDM API calls use:
- **RSA-OAEP-SHA1** encryption for Aadhaar numbers (as per ABDM V3 specification)
- Bearer token authentication from ABDM token exchange
- Audit logging in `abha_audit_logs` table per tenant

---

## 4. Authentication & Session Security

| Control | Implementation | Status |
|---|---|---|
| Password hashing | bcrypt, cost factor 10 | ✅ |
| JWT algorithm | HS256 with env-loaded secret | ✅ |
| JWT expiry | 8 hours | ✅ |
| JWT transport | `Authorization: Bearer` header **only** | ✅ Fixed (removed URL query param) |
| JWT secret strength | Min 256-bit random key (env var) | ✅ Rotated |
| Token revocation | Session-based (logout clears client token) | ⚠️ No server-side blocklist (future work) |
| Brute-force protection | Rate limit: 5 login attempts / 15 min / IP | ✅ |

---

## 5. Data Protection Controls

### 5.1 Patient PHI / PII

| Data Type | Storage | In Transit | Masking in Logs |
|---|---|---|---|
| Patient name, phone, DOB | PostgreSQL (encrypted volume) | HTTPS | Partial (no phone in logs) |
| Aadhaar number | Never stored — only used for ABHA OTP | HTTPS + RSA-OAEP | ✅ Not logged |
| ABHA ID / Number | Stored in `patients.abha_id` | HTTPS | ✅ |
| Medical history / allergies | PostgreSQL per-tenant schema | HTTPS | Not logged |
| Prescriptions | Per-tenant schema | HTTPS | Not logged |

### 5.2 Data Minimization
- Aadhaar numbers are **never persisted** in the database.
- ABHA IDs are stored only after patient consent (explicit link action).
- Audit logs store transaction IDs and operation names — not raw health record content.

---

## 6. SQL Injection Mitigation

### 6.1 Strategy

Because the platform uses dynamic multi-tenant schema routing (PostgreSQL schema names cannot be parameterized in SQL syntax), a **two-layer defense** was implemented:

**Layer 1 — Identifier Validation (`sanitize.js`)**
All schema names (e.g., `hospital_001`) pass through `sanitizeIdentifier()` before use in any SQL string. This function:
- Rejects any value not matching `^[a-zA-Z0-9_-]+$`
- Enforces a 63-character PostgreSQL identifier limit
- Rejects known SQL keywords

**Layer 2 — Parameterized Values**
All user-supplied *values* (emails, patient IDs, appointment times, complaint text) use PostgreSQL positional parameters (`$1`, `$2`, ...) via `$queryRawUnsafe(query, param1, param2)`.

### 6.2 Coverage

| Module | Sites Fixed | Method |
|---|---|---|
| `auth/index.js` | 22 | Positional params |
| `abha/index.js` | 16 | Positional params |
| `patient/index.js` | 11 | Positional params |
| `public/index.js` | 3 | Positional params |
| `appointment/index.js` | 9 | Positional params |
| `consultation/index.js` | 21 | Positional params |
| `billing/index.js` | 25 | Schema identifier validation |
| `insurance/index.js` | 22 | Schema identifier validation |
| `doctor/index.js` | 35 | Schema identifier validation |
| `nexus/index.js` | 89 | Positional params (user values) + identifier validation |
| `hospital/index.js` | 250 | Schema identifier validation |
| `tenant.js` | 4 | Positional params |
| `rbac.js` | 1 | Positional params |

---

## 7. Access Control (RBAC)

### 7.1 Role Hierarchy

```
nexus        → Full platform administration (separate JWT claim)
admin        → Full tenant administration
doctor       → Clinical access (own encounters)
nurse        → Ward / IPD access
receptionist → OPD registration, appointments
pharmacist   → Pharmacy / medicine dispensing
lab_assistant → Lab orders and results
staff        → Limited access
```

### 7.2 RBAC Security Controls

| Control | Status |
|---|---|
| Dynamic DB-backed permission check | ✅ |
| JWT role claim verified against DB | ✅ |
| Email-based admin bypass | ✅ Removed (was `email.includes('admin')`) |
| Silent bypass on missing RBAC tables | ✅ Removed (now hard 500 error) |
| Nexus admin routes protected by JWT | ✅ (previously unauthenticated) |

---

## 8. HTTP Security Headers (Helmet)

The following headers are now set on all responses:

| Header | Value |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-DNS-Prefetch-Control` | `off` |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` |
| `X-Download-Options` | `noopen` |
| `X-XSS-Protection` | `0` (modern browsers — CSP preferred) |
| `Referrer-Policy` | `no-referrer` |
| `X-Permitted-Cross-Domain-Policies` | `none` |

---

## 9. CORS Policy

**Before (vulnerability):** `origin: true` — reflects any origin, allows CSRF with credentials.

**After (hardened):**
```js
origin: (origin, callback) => {
  // Explicit whitelist: localhost (dev), jioplix.com, dev.jioplix.com
  // Any *.jioplix.com subdomain (tenant routing)
}
```

---

## 10. Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/auth/login` | 5 requests | 15 minutes per IP |
| `POST /api/abha/generate-otp` | 3 requests | 15 minutes per IP |
| `POST /api/abha/verify-otp` | 5 requests | 15 minutes per IP |
| All other API routes | 200 requests | 1 minute per IP |

---

## 11. File Upload Security

| Control | Implementation |
|---|---|
| MIME type validation | `file.mimetype` checked against allowlist |
| File size limit | 10 MB maximum |
| File count limit | 5 files per request |
| Filename sanitization | Use `path.basename()` — recommend UUID filenames (future work) |
| Magic byte validation | **Not implemented** (future work — use `file-type` package) |

---

## 12. Secrets Management

### Current Controls
- All secrets stored in `.env` file (not committed to production git)
- No hardcoded credentials in source code (post-remediation)
- Database connection uses SSL

### Recommended (Future)
- Migrate to **Azure Key Vault** or **Doppler** for secret rotation
- Implement automatic secret rotation for ABDM credentials (90-day cycle)

---

## 13. Monitoring & Audit Trail

| Capability | Implementation |
|---|---|
| Audit middleware | Registered on all `/api/*` routes |
| ABHA operation logs | Stored in `abha_audit_logs` per tenant |
| Prometheus metrics | `/metrics` endpoint (now bearer-token protected) |
| Login attempt logging | Console log (structured) |
| Failed auth logging | HTTP 401/403 responses with context |

---

## 14. Known Limitations & Roadmap

| Item | Priority | Timeline |
|---|---|---|
| Server-side JWT revocation / blocklist (Redis) | High | Sprint 2 |
| File upload magic byte validation | Medium | Sprint 2 |
| Full Content-Security-Policy header | Medium | Sprint 3 |
| Database-level encryption (column-level for Aadhaar-adjacent fields) | High | Sprint 3 |
| WAF (Web Application Firewall) in front of API | High | Sprint 4 |
| Penetration testing (external) | Critical | Q3 2026 |
| DPDP Act data retention and erasure workflows | High | Q3 2026 |

---

## 15. Incident Response

In the event of a suspected security incident:

1. **Immediate:** Rotate all secrets listed in `SECRETS_ROTATION_GUIDE.md`
2. **Within 6 hours:** Notify CERT-In (as per 2022 directions) if breach confirmed
3. **Within 72 hours:** Notify affected patients if PHI exposed (DPDP Act requirement)
4. **Ongoing:** Preserve server logs, DB audit logs, and network logs for forensics

**Security Contact:** engineering@jioplix.com

---

*This document should be reviewed and updated every 6 months or after any major architectural change.*
