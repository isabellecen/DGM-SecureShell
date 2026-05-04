import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { collectProxmoxHealth } from "./proxmoxCollector";
import { pollBackupTarget } from "./backupPoller";


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Dashboard
  app.get("/api/dashboard/stats", async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  // Customers
  app.get("/api/customers", async (_req, res) => {
    const result = await storage.getCustomers();
    res.json(result);
  });

  app.post("/api/customers", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required" });
    }
    const result = await storage.createCustomer({ name });
    res.status(201).json(result);
  });

  app.patch("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await storage.updateCustomer(id, req.body);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json(result);
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteCustomer(id);
    res.status(204).send();
  });

  // Jobs
  app.get("/api/jobs", async (_req, res) => {
    const result = await storage.getJobs();
    res.json(result);
  });

  app.post("/api/jobs", async (req, res) => {
    const { name, systemType, customerId, scheduleType, scheduleTime, windowHours, enabled, longRunning, longWindowHours, daysOfWeek } = req.body;
    if (!name || !systemType) {
      return res.status(400).json({ message: "Name and systemType are required" });
    }
    const result = await storage.createJob({
      name,
      systemType,
      customerId: customerId || null,
      scheduleType: scheduleType || "daily",
      scheduleTime: scheduleTime || "02:00",
      windowHours: windowHours || 6,
      enabled: enabled !== false,
      longRunning: longRunning || false,
      longWindowHours: longWindowHours || 24,
      daysOfWeek: daysOfWeek || [],
    });
    res.status(201).json(result);
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await storage.updateJob(id, req.body);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json(result);
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteJob(id);
    res.status(204).send();
  });

  // Proxmox Hosts
  app.get("/api/proxmox-hosts", async (_req, res) => {
    const result = await storage.getProxmoxHosts();
    const sanitized = result.map((h) => ({
      ...h,
      password: "***",
    }));
    res.json(sanitized);
  });

  app.get("/api/proxmox-hosts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const host = await storage.getProxmoxHost(id);
    if (!host) return res.status(404).json({ message: "Not found" });
    const allHosts = await storage.getProxmoxHosts();
    const withCustomer = allHosts.find(h => h.id === id);
    res.json({ ...(withCustomer || host), password: "***" });
  });

  app.post("/api/proxmox-hosts", async (req, res) => {
    const { name, host, port, username, password, customerId, enabled } = req.body;
    if (!name || !host || !username || !password) {
      return res.status(400).json({ message: "Name, host, username, and password are required" });
    }
    const result = await storage.createProxmoxHost({
      name,
      host,
      port: port || 22,
      username,
      password,
      customerId: customerId || null,
      enabled: enabled !== false,
    });
    res.status(201).json({ ...result, password: "***" });
  });

  app.patch("/api/proxmox-hosts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getProxmoxHost(id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const updateData: any = { ...req.body };
    if (!updateData.password) {
      delete updateData.password;
    }

    const result = await storage.updateProxmoxHost(id, updateData);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json({ ...result, password: "***" });
  });

  app.delete("/api/proxmox-hosts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteProxmoxHost(id);
    res.status(204).send();
  });

  app.get("/api/proxmox-hosts/:id/checks", async (req, res) => {
    const id = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const checks = await storage.getProxmoxChecks(id, limit);
    res.json(checks);
  });

