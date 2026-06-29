import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:password@localhost:5432/protectiveshell_test";

const { seedInternals } = await import("./seed");

test("boot seed helper only invokes seed when database is ready and SEED_ON_BOOT is exactly 1", async () => {
  const cases: Array<{
    name: string;
    databaseReady: boolean;
    env: NodeJS.ProcessEnv;
    expectedCalls: number;
    expectedRan: boolean;
  }> = [
    { name: "unset", databaseReady: true, env: {}, expectedCalls: 0, expectedRan: false },
    { name: "zero", databaseReady: true, env: { SEED_ON_BOOT: "0" }, expectedCalls: 0, expectedRan: false },
    { name: "true", databaseReady: true, env: { SEED_ON_BOOT: "true" }, expectedCalls: 0, expectedRan: false },
    { name: "whitespace", databaseReady: true, env: { SEED_ON_BOOT: " 1 " }, expectedCalls: 0, expectedRan: false },
    { name: "database not ready", databaseReady: false, env: { SEED_ON_BOOT: "1" }, expectedCalls: 0, expectedRan: false },
    { name: "enabled", databaseReady: true, env: { SEED_ON_BOOT: "1" }, expectedCalls: 1, expectedRan: true },
  ];

  for (const testCase of cases) {
    let calls = 0;
    const ran = await seedInternals.runSeedOnBootIfEnabled(
      testCase.databaseReady,
      async () => {
        calls += 1;
      },
      testCase.env,
    );

    assert.equal(calls, testCase.expectedCalls, testCase.name);
    assert.equal(ran, testCase.expectedRan, testCase.name);
  }
});

test("seed blocker table list covers every app table", () => {
  const blockerNames = seedInternals.seedBlockerTables.map((table: { name: string }) => table.name).sort();

  assert.deepEqual(blockerNames, [
    "app_settings",
    "audit_logs",
    "backup_targets",
    "customers",
    "email_ingestion_failures",
    "emails",
    "events",
    "expected_runs",
    "imap_checkpoints",
    "incidents",
    "job_rules",
    "jobs",
    "notification_routes",
    "proxmox_checks",
    "proxmox_hosts",
    "rate_limit_hits",
    "recipients",
    "scheduler_runs",
  ].sort());
});

test("non-empty app tables skip sample data inserts", async () => {
  const tableRows = new Map<unknown, unknown[]>();
  const settingsBlocker = seedInternals.seedBlockerTables.find(
    (table: { name: string }) => table.name === "app_settings",
  );
  assert(settingsBlocker);
  tableRows.set(settingsBlocker.table, [{ id: 1 }]);

  let advisoryLockCalls = 0;
  let insertCalls = 0;
  const logMessages: string[] = [];
  const previousLog = console.log;
  console.log = (message?: unknown) => {
    logMessages.push(String(message));
  };

  try {
    const result = await seedInternals.seedDatabaseWithClient({
      execute: async () => {
        advisoryLockCalls += 1;
      },
      select: () => ({
        from: (table: unknown) => ({
          limit: async () => tableRows.get(table) ?? [],
        }),
      }),
      insert: () => {
        insertCalls += 1;
        throw new Error("insert should not be called when seed blockers exist");
      },
    } as any);

    assert.equal(advisoryLockCalls, 1);
    assert.equal(insertCalls, 0);
    assert.deepEqual(result, {
      status: "skipped",
      reason: "database-not-empty",
      blockerTables: ["app_settings"],
    });
    assert.match(logMessages.join("\n"), /Skipping sample data seed: database is not empty/);
  } finally {
    console.log = previousLog;
  }
});
