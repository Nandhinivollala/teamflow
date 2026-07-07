"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { userCacheTag } from "@/modules/workspace-cache";

export async function markNotificationRead(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await prisma.notification.updateMany({ where: { id, recipientId: user.id }, data: { readAt: new Date() } });
  revalidateTag(userCacheTag(user.id), "max");
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { recipientId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidateTag(userCacheTag(user.id), "max");
  revalidatePath("/notifications");
  revalidatePath("/");
}
