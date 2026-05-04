# ProtectiveShell - Monitoring Dashboard

## Overview
ProtectiveShell is an internal monitoring dashboard for backup outcomes and infrastructure health. It monitors backup jobs via IMAP email notifications (Veeam, PBS, Synology) and Proxmox host health via SSH.

## Current State
MVP implementation with:
- Dashboard overview with stats widgets
- Email Inbox with Unmatched/Matched tabs for incoming backup notifications
  - "Create Job From This Email" workflow (auto-fills job name, detects system type, creates matching rule)
  - "Link to Existing Job" workflow
  - Sidebar badge showing unmatched email count
- Backup job CRUD management
- Backup Storage page showing capacity/remaining space for Synology NAS and PBS targets
  - Per-target capacity bars with usage percentages (green <75%, amber 75-90%, red >90%)
  - Datastore/volume breakdown with individual usage bars
  - Summary stats (total targets, overall usage, warnings, free space)
  - "Poll Now" button for each target
  - Error state display for unreachable targets
- Proxmox Health dashboard with enhanced host cards showing:
  - Storage type detection (ZFS/RAID/mdadm/Mixed)
  - Health summary lines (degraded pools, SMART warnings, monitoring errors)
  - Component-level badges (ZFS/SMART/RAID/mdadm with status colors)
  - "Run Check Now" button, consecutive failure count
  - Click-through to detail page with Overview/Disks/Pools-Arrays/History tabs
  - Check history timeline with status transitions
- Proxmox host CRUD management
- Incident tracking with state management (OPEN/ACKED/RESOLVED)
- Customer management
- Settings page for IMAP/SMTP/General configuration
- Notification recipient management
- Dark/light theme toggle with dark orange & black color scheme
- Seed data for realistic demo (including 6 sample emails)

## Tech Stack
- **Frontend**: React + TypeScript, Vite, TailwindCSS, Shadcn UI, Wouter routing, TanStack Query
- **Backend**: Express.js, PostgreSQL, Drizzle ORM
- **Database**: PostgreSQL via Drizzle ORM (node-postgres driver)

## Project Structure
```
client/src/
  App.tsx                  - Main app with sidebar layout and routes
  components/
    app-sidebar.tsx        - Sidebar navigation
    theme-toggle.tsx       - Dark/light mode toggle
    status-badge.tsx       - Status indicators (OK/WARN/CRIT etc.)
    ui/                    - Shadcn UI components
  pages/
    dashboard.tsx          - Overview dashboard with stats
    email-inbox.tsx        - Email inbox with unmatched/matched tabs, create job from email
    jobs.tsx              - Backup job management
    backup-storage.tsx    - Backup storage capacity monitoring
    proxmox.tsx           - Proxmox host monitoring (card grid with health summary)
    proxmox-detail.tsx     - Proxmox host detail (Overview/Disks/Pools/History tabs)
    incidents.tsx         - Incident tracking
    customers.tsx         - Customer management
    settings.tsx          - IMAP/SMTP/Recipients/General settings
  lib/
    theme-provider.tsx    - Theme context provider
    queryClient.ts        - TanStack Query config

server/
  index.ts               - Express server entry
  routes.ts              - All API routes
  storage.ts             - Database storage layer
  db.ts                  - Drizzle DB connection
  seed.ts                - Seed data

shared/
  schema.ts              - Drizzle schema (customers, jobs, proxmox_hosts, incidents, etc.)
```

## API Routes
- GET/POST /api/customers, PATCH/DELETE /api/customers/:id
- GET/POST /api/jobs, PATCH/DELETE /api/jobs/:id
- GET/POST /api/proxmox-hosts, GET /api/proxmox-hosts/:id, PATCH/DELETE /api/proxmox-hosts/:id
- GET /api/proxmox-hosts/:id/checks, POST /api/proxmox-hosts/:id/run-check
- GET/POST /api/backup-targets, GET/PATCH/DELETE /api/backup-targets/:id
- POST /api/backup-targets/:id/poll
- GET /api/incidents, PATCH /api/incidents/:id
- GET/POST /api/recipients, PATCH/DELETE /api/recipients/:id
- GET /api/emails, GET /api/emails/unmatched, GET /api/emails/matched, GET /api/emails/unmatched-count
- GET /api/emails/:id, POST /api/emails/:id/link-job
- GET/POST /api/job-rules, DELETE /api/job-rules/:id
- GET/POST /api/notification-routes, DELETE /api/notification-routes/:id
- GET /api/expected-runs, GET /api/events
- GET/POST /api/settings
- GET /api/dashboard/stats

## Running
- `npm run dev` starts both frontend and backend on port 5000

## User Preferences
- Dark mode by default
- Monitoring/infrastructure focused UI
