import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  userId: string;
  expiresAt: number;
};

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signSessionToken(
  userId: string,
  secret: string,
  now = Date.now(),
  durationMs = 7 * 24 * 60 * 60 * 1000,
) {
  const payload = Buffer.from(
    JSON.stringify({ userId, expiresAt: now + durationMs } satisfies SessionPayload),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySessionToken(token: string, secret: string, now = Date.now()) {
  const [payloadValue, suppliedSignature] = token.split(".");
  if (!payloadValue || !suppliedSignature) return null;

  const expectedSignature = signature(payloadValue, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadValue, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.userId || payload.expiresAt <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
