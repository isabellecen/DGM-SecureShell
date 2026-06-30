import { eq } from "drizzle-orm";
import { db } from "./db";
import { incidents } from "@shared/schema";
import type { EmailEventStatus } from "./emailStatus";

type IncidentClient = Pick<typeof db, "select" | "insert" | "update">;

type BackupEmailIncidentInput = {
  client?: IncidentClient;
  jobId: number;
  jobName?: string | null;
  emailId: number;
  expectedRunId?: number | null;
  status: EmailEventStatus;
  receivedAt: Date;
  subject?: string | null;
  snippet?: string | null;
};

type BackupWebhookIdentity = {
  source: string;
  eventType: string;
  webhookJobId: string;
  host?: string | null;
};

type BackupWebhookIncidentInput = BackupWebhookIdentity & {
  client?: IncidentClient;
  jobId: number;
  jobName?: string | null;
  sourceFingerprint: string;
  expectedRunId?: number | null;
  status: EmailEventStatus;
  receivedAt: Date;
  title?: string | null;
  message?: string | null;
};

export function backupEmailIncidentFingerprint(input: {
  emailId: number;
  expectedRunId?: number | null;
}): string {
  return input.expectedRunId
    ? `backup-status:expected-run:${input.expectedRunId}`
    : `backup-status:email:${input.emailId}`;
}

function webhookIncidentPart(value: string | null | undefined): string {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed.replace(/[^a-z0-9_.:-]+/g, "_") : "none";
}

export function backupWebhookIncidentFingerprint(input: BackupWebhookIdentity & {
  expectedRunId?: number | null;
}): string {
  return input.expectedRunId
    ? `backup-status:expected-run:${input.expectedRunId}`
    : [
        "backup-status:webhook",
        webhookIncidentPart(input.source),
        webhookIncidentPart(input.eventType),
        webhookIncidentPart(input.webhookJobId),
        webhookIncidentPart(input.host),
      ].join(":");
}

function shortText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 500) : fallback;
}

export function backupEmailIncidentPreview(input: BackupEmailIncidentInput) {
  if (input.status !== "FAIL" && input.status !== "WARN" && input.status !== "OK") {
    return null;
  }

  const sourceFingerprint = backupEmailIncidentFingerprint(input);
  if (input.status === "OK") {
    return {
      action: "resolve" as const,
      sourceFingerprint,
    };
  }

  const jobLabel = input.jobName || `Backup job #${input.jobId}`;
  const severity = input.status === "FAIL" ? "CRIT" : "WARN";
  const statusLabel = input.status === "FAIL" ? "failure" : "warning";
  const summary = shortText(input.subject || input.snippet, "Backup notification reported an issue.");

  return {
    action: "open" as const,
    sourceFingerprint,
    severity,
    title: `${jobLabel} reported ${statusLabel}`,
    details: [
      summary,
      `Received at ${input.receivedAt.toISOString()}.`,
      input.expectedRunId ? `Expected run #${input.expectedRunId}.` : `Email #${input.emailId}.`,
    ].join(" "),
  };
}

export function backupWebhookIncidentPreview(input: BackupWebhookIncidentInput) {
  if (input.status !== "FAIL" && input.status !== "WARN" && input.status !== "OK") {
    return null;
  }

  const sourceFingerprint = backupWebhookIncidentFingerprint(input);
  if (input.status === "OK") {
    return {
      action: "resolve" as const,
      sourceFingerprint,
    };
  }

  const jobLabel = input.jobName || `Backup job #${input.jobId}`;
  const severity = input.status === "FAIL" ? "CRIT" : "WARN";
  const statusLabel = input.status === "FAIL" ? "failure" : "warning";
  const summary = shortText(input.title || input.message, "Proxmox webhook reported an issue.");

  return {
    action: "open" as const,
    sourceFingerprint,
    severity,
    title: `${jobLabel} reported ${statusLabel}`,
    details: [
      summary,
      `Received at ${input.receivedAt.toISOString()}.`,
      input.expectedRunId ? `Expected run #${input.expectedRunId}.` : `Webhook ${input.sourceFingerprint}.`,
    ].join(" "),
  };
}

export async function syncBackupEmailIncident(input: BackupEmailIncidentInput): Promise<void> {
  const preview = backupEmailIncidentPreview(input);
  if (!preview) {
    return;
  }

  const client = input.client || db;
  if (preview.action === "resolve") {
    await client
      .update(incidents)
      .set({ state: "RESOLVED", updatedAt: new Date() })
      .where(eq(incidents.sourceFingerprint, preview.sourceFingerprint));
    return;
  }

  const [existing] = await client
    .select()
    .from(incidents)
    .where(eq(incidents.sourceFingerprint, preview.sourceFingerprint));

  if (existing) {
    await client
      .update(incidents)
      .set({
        severity: preview.severity,
        sourceId: input.jobId,
        title: preview.title,
        details: preview.details,
        state: "OPEN",
        notificationSentAt: existing.details === preview.details ? existing.notificationSentAt : null,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, existing.id));
    return;
  }

  await client.insert(incidents).values({
    sourceType: "BACKUP",
    sourceId: input.jobId,
    severity: preview.severity,
    title: preview.title,
    details: preview.details,
    state: "OPEN",
    sourceFingerprint: preview.sourceFingerprint,
  });
}

export async function syncBackupWebhookIncident(input: BackupWebhookIncidentInput): Promise<void> {
  const preview = backupWebhookIncidentPreview(input);
  if (!preview) {
    return;
  }

  const client = input.client || db;
  if (preview.action === "resolve") {
    await client
      .update(incidents)
      .set({ state: "RESOLVED", updatedAt: new Date() })
      .where(eq(incidents.sourceFingerprint, preview.sourceFingerprint));
    return;
  }

  const [existing] = await client
    .select()
    .from(incidents)
    .where(eq(incidents.sourceFingerprint, preview.sourceFingerprint));

  if (existing) {
    await client
      .update(incidents)
      .set({
        severity: preview.severity,
        sourceId: input.jobId,
        title: preview.title,
        details: preview.details,
        state: "OPEN",
        notificationSentAt: existing.details === preview.details ? existing.notificationSentAt : null,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, existing.id));
    return;
  }

  await client.insert(incidents).values({
    sourceType: "BACKUP",
    sourceId: input.jobId,
    severity: preview.severity,
    title: preview.title,
    details: preview.details,
    state: "OPEN",
    sourceFingerprint: preview.sourceFingerprint,
  });
}
