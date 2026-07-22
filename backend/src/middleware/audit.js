function audit(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] ${timestamp} ${req.method} ${req.originalUrl}`);
  next();
}

module.exports = { audit };