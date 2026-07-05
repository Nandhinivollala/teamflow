"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";

async function requireProjectManager(projectId: string) {
  const user = await requireUser();
  if (user.systemRole === "ADMIN") return user;
  const membership = user.memberships.find(
    (item) => item.projectId === projectId && item.role === "PROJECT_MANAGER",
  );
  if (!membership) throw new Error("Project Manager permission is required.");
  return user;
}

export async function updateProjectSettingsAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const actor = await requireProjectManager(projectId);
  if (name.length < 2 || name.length > 80) throw new Error("Project name must contain 2 to 80 characters.");
  if (description.length > 500) throw new Error("Project description cannot exceed 500 characters.");

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { name, description: description || null } }),
    prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PROJECT_SETTINGS_UPDATED",
        resourceType: "Project",
        resourceId: projectId,
        metadata: { name, description },
      },
    }),
  ]);
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/people");
}
