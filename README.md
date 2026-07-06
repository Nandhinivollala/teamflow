# TeamFlow

TeamFlow is a collaboration workspace for engineering delivery, incident investigation, RCA review, notifications, and reporting. The v1 architecture is an extensible modular monolith built with Next.js, TypeScript, PostgreSQL, and Prisma.

## Current state

- Responsive dashboard and interactive task workspace
- Kanban, list, and calendar task views with search, status filtering, and filter-scoped CSV export
- PostgreSQL-backed task reads with live dependency and assignee-capacity warnings
- Server-authorized task creation with transactional project association, audit entry, and outbox event
- Authorized task title, priority, due-date, workflow, and assignee editing with transactional audit/outbox records
- Same-project multi-dependency editing with non-blocking conflict visibility
- PostgreSQL-backed RCA review screen with structured sections, reviewer reassignment, mandatory comments, and approval/rejection decisions
- Live dashboard reporting for open, overdue, completion, pending-review, and project-progress metrics
- Event-driven in-app task-assignment notifications with database-level deduplication
- Project settings with manager-authorized membership and role administration
- Persisted task comments with project-scoped @mentions and deduplicated mention notifications
- Live reports for status distribution, completion health, RCA volume, and assignee workload
- Relational foundation for users, projects, persistent project views, multi-project tasks, dependencies, comments, mentions, attachments, structured RCAs, reviews, notifications, outbox events, and audit records
- Server-side permission vocabulary for the confirmed Admin, Project Manager, Member, and assigned-reviewer authorities
- Non-blocking dependency and assignee-overload warning policy
- RCA review policy requiring comments, every assigned decision, and unanimous approval before closure
- Deduplicated in-app notification delivery for assignments, mentions, and reviews
- PostgreSQL migrations and idempotent foundation seed
- Authenticated task-photo uploads using local development storage, image allowlisting, and a 1 MiB limit
- Provider boundaries retained for optional future integrations
- Eighteen passing domain-policy tests using Node's built-in test runner
- One-time forgot-password flow with expiring reset tokens stored in PostgreSQL

## Prerequisites

- Node.js 20.9 or newer
- pnpm
- PostgreSQL 15 or newer

## Setup

```bash
pnpm install
copy .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

> On macOS or Linux, use `cp .env.example .env`.

## Environment variables

| Variable | Required now | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | When auth is enabled | Session signing |
| `MAX_IMAGE_UPLOAD_BYTES` | No | Image limit; defaults to 1 MiB |

Never commit `.env` or provider credentials.

## Architecture

Domain code belongs under `src/modules`, not in React components or route handlers. Core writes remain synchronous and transactional. Secondary effects are emitted as domain events and can be delivered through the transactional outbox. Reporting queries remain separate from write-side services.

See [docs/architecture.md](docs/architecture.md) for the architecture, ERD, interaction overview, tradeoffs, and future deployment scenarios.
See [docs/source-reconciliation.md](docs/source-reconciliation.md) for the rules recovered from the supplied assignment and question paper.

## Assumptions

- An Admin has system-wide authority.
- A Project Manager manages a project, membership, and reviewer assignment.
- A Member contributes within a project.
- RCA review authority comes from an explicit review assignment.
- Task dependency and overload findings warn without blocking a save.
- Every assigned reviewer must decide and comment; only unanimous approval permits RCA closure.
- Tasks use To do, In progress, In review, Blocked, Done, and Cancelled with controlled reopen/restore paths.
- A Project Manager may reassign a pending review to another project member or leave it without a replacement.
- Task attachments are photos only and must be no larger than 1 MiB.
- External email is intentionally outside v1; all required alerts appear in the in-app inbox.
- Forgot-password reset links are shown directly in the app because email delivery is not configured in v1.

## Known limitations

- Authentication uses local credentials and signed HTTP-only sessions; external identity-provider integration is not implemented.
- Password reset uses one-time database tokens; because no email provider is configured, the reset link is surfaced directly in the UI after request.
- Uploaded images use ignored local disk storage in development; production should replace this adapter with durable object storage.
- The local PostgreSQL migrations and seed have been executed successfully.
- The assignee-capacity threshold must be supplied by project configuration because the source defines the warning but not the overload threshold.
- The non-dashboard Figma screens still need manual visual review.

## Useful commands

```bash
pnpm lint
pnpm build
pnpm test:domain
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```
