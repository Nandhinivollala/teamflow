import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionTask } from "./transitions.ts";

test("supports the normal delivery flow", () => {
  assert.equal(canTransitionTask("TO DO", "IN PROGRESS"), true);
  assert.equal(canTransitionTask("IN PROGRESS", "IN REVIEW"), true);
  assert.equal(canTransitionTask("IN REVIEW", "DONE"), true);
});

test("supports blocking, reopening, restoring, and no-op saves", () => {
  assert.equal(canTransitionTask("IN PROGRESS", "BLOCKED"), true);
  assert.equal(canTransitionTask("BLOCKED", "IN PROGRESS"), true);
  assert.equal(canTransitionTask("DONE", "IN PROGRESS"), true);
  assert.equal(canTransitionTask("CANCELLED", "TO DO"), true);
  assert.equal(canTransitionTask("TO DO", "TO DO"), true);
});

test("rejects skipped or terminal transitions", () => {
  assert.equal(canTransitionTask("TO DO", "DONE"), false);
  assert.equal(canTransitionTask("DONE", "CANCELLED"), false);
  assert.equal(canTransitionTask("CANCELLED", "DONE"), false);
});
