// Load .env from project root (one level up from /backend)
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { start } = require("./src/server");
start();