"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/auth/password";
import { createSession } from "@/modules/auth/session";

function signupError(code: string): never {
  redirect(`/signup?error=${code}`);
}

export async function signupAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  if (name.length < 2 || name.length > 80) signupError("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) signupError("email");
  if (password.length < 8 || password.length > 128) signupError("password");
  if (password !== confirmation) signupError("mismatch");
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) signupError("exists");

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.create({
      data: { name, email, passwordHash },
    });
    await transaction.auditLog.create({
      data: {
        actorId: created.id,
        action: "ACCOUNT_CREATED",
        resourceType: "User",
        resourceId: created.id,
        metadata: { email },
      },
    });
    return created;
  });

  await createSession(user.id);
  redirect("/projects");
}
