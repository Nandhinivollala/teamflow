"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { extractMentionHandles } from "@/modules/comments/mentions";
import { localObjectStorage } from "@/modules/files/local-storage";
import { canTransitionTask, isTaskStatus } from "@/modules/task/transitions";

const priorities = new Set(["High", "Medium", "Low"]);

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const priorityValue = String(formData.get("priority") ?? "Medium");
  const dueValue = String(formData.get("dueAt") ?? "");
  if (title.length < 3 || title.length > 160) {
    throw new Error("Task title must contain between 3 and 160 characters.");
  }

  const project = await prisma.project.findUnique({
    where: { key: "ENG" },
    include: { memberships: { where: { userId: user.id } } },
  });
  if (!project || (user.systemRole !== "ADMIN" && project.memberships.length === 0)) {
    throw new Error("You do not have permission to create tasks in this project.");
  }

  const priority = priorities.has(priorityValue) ? priorityValue : "Medium";
  const dueAt = dueValue ? new Date(`${dueValue}T12:00:00.000Z`) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    throw new Error("The due date is invalid.");
  }

  await prisma.$transaction(async (transaction) => {
    const task = await transaction.task.create({
      data: {
        title,
        status: process.env.TASK_INITIAL_STATUS ?? "TO DO",
        priority,
        dueAt,
        creatorId: user.id,
        assigneeId: user.id,
        projects: { create: { projectId: project.id } },
      },
    });

    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        action: "TASK_CREATED",
        resourceType: "Task",
        resourceId: task.id,
        metadata: { projectId: project.id, status: task.status },
      },
    });

    await transaction.outboxEvent.create({
      data: {
        type: "TASK_CREATED",
        aggregateId: task.id,
        payload: { taskId: task.id, projectId: project.id, actorId: user.id },
      },
    });
    await transaction.notification.create({
      data: {
        recipientId: user.id,
        type: "TASK_ASSIGNED",
        title: `You were assigned TF-${task.sequence}`,
        body: task.title,
        deduplicationKey: `${task.id}:${user.id}:TASK_ASSIGNED`,
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliveries: {
          create: [
            { channel: "IN_APP", status: "DELIVERED", attemptedAt: new Date(), deliveredAt: new Date() },
            ...(user.emailNotificationsEnabled ? [{ channel: "EMAIL" as const, status: "PENDING" as const }] : []),
          ],
        },
      },
    });
  });

  revalidatePath("/tasks");
}

