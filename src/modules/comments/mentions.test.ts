import assert from "node:assert/strict";
import test from "node:test";
import { extractMentionHandles } from "./mentions.ts";

test("mention extraction is case-insensitive and duplicate-safe", () => {
  assert.deepEqual(
    extractMentionHandles("Please ask @Maya.Patel, then update @maya.patel and @nina_k."),
    ["maya.patel", "nina_k"],
  );
});

test("email addresses are not treated as mentions", () => {
  assert.deepEqual(extractMentionHandles("Send it to ops@example.com"), []);
});
