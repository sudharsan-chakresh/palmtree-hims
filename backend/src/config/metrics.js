const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'hims-nexus'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// --- CUSTOM TENANT METRICS ---

const tenantDbSize = new client.Gauge({
  name: 'hims_tenant_db_size_mb',
  help: 'Database size of the tenant shard in MB',
  labelNames: ['tenant_id', 'tenant_name', 'plan']
});

const tenantActiveUsers = new client.Gauge({
  name: 'hims_tenant_active_users',
  help: 'Number of active users in the tenant shard',
  labelNames: ['tenant_id', 'tenant_name']
});

const tenantTotalRecords = new client.Gauge({
  name: 'hims_tenant_total_records',
  help: 'Total clinical records (patients + encounters) in the tenant shard',
  labelNames: ['tenant_id', 'tenant_name']
});

register.registerMetric(tenantDbSize);
register.registerMetric(tenantActiveUsers);
register.registerMetric(tenantTotalRecords);

// --- DB PERFORMANCE METRICS ---
const dbQueryDuration = new client.Histogram({
  name: 'hims_db_query_duration_seconds',
  help: 'Histogram of database query durations in seconds',
  labelNames: ['query_type']
});

const dbErrors = new client.Counter({
  name: 'hims_db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['query_type', 'error_type']
});

register.registerMetric(dbQueryDuration);
register.registerMetric(dbErrors);

module.exports = {
  register,
  metrics: {
    tenantDbSize,
    tenantActiveUsers,
    tenantTotalRecords
  }
    ,
    dbQueryDuration,
    dbErrors
};
