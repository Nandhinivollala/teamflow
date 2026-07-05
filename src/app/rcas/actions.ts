"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { submitReview } from "@/modules/rca/review-policy";

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
      const recipient = await transaction.user.findUniqueOrThrow({ where: { id: reviewerId } });
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
            create: [
              { channel: "IN_APP", status: "DELIVERED", attemptedAt: new Date(), deliveredAt: new Date() },
              ...(recipient.emailNotificationsEnabled ? [{ channel: "EMAIL" as const, status: "PENDING" as const }] : []),
            ],
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
  revalidatePath("/rcas");
}