app.post("/api/proxmox-hosts/:id/run-check", async (req, res) => {
  const id = parseInt(req.params.id);
  const host = await storage.getProxmoxHost(id);
  if (!host) return res.status(404).json({ message: "Host not found" });

  const result = await collectProxmoxHealth({
    host: host.host,
    port: host.port,
    username: host.username,
    password: host.password,
  });

  const check = await storage.createProxmoxCheck({
    hostId: id,
    checkedAt: new Date(),
    overallStatus: result.overall_status,
    storageType: result.storage_type,
    payloadJson: result.components,
    monitoringError: result.monitoring_error,
  });

  await storage.updateProxmoxHost(id, {
    lastCheckAt: new Date(),
    lastStatus: result.overall_status,
    lastStatusDetails: result,
  });

  res.json(check);
});



  // Backup Targets
  app.get("/api/backup-targets", async (_req, res) => {
    const result = await storage.getBackupTargets();
    const sanitized = result.map((t) => ({
      ...t,
      password: "***",
    }));
    res.json(sanitized);
  });

  app.get("/api/backup-targets/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const target = await storage.getBackupTarget(id);
    if (!target) return res.status(404).json({ message: "Not found" });
    const allTargets = await storage.getBackupTargets();
    const withCustomer = allTargets.find(t => t.id === id);
    res.json({ ...(withCustomer || target), password: "***" });
  });

  app.post("/api/backup-targets", async (req, res) => {
    const { name, type, host, port, username, password, customerId, enabled } = req.body;
    if (!name || !type || !host || !username || !password) {
      return res.status(400).json({ message: "Name, type, host, username, and password are required" });
    }
    if (!["SYNOLOGY", "PBS"].includes(type)) {
      return res.status(400).json({ message: "Type must be SYNOLOGY or PBS" });
    }
    const result = await storage.createBackupTarget({
      name,
      type,
      host,
      port: port || 443,
      username,
      password,
      customerId: customerId || null,
      enabled: enabled !== false,
    });
    res.status(201).json({ ...result, password: "***" });
  });

  app.patch("/api/backup-targets/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getBackupTarget(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const updateData: any = { ...req.body };
    if (!updateData.password) {
      delete updateData.password;
    }
    const result = await storage.updateBackupTarget(id, updateData);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json({ ...result, password: "***" });
  });

  app.delete("/api/backup-targets/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteBackupTarget(id);
    res.status(204).send();
  });

  app.post("/api/backup-targets/:id/poll", async (req, res) => {
    const id = parseInt(req.params.id);
    const target = await storage.getBackupTarget(id);
    if (!target) return res.status(404).json({ message: "Not found" });

    const result = await pollBackupTarget({
      type: target.type as "SYNOLOGY" | "PBS",
      host: target.host,
      port: target.port,
      username: target.username,
      password: target.password,
    });

    const updateData: Record<string, any> = {
      lastPolledAt: new Date(),
      pollStatus: result.pollStatus,
      pollError: result.pollError,
    };

    if (result.pollStatus === "OK" && result.totalBytes && result.usedBytes) {
      updateData.totalBytes = result.totalBytes;
      updateData.usedBytes = result.usedBytes;
      updateData.datastoresJson = result.datastoresJson;
    }

    await storage.updateBackupTarget(id, updateData);
    const allTargets = await storage.getBackupTargets();
    const withCustomer = allTargets.find(t => t.id === id);
    res.json({ ...(withCustomer || target), ...updateData, password: "***" });
  });

  // Incidents
  app.get("/api/incidents", async (_req, res) => {
    const result = await storage.getIncidents();
    res.json(result);
  });

  app.patch("/api/incidents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const { state } = req.body;
    if (!state || !["OPEN", "ACKED", "RESOLVED"].includes(state)) {
      return res.status(400).json({ message: "Valid state is required (OPEN, ACKED, RESOLVED)" });
    }
    const result = await storage.updateIncidentState(id, state);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json(result);
  });

  // Recipients
  app.get("/api/recipients", async (_req, res) => {
    const result = await storage.getRecipients();
    res.json(result);
  });

  app.post("/api/recipients", async (req, res) => {
    const { name, email, type, customerId, enabled } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    const result = await storage.createRecipient({
      name,
      email,
      type: type || "TECH",
      customerId: customerId || null,
      enabled: enabled !== false,
    });
    res.status(201).json(result);
  });

  app.patch("/api/recipients/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await storage.updateRecipient(id, req.body);
    if (!result) return res.status(404).json({ message: "Not found" });
    res.json(result);
  });

  app.delete("/api/recipients/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteRecipient(id);
    res.status(204).send();
  });

  // Job Rules
  app.get("/api/job-rules", async (req, res) => {
    const jobId = req.query.jobId ? parseInt(req.query.jobId as string) : undefined;
    const result = await storage.getJobRules(jobId);
    res.json(result);
  });

  app.post("/api/job-rules", async (req, res) => {
    const { jobId, senderMatch, subjectMatch, bodyMatch, priority } = req.body;
    if (!jobId) {
      return res.status(400).json({ message: "jobId is required" });
    }
    const result = await storage.createJobRule({
      jobId,
      senderMatch: senderMatch || null,
      subjectMatch: subjectMatch || null,
      bodyMatch: bodyMatch || null,
      priority: priority || 0,
    });
    res.status(201).json(result);
  });

  app.delete("/api/job-rules/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteJobRule(id);
    res.status(204).send();
  });

  // Expected Runs (read-only for UI)
  app.get("/api/expected-runs", async (_req, res) => {
    const result = await storage.getExpectedRuns(50);
    res.json(result);
  });

  // Emails
  app.get("/api/emails", async (_req, res) => {
    const result = await storage.getEmails(50);
    res.json(result);
  });

  app.get("/api/emails/unmatched", async (_req, res) => {
    const result = await storage.getUnmatchedEmails();
    res.json(result);
  });

  app.get("/api/emails/matched", async (_req, res) => {
    const result = await storage.getMatchedEmails(50);
    res.json(result);
  });

  app.get("/api/emails/unmatched-count", async (_req, res) => {
    const count = await storage.getUnmatchedEmailCount();
    res.json({ count });
  });

  app.get("/api/emails/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await storage.getEmail(id);
    if (!result) {
      return res.status(404).json({ message: "Email not found" });
    }
    res.json(result);
  });

  app.post("/api/emails/:id/link-job", async (req, res) => {
    const emailId = parseInt(req.params.id);
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ message: "jobId is required" });
    }
    const result = await storage.linkEmailToJob(emailId, jobId);
    if (!result) {
      return res.status(404).json({ message: "Email not found" });
    }
    res.json(result);
  });

  // Events (read-only for UI)
  app.get("/api/events", async (_req, res) => {
    const result = await storage.getEvents(50);
    res.json(result);
  });

  // Notification Routes
  app.get("/api/notification-routes", async (_req, res) => {
    const result = await storage.getNotificationRoutes();
    res.json(result);
  });

  app.post("/api/notification-routes", async (req, res) => {
    const { scopeType, scopeId, eventType, severityMin, recipientsJson } = req.body;
    if (!eventType) {
      return res.status(400).json({ message: "eventType is required" });
    }
    const result = await storage.createNotificationRoute({
      scopeType: scopeType || "GLOBAL",
      scopeId: scopeId || null,
      eventType,
      severityMin: severityMin || "WARN",
      recipientsJson: recipientsJson || null,
    });
    res.status(201).json(result);
  });

  app.delete("/api/notification-routes/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteNotificationRoute(id);
    res.status(204).send();
  });

  // Settings
  app.get("/api/settings", async (_req, res) => {
    const result = await storage.getSettings();
    res.json(result);
  });

  app.post("/api/settings", async (req, res) => {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ message: "Key is required" });
    }
    const result = await storage.upsertSetting(key, value || "");
    res.json(result);
  });

  return httpServer;
}
