import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskWorkspace, type TaskWorkspaceItem } from "@/components/task-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { getProjectContext } from "@/modules/projects/active-project";
import { evaluateTaskWarnings } from "@/modules/task/warnings";
import { getCachedTasksWorkspaceData } from "@/modules/workspace-cache";

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

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string; edit?: string; search?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const { project, projects, membership } = await getProjectContext(user);
  if (!project) notFound();

  const [{ tasks: records, rcaCount, members }, selectedTaskDetails] = await Promise.all([
    getCachedTasksWorkspaceData(project.id),
    query.edit
      ? prisma.task.findFirst({
          where: { id: query.edit, projects: { some: { projectId: project.id } } },
          include: {
            comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
            attachments: { orderBy: { createdAt: "asc" } },
            blockers: { select: { blockingTaskId: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const loadByAssignee = new Map<string, number>();
  for (const task of records) {
    if (task.assigneeId && task.status !== "DONE") {
      loadByAssignee.set(task.assigneeId, (loadByAssignee.get(task.assigneeId) ?? 0) + 1);
    }
  }

  const selectedComments = selectedTaskDetails?.comments.map((comment) => ({
    id: comment.id,
    author: comment.author.name,
    body: comment.body,
    createdAt: comment.createdAt.toLocaleString("en-IN"),
  })) ?? [];

  const selectedAttachments = selectedTaskDetails?.attachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    sizeLabel: `${Math.ceil(attachment.sizeBytes / 1024)} KB`,
  })) ?? [];

  const selectedBlockingIds = selectedTaskDetails?.blockers.map(({ blockingTaskId }) => blockingTaskId) ?? [];

  const tasks: TaskWorkspaceItem[] = records.map((task) => {
    const status = statuses.has(task.status as TaskWorkspaceItem["status"])
      ? task.status as TaskWorkspaceItem["status"]
      : "TO DO";
    const priority = priorities.has(task.priority as TaskWorkspaceItem["priority"])
      ? task.priority as TaskWorkspaceItem["priority"]
      : "Medium";
    const unresolvedBlockers = task.blockerSummaries
      .filter((dependency) => dependency.status !== "DONE")
      .map((dependency) => `TF-${dependency.sequence}`);
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
      assignee: task.assigneeName ? initials(task.assigneeName) : "—",
      due: task.dueAtIso
        ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(task.dueAtIso))
        : "No date",
      dueIso: task.dueAtIso?.slice(0, 10) ?? "",
      dueDay: task.dueAtIso ? new Date(task.dueAtIso).getUTCDate() : 0,
      projectIds: [project.key],
      blockingTaskIds: selectedTaskDetails?.id === task.id ? selectedBlockingIds : [],
      comments: selectedTaskDetails?.id === task.id ? selectedComments : [],
      attachments: selectedTaskDetails?.id === task.id ? selectedAttachments : [],
      rcaId: task.rcaId,
      warning,
    };
  });

  return (
    <TaskWorkspace
      tasks={tasks}
      projectId={project.id}
      projectKey={project.key}
      projectName={project.name}
      projects={projects.map(({ key, name }) => ({ key, name }))}
      rcaCount={rcaCount}
      initialCreate={query.create === "1"}
      initialEditingTaskId={query.edit}
      initialSearch={query.search}
      members={members}
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
