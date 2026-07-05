# Source reconciliation

## Authority order

1. `TeamFlow_Assignment_1.pdf` defines the assessed deliverables and asks the candidate to choose and justify business rules.
2. `TeamFlow_Question_paper.docx` records the candidate's selected product rules and v1 capabilities.
3. The project handoff records prior planning, but its warning that business rules were missing is superseded where the question paper supplies an explicit outcome.

## Recovered decisions

| Area | Recovered outcome | Implementation |
| --- | --- | --- |
| Dependency conflict | Warn; do not block save | `evaluateTaskWarnings` |
| Assignee overload | Warn; do not block save | `evaluateTaskWarnings`, configurable capacity |
| RCA decision | Approved or Rejected with mandatory comment | `submitReview`, database check |
| RCA closure | Every assigned reviewer decides; unanimous approval required | `evaluateRcaReviews` |
| Split review | Record both decisions and keep RCA open | `CHANGES_REQUIRED` outcome |
| Notification triggers | Assignment, status change, RCA submission, review decision | Event-type policy |
| Delivery | In-app and email from one event pipeline | Notification plus delivery records |
| Duplicate alerts | Suppress | Unique deduplication key |
| Email opt-out | Per user | `emailNotificationsEnabled` |
| Email failure | Surface directly; no silent background retry | `shouldRetryDelivery` returns false |
| Collaboration | Task/RCA comments, mentions, attachments | Relational models and mention parser |
| Views | Kanban, calendar, list; preference per user/project | `UserProjectPreference` |
| Theme | Immediate light/dark toggle, browser-bound | UI responsibility; no cross-device persistence |

Claims in the question paper's evaluation section are treated as target acceptance scenarios, not evidence that this repository has already passed end-to-end testing.
