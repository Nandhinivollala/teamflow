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
