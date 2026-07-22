let app;
try {
  app = require("../backend/src/app");
} catch (err) {
  console.error("CRITICAL STARTUP ERROR:", err);
  app = (req, res) => {
    res.status(500).json({
      error: "Critical Startup Error",
      message: err.message,
      stack: err.stack
    });
  };
}

module.exports = app;
