"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiry,
} from "@/modules/auth/password-reset";

function forgotPasswordError(code: string): never {
  redirect(`/forgot-password?error=${code}`);
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    forgotPasswordError("email");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    redirect("/forgot-password?sent=1");
  }

  const token = createPasswordResetToken();
  const hashedToken = hashPasswordResetToken(token);
  const expiresAt = passwordResetExpiry();

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, hashedToken, expiresAt },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        resourceType: "User",
        resourceId: user.id,
        metadata: { email },
      },
    }),
  ]);

  redirect(`/forgot-password?sent=1&token=${encodeURIComponent(token)}`);
}
