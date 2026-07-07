"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { submitReview } from "@/modules/rca/review-policy";
import { projectCacheTag, userCacheTag } from "@/modules/workspace-cache";

const severities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export async function createTaskRcaAction(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const findings = String(formData.get("findings") ?? "").trim();
  const reviewerId = String(formData.get("reviewerId") ?? "");
  const severityValue = String(formData.get("severity") ?? "MEDIUM");
  if (!taskId || title.length < 3 || title.length > 160) throw new Error("A valid RCA title is required.");
  if (findings.length < 10 || findings.length > 6000) throw new Error("Findings must contain between 10 and 6000 characters.");
  if (!reviewerId) throw new Error("Choose a reviewer.");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      rca: { select: { id: true } },
      projects: {
        include: {
          project: { include: { memberships: true } },
        },
      },
    },
  });
  const project = task?.projects.find(({ projectId: taskProjectId }) => taskProjectId === projectId)?.project;
  const canCreate = user.systemRole === "ADMIN"
    || project?.memberships.some(({ userId }) => userId === user.id);
  if (!task || !project || !canCreate) throw new Error("You do not have access to this task.");
  if (task.status !== "IN REVIEW") throw new Error("An RCA can only be created while the task is In review.");
  if (task.rca) throw new Error("This task already has an RCA.");
  if (!project.memberships.some(({ userId }) => userId === reviewerId)) {
    throw new Error("The reviewer must be a member of this project.");
  }

  const severity = severities.has(severityValue) ? severityValue as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" : "MEDIUM";
  const rca = await prisma.$transaction(async (transaction) => {
    const created = await transaction.rootCauseAnalysis.create({
      data: {
        projectId: project.id,
        taskId: task.id,
        title,
        summary: `Review findings for TF-${task.sequence}: ${task.title}`,
        severity,
        state: "IN_REVIEW",
        createdById: user.id,
        sections: {
          create: {
            kind: "FINDINGS",
            title: "Review findings",
            content: findings,
            position: 1,
          },
        },
        reviewAssignments: { create: { reviewerId } },
      },
    });
    await transaction.notification.create({
      data: {
        recipientId: reviewerId,
        type: "RCA_REVIEW_ASSIGNED",
        title: `RCA review assigned for TF-${task.sequence}`,
        body: title,
        deduplicationKey: `${created.id}:${reviewerId}:RCA_REVIEW_ASSIGNED`,
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliveries: {
          create: { channel: "IN_APP", status: "DELIVERED", attemptedAt: new Date(), deliveredAt: new Date() },
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        action: "RCA_CREATED",
        resourceType: "RootCauseAnalysis",
        resourceId: created.id,
        metadata: { taskId: task.id, reviewerId, severity },
      },
    });
    await transaction.outboxEvent.create({
      data: {
        type: "RCA_SUBMITTED",
        aggregateId: created.id,
        payload: { rcaId: created.id, taskId: task.id, reviewerId, actorId: user.id },
      },
    });
    return created;
  });

  revalidateTag(projectCacheTag(project.id), "max");
  revalidateTag(userCacheTag(reviewerId), "max");
  revalidatePath("/tasks");
  revalidatePath("/rcas");
  redirect(`/rcas#rca-${rca.id}`);
}

export async function submitReviewAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "");
  if (decision !== "APPROVED" && decision !== "REJECTED") throw new Error("Invalid decision.");
  const assignment = await prisma.reviewAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.reviewerId !== user.id) throw new Error("Review assignment not found.");
  const review = submitReview({ reviewerId: user.id }, decision, comment);
  await prisma.$transaction([
    prisma.reviewAssignment.update({
      where: { id: assignmentId },
      data: { status: "COMPLETED", decision: review.decision, comment: review.comment, completedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { actorId: user.id, action: "RCA_REVIEW_DECIDED", resourceType: "RootCauseAnalysis", resourceId: assignment.rcaId, metadata: { decision } },
    }),
    prisma.outboxEvent.create({
      data: { type: "RCA_REVIEW_DECIDED", aggregateId: assignment.rcaId, payload: { assignmentId, reviewerId: user.id, decision } },
    }),
  ]);
  const rca = await prisma.rootCauseAnalysis.findUnique({
    where: { id: assignment.rcaId },
    select: { projectId: true },
  });
  if (rca) {
    revalidateTag(projectCacheTag(rca.projectId), "max");
  }
  revalidateTag(userCacheTag(user.id), "max");
  revalidatePath("/rcas");
}

export async function reassignReviewerAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const reviewerId = String(formData.get("reviewerId") ?? "") || null;
  const assignment = await prisma.reviewAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      rca: {
        include: {
          project: { include: { memberships: true } },
        },
      },
    },
  });
  if (!assignment || assignment.status !== "ASSIGNED") throw new Error("Only a pending review can be reassigned.");
  const manager = assignment.rca.project.memberships.find(({ userId }) => userId === user.id);
  if (user.systemRole !== "ADMIN" && manager?.role !== "PROJECT_MANAGER") {
    throw new Error("Only a project manager can reassign reviewers.");
  }
  if (reviewerId === assignment.reviewerId) {
    revalidatePath("/rcas");
    return;
  }
  if (reviewerId && !assignment.rca.project.memberships.some(({ userId }) => userId === reviewerId)) {
    throw new Error("The reviewer must be a member of this project.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.reviewAssignment.update({
      where: { id: assignment.id },
      data: { status: "CANCELLED" },
    });
    if (reviewerId) {
      await transaction.reviewAssignment.upsert({
        where: { rcaId_reviewerId: { rcaId: assignment.rcaId, reviewerId } },
        create: { rcaId: assignment.rcaId, reviewerId },
        update: { status: "ASSIGNED", decision: null, comment: null, completedAt: null, assignedAt: new Date() },
      });
      await transaction.notification.create({
        data: {
          recipientId: reviewerId,
          type: "RCA_REVIEW_ASSIGNED",
          title: "RCA review assigned",
          body: assignment.rca.title,
          deduplicationKey: `${assignment.rcaId}:${reviewerId}:RCA_REASSIGNED:${Date.now()}`,
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveries: {
            create: { channel: "IN_APP", status: "DELIVERED", attemptedAt: new Date(), deliveredAt: new Date() },
          },
        },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        action: "RCA_REVIEWER_REASSIGNED",
        resourceType: "RootCauseAnalysis",
        resourceId: assignment.rcaId,
        metadata: { previousReviewerId: assignment.reviewerId, reviewerId },
      },
    });
    await transaction.outboxEvent.create({
      data: {
        type: "RCA_REVIEWER_REASSIGNED",
        aggregateId: assignment.rcaId,
        payload: { assignmentId, previousReviewerId: assignment.reviewerId, reviewerId, actorId: user.id },
      },
    });
  });
  revalidateTag(projectCacheTag(assignment.rca.projectId), "max");
  revalidateTag(userCacheTag(assignment.reviewerId), "max");
  if (reviewerId) {
    revalidateTag(userCacheTag(reviewerId), "max");
  }
  revalidatePath("/rcas");
}
