# DB Connectivity Runbook for Jioplix

This runbook documents the steps taken to resolve intermittent DB connectivity and to prevent recurrence. Use this document for on-call troubleshooting and for sharing with the DB vendor.

## Summary
- Problem: App (App Service) was intermittently unable to connect to Postgres due to SSL mismatch and later a `pg_hba.conf` rejection for Azure outbound IPs.
- Temporary fix applied: Added App Service outbound IPs to `/var/lib/pgsql/data/pg_hba.conf` and reloaded Postgres. Restarted App Service and validated endpoints.
- CI hardening: Added post-deploy smoke test to `azure-pipelines.yml` to call `/api/nexus/tenants/public` and fail the pipeline if the endpoint returns non-200 or empty response.
- Instrumentation: Added Prometheus metrics (`hims_db_query_duration_seconds`, `hims_db_errors_total`) and instrumentation around Prisma raw queries and health endpoints.

## Affected Services
- App Service (dev): `jioplix-dev-ashzabdjazfwdzdd`
- App Service (prod): `Jioplix-az` / hostnames `jioplix.com`, `www.jioplix.com`, `Jioplix-az-ashzabdjazfwdzdd.southindia-01.azurewebsites.net`
- Database host: `tserver` (self-hosted Postgres) at `204.152.214.26:5432` (schema: `nexus`, DB: `jioplixdb`)
- Prod Outbound IPs:
  - `104.211.201.94`
  - `13.71.66.90`
  - `13.71.66.145`
  - `104.211.205.169`
  - `104.211.218.57`
  - `13.71.67.90`
  - `20.235.14.7`
  - `20.219.107.150`
  - `20.235.14.25`
  - `20.219.121.219`
  - `20.219.124.7`
  - `20.235.14.174`
  - `40.78.194.99`

## Immediate Steps (what we did)
1. Verify Azure App Service outbound IPs:
   ```bash
   az webapp show --name <app-name> --resource-group <rg> --query outboundIpAddresses --output tsv
   ```
2. Edit `pg_hba.conf` (path from `SHOW hba_file;`) and add lines for App Service outbound IPs:
   ```text
   host    jioplixdb    jioplixuser    20.219.121.219/32    md5
   host    jioplixdb    jioplixuser    20.219.107.150/32    md5
   host    jioplixdb    jioplixuser    20.219.124.7/32      md5
   ```
3. Reload Postgres:
   ```bash
   sudo systemctl reload postgresql
   # or
   sudo -u postgres pg_ctl reload -D /var/lib/pgsql/data
   ```
4. Restart App Service and validate endpoints:
   ```bash
   az webapp restart --name <app-name> --resource-group <rg>
   curl -i https://<app-host>/health-db
   curl -i https://<app-host>/api/nexus/tenants/public
   ```

## Instrumentation Added
- Prometheus metrics exported on `/metrics` (existing) now include:
  - `hims_db_query_duration_seconds` (Histogram)
  - `hims_db_errors_total` (Counter)
- Prisma instrumentation for `$queryRawUnsafe` and `$executeRawUnsafe` to measure durations and errors.
- Health endpoints instrumented to record durations and errors.

## CI Hardening
- `azure-pipelines.yml` now includes a smoke test step after deployment and migrations to ensure `/api/nexus/tenants/public` returns 200 and non-empty response.

## Known Issues & Resolutions

### App Startup Timeout (504 Gateway Timeout)
- **Issue:** App container startup takes ~133 seconds; Azure's health probe may timeout on initial deployment (230s limit) or during stop/start cycles (1800s limit).
- **Root cause:** Prisma client initialization + DB connection pool setup + potential schema checks on startup.
- **Logs to check:**
  - Container startup logs in `/home/LogFiles/2026_06_XX_lw..._docker.log` (e.g., `Site startup probe succeeded after 133.0705522 seconds`)
  - Azure status logs show: `Container did not start within expected time limit`
- **Mitigation:**
  - Keep health check responses lightweight; avoid heavy DB queries in startup path.
  - Pre-warm Prisma client in background during app initialization.
  - Consider lazy-loading DB schema checks instead of eager checks on startup.
  - Monitor `/health` endpoint response time and tune as needed.

## Application Insights & Monitoring Setup

To capture real-time startup errors, DB latencies, and 504 errors, enable Application Insights:

```bash
# Create Application Insights instance
az monitor app-insights component create \
  --app jioplix-prod-ai \
  --location southindia \
  --resource-group Jioplix-Resource-Group \
  --kind web

# Get Instrumentation Key
az monitor app-insights component show \
  --app jioplix-prod-ai \
  --resource-group Jioplix-Resource-Group \
  --query instrumentationKey -o tsv

# Add to App Service (replace <KEY> with the value above)
az webapp config appsettings set \
  --name Jioplix-az \
  --resource-group Jioplix-Resource-Group \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="<KEY>" \
            ApplicationInsightsAgent_EXTENSION_VERSION="~3"
```

Then restart the app:
```bash
az webapp restart --name Jioplix-az --resource-group Jioplix-Resource-Group
```

Query logs in Application Insights for:
- Request duration distribution
- Dependency timing (DB queries)
- Exception traces (node-specific errors)

## Recommended Permanent Fixes (prioritized)
1. Move DB to private network or enable Private Endpoint (preferred):
   - Use Azure Private Endpoint or VNet integration to avoid public IP allowlisting.
2. If DB self-hosted, establish VPN or Hybrid Connection between Azure VNet and on-prem network.
3. Enforce SSL with `hostssl` entries and `?sslmode=require` in `DATABASE_URL`.
4. Automate firewall/`pg_hba.conf` updates via IaC (Terraform/Ansible) if public access is required.
5. Add alerts on `hims_db_errors_total` and high 95th percentile of `hims_db_query_duration_seconds`.

## Troubleshooting Checklist (quick)
1. Check App health and endpoints:
   - `/health-db` should return JSON with `status: ok`.
2. Check App Service settings include correct `DATABASE_URL`.
3. Confirm outbound IPs and ensure they are in `pg_hba.conf` or firewall rules.
4. On DB server:
   - `sudo -u postgres psql -d jioplixdb -c "SHOW hba_file;"`
   - `sudo -u postgres grep -n 'jioplix' /var/lib/pgsql/data/pg_hba.conf`
   - `sudo systemctl reload postgresql`
   - `sudo journalctl -u postgresql -n 200 --no-pager | egrep -i 'connection|authentication|reject|pg_hba'`
5. Check metrics endpoint `/metrics` for `hims_db_errors_total` and `hims_db_query_duration_seconds`.

## Contacts
- DB vendor support: [vendor_contact@example.com]
- DevOps lead: [devops@example.com]

## Notes
- Avoid mocking tenant list data in client or server for production; real DB must be the source of truth.

