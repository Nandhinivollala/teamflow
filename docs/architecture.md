# Architecture and decisions

## System context

```mermaid
flowchart LR
  User["Browser user"] --> App["TeamFlow modular monolith"]
  App --> DB[("PostgreSQL")]
  App --> Store["S3-compatible object storage"]
  App --> Email["Email provider"]
```

The Next.js application is one deployable unit. Modules own their rules and expose application services; route handlers adapt HTTP requests to those services. PostgreSQL is the source of truth. Files use object storage while PostgreSQL retains ownership and metadata.

## Module boundaries

```mermaid
flowchart TD
  Web["Next.js UI / route handlers"] --> Auth
  Web --> Projects
  Web --> Tasks
  Web --> RCA["Incidents and RCA"]
  Tasks --> Events["Domain events + outbox"]
  RCA --> Reviews
  Reviews --> Events
  Events --> Notifications
  Notifications --> Email
  Projects --> DB[("PostgreSQL")]
  Tasks --> DB
  RCA --> DB
  Reviews --> DB
  Notifications --> DB
  Reports["Reporting queries"] --> DB
  Files --> Storage["Object-storage adapter"]
```

## Domain model

```mermaid
erDiagram
  USER ||--o{ PROJECT_MEMBERSHIP : joins
  PROJECT ||--o{ PROJECT_MEMBERSHIP : has
  USER ||--o{ USER_PROJECT_PREFERENCE : selects
  PROJECT ||--o{ USER_PROJECT_PREFERENCE : persists
  USER ||--o{ TASK : creates
  USER o|--o{ TASK : is_assigned
  TASK o|--o{ TASK : parent_of
  TASK ||--o{ TASK_PROJECT : tracked_in
  PROJECT ||--o{ TASK_PROJECT : tracks
  TASK ||--o{ TASK_DEPENDENCY : blocked_task
  TASK ||--o{ TASK_DEPENDENCY : blocking_task
  PROJECT ||--o{ ROOT_CAUSE_ANALYSIS : contains
  USER ||--o{ ROOT_CAUSE_ANALYSIS : creates
  ROOT_CAUSE_ANALYSIS ||--o{ RCA_SECTION : structures
  ROOT_CAUSE_ANALYSIS ||--o{ REVIEW_ASSIGNMENT : receives
  USER ||--o{ REVIEW_ASSIGNMENT : reviews
  USER ||--o{ NOTIFICATION : receives
  NOTIFICATION ||--o{ NOTIFICATION_DELIVERY : dispatches
  TASK o|--o{ COMMENT : discusses
  ROOT_CAUSE_ANALYSIS o|--o{ COMMENT : discusses
  COMMENT ||--o{ COMMENT_MENTION : mentions
  USER ||--o{ COMMENT_MENTION : receives
  TASK o|--o{ ATTACHMENT : owns
  ROOT_CAUSE_ANALYSIS o|--o{ ATTACHMENT : owns
  USER o|--o{ AUDIT_LOG : acts
```

`TaskProject` supports a task tracked in several projects. `TaskDependency` is a directed edge and rejects direct self-reference in PostgreSQL. Dependency conflicts remain saveable and are returned as warnings. Attachments and comments each enforce exactly one parent (task or RCA). Notification delivery is separated by channel while one event-level record owns deduplication.

## Service interaction

```mermaid
sequenceDiagram
  actor User
  participant Route as Route handler
  participant Service as Domain application service
  participant DB as PostgreSQL transaction
  participant Worker as Event dispatcher
  participant Provider as Email or storage adapter
  User->>Route: Authenticated command
  Route->>Service: Actor + validated input
  Service->>Service: Permission and invariant checks
  Service->>DB: Aggregate write + audit + outbox
  DB-->>Service: Commit
  Service-->>Route: Result
  Route-->>User: Immediate response
  Worker->>DB: Claim outbox event
  Worker->>Provider: Secondary effect
```

## Decision log

| Decision | Selected | Alternative | Tradeoff and rationale |
| --- | --- | --- | --- |
| Deployment | Modular monolith | Microservices | Faster delivery and cheaper operation; module boundaries preserve extraction paths. |
| Database | PostgreSQL | NoSQL | Transactions, joins, uniqueness, and foreign keys match memberships, dependencies, reviews, and audit. |
| Core communication | Synchronous | Fully asynchronous | Users receive immediate validation and authoritative outcomes. |
| Secondary effects | Domain events and outbox | Inline provider calls | More moving parts, but avoids coupling successful writes to email/storage availability. |
| Files | Object storage adapter | Database blobs/local disk | Requires a provider, but scales independently and keeps database backups focused. |
| Multi-project tasks | Explicit join entity | Duplicate tasks | One task identity avoids divergent copies and supports indexed project queries. |
| Authorization | Server-enforced roles plus assignment authority | UI-only checks | Every mutation remains safe regardless of client behavior. |
| Dependency conflict | Non-blocking warning | Reject save/transition | Preserves planning flexibility while making risk visible, matching the recovered product decision. |
| RCA closure | Unanimous assigned approval | Majority/first approval | Slower completion, but every reviewer is accountable and rejection cannot be bypassed. |
| Notification failure | Surface email failure, no silent retry | Automatic retries | Clear v1 behavior and lower operational complexity; failed delivery remains recorded. |

## Future scenarios (not implemented)

- **Offline-first:** append client commands to a local queue, use versioned aggregates and conflict responses, and synchronize through idempotency keys.
- **Compliance:** single-tenant deployment options, immutable audit export, customer-managed keys, retention policies, and evidence-producing access reviews.
- **High scale:** read replicas, partitioned audit/outbox tables, cached reporting projections, queued event delivery, and selective module extraction.
- **Multi-region:** a home region per project or tenant, globally replicated reads, region-aware object storage, and explicit conflict ownership.
- **Extreme low cost:** one small application instance, managed/serverless PostgreSQL, provider free tiers, and an in-process outbox dispatcher.
