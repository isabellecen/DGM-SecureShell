import { eq } from "drizzle-orm";
import { pollBackupTarget } from "./backupPoller";
import { collectProxmoxHealth } from "./proxmoxCollector";
import { db } from "./db";
import { backupTargets, proxmoxHosts } from "@shared/schema";
import { storage } from "./storage";

export async function runProxmoxHostCheck(hostId: number) {
  const host = await storage.getProxmoxHost(hostId);
  if (!host) {
    return undefined;
  }

  const result = await collectProxmoxHealth({
    host: host.host,
    port: host.port,
    username: host.username,
    password: host.password,
    hostKeyFingerprint: host.hostKeyFingerprint,
    allowInsecureHostKey: host.allowInsecureHostKey,
  });

  const checkedAt = new Date();
  const check = await storage.createProxmoxCheck({
    hostId,
    checkedAt,
    overallStatus: result.overall_status,
    storageType: result.storage_type,
    payloadJson: result.components,
    monitoringError: result.monitoring_error,
  });

  const failed = result.monitoring_error !== null || result.overall_status === "UNKNOWN";
  await storage.updateProxmoxHost(hostId, {
    lastCheckAt: checkedAt,
    lastStatus: result.overall_status,
    lastStatusDetails: result,
    consecutiveFailures: failed ? host.consecutiveFailures + 1 : 0,
  });

  return check;
}

export async function pollBackupTargetAndPersist(targetId: number) {
  const target = await storage.getBackupTarget(targetId);
  if (!target) {
    return undefined;
  }

  const result = await pollBackupTarget({
    type: target.type as "SYNOLOGY" | "PBS",
    host: target.host,
    port: target.port,
    username: target.username,
    password: target.password,
    tlsFingerprint: target.tlsFingerprint,
    allowInsecureTls: target.allowInsecureTls,
  });

  const updateData: Parameters<typeof storage.updateBackupTarget>[1] = {
    lastPolledAt: new Date(),
    pollStatus: result.pollStatus,
    pollError: result.pollError,
  };

  if (result.pollStatus === "OK" && result.totalBytes && result.usedBytes) {
    updateData.totalBytes = result.totalBytes;
    updateData.usedBytes = result.usedBytes;
    updateData.datastoresJson = result.datastoresJson;
  }

  await storage.updateBackupTarget(targetId, updateData);

  const [updated] = await db
    .select()
    .from(backupTargets)
    .where(eq(backupTargets.id, targetId));
  return updated;
}

export async function listEnabledProxmoxHostIds(): Promise<number[]> {
  const rows = await db
    .select({ id: proxmoxHosts.id })
    .from(proxmoxHosts)
    .where(eq(proxmoxHosts.enabled, true));
  return rows.map((row) => row.id);
}

export async function listEnabledBackupTargetIds(): Promise<number[]> {
  const rows = await db
    .select({ id: backupTargets.id })
    .from(backupTargets)
    .where(eq(backupTargets.enabled, true));
  return rows.map((row) => row.id);
}
