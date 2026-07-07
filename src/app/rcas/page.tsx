import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getProjectContext } from "@/modules/projects/active-project";
import { prisma } from "@/lib/prisma";
import { evaluateRcaReviews } from "@/modules/rca/review-policy";
import { ProjectSwitcher } from "@/components/project-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { TaskSearchBar } from "@/components/task-search-bar";
import { getCachedRcasPageData } from "@/modules/workspace-cache";
import { logoutAction } from "@/app/login/actions";
import { createTaskRcaAction, reassignReviewerAction, submitReviewAction } from "./actions";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function RcasPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const user = await requireUser();
  const { project, projects, membership } = await getProjectContext(user);
  if (!project) notFound();
  const query = await searchParams;
  const canManageProject = user.systemRole === "ADMIN" || membership?.role === "PROJECT_MANAGER";
  const [{ projectMembers, rcas, taskCount, unreadNotifications }, requestedTask] = await Promise.all([
    getCachedRcasPageData(project.id, user.id),
    query.task
      ? prisma.task.findUnique({
          where: { id: query.task },
          include: {
            rca: { select: { id: true } },
            projects: {
              include: {
                project: {
                  include: {
                    memberships: { select: { userId: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);
  const requestedProject = requestedTask?.projects.find(({ projectId }) => projectId === project.id)?.project;
  const selectedTask = requestedTask
    && requestedTask.status === "IN REVIEW"
    && requestedProject
    && (user.systemRole === "ADMIN" || requestedProject.memberships.some(({ userId }) => userId === user.id))
    ? requestedTask
    : null;
  const role = user.systemRole === "ADMIN"
    ? "Administrator"
    : membership?.role === "PROJECT_MANAGER"
      ? "Project Manager"
      : "Member";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark">T</span><span>TeamFlow</span></Link>
        <ProjectSwitcher projects={projects} activeProject={project} redirectTo="/rcas" />
        <nav aria-label="Primary navigation">
          <Link href="/"><span className="mini-icon">▦</span>Dashboard</Link>
          <Link href="/tasks"><span className="mini-icon">✓</span>Tasks<span className="nav-count">{taskCount}</span></Link>
          <Link className="active" href="/rcas"><span className="mini-icon">△</span>Root cause analyses<span className="nav-count">{rcas.length}</span></Link>
          <Link href="/reports"><span className="mini-icon">⌁</span>Reports</Link>
        </nav>
        <div className="sidebar-bottom">
          <Link href="/people"><span className="mini-icon">♙</span>People</Link>
          <Link href="/settings"><span className="mini-icon">⚙</span>Project settings</Link>
          <div className="user-card">
            <span className="avatar">{initials(user.name)}</span>
            <span><b>{user.name}</b><small>{role}</small></span>
            <form action={logoutAction}><button type="submit">Log out</button></form>
          </div>
        </div>
      </aside>

      <main className="main">
        <header>
          <TaskSearchBar projectName={project.name} />
          <ThemeToggle />
          <Link className="icon-button notification-button notification-link" href="/notifications" aria-label={`${unreadNotifications} unread notifications`}>
            ♢{unreadNotifications > 0 && <span className="dot" />}
          </Link>
          <Link className="create" href="/tasks">Open tasks</Link>
        </header>

        <div className="rca-page">
          <div className="rca-top">
            <div><p className="eyebrow">{project.name.toUpperCase()} / RCA</p><h1>Root cause analyses</h1><p>Capture findings, assign reviewers, and keep every decision auditable.</p></div>
          </div>

          {selectedTask && !selectedTask.rca && requestedProject && (
            <section className="rca-create panel">
              <div>
                <p className="eyebrow">TF-{selectedTask.sequence} / IN REVIEW</p>
                <h2>Add review findings</h2>
                <p>Document your findings and assign one project member to review them.</p>
              </div>
              <form action={createTaskRcaAction}>
                <input type="hidden" name="taskId" value={selectedTask.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <label>RCA title<input name="title" required minLength={3} maxLength={160} defaultValue={`RCA for TF-${selectedTask.sequence}: ${selectedTask.title}`} /></label>
                <label>Severity<select name="severity" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label>
                <label>Assign reviewer<select name="reviewerId" required defaultValue=""><option value="" disabled>Select a project member</option>{projectMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
                <label className="rca-findings">Review findings<textarea name="findings" required minLength={10} maxLength={6000} placeholder="Describe what you found, why it happened, and what should change." /></label>
                <div className="rca-create-actions"><Link className="secondary" href="/tasks">Cancel</Link><button className="create">Save and assign review</button></div>
              </form>
            </section>
          )}
          {query.task && !selectedTask && <p className="rca-message">RCA creation is available only for an accessible task in this project with the In review status.</p>}
          {selectedTask?.rca && <p className="rca-message">This task already has an RCA. It appears below.</p>}

          <div className="rca-list">
            {rcas.map((rca) => {
              const activeReviews = rca.reviewAssignments.filter((review) => review.status !== "CANCELLED");
              const outcome = evaluateRcaReviews(activeReviews.map((review) => ({ reviewerId: review.reviewerId, decision: review.decision ?? undefined, comment: review.comment ?? undefined })));
              const mine = activeReviews.find((review) => review.reviewerId === user.id);
              const canManage = canManageProject;
              const showDecisionForm = Boolean(mine && !mine.decision);
              return (
                <article className="rca-record panel" id={`rca-${rca.id}`} key={rca.id}>
                  <div className="rca-record-head">
                    <div className="rca-record-copy">
                      <div className="rca-meta"><span className={`severity severity-${rca.severity.toLowerCase()}`}>{rca.severity}</span>{rca.task && <Link className="rca-task-link" href={`/tasks?edit=${rca.task.id}`}>TF-{rca.task.sequence} · {rca.task.title}</Link>}</div>
                      <h2>{rca.title}</h2>
                      <p>{rca.summary}</p>
                    </div>
                    <strong>{outcome.status.replaceAll("_", " ")}</strong>
                  </div>
                  <div className={`rca-sections section-count-${Math.min(3, Math.max(1, rca.sections.length))}`}>{rca.sections.map((section) => <section key={section.id}><h3>{section.title}</h3><p>{section.content}</p></section>)}</div>
                  <div className={`review-grid ${showDecisionForm ? "" : "single"}`}>
                    <div>
                      <h3>Reviewers</h3>
                      {activeReviews.map((review) => (
                        <div className="reviewer-row" key={review.id}>
                          <p><b>{review.reviewerName}</b><span>{review.decision ?? "AWAITING DECISION"}</span>{review.comment && <small>{review.comment}</small>}</p>
                          {canManage && review.status === "ASSIGNED" && (
                            <form action={reassignReviewerAction}>
                              <input type="hidden" name="assignmentId" value={review.id} />
                              <select name="reviewerId" defaultValue={review.reviewerId}><option value="">No replacement</option>{projectMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select>
                              <button className="secondary">Reassign</button>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                    {mine && !mine.decision && (
                      <form action={submitReviewAction} className="review-form">
                        <input type="hidden" name="assignmentId" value={mine.id} />
                        <label>Review comment<textarea name="comment" required minLength={3} placeholder="Document the reason for your decision." /></label>
                        <div><button className="secondary" name="decision" value="REJECTED">Request changes</button><button className="create" name="decision" value="APPROVED">Approve RCA</button></div>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
            {rcas.length === 0 && <section className="panel rca-empty"><h2>No RCAs in {project.name}</h2><p>Move a task to In review, then use Add RCA to record findings.</p><Link className="create" href="/tasks">Open tasks</Link></section>}
          </div>
        </div>
      </main>
    </div>
  );
}
