import { db } from "./db";
import {
  customers,
  jobs,
  proxmoxHosts,
  proxmoxChecks,
  backupTargets,
  incidents,
  recipients,
  expectedRuns,
  emails,
  appSettings,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { encryptSecret } from "./crypto";

export async function seedDatabase() {
  const existingCustomers = await db.select().from(customers);
  if (existingCustomers.length > 0) {
    return;
  }

  console.log("Seeding database with sample data...");

  const [c1] = await db.insert(customers).values({ name: "Meridian Healthcare" }).returning();
  const [c2] = await db.insert(customers).values({ name: "Atlas Financial Group" }).returning();
  const [c3] = await db.insert(customers).values({ name: "Pinnacle Engineering" }).returning();
  const [c4] = await db.insert(customers).values({ name: "Greenfield Properties" }).returning();

  const [j1] = await db.insert(jobs).values({
    customerId: c1.id,
    name: "Meridian DC1 - Full VM Backup",
    systemType: "VEEAM",
    scheduleType: "daily",
    scheduleTime: "01:00",
    windowHours: 6,
    enabled: true,
    longRunning: false,
  }).returning();

  const [j2] = await db.insert(jobs).values({
    customerId: c1.id,
    name: "Meridian DC2 - Incremental",
    systemType: "VEEAM",
    scheduleType: "daily",
    scheduleTime: "03:00",
    windowHours: 4,
    enabled: true,
    longRunning: false,
  }).returning();

  const [j3] = await db.insert(jobs).values({
    customerId: c2.id,
    name: "Atlas PBS - VM Replication",
    systemType: "PBS",
    scheduleType: "daily",
    scheduleTime: "02:00",
    windowHours: 8,
    enabled: true,
    longRunning: true,
    longWindowHours: 24,
  }).returning();

  const [j4] = await db.insert(jobs).values({
    customerId: c3.id,
    name: "Pinnacle NAS - Hyper Backup",
    systemType: "SYNOLOGY",
    scheduleType: "daily",
    scheduleTime: "04:00",
    windowHours: 6,
    enabled: true,
    longRunning: false,
  }).returning();

  const [j5] = await db.insert(jobs).values({
    customerId: c4.id,
    name: "Greenfield - Weekly Full",
    systemType: "VEEAM",
    scheduleType: "weekly",
    scheduleTime: "22:00",
    windowHours: 12,
    enabled: true,
    longRunning: true,
    longWindowHours: 18,
    daysOfWeek: ["saturday"],
  }).returning();

  await db.insert(jobs).values({
    customerId: c2.id,
    name: "Atlas Archive - Monthly Tape",
    systemType: "VEEAM",
    scheduleType: "weekly",
    scheduleTime: "00:00",
    windowHours: 24,
    enabled: false,
    longRunning: true,
    longWindowHours: 48,
  });

  const hostPayload1 = {
    overall_status: "OK",
    storage_type: "ZFS",
    components: {
      zfs: {
        status: "OK",
        pools: [
          { name: "rpool", state: "ONLINE" },
          { name: "data", state: "ONLINE" },
        ],
      },
      smart: {
        status: "OK",
        disks_total: 6,
        disks_warning: 0,
        disks_failed: 0,
        disks: [
          { name: "/dev/sda", model: "Samsung SSD 870 EVO 500GB", status: "OK", temperature: 34, reallocated: 0, pending: 0 },
          { name: "/dev/sdb", model: "Samsung SSD 870 EVO 500GB", status: "OK", temperature: 35, reallocated: 0, pending: 0 },
          { name: "/dev/sdc", model: "WDC WD4003FFBX-68MU3N0", status: "OK", temperature: 38, reallocated: 0, pending: 0 },
          { name: "/dev/sdd", model: "WDC WD4003FFBX-68MU3N0", status: "OK", temperature: 37, reallocated: 0, pending: 0 },
          { name: "/dev/sde", model: "WDC WD4003FFBX-68MU3N0", status: "OK", temperature: 39, reallocated: 0, pending: 0 },
          { name: "/dev/sdf", model: "WDC WD4003FFBX-68MU3N0", status: "OK", temperature: 36, reallocated: 0, pending: 0 },
        ],
      },
    },
    monitoring_error: null,
  };

  const hostPayload2 = {
    overall_status: "WARN",
    storage_type: "ZFS",
    components: {
      zfs: {
        status: "WARN",
        pools: [
          { name: "rpool", state: "DEGRADED" },
          { name: "data", state: "ONLINE" },
        ],
      },
      smart: {
        status: "WARN",
        disks_total: 8,
        disks_warning: 1,
        disks_failed: 0,
        disks: [
          { name: "/dev/sda", model: "Samsung SSD 860 PRO 512GB", status: "OK", temperature: 36, reallocated: 0, pending: 0 },
          { name: "/dev/sdb", model: "Samsung SSD 860 PRO 512GB", status: "OK", temperature: 37, reallocated: 0, pending: 0 },
          { name: "/dev/sdc", model: "Seagate ST4000NE001-2MA101", status: "OK", temperature: 40, reallocated: 0, pending: 0 },
          { name: "/dev/sdd", model: "Seagate ST4000NE001-2MA101", status: "OK", temperature: 41, reallocated: 0, pending: 0 },
          { name: "/dev/sde", model: "Seagate ST4000NE001-2MA101", status: "OK", temperature: 39, reallocated: 0, pending: 0 },
          { name: "/dev/sdf", model: "Seagate ST4000NE001-2MA101", status: "WARN", temperature: 48, reallocated: 16, pending: 2 },
          { name: "/dev/sdg", model: "Seagate ST4000NE001-2MA101", status: "OK", temperature: 38, reallocated: 0, pending: 0 },
          { name: "/dev/sdh", model: "Seagate ST4000NE001-2MA101", status: "OK", temperature: 42, reallocated: 0, pending: 0 },
        ],
      },
    },
    monitoring_error: null,
  };

  const hostPayload3 = {
    overall_status: "OK",
    storage_type: "RAID",
    components: {
      raid: {
        status: "OK",
        virtual_disks_degraded: 0,
        predictive_failures: 0,
        virtual_disks: [
          { name: "VD0", state: "ONLINE", size: "1.8TB", raid_level: "RAID-1" },
          { name: "VD1", state: "ONLINE", size: "7.2TB", raid_level: "RAID-5" },
        ],
      },
      smart: {
        status: "OK",
        disks_total: 5,
        disks_warning: 0,
        disks_failed: 0,
        disks: [
          { name: "/dev/sda", model: "Dell PERC H730 VD0", status: "OK", temperature: 32, reallocated: 0, pending: 0 },
          { name: "/dev/sdb", model: "Dell PERC H730 VD1-0", status: "OK", temperature: 35, reallocated: 0, pending: 0 },
          { name: "/dev/sdc", model: "Dell PERC H730 VD1-1", status: "OK", temperature: 36, reallocated: 0, pending: 0 },
          { name: "/dev/sdd", model: "Dell PERC H730 VD1-2", status: "OK", temperature: 34, reallocated: 0, pending: 0 },
          { name: "/dev/sde", model: "Dell PERC H730 VD1-3", status: "OK", temperature: 37, reallocated: 0, pending: 0 },
        ],
      },
    },
    monitoring_error: null,
  };

  const hostPayload4 = {
    overall_status: "UNKNOWN",
    storage_type: "UNKNOWN",
    components: {},
    monitoring_error: "SSH_TIMEOUT",
  };

  const [h1] = await db.insert(proxmoxHosts).values({
    customerId: c1.id,
    name: "PVE-MER-01",
    host: "10.0.1.10",
    port: 22,
    username: "root",
    password: encryptSecret("placeholder") || "placeholder",
    enabled: true,
    lastStatus: "OK",
    lastCheckAt: new Date(Date.now() - 30 * 60 * 1000),
    lastStatusDetails: hostPayload1,
    consecutiveFailures: 0,
  }).returning();

  const [h2] = await db.insert(proxmoxHosts).values({
    customerId: c1.id,
    name: "PVE-MER-02",
    host: "10.0.1.11",
    port: 22,
    username: "root",
    password: encryptSecret("placeholder") || "placeholder",
    enabled: true,
    lastStatus: "WARN",
    lastCheckAt: new Date(Date.now() - 35 * 60 * 1000),
    lastStatusDetails: hostPayload2,
    consecutiveFailures: 0,
  }).returning();

  const [h3] = await db.insert(proxmoxHosts).values({
    customerId: c2.id,
    name: "PVE-ATL-01",
    host: "10.0.2.10",
    port: 22,
    username: "root",
    password: encryptSecret("placeholder") || "placeholder",
    enabled: true,
    lastStatus: "OK",
    lastCheckAt: new Date(Date.now() - 25 * 60 * 1000),
    lastStatusDetails: hostPayload3,
    consecutiveFailures: 0,
  }).returning();

  const [h4] = await db.insert(proxmoxHosts).values({
    customerId: c3.id,
    name: "PVE-PIN-01",
    host: "10.0.3.10",
    port: 22,
    username: "root",
    password: encryptSecret("placeholder") || "placeholder",
    enabled: true,
    lastStatus: "UNKNOWN",
    lastCheckAt: new Date(Date.now() - 15 * 60 * 1000),
    lastStatusDetails: hostPayload4,
    consecutiveFailures: 3,
  }).returning();

  const [h5] = await db.insert(proxmoxHosts).values({
    customerId: c4.id,
    name: "PVE-GRN-01",
    host: "10.0.4.10",
    port: 22,
    username: "root",
    password: encryptSecret("placeholder") || "placeholder",
    enabled: false,
    lastStatus: "UNKNOWN",
    consecutiveFailures: 0,
  }).returning();

  const checkHistoryBase = Date.now();
  await db.insert(proxmoxChecks).values([
    { hostId: h1.id, checkedAt: new Date(checkHistoryBase - 30 * 60 * 1000), overallStatus: "OK", storageType: "ZFS", payloadJson: hostPayload1, monitoringError: null },
    { hostId: h1.id, checkedAt: new Date(checkHistoryBase - 90 * 60 * 1000), overallStatus: "OK", storageType: "ZFS", payloadJson: hostPayload1, monitoringError: null },
    { hostId: h1.id, checkedAt: new Date(checkHistoryBase - 150 * 60 * 1000), overallStatus: "OK", storageType: "ZFS", payloadJson: hostPayload1, monitoringError: null },
    { hostId: h2.id, checkedAt: new Date(checkHistoryBase - 35 * 60 * 1000), overallStatus: "WARN", storageType: "ZFS", payloadJson: hostPayload2, monitoringError: null },
    { hostId: h2.id, checkedAt: new Date(checkHistoryBase - 95 * 60 * 1000), overallStatus: "WARN", storageType: "ZFS", payloadJson: hostPayload2, monitoringError: null },
    { hostId: h2.id, checkedAt: new Date(checkHistoryBase - 155 * 60 * 1000), overallStatus: "OK", storageType: "ZFS", payloadJson: { ...hostPayload2, overall_status: "OK", components: { ...hostPayload2.components, zfs: { status: "OK", pools: [{ name: "rpool", state: "ONLINE" }, { name: "data", state: "ONLINE" }] } } }, monitoringError: null },
    { hostId: h3.id, checkedAt: new Date(checkHistoryBase - 25 * 60 * 1000), overallStatus: "OK", storageType: "RAID", payloadJson: hostPayload3, monitoringError: null },
    { hostId: h3.id, checkedAt: new Date(checkHistoryBase - 85 * 60 * 1000), overallStatus: "OK", storageType: "RAID", payloadJson: hostPayload3, monitoringError: null },
    { hostId: h4.id, checkedAt: new Date(checkHistoryBase - 15 * 60 * 1000), overallStatus: "UNKNOWN", storageType: "UNKNOWN", payloadJson: hostPayload4, monitoringError: "SSH_TIMEOUT" },
    { hostId: h4.id, checkedAt: new Date(checkHistoryBase - 75 * 60 * 1000), overallStatus: "UNKNOWN", storageType: "UNKNOWN", payloadJson: hostPayload4, monitoringError: "SSH_TIMEOUT" },
    { hostId: h4.id, checkedAt: new Date(checkHistoryBase - 135 * 60 * 1000), overallStatus: "UNKNOWN", storageType: "UNKNOWN", payloadJson: hostPayload4, monitoringError: "SSH_TIMEOUT" },
    { hostId: h4.id, checkedAt: new Date(checkHistoryBase - 195 * 60 * 1000), overallStatus: "OK", storageType: "ZFS", payloadJson: { ...hostPayload1, storage_type: "ZFS" }, monitoringError: null },
  ]);

  await db.insert(backupTargets).values([
    {
      customerId: c2.id,
      name: "Atlas PBS Primary",
      type: "PBS",
      host: "10.0.2.20",
      port: 8007,
      username: "root@pam",
      password: encryptSecret("placeholder") || "placeholder",
      enabled: true,
      totalBytes: "8000000000000",
      usedBytes: "5200000000000",
      lastPolledAt: new Date(Date.now() - 20 * 60 * 1000),
      pollStatus: "OK",
      pollError: null,
      datastoresJson: [
        { name: "vm-backups", totalBytes: "4000000000000", usedBytes: "2800000000000", snapshotCount: 142 },
        { name: "ct-backups", totalBytes: "2000000000000", usedBytes: "1200000000000", snapshotCount: 68 },
        { name: "offsite-sync", totalBytes: "2000000000000", usedBytes: "1200000000000", snapshotCount: 54 },
      ],
    },
    {
      customerId: c3.id,
      name: "Pinnacle Synology NAS",
      type: "SYNOLOGY",
      host: "10.0.3.50",
      port: 5001,
      username: "admin",
      password: encryptSecret("placeholder") || "placeholder",
      enabled: true,
      totalBytes: "16000000000000",
      usedBytes: "11200000000000",
      lastPolledAt: new Date(Date.now() - 15 * 60 * 1000),
      pollStatus: "OK",
      pollError: null,
      datastoresJson: [
        { name: "Volume 1", totalBytes: "8000000000000", usedBytes: "6400000000000", shareCount: 12 },
        { name: "Volume 2", totalBytes: "8000000000000", usedBytes: "4800000000000", shareCount: 8 },
      ],
    },
    {
      customerId: c1.id,
      name: "Meridian PBS Offsite",
      type: "PBS",
      host: "10.0.1.30",
      port: 8007,
      username: "backup@pbs",
      password: encryptSecret("placeholder") || "placeholder",
      enabled: true,
      totalBytes: "4000000000000",
      usedBytes: "800000000000",
      lastPolledAt: new Date(Date.now() - 45 * 60 * 1000),
      pollStatus: "OK",
      pollError: null,
      datastoresJson: [
        { name: "vm-replicas", totalBytes: "4000000000000", usedBytes: "800000000000", snapshotCount: 36 },
      ],
    },
    {
      customerId: c4.id,
      name: "Greenfield Synology DR",
      type: "SYNOLOGY",
      host: "10.0.4.50",
      port: 5001,
      username: "admin",
      password: encryptSecret("placeholder") || "placeholder",
      enabled: true,
      totalBytes: "32000000000000",
      usedBytes: "28800000000000",
      lastPolledAt: new Date(Date.now() - 10 * 60 * 1000),
      pollStatus: "OK",
      pollError: null,
      datastoresJson: [
        { name: "Volume 1", totalBytes: "16000000000000", usedBytes: "15200000000000", shareCount: 24 },
        { name: "Volume 2", totalBytes: "16000000000000", usedBytes: "13600000000000", shareCount: 18 },
      ],
    },
    {
      customerId: c2.id,
      name: "Atlas PBS Replica",
      type: "PBS",
      host: "10.0.2.21",
      port: 8007,
      username: "root@pam",
      password: encryptSecret("placeholder") || "placeholder",
      enabled: false,
      totalBytes: null,
      usedBytes: null,
      lastPolledAt: null,
      pollStatus: "ERROR",
      pollError: "Connection refused: host unreachable",
      datastoresJson: null,
    },
  ]);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  await db.insert(expectedRuns).values([
    {
      jobId: j1.id,
      scheduledFor: new Date(yesterday.setHours(1, 0, 0, 0)),
      deadlineAt: new Date(yesterday.getTime() + 6 * 60 * 60 * 1000),
      status: "OK",
    },
    {
      jobId: j2.id,
      scheduledFor: new Date(yesterday.setHours(3, 0, 0, 0)),
      deadlineAt: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000),
      status: "OK",
    },
    {
      jobId: j3.id,
      scheduledFor: new Date(yesterday.setHours(2, 0, 0, 0)),
      deadlineAt: new Date(yesterday.getTime() + 8 * 60 * 60 * 1000),
      status: "WARN",
    },
    {
      jobId: j4.id,
      scheduledFor: new Date(twoDaysAgo.setHours(4, 0, 0, 0)),
      deadlineAt: new Date(twoDaysAgo.getTime() + 6 * 60 * 60 * 1000),
      status: "FAIL",
    },
    {
      jobId: j1.id,
      scheduledFor: new Date(now.setHours(1, 0, 0, 0)),
      deadlineAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      status: "PENDING",
    },
  ]);

  await db.insert(incidents).values([
    {
      sourceType: "BACKUP",
      sourceId: j4.id,
      severity: "CRIT",
      title: "Pinnacle NAS backup failed",
      details: "Hyper Backup task reported error: Connection to remote server timed out after 300 seconds",
      state: "OPEN",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      sourceType: "PROXMOX",
      sourceId: null,
      severity: "WARN",
      title: "PVE-MER-02 ZFS pool degraded",
      details: "ZFS pool rpool is in DEGRADED state. One disk may need replacement.",
      state: "ACKED",
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
    {
      sourceType: "PROXMOX",
      sourceId: null,
      severity: "CRIT",
      title: "PVE-PIN-01 unreachable",
      details: "SSH connection failed for 3 consecutive attempts. Host may be down or firewall is blocking.",
      state: "OPEN",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
    {
      sourceType: "BACKUP",
      sourceId: j3.id,
      severity: "WARN",
      title: "Atlas PBS backup completed with warnings",
      details: "VM replication completed but some snapshots were skipped due to lock contention",
      state: "OPEN",
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
    {
      sourceType: "BACKUP",
      sourceId: j5.id,
      severity: "INFO",
      title: "Greenfield weekly backup completed successfully",
      details: "Full backup completed in 8h 42m. Total data: 2.1 TB.",
      state: "RESOLVED",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000),
    },
  ]);

  await db.insert(recipients).values([
    {
      customerId: null,
      name: "Admin Team",
      email: "admin@protectiveshell.local",
      type: "TECH",
      enabled: true,
    },
    {
      customerId: c1.id,
      name: "Meridian IT Manager",
      email: "it-manager@meridian.example",
      type: "TECH",
      enabled: true,
    },
    {
      customerId: c2.id,
      name: "Atlas Operations",
      email: "ops@atlas-financial.example",
      type: "CLIENT",
      enabled: true,
    },
  ]);

  const now2 = new Date();
  await db.insert(emails).values([
    {
      folder: "INBOX",
      uidvalidity: 1001,
      uid: 101,
      messageId: "<veeam-backup-001@meridian.local>",
      fromAddr: "veeam@meridian-dc1.local",
      subject: "Backup Job 'DC1 Full' completed successfully",
      receivedAt: new Date(now2.getTime() - 2 * 60 * 60 * 1000),
      snippet: "Backup job DC1 Full VM Backup completed. Duration: 3h 22m. Data: 845 GB. Status: Success. No warnings.",
      rawExcerpt: "From: veeam@meridian-dc1.local\nSubject: Backup Job 'DC1 Full' completed successfully\n\nBackup job DC1 Full VM Backup completed.\nDuration: 3h 22m\nData: 845 GB\nStatus: Success",
      ingestedOk: true,
      matchedJobId: j1.id,
    },
    {
      folder: "INBOX",
      uidvalidity: 1001,
      uid: 102,
      messageId: "<pbs-replication-002@atlas.local>",
      fromAddr: "pbs@atlas-pbs01.local",
      subject: "[PBS] Sync job 'vm-replication' OK",
      receivedAt: new Date(now2.getTime() - 5 * 60 * 60 * 1000),
      snippet: "Proxmox Backup Server sync job vm-replication finished successfully. Transferred 128 GiB in 2h 15m.",
      rawExcerpt: "From: pbs@atlas-pbs01.local\nSubject: [PBS] Sync job 'vm-replication' OK\n\nSync job vm-replication finished successfully.\nTransferred: 128 GiB\nDuration: 2h 15m",
      ingestedOk: true,
      matchedJobId: j3.id,
    },
    {
      folder: "INBOX",
      uidvalidity: 1001,
      uid: 103,
      messageId: "<veeam-unknown-003@unknown.local>",
      fromAddr: "veeam@newclient-dc.example.com",
      subject: "Backup Job 'Server2025-Daily' completed with warnings",
      receivedAt: new Date(now2.getTime() - 1 * 60 * 60 * 1000),
      snippet: "Backup job Server2025-Daily completed with 2 warnings. Duration: 4h 10m. Data: 1.2 TB. Warning: Snapshot consolidation required for VM 'SQLSRV01'.",
      rawExcerpt: "From: veeam@newclient-dc.example.com\nSubject: Backup Job 'Server2025-Daily' completed with warnings\n\nBackup job Server2025-Daily completed.\nDuration: 4h 10m\nData: 1.2 TB\nWarnings: 2\n- Snapshot consolidation required for VM 'SQLSRV01'",
      ingestedOk: false,
      matchedJobId: null,
    },
    {
      folder: "INBOX",
      uidvalidity: 1001,
      uid: 104,
      messageId: "<synology-backup-004@unknown.local>",
      fromAddr: "admin@synology-nas.techcorp.net",
      subject: "Hyper Backup - [TechCorp-NAS] Task 'CloudStation Backup' completed",
      receivedAt: new Date(now2.getTime() - 3 * 60 * 60 * 1000),
      snippet: "Hyper Backup task CloudStation Backup on TechCorp-NAS completed successfully. Total data backed up: 456 GB. Duration: 1h 30m.",
      rawExcerpt: "From: admin@synology-nas.techcorp.net\nSubject: Hyper Backup - [TechCorp-NAS] Task 'CloudStation Backup' completed\n\nTask: CloudStation Backup\nStatus: Completed\nTotal: 456 GB\nDuration: 1h 30m",
      ingestedOk: false,
      matchedJobId: null,
    },
    {
      folder: "INBOX",
      uidvalidity: 1001,
      uid: 105,
      messageId: "<pbs-error-005@unknown.local>",
      fromAddr: "root@pbs-backup02.datawise.io",
      subject: "[PBS] TASK ERROR: Backup group 'vm/110' - Sync job 'offsite-repl' failed",
      receivedAt: new Date(now2.getTime() - 30 * 60 * 1000),
      snippet: "TASK ERROR: Sync job 'offsite-repl' for backup group vm/110 failed. Error: connection to remote server timed out. Please check network connectivity.",
      rawExcerpt: "From: root@pbs-backup02.datawise.io\nSubject: [PBS] TASK ERROR: Backup group 'vm/110' - Sync job 'offsite-repl' failed\n\nTASK ERROR\nJob: offsite-repl\nGroup: vm/110\nError: connection to remote server timed out",
      ingestedOk: false,
      matchedJobId: null,
    },
    {
      folder: "INBOX",
      uidvalidity: 1001,
      uid: 106,
      messageId: "<veeam-success-006@unknown.local>",
      fromAddr: "notifications@veeam-srv.lawfirm.co",
      subject: "Veeam: Backup copy job 'LegalDocs-Offsite' completed",
      receivedAt: new Date(now2.getTime() - 8 * 60 * 60 * 1000),
      snippet: "Backup copy job LegalDocs-Offsite completed successfully. Copied 89 restore points. Total data: 234 GB.",
      rawExcerpt: "From: notifications@veeam-srv.lawfirm.co\nSubject: Veeam: Backup copy job 'LegalDocs-Offsite' completed\n\nJob: LegalDocs-Offsite\nRestore Points: 89\nTotal: 234 GB\nStatus: Success",
      ingestedOk: false,
      matchedJobId: null,
    },
  ]);

  await db.insert(appSettings).values([
    { key: "APP_TIMEZONE", value: "America/New_York" },
    { key: "IMAP_PORT", value: "993" },
    { key: "IMAP_POLL_INTERVAL", value: "60" },
    { key: "SMTP_PORT", value: "587" },
    { key: "RETENTION_DAYS", value: "7" },
    { key: "SSH_TIMEOUT", value: "10" },
    { key: "CONSECUTIVE_FAILURE_THRESHOLD", value: "3" },
    { key: "DAILY_REPORT_TIME", value: "08:00" },
  ]);

  console.log("Database seeded successfully");
}
