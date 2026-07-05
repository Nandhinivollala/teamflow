import assert from "node:assert/strict";
import test from "node:test";
import {
  notificationDeduplicationKey,
} from "./policy.ts";

test("the same event-recipient-type tuple produces one stable key", () => {
  const input = { eventId: "event-1", recipientId: "user-2", type: "TASK_ASSIGNED" as const };
  assert.equal(notificationDeduplicationKey(input), notificationDeduplicationKey(input));
});

test("different events produce different notification keys", () => {
  const first = notificationDeduplicationKey({ eventId: "event-1", recipientId: "user-2", type: "TASK_ASSIGNED" });
  const second = notificationDeduplicationKey({ eventId: "event-2", recipientId: "user-2", type: "TASK_ASSIGNED" });
  assert.notEqual(first, second);
});
