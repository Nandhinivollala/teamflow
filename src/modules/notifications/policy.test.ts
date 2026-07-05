import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryChannels,
  notificationDeduplicationKey,
  shouldRetryDelivery,
} from "./policy.ts";

test("the same event-recipient-type tuple produces one stable key", () => {
  const input = { eventId: "event-1", recipientId: "user-2", type: "TASK_ASSIGNED" as const };
  assert.equal(notificationDeduplicationKey(input), notificationDeduplicationKey(input));
});

test("email opt-out retains in-app delivery", () => {
  assert.deepEqual(deliveryChannels(false), ["IN_APP"]);
  assert.deepEqual(deliveryChannels(true), ["IN_APP", "EMAIL"]);
});

test("failed email delivery is surfaced rather than silently retried", () => {
  assert.equal(shouldRetryDelivery(), false);
});
