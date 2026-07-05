export type ReviewDecision = "APPROVED" | "REJECTED";

export type ReviewRecord = {
  reviewerId: string;
  decision?: ReviewDecision;
  comment?: string;
};

export type RcaReviewOutcome =
  | { status: "AWAITING_REVIEWS"; mayClose: false; outstandingReviewerIds: string[] }
  | { status: "CHANGES_REQUIRED"; mayClose: false; rejectedBy: string[] }
  | { status: "APPROVED"; mayClose: true };

export function submitReview(
  review: Omit<ReviewRecord, "decision" | "comment">,
  decision: ReviewDecision,
  comment: string,
): ReviewRecord {
  const normalizedComment = comment.trim();
  if (!normalizedComment) {
    throw new Error("A review decision requires a comment.");
  }
  return { ...review, decision, comment: normalizedComment };
}

export function evaluateRcaReviews(reviews: readonly ReviewRecord[]): RcaReviewOutcome {
  const outstandingReviewerIds = reviews
    .filter((review) => !review.decision)
    .map((review) => review.reviewerId);

  if (reviews.length === 0 || outstandingReviewerIds.length > 0) {
    return { status: "AWAITING_REVIEWS", mayClose: false, outstandingReviewerIds };
  }

  const rejectedBy = reviews
    .filter((review) => review.decision === "REJECTED")
    .map((review) => review.reviewerId);

  if (rejectedBy.length > 0) {
    return { status: "CHANGES_REQUIRED", mayClose: false, rejectedBy };
  }

  return { status: "APPROVED", mayClose: true };
}