export async function updateTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const priorityValue = String(formData.get("priority") ?? "Medium");
  const dueValue = String(formData.get("dueAt") ?? "");
  const statusValue = String(formData.get("status") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const requestedBlockerIds = [
    ...new Set(formData.getAll("blockingTaskIds").map(String).filter(Boolean)),
  ].filter((id) => id !== taskId);

  if (!taskId || title.length < 3 || title.length > 160) {
    throw new Error("A valid task and title are required.");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      projects: {
        include: {
          project: {
            include: { memberships: { where: { userId: user.id } } },
          },
        },
      },
    },
  });
  const canUpdate = user.systemRole === "ADMIN"
    || task?.projects.some(({ project }) => project.memberships.length > 0);
  if (!task || !canUpdate) {
    throw new Error("You do not have permission to update this task.");
  }
  if (!isTaskStatus(task.status) || !isTaskStatus(statusValue) || !canTransitionTask(task.status, statusValue)) {
    throw new Error(`Task cannot move from ${task.status} to ${statusValue}.`);
  }

  const priority = priorities.has(priorityValue) ? priorityValue : "Medium";
  const dueAt = dueValue ? new Date(`${dueValue}T12:00:00.000Z`) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("The due date is invalid.");

  const projectIds = task.projects.map(({ projectId }) => projectId);
  if (assigneeId) {
    const assigneeMembership = await prisma.projectMembership.findFirst({
      where: { userId: assigneeId, projectId: { in: projectIds } },
    });
    if (!assigneeMembership) throw new Error("The assignee must be a member of this project.");
  }
  const validBlockers = requestedBlockerIds.length === 0
    ? []
    : await prisma.task.findMany({
        where: {
          id: { in: requestedBlockerIds },
          projects: { some: { projectId: { in: projectIds } } },
        },
        select: { id: true },
      });
  if (validBlockers.length !== requestedBlockerIds.length) {
    throw new Error("Dependencies must reference tasks in the same project.");
  }

  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.task.update({
      where: { id: taskId },
      data: { title, priority, dueAt, status: statusValue, assigneeId },
    });
    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        action: "TASK_UPDATED",
        resourceType: "Task",
        resourceId: taskId,
        metadata: {
          title: updated.title,
          priority: updated.priority,
          dueAt: updated.dueAt,
          previousStatus: task.status,
          status: updated.status,
          previousAssigneeId: task.assigneeId,
          assigneeId: updated.assigneeId,
        },
      },
    });
    await transaction.taskDependency.deleteMany({ where: { blockedTaskId: taskId } });
    if (requestedBlockerIds.length > 0) {
      await transaction.taskDependency.createMany({
        data: requestedBlockerIds.map((blockingTaskId) => ({
          blockedTaskId: taskId,
          blockingTaskId,
        })),
      });
    }
    await transaction.outboxEvent.create({
      data: {
        type: "TASK_UPDATED",
        aggregateId: taskId,
        payload: { taskId, actorId: user.id, blockingTaskIds: requestedBlockerIds },
      },
    });
    if (assigneeId && assigneeId !== task.assigneeId) {
      const recipient = await transaction.user.findUniqueOrThrow({ where: { id: assigneeId } });
      await transaction.notification.create({
        data: {
          recipientId: assigneeId,
          type: "TASK_ASSIGNED",
          title: `You were assigned TF-${task.sequence}`,
          body: updated.title,
          deduplicationKey: `${task.id}:${assigneeId}:TASK_REASSIGNED:${Date.now()}`,
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveries: {
            create: [
              { channel: "IN_APP", status: "DELIVERED", attemptedAt: new Date(), deliveredAt: new Date() },
              ...(recipient.emailNotificationsEnabled ? [{ channel: "EMAIL" as const, status: "PENDING" as const }] : []),
            ],
          },
        },
      });
    }
  });

  revalidatePath("/tasks");
}

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function uploadTaskPhotoAction(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const photo = formData.get("photo");
  const maxBytes = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 1_048_576);
  if (!(photo instanceof File) || !taskId || photo.size === 0) throw new Error("Choose a photo to upload.");
  const extension = imageTypes.get(photo.type);
  if (!extension) throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed.");
  if (photo.size > maxBytes) throw new Error("The photo must be 1 MiB or smaller.");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { projects: { include: { project: { include: { memberships: { where: { userId: user.id } } } } } } },
  });
  if (!task || (user.systemRole !== "ADMIN" && !task.projects.some(({ project }) => project.memberships.length))) {
    throw new Error("You do not have access to this task.");
  }

  const storageKey = `${taskId}/${randomUUID()}.${extension}`;
  const body = new Uint8Array(await photo.arrayBuffer());
  await localObjectStorage.put(storageKey, body, photo.type);
  try {
    await prisma.$transaction([
      prisma.attachment.create({
        data: {
          taskId,
          storageKey,
          fileName: photo.name.slice(0, 255),
          contentType: photo.type,
          sizeBytes: photo.size,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "TASK_PHOTO_UPLOADED",
          resourceType: "Task",
          resourceId: taskId,
          metadata: { storageKey, fileName: photo.name, sizeBytes: photo.size },
        },
      }),
    ]);
  } catch (error) {
    await localObjectStorage.delete(storageKey);
    throw error;
  }
  revalidatePath("/tasks");
}

export async function addTaskCommentAction(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!taskId || body.length < 1 || body.length > 4000) throw new Error("A valid comment is required.");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { projects: { include: { project: { include: { memberships: { where: { userId: user.id } } } } } } },
  });
  if (!task || (user.systemRole !== "ADMIN" && !task.projects.some(({ project }) => project.memberships.length))) {
    throw new Error("You do not have access to this task.");
  }

  const handles = extractMentionHandles(body);
  const candidates = handles.length
    ? await prisma.user.findMany({
        where: { memberships: { some: { projectId: { in: task.projects.map(({ projectId }) => projectId) } } } },
        select: { id: true, email: true, name: true, emailNotificationsEnabled: true },
      })
    : [];
  const mentioned = candidates.filter((candidate) => {
    const aliases = [
      candidate.email.split("@")[0].toLowerCase(),
      candidate.name.toLowerCase().replaceAll(" ", "."),
      candidate.name.toLowerCase().replaceAll(" ", "_"),
    ];
    return handles.some((handle) => aliases.includes(handle));
  });

  await prisma.$transaction(async (transaction) => {
    const comment = await transaction.comment.create({
      data: {
        taskId,
        authorId: user.id,
        body,
        mentions: { create: mentioned.map(({ id }) => ({ userId: id })) },
      },
    });
    for (const recipient of mentioned.filter(({ id }) => id !== user.id)) {
      await transaction.notification.create({
        data: {
          recipientId: recipient.id,
          type: "COMMENT_MENTIONED",
          title: `You were mentioned on TF-${task.sequence}`,
          body,
          deduplicationKey: `${comment.id}:${recipient.id}:COMMENT_MENTIONED`,
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveries: {
            create: [
              { channel: "IN_APP", status: "DELIVERED", attemptedAt: new Date(), deliveredAt: new Date() },
              ...(recipient.emailNotificationsEnabled ? [{ channel: "EMAIL" as const, status: "PENDING" as const }] : []),
            ],
          },
        },
      });
    }
    await transaction.auditLog.create({
      data: { actorId: user.id, action: "TASK_COMMENTED", resourceType: "Task", resourceId: taskId, metadata: { commentId: comment.id } },
    });
  });
  revalidatePath("/tasks");
}
