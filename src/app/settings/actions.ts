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

export async function addProjectMemberAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "PROJECT_MANAGER" ? "PROJECT_MANAGER" : "MEMBER";
  const actor = await requireProjectManager(projectId);
  const member = await prisma.user.findUnique({ where: { email } });
  if (!member) throw new Error("No TeamFlow user exists with that email.");

  await prisma.$transaction([
    prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId, userId: member.id } },
      update: { role },
      create: { projectId, userId: member.id, role },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PROJECT_MEMBER_ADDED",
        resourceType: "Project",
        resourceId: projectId,
        metadata: { memberId: member.id, role },
      },
    }),
  ]);
  revalidatePath("/settings");
}

export async function updateProjectMemberRoleAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role") === "PROJECT_MANAGER" ? "PROJECT_MANAGER" : "MEMBER";
  const actor = await requireProjectManager(projectId);
  if (actor.id === userId && actor.systemRole !== "ADMIN") {
    throw new Error("A Project Manager cannot demote their own membership.");
  }

  await prisma.$transaction([
    prisma.projectMembership.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PROJECT_MEMBER_ROLE_CHANGED",
        resourceType: "Project",
        resourceId: projectId,
        metadata: { memberId: userId, role },
      },
    }),
  ]);
  revalidatePath("/settings");
}
