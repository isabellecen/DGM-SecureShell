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

test("audit entity parser extracts API resource and numeric id", () => {
  assert.deepEqual(auditInternals.entityFromPath("/api/jobs/42"), {
    entityType: "jobs",
    entityId: "42",
  });
});
