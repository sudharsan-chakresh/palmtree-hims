const env = process.env.NODE_ENV || "development";

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

function getTenantConnectionString(tenant) {
  if (tenant) {
    return process.env[`DB_${tenant}`] ?? process.env.DATABASE_URL;
  }

  return process.env.DATABASE_URL;
}

module.exports = {
  env,
  getDatabaseUrl,
  getTenantConnectionString,
};