import type { Express, Request, Response } from "express";
import { storage } from "./storage";

const auditedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const redactedKey = /(pass|password|secret|token|private[_-]?key|api[_-]?key)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactedKey.test(key) ? "[redacted]" : sanitize(entry),
      ]),
    );
  }

  return value;
}

function entityFromPath(path: string): { entityType: string; entityId?: string } {
  const segments = path.split("/").filter(Boolean);
  const entityType = segments[1] || "api";
  const maybeId = segments[2];
  return {
    entityType,
    entityId: maybeId && /^\d+$/.test(maybeId) ? maybeId : undefined,
  };
}

function actionFor(req: Request): string {
  if (req.method === "POST" && req.path.includes("/test-")) return "test";
  if (req.method === "POST" && req.path.includes("/run")) return "run";
  if (req.method === "POST" && req.path.includes("/poll")) return "poll";
  if (req.method === "POST") return "create";
  if (req.method === "PATCH" || req.method === "PUT") return "update";
  if (req.method === "DELETE") return "delete";
  return req.method.toLowerCase();
}

function actorFor(req: Request): string {
  return req.user?.username || "system";
}

function shouldAudit(req: Request, res: Response): boolean {
  if (!req.path.startsWith("/api") || !auditedMethods.has(req.method)) return false;
  if (req.path.startsWith("/api/auth/")) return false;
  if (res.statusCode < 200 || res.statusCode >= 300) return false;
  return true;
}

export function registerAudit(app: Express) {
  app.use((req, res, next) => {
    res.on("finish", () => {
      if (!shouldAudit(req, res)) {
        return;
      }

      const { entityType, entityId } = entityFromPath(req.path);
      const action = actionFor(req);
      void storage.createAuditLog({
        actor: actorFor(req),
        action,
        entityType,
        entityId,
        summary: `${actorFor(req)} ${action} ${req.method} ${req.path}`,
        metadataJson: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          body: sanitize(req.body),
          query: sanitize(req.query),
        },
      }).catch((err) => {
        console.warn("Audit log write failed:", err);
      });
    });

    next();
  });
}

export const auditInternals = {
  sanitize,
  entityFromPath,
};
