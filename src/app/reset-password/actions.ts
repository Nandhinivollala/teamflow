"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/auth/password";
import { hashPasswordResetToken } from "@/modules/auth/password-reset";
import { createSession } from "@/modules/auth/session";

function resetPasswordError(code: string, token: string): never {
  redirect(`/reset-password?error=${code}&token=${encodeURIComponent(token)}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  if (!token) redirect("/forgot-password");
  if (password.length < 8 || password.length > 128) resetPasswordError("password", token);
  if (password !== confirmation) resetPasswordError("mismatch", token);

  const hashedToken = hashPasswordResetToken(token);
  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { hashedToken },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt <= new Date()) {
    redirect("/reset-password?error=expired");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: resetRecord.userId, id: { not: resetRecord.id } },
    }),
    prisma.auditLog.create({
      data: {
        actorId: resetRecord.userId,
        action: "PASSWORD_RESET_COMPLETED",
        resourceType: "User",
        resourceId: resetRecord.userId,
      },
    }),
  ]);

  await createSession(resetRecord.userId);
  redirect("/projects");
}
