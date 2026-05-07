import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:password@localhost:5432/protectiveshell_test";

const { auditInternals } = await import("./audit");

test("audit sanitizer redacts secret-like fields", () => {
  assert.deepEqual(
    auditInternals.sanitize({
      username: "admin",
      password: "secret",
      nested: {
        apiKey: "abc",
        host: "example.com",
      },
    }),
    {
      username: "admin",
      password: "[redacted]",
      nested: {
        apiKey: "[redacted]",
        host: "example.com",
      },
    },
  );
});

test("audit request sanitizer redacts secret setting values", () => {
  assert.deepEqual(
    auditInternals.sanitizeRequestBody({
      path: "/api/settings",
      body: {
        key: "IMAP_PASS",
        value: "mail-secret",
      },
    } as any),
    {
      key: "IMAP_PASS",
      value: "[redacted]",
    },
  );

  assert.deepEqual(
    auditInternals.sanitizeRequestBody({
      path: "/api/settings",
      body: {
        key: "APP_TIMEZONE",
        value: "America/Phoenix",
      },
    } as any),
    {
      key: "APP_TIMEZONE",
      value: "America/Phoenix",
    },
  );
});

test("audit entity parser extracts API resource and numeric id", () => {
  assert.deepEqual(auditInternals.entityFromPath("/api/jobs/42"), {
    entityType: "jobs",
    entityId: "42",
  });
});
