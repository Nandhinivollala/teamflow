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
- Task states are To do, In progress, In review, Blocked, Done, and Cancelled. The normal path is To do → In progress → In review → Done; work can be blocked, moved backward, cancelled, reopened from Done, or restored from Cancelled only through the implemented transition map.
- Project Managers can replace a pending reviewer with any project member or cancel the assignment with no replacement. Completed decisions are immutable audit history.
- Task attachments accept JPEG, PNG, WebP, and GIF images up to 1 MiB.

## Still unresolved

1. Exact RCA lifecycle state names beyond the confirmed review/closure condition.
2. Reviewer overdue reminders and escalation timing.
3. The numerical or configurable threshold that defines assignee overload.
4. Authentication provider and deployment environment.
5. Production object-storage provider.

`RootCauseAnalysis.state` and RCA section kinds remain strings. The overload policy accepts an explicit capacity supplied by project configuration. Reviewer reassignment is confirmed; automated timeout and escalation behavior remains intentionally unspecified.
