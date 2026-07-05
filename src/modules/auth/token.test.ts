import assert from "node:assert/strict";
import test from "node:test";
import { signSessionToken, verifySessionToken } from "./token.ts";

const secret = "a-test-secret-that-is-longer-than-thirty-two-characters";

test("signed sessions round-trip and expire", () => {
  const token = signSessionToken("user-1", secret, 1_000, 5_000);
  assert.deepEqual(verifySessionToken(token, secret, 2_000), {
    userId: "user-1",
    expiresAt: 6_000,
  });
  assert.equal(verifySessionToken(token, secret, 6_001), null);
});

test("tampered sessions are rejected", () => {
  const token = signSessionToken("user-1", secret);
  assert.equal(verifySessionToken(`${token}x`, secret), null);
});
