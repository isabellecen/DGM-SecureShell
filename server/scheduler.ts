import { and, eq, lt } from "drizzle-orm";
import { db } from "./db";
import { expectedRuns, incidents, jobs } from "@shared/schema";
import {
  listEnabledBackupTargetIds,
  listEnabledProxmoxHostIds,
  pollBackupTargetAndPersist,
  runProxmoxHostCheck,
} from "./monitoring";

let started = false;

function intervalMs(envName: string, fallbackMinutes: number): number {
  const minutes = Number(process.env[envName] || fallbackMinutes);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : fallbackMinutes;
  return safeMinutes * 60 * 1000;
}

function schedule(name: string, interval: number, task: () => Promise<void>) {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      console.error(`${name} scheduler failed:`, err);
    }
  };

  void run();
  const timer = setInterval(run, interval);
  timer.unref?.();
}

export function startScheduler() {
  if (started || process.env.NODE_ENV === "test" || process.env.DISABLE_SCHEDULER === "1") {
    return;
  }
  started = true;

  schedule("proxmox", intervalMs("PROXMOX_POLL_INTERVAL_MINUTES", 5), async () => {
    for (const hostId of await listEnabledProxmoxHostIds()) {
      await runProxmoxHostCheck(hostId);
    }
  });

  schedule("backup-target", intervalMs("BACKUP_TARGET_POLL_INTERVAL_MINUTES", 30), async () => {
    for (const targetId of await listEnabledBackupTargetIds()) {
      await pollBackupTargetAndPersist(targetId);
    }
  });

  schedule("expected-run-producer", 15 * 60 * 1000, produceExpectedRuns);
  schedule("expected-runs", 60 * 1000, evaluateExpectedRunDeadlines);
}

async function produceExpectedRuns() {
  const activeJobs = await db.select().from(jobs).where(eq(jobs.enabled, true));
  const now = new Date();

  for (const job of activeJobs) {
    for (const scheduledFor of nextScheduledTimes(job, now)) {
      const [existing] = await db
        .select({ id: expectedRuns.id })
        .from(expectedRuns)
        .where(and(eq(expectedRuns.jobId, job.id), eq(expectedRuns.scheduledFor, scheduledFor)))
        .limit(1);

      if (existing) {
        continue;
      }

      const windowHours = job.longRunning ? job.longWindowHours || job.windowHours : job.windowHours;
      await db.insert(expectedRuns).values({
        jobId: job.id,
        scheduledFor,
        deadlineAt: new Date(scheduledFor.getTime() + windowHours * 60 * 60 * 1000),
        status: "PENDING",
      });
    }
  }
}

function nextScheduledTimes(job: typeof jobs.$inferSelect, now: Date): Date[] {
  const times: Date[] = [];
  const [hoursRaw, minutesRaw] = job.scheduleTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return times;
  }

  for (let offset = 0; offset <= 1; offset++) {
    const scheduled = new Date(now);
    scheduled.setDate(now.getDate() + offset);
    scheduled.setHours(hours, minutes, 0, 0);

    if (job.scheduleType === "weekly") {
      const dayName = scheduled.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
      if (!job.daysOfWeek?.map((day) => day.toLowerCase()).includes(dayName)) {
        continue;
      }
    }

    const windowHours = job.longRunning ? job.longWindowHours || job.windowHours : job.windowHours;
    const deadlineAt = new Date(scheduled.getTime() + windowHours * 60 * 60 * 1000);
    if (deadlineAt > now) {
      times.push(scheduled);
    }
  }

  return times;
}

async function evaluateExpectedRunDeadlines() {
  const now = new Date();
  const missingRuns = await db
    .update(expectedRuns)
    .set({ status: "MISSING" })
    .where(and(eq(expectedRuns.status, "PENDING"), lt(expectedRuns.deadlineAt, now)))
    .returning();

  for (const run of missingRuns) {
    await db.insert(incidents).values({
      sourceType: "BACKUP",
      sourceId: run.jobId,
      severity: "CRIT",
      title: `Backup job #${run.jobId} missed its deadline`,
      details: `Expected run #${run.id} was due by ${run.deadlineAt.toISOString()}.`,
      state: "OPEN",
    });
  }
}
