import crypto from "crypto";
import { z } from "zod";
import type { EmailEventStatus } from "./emailStatus";

export const PROXMOX_WEBHOOK_PATH = "/api/integrations/proxmox/notifications";
export const PROXMOX_WEBHOOK_SECRET_SETTING = "PROXMOX_WEBHOOK_SECRET";

const pbsEventTypes = new Set(["sync", "prune", "verification", "tape-backup"]);

const webhookPayloadSchema = z.object({
  source: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toUpperCase() : value,
    z.enum(["PVE", "PBS"]),
  ),
  severity: z.string().trim().min(1),
  timestamp: z.union([z.string(), z.number(), z.date()]),
  title: z.string().trim().nullable().optional(),
  message: z.string().trim().nullable().optional(),
  fields: z.record(z.unknown()).default({}),
}).passthrough();

export type ProxmoxWebhookSource = "PVE" | "PBS";

export type NormalizedProxmoxWebhookEvent = {
  source: ProxmoxWebhookSource;
  eventType: string;
  jobId: string;
  host: string | null;
  severity: string;
  status: EmailEventStatus;
  receivedAt: Date;
  title: string | null;
  message: string | null;
  fingerprint: string;
  payload: unknown;
};

export type ProxmoxWebhookParseResult =
  | { kind: "event"; event: NormalizedProxmoxWebhookEvent }
  | { kind: "ignored"; reason: string }
  | { kind: "invalid"; message: string };

function fieldString(fields: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return null;
}

function parseWebhookTimestamp(value: string | number | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const millis = Math.abs(value) < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && value.trim() !== "") {
    return parseWebhookTimestamp(numeric);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function statusFromProxmoxSeverity(severity: string): EmailEventStatus {
  const normalized = severity.trim().toLowerCase();
  if (normalized === "error") return "FAIL";
  if (normalized === "warning") return "WARN";
  if (normalized === "info" || normalized === "notice") return "OK";
  return "UNKNOWN";
}

function supportedEventType(source: ProxmoxWebhookSource, eventType: string): boolean {
  if (source === "PVE") {
    return eventType === "vzdump";
  }
  return pbsEventTypes.has(eventType);
}

function fingerprintPart(value: string | null | undefined): string {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed.replace(/[^a-z0-9_.:-]+/g, "_") : "none";
}

export function proxmoxWebhookFingerprint(input: {
  source: ProxmoxWebhookSource;
  eventType: string;
  jobId: string;
  host?: string | null;
  timestamp: Date;
  severity: string;
}) {
  return [
    "proxmox-webhook",
    fingerprintPart(input.source),
    fingerprintPart(input.eventType),
    fingerprintPart(input.jobId),
    fingerprintPart(input.host),
    input.timestamp.toISOString(),
    fingerprintPart(input.severity),
  ].join(":");
}

export function parseProxmoxWebhookPayload(value: unknown): ProxmoxWebhookParseResult {
  const parsed = webhookPayloadSchema.safeParse(value);
  if (!parsed.success) {
    return {
      kind: "invalid",
      message: parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; "),
    };
  }

  const payload = parsed.data;
  const receivedAt = parseWebhookTimestamp(payload.timestamp);
  if (!receivedAt) {
    return { kind: "invalid", message: "timestamp is invalid" };
  }

  const eventType = fieldString(payload.fields, ["type", "event-type", "event_type"])?.toLowerCase();
  if (!eventType) {
    return { kind: "ignored", reason: "missing event type" };
  }

  if (!supportedEventType(payload.source, eventType)) {
    return { kind: "ignored", reason: `unsupported ${payload.source} event type: ${eventType}` };
  }

  const jobId = fieldString(payload.fields, ["job-id", "job_id", "jobid"]);
  if (!jobId) {
    return { kind: "ignored", reason: "missing job-id" };
  }

  const host = fieldString(payload.fields, ["hostname", "host", "node", "node-name", "node_name"]);
  const severity = payload.severity.trim().toLowerCase();

  return {
    kind: "event",
    event: {
      source: payload.source,
      eventType,
      jobId,
      host,
      severity,
      status: statusFromProxmoxSeverity(severity),
      receivedAt,
      title: payload.title || null,
      message: payload.message || null,
      fingerprint: proxmoxWebhookFingerprint({
        source: payload.source,
        eventType,
        jobId,
        host,
        timestamp: receivedAt,
        severity,
      }),
      payload: value,
    },
  };
}

export function proxmoxWebhookSecretFromHeaders(input: {
  authorization?: string;
  webhookSecret?: string;
  protectiveShellWebhookSecret?: string;
  genericWebhookSecret?: string;
}): string | undefined {
  const auth = input.authorization?.trim();
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;

  for (const value of [
    input.webhookSecret,
    input.protectiveShellWebhookSecret,
    input.genericWebhookSecret,
  ]) {
    const headerSecret = value?.trim();
    if (headerSecret) return headerSecret;
  }

  return undefined;
}

export function proxmoxWebhookSecretMatches(provided: string | undefined, configured: string | undefined): boolean {
  if (!provided || !configured) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const configuredBuffer = Buffer.from(configured);
  return providedBuffer.length === configuredBuffer.length && crypto.timingSafeEqual(providedBuffer, configuredBuffer);
}

export const proxmoxWebhookInternals = {
  fieldString,
  parseWebhookTimestamp,
  supportedEventType,
};
