import type { Metadata } from "next";
import { TaskWorkspace, type TaskWorkspaceItem } from "@/components/task-workspace";
import { prisma } from "@/lib/prisma";
import { evaluateTaskWarnings } from "@/modules/task/warnings";
import { requireUser } from "@/modules/auth/session";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tasks | TeamFlow",
  description: "Plan and track engineering work across views.",
};

const statuses = new Set<TaskWorkspaceItem["status"]>(["TO DO", "IN PROGRESS", "IN REVIEW", "BLOCKED", "DONE", "CANCELLED"]);
const priorities = new Set<TaskWorkspaceItem["priority"]>(["High", "Medium", "Low"]);

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function TasksPage() {
  const user = await requireUser();
  const membership = user.memberships.find(({ project }) => project.key === "ENG");
  if (!membership && user.systemRole !== "ADMIN") notFound();

  const records = await prisma.task.findMany({
    where: { projects: { some: { project: { key: "ENG" } } } },
    include: {
      assignee: true,
      projects: { include: { project: true } },
      blockers: { include: { blockingTask: true } },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ dueAt: "asc" }, { sequence: "asc" }],
  });

  const loadByAssignee = new Map<string, number>();
  for (const task of records) {
    if (task.assigneeId && task.status !== "DONE") {
      loadByAssignee.set(task.assigneeId, (loadByAssignee.get(task.assigneeId) ?? 0) + 1);
    }
  }

  const tasks: TaskWorkspaceItem[] = records.map((task) => {
    const status = statuses.has(task.status as TaskWorkspaceItem["status"])
      ? task.status as TaskWorkspaceItem["status"]
      : "TO DO";
    const priority = priorities.has(task.priority as TaskWorkspaceItem["priority"])
      ? task.priority as TaskWorkspaceItem["priority"]
      : "Medium";
    const unresolvedBlockers = task.blockers
      .filter((dependency) => dependency.blockingTask.status !== "DONE")
      .map((dependency) => `TF-${dependency.blockingTask.sequence}`);
    const warnings = evaluateTaskWarnings({
      unresolvedBlockerIds: unresolvedBlockers,
      assigneeOpenTaskCount: task.assigneeId ? loadByAssignee.get(task.assigneeId) : undefined,
      assigneeCapacity: task.assigneeId ? 3 : undefined,
    });
    const warning = warnings[0]?.code === "UNRESOLVED_DEPENDENCIES"
      ? `Blocked by ${warnings[0].blockerIds.join(", ")}`
      : warnings[0]?.code === "ASSIGNEE_OVERLOAD"
        ? "Assignee at capacity"
        : undefined;

    return {
      id: task.id,
      key: `TF-${task.sequence}`,
      title: task.title,
      status,
      priority,
      assigneeId: task.assigneeId ?? "",
      assignee: task.assignee ? initials(task.assignee.name) : "—",
      due: task.dueAt
        ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(task.dueAt)
        : "No date",
      dueIso: task.dueAt?.toISOString().slice(0, 10) ?? "",
      dueDay: task.dueAt?.getUTCDate() ?? 0,
      projectIds: task.projects.map(({ project }) => project.key),
      blockingTaskIds: task.blockers.map(({ blockingTaskId }) => blockingTaskId),
      comments: task.comments.map((comment) => ({
        id: comment.id,
        author: comment.author.name,
        body: comment.body,
        createdAt: comment.createdAt.toLocaleString("en-IN"),
      })),
      attachments: task.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        sizeLabel: `${Math.ceil(attachment.sizeBytes / 1024)} KB`,
      })),
      warning,
    };
  });

  return (
    <TaskWorkspace
      tasks={tasks}
      members={(await prisma.projectMembership.findMany({
        where: { project: { key: "ENG" } },
        include: { user: true },
        orderBy: { user: { name: "asc" } },
      })).map(({ user: member }) => ({ id: member.id, name: member.name }))}
      viewer={{
        name: user.name,
        initials: initials(user.name),
        role: user.systemRole === "ADMIN"
          ? "Administrator"
          : membership?.role === "PROJECT_MANAGER"
            ? "Project Manager"
            : "Member",
      }}
    />
  );
}
