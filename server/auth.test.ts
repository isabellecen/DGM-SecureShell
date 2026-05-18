import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:password@localhost:5432/protectiveshell_test";

const { authInternals } = await import("./auth");

test("scrypt admin hash verification rejects malformed hashes", () => {
  assert.equal(authInternals.verifyScryptPassword("anything", "scrypt:salt:zz"), false);
  assert.equal(authInternals.verifyScryptPassword("anything", "scrypt:salt:"), false);
  assert.equal(authInternals.verifyScryptPassword("anything", "scrypt:salt:00"), false);
  assert.equal(authInternals.verifyScryptPassword("anything", "scrypt:salt:00:extra"), false);
});

test("scrypt admin hash verification accepts generated hashes", () => {
  const salt = "00112233445566778899aabbccddeeff";
  const hash = crypto.scryptSync("correct-password", salt, 64).toString("hex");

  assert.equal(
    authInternals.verifyScryptPassword("correct-password", `scrypt:${salt}:${hash}`),
    true,
  );
  assert.equal(
    authInternals.verifyScryptPassword("wrong-password", `scrypt:${salt}:${hash}`),
    false,
  );
});
