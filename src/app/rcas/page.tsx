import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { evaluateRcaReviews } from "@/modules/rca/review-policy";
import { createTaskRcaAction, reassignReviewerAction, submitReviewAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RcasPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const requestedTask = query.task
    ? await prisma.task.findUnique({
        where: { id: query.task },
        include: {
          rca: { select: { id: true } },
          projects: {
            include: {
              project: {
                include: {
                  memberships: { include: { user: true }, orderBy: { user: { name: "asc" } } },
                },
              },
            },
          },
        },
      })
    : null;
  const requestedProject = requestedTask?.projects[0]?.project;
  const selectedTask = requestedTask
    && requestedTask.status === "IN REVIEW"
    && (user.systemRole === "ADMIN" || requestedProject?.memberships.some(({ userId }) => userId === user.id))
    ? requestedTask
    : null;
  const rcas = await prisma.rootCauseAnalysis.findMany({
    where: { project: { memberships: { some: { userId: user.id } } } },
    include: {
      project: { include: { memberships: { include: { user: true }, orderBy: { user: { name: "asc" } } } } },
      sections: { orderBy: { position: "asc" } },
      reviewAssignments: { include: { reviewer: true }, orderBy: { assignedAt: "asc" } },
      task: { select: { id: true, sequence: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return <main className="rca-page"><div className="rca-top"><Link href="/">← Dashboard</Link><div><p className="eyebrow">ENGINEERING / RCA</p><h1>Root cause analyses</h1><p>Investigations stay open until every assigned reviewer has decided.</p></div></div>
    {selectedTask && !selectedTask.rca && requestedProject && (
      <section className="rca-create panel">
        <div>
          <p className="eyebrow">TF-{selectedTask.sequence} / IN REVIEW</p>
          <h2>Add review findings</h2>
          <p>Document your findings and assign one project member to review them.</p>
        </div>
        <form action={createTaskRcaAction}>
          <input type="hidden" name="taskId" value={selectedTask.id} />
          <label>RCA title<input name="title" required minLength={3} maxLength={160} defaultValue={`RCA for TF-${selectedTask.sequence}: ${selectedTask.title}`} /></label>
          <label>Severity<select name="severity" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label>
          <label>Assign reviewer<select name="reviewerId" required defaultValue=""><option value="" disabled>Select a project member</option>{requestedProject.memberships.map(({ user: member }) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
          <label className="rca-findings">Review findings<textarea name="findings" required minLength={10} maxLength={6000} placeholder="Describe what you found, why it happened, and what should change." /></label>
          <div className="rca-create-actions"><Link className="secondary" href="/tasks">Cancel</Link><button className="create">Save and assign review</button></div>
        </form>
      </section>
    )}
    {query.task && !selectedTask && <p className="rca-message">RCA creation is available only for an accessible task in the In review status.</p>}
    {selectedTask?.rca && <p className="rca-message">This task already has an RCA. It appears below.</p>}
    {rcas.map((rca) => {
      const activeReviews = rca.reviewAssignments.filter((review) => review.status !== "CANCELLED");
      const outcome = evaluateRcaReviews(activeReviews.map((review) => ({ reviewerId: review.reviewerId, decision: review.decision ?? undefined, comment: review.comment ?? undefined })));
      const mine = activeReviews.find((review) => review.reviewerId === user.id);
      const myMembership = rca.project.memberships.find(({ userId }) => userId === user.id);
      const canManage = user.systemRole === "ADMIN" || myMembership?.role === "PROJECT_MANAGER";
      return <article className="rca-record panel" id={`rca-${rca.id}`} key={rca.id}><header><div><span className={`severity severity-${rca.severity.toLowerCase()}`}>{rca.severity}</span>{rca.task && <Link className="rca-task-link" href={`/tasks?edit=${rca.task.id}`}>TF-{rca.task.sequence} · {rca.task.title}</Link>}<h2>{rca.title}</h2><p>{rca.summary}</p></div><strong>{outcome.status.replaceAll("_", " ")}</strong></header>
        <div className="rca-sections">{rca.sections.map((section) => <section key={section.id}><h3>{section.title}</h3><p>{section.content}</p></section>)}</div>
        <div className="review-grid"><div><h3>Reviewers</h3>{activeReviews.map((review) => <div className="reviewer-row" key={review.id}><p><b>{review.reviewer.name}</b><span>{review.decision ?? "AWAITING DECISION"}</span>{review.comment && <small>{review.comment}</small>}</p>
          {canManage && review.status === "ASSIGNED" && <form action={reassignReviewerAction}><input type="hidden" name="assignmentId" value={review.id}/><select name="reviewerId" defaultValue={review.reviewerId}><option value="">No replacement</option>{rca.project.memberships.map(({ user: member }) => <option value={member.id} key={member.id}>{member.name}</option>)}</select><button className="secondary">Reassign</button></form>}
        </div>)}</div>
          {mine && !mine.decision && <form action={submitReviewAction} className="review-form"><input type="hidden" name="assignmentId" value={mine.id}/><label>Review comment<textarea name="comment" required minLength={3} placeholder="Document the reason for your decision."/></label><div><button className="secondary" name="decision" value="REJECTED">Request changes</button><button className="create" name="decision" value="APPROVED">Approve RCA</button></div></form>}
        </div></article>;
    })}
  </main>;
}
