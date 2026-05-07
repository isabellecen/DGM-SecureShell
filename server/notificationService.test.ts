import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:password@localhost:5432/protectiveshell_test";

const { normalizeTimezone, notificationServiceInternals } = await import("./notificationService");

test("normalizeTimezone falls back to UTC for invalid settings", () => {
  assert.equal(normalizeTimezone("America/Phoenix"), "America/Phoenix");
  assert.equal(normalizeTimezone("Not/A_Real_Zone"), "UTC");
});

test("matching notification routes with no valid recipients do not request fallback recipients", () => {
  const allRecipients = [
    {
      id: 1,
      name: "Ops",
      email: "ops@example.com",
      type: "TECH",
      customerId: null,
      enabled: true,
    },
  ];

  assert.deepEqual(
    notificationServiceInternals.recipientsForMatchingRoutes(
      [{ recipientsJson: [999] }],
      allRecipients as any,
    ),
    [],
  );
  assert.equal(notificationServiceInternals.recipientsForMatchingRoutes([], allRecipients as any), null);
});
