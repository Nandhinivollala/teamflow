"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { setActiveProjectKey } from "@/modules/projects/active-project";

const safeDestinations = new Set(["/", "/tasks", "/rcas", "/reports", "/people", "/settings", "/projects"]);

export async function switchProjectAction(formData: FormData) {
  const user = await requireUser();
  const projectKey = String(formData.get("projectKey") ?? "").trim().toUpperCase();
  const redirectTo = String(formData.get("redirectTo") ?? "/");
  const project = await prisma.project.findUnique({
    where: { key: projectKey },
    include: { memberships: { where: { userId: user.id } } },
  });
  if (!project || (user.systemRole !== "ADMIN" && project.memberships.length === 0)) {
    throw new Error("You do not have access to that project.");
  }
  await setActiveProjectKey(project.key);
  redirect(safeDestinations.has(redirectTo) ? redirectTo : "/");
}

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const requestedKey = String(formData.get("key") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  const key = requestedKey || name.replace(/[^a-z0-9]+/gi, "").slice(0, 8).toUpperCase();
  if (name.length < 2 || name.length > 80) throw new Error("Project name must contain between 2 and 80 characters.");
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) throw new Error("Project key must contain 2-10 uppercase letters or numbers and begin with a letter.");
  if (description.length > 500) throw new Error("Project description must be 500 characters or fewer.");

  await prisma.$transaction(async (transaction) => {
    const project = await transaction.project.create({
      data: {
        key,
        name,
        description: description || null,
        memberships: { create: { userId: user.id, role: "PROJECT_MANAGER" } },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        action: "PROJECT_CREATED",
        resourceType: "Project",
        resourceId: project.id,
        metadata: { key, name },
      },
    });
  });

  await setActiveProjectKey(key);
  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/");
}
