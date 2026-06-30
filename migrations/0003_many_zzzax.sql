ALTER TABLE "events" ADD COLUMN "source_type" text DEFAULT 'EMAIL' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_fingerprint" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "payload_json" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "webhook_source" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "webhook_job_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "webhook_host" text;--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_fingerprint_idx" ON "events" USING btree ("source_fingerprint");--> statement-breakpoint
CREATE INDEX "jobs_webhook_lookup_idx" ON "jobs" USING btree ("webhook_source","webhook_job_id","webhook_host");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_type_check" CHECK ("events"."source_type" IN ('EMAIL', 'PROXMOX_WEBHOOK'));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_webhook_source_check" CHECK ("jobs"."webhook_source" IS NULL OR "jobs"."webhook_source" IN ('PVE', 'PBS'));