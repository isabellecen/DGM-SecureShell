const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const entry = path.resolve(__dirname, "..", "dist", "index.cjs");

if (!existsSync(entry)) {
  console.error("Production build not found: dist/index.cjs");
  console.error("");
  console.error("Run `npm run build` before `npm start`, or deploy the built dist/ folder with the app.");
  console.error("If this server installs production-only dependencies, build before pruning dev dependencies.");
  process.exit(1);
}

const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
  stdio: "inherit",
  shell: false,
});

child.on("error", (err) => {
  console.error("Failed to start production server:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Production server terminated by ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});
