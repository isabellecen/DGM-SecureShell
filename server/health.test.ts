import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:password@localhost:5432/protectiveshell_test";

const { healthInternals } = await import("./health");

test("production readiness response hides internal detail", () => {
  const payload = healthInternals.readyzResponseBody(
    {
      ok: false,
      database: { ok: false, message: "password authentication failed" },
      scheduler: { enabled: true, ok: false, errorWorkers: [{ workerName: "imap" }] },
    },
    "production",
  );

  assert.deepEqual(payload, { ok: false });
});

test("development readiness response keeps diagnostic detail", () => {
  const details = {
    ok: true,
    database: { ok: true, latencyMs: 2 },
    scheduler: { enabled: true, ok: true, staleWorkers: [], errorWorkers: [] },
  };

  assert.deepEqual(healthInternals.readyzResponseBody(details, "development"), details);
});
