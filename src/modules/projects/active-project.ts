import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const ACTIVE_PROJECT_COOKIE = "teamflow_active_project";

type ProjectUser = {
  systemRole: string;
  memberships: Array<{
    role: string;
    project: {
      id: string;
      key: string;
      name: string;
      description: string | null;
    };
  }>;
};

export async function getProjectContext(user: ProjectUser) {
  const projects = user.systemRole === "ADMIN"
    ? await prisma.project.findMany({ orderBy: { name: "asc" } })
    : user.memberships.map(({ project }) => project).sort((a, b) => a.name.localeCompare(b.name));
  const requestedKey = (await cookies()).get(ACTIVE_PROJECT_COOKIE)?.value;
  const project = projects.find(({ key }) => key === requestedKey) ?? projects[0] ?? null;
  const membership = project
    ? user.memberships.find(({ project: memberProject }) => memberProject.id === project.id) ?? null
    : null;

  return { project, projects, membership };
}

export async function setActiveProjectKey(key: string) {
  (await cookies()).set(ACTIVE_PROJECT_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}
