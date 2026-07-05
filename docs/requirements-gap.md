# Remaining requirements gaps

The question paper recovered several outcomes that were absent from the earlier handoff. The following behavior is now confirmed and implemented at the domain-policy/schema level:

- Dependency conflicts and assignee overload produce warnings without blocking saves.
- Notifications cover task assignment, status change, RCA submission, review decisions, and comment mentions.
- A single event produces in-app and, unless opted out, email delivery.
- Duplicate notifications are suppressed using an event-recipient-type key.
- Email failure is surfaced directly and is not silently retried.
- Review decisions are Approved or Rejected and require a comment.
- An RCA cannot close until every assigned reviewer decides; any rejection keeps it open.
- Comments, mentions, attachments, persistent per-project view preference, filtered CSV export, responsive design, and a browser-bound theme are in v1 scope.

## Still unresolved

1. Exact task status names and permitted transitions.
2. Exact RCA lifecycle state names beyond the confirmed review/closure condition.
3. Reviewer-unavailable, reassignment, overdue, and impossible-review behavior.
4. The numerical or configurable threshold that defines assignee overload.
5. Attachment type and size limits.
6. Authentication provider and deployment environment.

`Task.status`, `RootCauseAnalysis.state`, and RCA section kinds therefore remain strings. The overload policy accepts an explicit capacity supplied by project configuration. No reviewer reassignment or timeout behavior is inferred.
