/**
 * Resolve dist/server.js from this package root (next to package.json), not process.cwd().
 * Fixes hosts (e.g. Render) where cwd may not match the service root.
 */
const path = require("path");
const fs = require("fs");

const serverPath = path.join(__dirname, "..", "dist", "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("[tenantos-api] Compiled server not found at:", serverPath);
  console.error("[tenantos-api] Run `npm run build` in the backend folder. cwd=", process.cwd());
  process.exit(1);
}

require(serverPath);
