import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export function projectCacheTag(projectId: string) {
  return `project:${projectId}`;
}

export function userCacheTag(userId: string) {
  return `user:${userId}`;
}

export async function getCachedDashboardData(projectId: string, userId: string) {
  return unstable_cache(
    async () => {
      const [
        projectTaskIds,
        taskCount,
        completedCount,
        openCount,
        overdueCount,
        pendingReviews,
        focusTasks,
        projectRcas,
        unreadNotifications,
      ] = await Promise.all([
        prisma.task.findMany({
          where: { projects: { some: { projectId } } },
          select: { id: true },
        }),
        prisma.task.count({ where: { projects: { some: { projectId } } } }),
        prisma.task.count({ where: { projects: { some: { projectId } }, status: "DONE" } }),
        prisma.task.count({ where: { projects: { some: { projectId } }, status: { notIn: ["DONE", "CANCELLED"] } } }),
        prisma.task.count({
          where: {
            projects: { some: { projectId } },
            status: { notIn: ["DONE", "CANCELLED"] },
            dueAt: { lt: new Date() },
          },
        }),
        prisma.reviewAssignment.count({ where: { reviewerId: userId, status: "ASSIGNED" } }),
        prisma.task.findMany({
          where: {
            assigneeId: userId,
            status: { notIn: ["DONE", "CANCELLED"] },
            projects: { some: { projectId } },
          },
          select: {
            id: true,
            sequence: true,
            title: true,
            dueAt: true,
            assignee: { select: { name: true } },
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: 3,
        }),
        prisma.rootCauseAnalysis.findMany({
          where: { projectId },
          select: { id: true },
        }),
        prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
      ]);

      const taskIds = projectTaskIds.map((task) => task.id);
      const rcaIds = projectRcas.map((rca) => rca.id);
      const recentActivity = await prisma.auditLog.findMany({
        where: {
          OR: [
            { actorId: userId, action: { in: ["ACCOUNT_CREATED", "PASSWORD_RESET_REQUESTED", "PASSWORD_RESET_COMPLETED"] } },
            { action: "PROJECT_CREATED", actorId: userId, resourceId: projectId },
            { resourceType: "Project", resourceId: projectId },
            ...(taskIds.length > 0 ? [{ resourceType: "Task", resourceId: { in: taskIds } }] : []),
            ...(rcaIds.length > 0 ? [{ resourceType: "RootCauseAnalysis", resourceId: { in: rcaIds } }] : []),
          ],
        },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      });

      return {
        taskCount,
        completedCount,
        openCount,
        overdueCount,
        pendingReviews,
        unreadNotifications,
        rcaCount: projectRcas.length,
        focusTasks: focusTasks.map((task) => ({
          ...task,
          dueAtIso: task.dueAt?.toISOString() ?? null,
          assigneeName: task.assignee?.name ?? null,
        })),
        recentActivity: recentActivity.map((item) => ({
          id: item.id,
          action: item.action,
          actorName: item.actor?.name ?? null,
          createdAtIso: item.createdAt.toISOString(),
        })),
      };
    },
    [`dashboard:${projectId}:${userId}`],
    {
      revalidate: 30,
      tags: [projectCacheTag(projectId), userCacheTag(userId)],
    },
  )();
}

export async function getCachedTasksWorkspaceData(projectId: string) {
  return unstable_cache(
    async () => {
      const [records, rcaCount, members] = await Promise.all([
        prisma.task.findMany({
          where: { projects: { some: { projectId } } },
          include: {
            assignee: { select: { name: true } },
            blockers: { include: { blockingTask: { select: { sequence: true, status: true } } } },
            rca: { select: { id: true } },
          },
          orderBy: [{ dueAt: "asc" }, { sequence: "asc" }],
        }),
        prisma.rootCauseAnalysis.count({ where: { projectId } }),
        prisma.projectMembership.findMany({
          where: { projectId },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { user: { name: "asc" } },
        }),
      ]);

      return {
        rcaCount,
        members: members.map(({ user }) => user),
        tasks: records.map((task) => ({
          id: task.id,
          sequence: task.sequence,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          assigneeName: task.assignee?.name ?? null,
          dueAtIso: task.dueAt?.toISOString() ?? null,
          blockerSummaries: task.blockers.map((dependency) => ({
            sequence: dependency.blockingTask.sequence,
            status: dependency.blockingTask.status,
          })),
          rcaId: task.rca?.id ?? null,
        })),
      };
    },
    [`tasks:${projectId}`],
    {
      revalidate: 30,
      tags: [projectCacheTag(projectId)],
    },
  )();
}

export async function getCachedRcasPageData(projectId: string, userId: string) {
  return unstable_cache(
    async () => {
      const [projectMembers, rcas, taskCount, unreadNotifications] = await Promise.all([
        prisma.projectMembership.findMany({
          where: { projectId },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { user: { name: "asc" } },
        }),
        prisma.rootCauseAnalysis.findMany({
          where: { projectId },
          include: {
            sections: { orderBy: { position: "asc" } },
            reviewAssignments: { include: { reviewer: { select: { id: true, name: true } } }, orderBy: { assignedAt: "asc" } },
            task: { select: { id: true, sequence: true, title: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.task.count({ where: { projects: { some: { projectId } } } }),
        prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
      ]);

      return {
        taskCount,
        unreadNotifications,
        projectMembers: projectMembers.map(({ user }) => user),
        rcas: rcas.map((rca) => ({
          id: rca.id,
          title: rca.title,
          summary: rca.summary,
          severity: rca.severity,
          state: rca.state,
          task: rca.task,
          sections: rca.sections.map((section) => ({
            id: section.id,
            title: section.title,
            content: section.content,
          })),
          reviewAssignments: rca.reviewAssignments.map((review) => ({
            id: review.id,
            reviewerId: review.reviewerId,
            reviewerName: review.reviewer.name,
            status: review.status,
            decision: review.decision,
            comment: review.comment,
          })),
        })),
      };
    },
    [`rcas:${projectId}:${userId}`],
    {
      revalidate: 30,
      tags: [projectCacheTag(projectId), userCacheTag(userId)],
    },
  )();
}

export async function getCachedReportsData(projectId: string) {
  return unstable_cache(
    async () => {
      const [tasks, rcaCount, activeRcaCount] = await Promise.all([
        prisma.task.findMany({
          where: { projects: { some: { projectId } } },
          select: {
            status: true,
            assigneeId: true,
            assignee: { select: { name: true } },
          },
        }),
        prisma.rootCauseAnalysis.count({ where: { projectId } }),
        prisma.rootCauseAnalysis.count({ where: { projectId, state: { not: "CLOSED" } } }),
      ]);

      const completed = tasks.filter(({ status }) => status === "DONE").length;
      const completion = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
      const statusCounts = [...new Set(tasks.map(({ status }) => status))].map((status) => ({
        label: status,
        value: tasks.filter((task) => task.status === status).length,
      }));
      const assignees = [...new Set(tasks.map(({ assigneeId }) => assigneeId).filter(Boolean))];
      const workload = assignees.map((assigneeId) => {
        const assigned = tasks.filter((task) => task.assigneeId === assigneeId);
        return {
          label: assigned[0]?.assignee?.name ?? "Unassigned",
          value: assigned.filter(({ status }) => status !== "DONE").length,
          total: assigned.length,
        };
      }).sort((a, b) => b.value - a.value);

      return {
        totalTasks: tasks.length,
        completed,
        completion,
        rcaCount,
        activeRcaCount,
        workload,
        statusCounts,
      };
    },
    [`reports:${projectId}`],
    {
      revalidate: 30,
      tags: [projectCacheTag(projectId)],
    },
  )();
}

export async function getCachedPeopleData(projectId: string) {
  return unstable_cache(
    async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  _count: {
                    select: {
                      tasksAssigned: {
                        where: {
                          projects: { some: { projectId } },
                          status: { notIn: ["DONE", "CANCELLED"] },
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          },
        },
      });

      if (!project) return null;

      return {
        id: project.id,
        name: project.name,
        memberships: project.memberships.map((item) => ({
          userId: item.userId,
          role: item.role,
          user: {
            id: item.user.id,
            name: item.user.name,
            email: item.user.email,
            openTasks: item.user._count.tasksAssigned,
          },
        })),
      };
    },
    [`people:${projectId}`],
    {
      revalidate: 30,
      tags: [projectCacheTag(projectId)],
    },
  )();
}
