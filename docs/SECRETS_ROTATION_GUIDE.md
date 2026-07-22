# Secrets Rotation Guide — Jioplix HIMS

> **CRITICAL:** Treat this document as sensitive. Do not commit it to a public repository.
> Execute all steps in a secure terminal session with restricted access.

---

## When to Rotate

Rotate ALL secrets immediately if:
- A developer leaves the team
- Any secret has been committed to a git repository
- A suspected breach or unauthorized access
- Every 90 days (routine policy)

---

## Step 1 — Rotate Database Password

### 1.1 Generate a new strong password
```bash
openssl rand -base64 32
# Example output: kLm9Rq2vXpYnEhJzOcWfBd8TuAiGsN0e
```

### 1.2 Update in PostgreSQL
```sql
-- Connect as superuser to your PostgreSQL instance
ALTER USER your_db_user WITH PASSWORD 'NEW_STRONG_PASSWORD_HERE';
```

### 1.3 Update `.env`
```env
DATABASE_URL=postgresql://your_db_user:NEW_STRONG_PASSWORD_HERE@69.12.82.14:5432/jioplix_prod?sslmode=require
```

### 1.4 Restart the backend service
```bash
pm2 restart jioplix-backend
# or
systemctl restart jioplix
```

---

## Step 2 — Rotate JWT Secret

### 2.1 Generate cryptographically strong secret
```bash
openssl rand -hex 64
# Output: a256-bit hex string — use this as your JWT_SECRET
```

### 2.2 Update `.env`
```env
JWT_SECRET=<output from above — never use human-readable strings>
```

> ⚠️ **Impact:** All existing sessions will be invalidated. Users must log in again.

### 2.3 Notify users (optional)
Send a platform-wide notification that all users must re-login.

---

## Step 3 — Rotate RESEND Email API Key

### 3.1 Go to Resend Dashboard
Visit: https://resend.com/api-keys

### 3.2 Create a new API key
- Click **Create API Key**
- Name: `jioplix-prod-v2`
- Domain: `jioplix.com`
- Permission: **Sending access** only

### 3.3 Delete the old key
Select the old key (`re_L2XbTXjq_...`) and click **Revoke**.

### 3.4 Update `.env`
```env
RESEND_API_KEY=re_NEW_KEY_HERE
```

---

## Step 4 — Rotate ABDM / NHA Credentials

### 4.1 Login to ABDM Sandbox/Production console
Production: https://dev.abdm.gov.in/

### 4.2 Generate new client credentials
- Navigate to **Application Management → API Credentials**
- Click **Regenerate Secret**

### 4.3 Update `.env`
```env
ABDM_CLIENT_ID=YOUR_NEW_CLIENT_ID
ABDM_CLIENT_SECRET=your-new-secret-uuid-here
```

### 4.4 Test the integration
```bash
# Test token generation
curl -X POST https://dev.abdm.gov.in/api/v1/integrations/hrp/v3/token \
  -H "Content-Type: application/json" \
  -d '{"clientId":"YOUR_NEW_CLIENT_ID","clientSecret":"your-new-secret"}'
```

---

## Step 5 — Rotate NEXUS Admin Password

### 5.1 Update `.env`
```env
NEXUS_ADMIN_PASSWORD=<new strong password — min 16 chars, mixed case, symbols>
```

### 5.2 Update in database
```sql
-- Connect to your DB and run:
UPDATE nexus.users 
SET password_hash = crypt('NEW_PASSWORD', gen_salt('bf', 10))
WHERE role = 'nexus';
```

> Or use the `/api/nexus/tenants/:id/password` endpoint with the current nexus JWT.

---

## Step 6 — Add METRICS_TOKEN (New Requirement)

### 6.1 Generate a token
```bash
openssl rand -hex 32
```

### 6.2 Add to `.env`
```env
METRICS_TOKEN=<output from above>
```

### 6.3 Update Prometheus scraper config
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'jioplix'
    static_configs:
      - targets: ['your-api-host:4000']
    bearer_token: '<METRICS_TOKEN>'
```

---

## Step 7 — Remove .env from Git History

> **Only needed if `.env` was ever committed to the repository.**

### 7.1 Install BFG Repo Cleaner
```bash
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
```

### 7.2 Remove `.env` from all history
```bash
java -jar bfg-1.14.0.jar --delete-files .env your-repo.git
cd your-repo
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

### 7.3 Verify `.env` is in `.gitignore`
```bash
cat .gitignore | grep ".env"
# Should output: .env
```

If missing, add it:
```bash
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
git add .gitignore && git commit -m "chore: ensure .env is gitignored"
```

> ⚠️ After force-pushing, all team members must run:
> ```bash
> git fetch --all
> git reset --hard origin/main
> ```

---

## Step 8 — Add New Environment Variables

After rotating, ensure these NEW variables are also added to `.env`:

```env
# Security additions — post July 2026 hardening
METRICS_TOKEN=<generate with: openssl rand -hex 32>
SEED_DEFAULT_PASSWORD=<set a known strong password for seeded demo users>
STAFF_DEFAULT_PASSWORD=<set if you want a fixed default for new staff accounts>
APP_DOMAIN=jioplix.com
DEV_APP_DOMAIN=dev.jioplix.com
```

---

## Checklist

After completing rotation, verify:

- [ ] Backend starts without errors: `npm start`
- [ ] Login flow works end-to-end
- [ ] ABDM OTP generation works in demo mode
- [ ] `/metrics` returns 401 without token, 200 with correct token
- [ ] `/api/nexus/seed-database` returns 401 without nexus JWT
- [ ] Old `.env` values are no longer valid (test with revoked credentials)
- [ ] Git history is clean (no `.env` in `git log --all --full-history -- .env`)

---

## Recommended: Move to a Secrets Manager

For production-grade secrets management, consider:

| Tool | Cost | Best For |
|---|---|---|
| **Doppler** | Free tier available | Simple `.env` replacement, team sharing |
| **Azure Key Vault** | Pay-per-use | Azure-hosted infrastructure |
| **HashiCorp Vault** | Open source / Enterprise | Self-hosted, complex policies |
| **AWS Secrets Manager** | Pay-per-secret | AWS-hosted infrastructure |

Example with Doppler:
```bash
npm install -g doppler
doppler login
doppler setup
doppler run -- node index.js  # Injects secrets at runtime
```
