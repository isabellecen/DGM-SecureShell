import assert from "node:assert/strict";
import test from "node:test";
import {
  parseProxmoxWebhookPayload,
  proxmoxWebhookFingerprint,
  proxmoxWebhookSecretFromHeaders,
  proxmoxWebhookSecretMatches,
  statusFromProxmoxSeverity,
} from "./proxmoxWebhook";

test("Proxmox webhook severity maps to backup event status", () => {
  assert.equal(statusFromProxmoxSeverity("error"), "FAIL");
  assert.equal(statusFromProxmoxSeverity("warning"), "WARN");
  assert.equal(statusFromProxmoxSeverity("info"), "OK");
  assert.equal(statusFromProxmoxSeverity("notice"), "OK");
  assert.equal(statusFromProxmoxSeverity("unknown"), "UNKNOWN");
});

test("Proxmox webhook parser accepts supported PVE and PBS job notifications", () => {
  const pve = parseProxmoxWebhookPayload({
    source: "PVE",
    severity: "info",
    timestamp: 1730000000,
    title: "Backup succeeded",
    message: "vzdump completed",
    fields: {
      type: "vzdump",
      hostname: "pve1",
      "job-id": "backup-123",
    },
  });

  assert.equal(pve.kind, "event");
  if (pve.kind === "event") {
    assert.equal(pve.event.source, "PVE");
    assert.equal(pve.event.eventType, "vzdump");
    assert.equal(pve.event.jobId, "backup-123");
    assert.equal(pve.event.host, "pve1");
    assert.equal(pve.event.status, "OK");
  }

  const pbs = parseProxmoxWebhookPayload({
    source: "PBS",
    severity: "warning",
    timestamp: "2026-06-30T12:00:00.000Z",
    fields: {
      type: "sync",
      hostname: "pbs1",
      "job-id": "remote-sync",
    },
  });

  assert.equal(pbs.kind, "event");
  if (pbs.kind === "event") {
    assert.equal(pbs.event.source, "PBS");
    assert.equal(pbs.event.eventType, "sync");
    assert.equal(pbs.event.status, "WARN");
  }
});

test("Proxmox webhook parser ignores unsupported or unmappable notifications", () => {
  assert.deepEqual(
    parseProxmoxWebhookPayload({
      source: "PVE",
      severity: "info",
      timestamp: 1730000000,
      fields: { type: "replication", "job-id": "replication-1" },
    }),
    { kind: "ignored", reason: "unsupported PVE event type: replication" },
  );

  assert.deepEqual(
    parseProxmoxWebhookPayload({
      source: "PVE",
      severity: "info",
      timestamp: 1730000000,
      fields: { type: "vzdump" },
    }),
    { kind: "ignored", reason: "missing job-id" },
  );
});

test("Proxmox webhook parser rejects malformed payloads", () => {
  const result = parseProxmoxWebhookPayload({
    source: "PVE",
    severity: "info",
    timestamp: "not-a-date",
    fields: { type: "vzdump", "job-id": "backup-123" },
  });

  assert.deepEqual(result, { kind: "invalid", message: "timestamp is invalid" });
});

test("Proxmox webhook fingerprint is stable and includes identity fields", () => {
  const input = {
    source: "PVE" as const,
    eventType: "vzdump",
    jobId: "Backup 123",
    host: "PVE1",
    timestamp: new Date("2026-06-30T12:00:00.000Z"),
    severity: "info",
  };

  assert.equal(proxmoxWebhookFingerprint(input), proxmoxWebhookFingerprint(input));
  assert.notEqual(
    proxmoxWebhookFingerprint(input),
    proxmoxWebhookFingerprint({ ...input, severity: "error" }),
  );
  assert.notEqual(
    proxmoxWebhookFingerprint(input),
    proxmoxWebhookFingerprint({ ...input, timestamp: new Date("2026-06-30T12:05:00.000Z") }),
  );
});

test("Proxmox webhook secret accepts bearer or custom header values", () => {
  assert.equal(
    proxmoxWebhookSecretFromHeaders({ authorization: "Bearer abc123" }),
    "abc123",
  );
  assert.equal(
    proxmoxWebhookSecretFromHeaders({ webhookSecret: "abc123" }),
    "abc123",
  );
  assert.equal(
    proxmoxWebhookSecretFromHeaders({ protectiveShellWebhookSecret: "abc123" }),
    "abc123",
  );
  assert.equal(
    proxmoxWebhookSecretFromHeaders({ genericWebhookSecret: "abc123" }),
    "abc123",
  );
  assert.equal(proxmoxWebhookSecretMatches("abc123", "abc123"), true);
  assert.equal(proxmoxWebhookSecretMatches("wrong", "abc123"), false);
  assert.equal(proxmoxWebhookSecretMatches(undefined, "abc123"), false);
});
