import crypto from "node:crypto";
import readline from "node:readline/promises";

async function readPassword() {
  const [, , argPassword] = process.argv;
  if (argPassword) {
    return argPassword;
  }

  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await rl.question("Password to hash: ");
  } finally {
    rl.close();
  }
}

const password = await readPassword();
if (!password) {
  console.error("A password is required.");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt}:${hash}`);
