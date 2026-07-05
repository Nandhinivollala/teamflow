import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { evaluateRcaReviews } from "@/modules/rca/review-policy";
import { reassignReviewerAction, submitReviewAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RcasPage() {
  const user = await requireUser();
  const rcas = await prisma.rootCauseAnalysis.findMany({
    where: { project: { memberships: { some: { userId: user.id } } } },
    include: {
      project: { include: { memberships: { include: { user: true }, orderBy: { user: { name: "asc" } } } } },
      sections: { orderBy: { position: "asc" } },
      reviewAssignments: { include: { reviewer: true }, orderBy: { assignedAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return <main className="rca-page"><div className="rca-top"><Link href="/">← Dashboard</Link><div><p className="eyebrow">ENGINEERING / RCA</p><h1>Root cause analyses</h1><p>Investigations stay open until every assigned reviewer has decided.</p></div></div>
    {rcas.map((rca) => {
      const activeReviews = rca.reviewAssignments.filter((review) => review.status !== "CANCELLED");
      const outcome = evaluateRcaReviews(activeReviews.map((review) => ({ reviewerId: review.reviewerId, decision: review.decision ?? undefined, comment: review.comment ?? undefined })));
      const mine = activeReviews.find((review) => review.reviewerId === user.id);
      const myMembership = rca.project.memberships.find(({ userId }) => userId === user.id);
      const canManage = user.systemRole === "ADMIN" || myMembership?.role === "PROJECT_MANAGER";
      return <article className="rca-record panel" key={rca.id}><header><div><span className={`severity severity-${rca.severity.toLowerCase()}`}>{rca.severity}</span><h2>{rca.title}</h2><p>{rca.summary}</p></div><strong>{outcome.status.replaceAll("_", " ")}</strong></header>
        <div className="rca-sections">{rca.sections.map((section) => <section key={section.id}><h3>{section.title}</h3><p>{section.content}</p></section>)}</div>
        <div className="review-grid"><div><h3>Reviewers</h3>{activeReviews.map((review) => <div className="reviewer-row" key={review.id}><p><b>{review.reviewer.name}</b><span>{review.decision ?? "AWAITING DECISION"}</span>{review.comment && <small>{review.comment}</small>}</p>
          {canManage && review.status === "ASSIGNED" && <form action={reassignReviewerAction}><input type="hidden" name="assignmentId" value={review.id}/><select name="reviewerId" defaultValue={review.reviewerId}><option value="">No replacement</option>{rca.project.memberships.map(({ user: member }) => <option value={member.id} key={member.id}>{member.name}</option>)}</select><button className="secondary">Reassign</button></form>}
        </div>)}</div>
          {mine && !mine.decision && <form action={submitReviewAction} className="review-form"><input type="hidden" name="assignmentId" value={mine.id}/><label>Review comment<textarea name="comment" required minLength={3} placeholder="Document the reason for your decision."/></label><div><button className="secondary" name="decision" value="REJECTED">Request changes</button><button className="create" name="decision" value="APPROVED">Approve RCA</button></div></form>}
        </div></article>;
    })}
  </main>;
}
