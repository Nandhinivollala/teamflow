import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signSessionToken, verifySessionToken } from "./token";

const COOKIE_NAME = "teamflow_session";

function sessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, signSessionToken(userId, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token, sessionSecret());
  if (!payload) return null;

  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      systemRole: true,
      memberships: {
        select: {
          role: true,
          project: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
