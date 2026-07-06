import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function passwordResetExpiry() {
  return new Date(Date.now() + TOKEN_TTL_MS);
}
