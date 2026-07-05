import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRcaReviews, submitReview } from "./review-policy.ts";

test("review decisions require a comment", () => {
  assert.throws(() => submitReview({ reviewerId: "reviewer-1" }, "APPROVED", "  "));
});

test("an RCA cannot close while an assigned reviewer is outstanding", () => {
  assert.deepEqual(
    evaluateRcaReviews([
      submitReview({ reviewerId: "one" }, "APPROVED", "Looks good"),
      { reviewerId: "two" },
    ]),
    { status: "AWAITING_REVIEWS", mayClose: false, outstandingReviewerIds: ["two"] },
  );
});

test("a split decision remains open after every decision is recorded", () => {
  assert.deepEqual(
    evaluateRcaReviews([
      submitReview({ reviewerId: "one" }, "APPROVED", "Complete"),
      submitReview({ reviewerId: "two" }, "REJECTED", "Corrective action lacks an owner"),
    ]),
    { status: "CHANGES_REQUIRED", mayClose: false, rejectedBy: ["two"] },
  );
});

test("unanimous approval permits closure", () => {
  assert.deepEqual(
    evaluateRcaReviews([
      submitReview({ reviewerId: "one" }, "APPROVED", "Complete"),
      submitReview({ reviewerId: "two" }, "APPROVED", "Verified"),
    ]),
    { status: "APPROVED", mayClose: true },
  );
});
