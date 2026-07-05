import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/login/actions";
import { requireUser } from "@/modules/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function relativeTime(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} d ago`;
}

function activityText(action: string) {
  const labels: Record<string, string> = {
    TASK_CREATED: "created a task",
    TASK_UPDATED: "updated a task",
    TASK_COMMENTED: "commented on a task",
    TASK_PHOTO_UPLOADED: "uploaded a task photo",
    RCA_REVIEW_DECIDED: "submitted an RCA review",
    RCA_REVIEWER_REASSIGNED: "reassigned an RCA reviewer",
    PROJECT_MEMBER_ADDED: "added a project member",
    PROJECT_MEMBER_ROLE_CHANGED: "changed a project role",
  };
  return labels[action] ?? action.toLowerCase().replaceAll("_", " ");
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    check: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    alert: "M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01",
    chart: "M4 19V9m6 10V5m6 14v-7m5 7H2",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.9m-1-12a4 4 0 0 1 0 7.8",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19 15l2 2-2 3-3-1-2 1-1 3H9l-1-3-2-1-3 1-2-3 2-2V9L1 7l2-3 3 1 2-1 1-3h4l1 3 2 1 3-1 2 3-2 2z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default async function Home() {
  const user = await requireUser();
  const project = user.memberships[0]?.project;
  const role = user.systemRole === "ADMIN"
    ? "Administrator"
    : user.memberships[0]?.role === "PROJECT_MANAGER"
      ? "Project Manager"
      : "Member";

  const [taskMetrics, pendingReviews, focusTasks, recentActivity, rcaCount, unreadNotifications] =
    await Promise.all([
      prisma.task.findMany({
        where: project ? { projects: { some: { projectId: project.id } } } : {},
        select: { status: true, dueAt: true },
      }),
      prisma.reviewAssignment.count({ where: { reviewerId: user.id, status: "ASSIGNED" } }),
      prisma.task.findMany({
        where: {
          assigneeId: user.id,
          status: { notIn: ["DONE", "CANCELLED"] },
          ...(project ? { projects: { some: { projectId: project.id } } } : {}),
        },
        include: { projects: { include: { project: true } }, assignee: true },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 3,
      }),
      prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 3 }),
      prisma.rootCauseAnalysis.count({ where: project ? { projectId: project.id } : {} }),
      prisma.notification.count({ where: { recipientId: user.id, readAt: null } }),
    ]);

  const completed = taskMetrics.filter((task) => task.status === "DONE").length;
  const open = taskMetrics.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length;
  const overdue = taskMetrics.filter(
    (task) => !["DONE", "CANCELLED"].includes(task.status) && task.dueAt && task.dueAt < new Date(),
  ).length;
  const completionRate = taskMetrics.length ? Math.round((completed / taskMetrics.length) * 100) : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark">T</span><span>TeamFlow</span></Link>
        <div className="project-switcher">
          <span className="project-logo">E</span>
          <span><small>Current project</small>{project?.name ?? "Engineering"}</span>
        </div>
        <nav aria-label="Primary navigation">
          <Link className="active" href="/"><Icon name="grid" />Dashboard</Link>
          <Link href="/tasks"><Icon name="check" />Tasks<span className="nav-count">{taskMetrics.length}</span></Link>
          <Link href="/rcas"><Icon name="alert" />Root cause analyses<span className="nav-count">{rcaCount}</span></Link>
          <Link href="/reports"><Icon name="chart" />Reports</Link>
        </nav>
        <div className="sidebar-bottom">
          <Link href="/people"><Icon name="users" />People</Link>
          <Link href="/settings"><Icon name="settings" />Project settings</Link>
          <div className="user-card">
            <span className="avatar">{initials(user.name)}</span>
            <span><b>{user.name}</b><small>{role}</small></span>
            <form action={logoutAction}><button type="submit" aria-label="Sign out">↪</button></form>
          </div>
        </div>
      </aside>

      <main className="main">
        <header>
          <Link className="mobile-menu" href="/tasks" aria-label="Open tasks navigation">☰</Link>
          <Link className="search" href="/tasks">⌕ <span>Search tasks, projects, or people</span><kbd>Ctrl K</kbd></Link>
          <ThemeToggle />
          <Link className="icon-button notification-button notification-link" href="/notifications" aria-label={`${unreadNotifications} unread notifications`}>
            ♢{unreadNotifications > 0 && <span className="dot" />}
          </Link>
          <Link className="create" href="/tasks?create=1">＋ Create</Link>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</p>
              <h1>Good afternoon, {user.name.split(/\s+/)[0]}.</h1>
              <p>Here&apos;s what&apos;s moving across your team today.</p>
            </div>
            <Link className="secondary" href="/tasks">View my work <span>→</span></Link>
          </div>

          <section className="metrics" aria-label="Project summary">
            <Link href="/tasks"><span className="metric-icon violet"><Icon name="check" /></span><div><p>Open tasks</p><strong>{open}</strong><small>Live project total</small></div></Link>
            <Link href="/tasks"><span className="metric-icon coral"><Icon name="alert" /></span><div><p>Overdue</p><strong>{overdue}</strong><small>Needs attention</small></div></Link>
            <Link href="/reports"><span className="metric-icon teal"><Icon name="chart" /></span><div><p>Completion rate</p><strong>{completionRate}%</strong><small>{completed} of {taskMetrics.length} completed</small></div></Link>
            <Link href="/rcas"><span className="metric-icon amber">✓</span><div><p>RCA reviews</p><strong>{pendingReviews}</strong><small>Awaiting your review</small></div></Link>
          </section>

          <div className="dashboard-grid">
            <section className="panel focus-panel">
              <div className="panel-title">
                <div><h2>Your focus</h2><p>Tasks that need your attention</p></div>
                <Link href="/tasks">View all <span>→</span></Link>
              </div>
              <div className="task-list">
                {focusTasks.map((task, index) => (
                  <article className="task" key={task.id}>
                    <span className={`task-status ${["purple", "teal", "blue"][index % 3]}`} />
                    <div className="task-body">
                      <div><span className="task-key">TF-{task.sequence}</span><h3>{task.title}</h3></div>
                      <div className="task-meta">
                        <span>{task.projects[0]?.project.name ?? "Engineering"}</span><i />
                        <span>{task.dueAt ? `◷ ${task.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No due date"}</span>
                      </div>
                    </div>
                    <div className="people"><span>{task.assignee ? initials(task.assignee.name) : "—"}</span></div>
                    <Link className="task-more" href={`/tasks?edit=${task.id}`} aria-label={`Edit TF-${task.sequence}`}>•••</Link>
                  </article>
                ))}
                {focusTasks.length === 0 && <p className="empty-state">No open tasks are assigned to you.</p>}
              </div>
            </section>

            <section className="panel activity-panel">
              <div className="panel-title">
                <div><h2>Recent activity</h2><p>Across your projects</p></div>
                <Link href="/notifications" aria-label="View notification activity">•••</Link>
              </div>
              <div className="activity-list">
                {recentActivity.map((item, index) => (
                  <article key={item.id}>
                    <span className="avatar" style={{ background: ["#6d5ce7", "#0d9488", "#2563eb"][index % 3] }}>
                      {item.actor ? initials(item.actor.name) : "TF"}
                    </span>
                    <div><p>{item.actor?.name ?? "TeamFlow"} {activityText(item.action)}</p><small>{relativeTime(item.createdAt)}</small></div>
                  </article>
                ))}
              </div>
              <Link className="activity-link" href="/notifications">See notification activity <span>→</span></Link>
            </section>
          </div>

          <section className="panel progress-panel">
            <div className="panel-title"><div><h2>Project progress</h2><p>Delivery health for active projects</p></div><Link href="/reports">Open reports →</Link></div>
            <div className="progress-row">
              <div className="project-badge indigo">E</div>
              <div className="progress-copy"><b>{project?.name ?? "Engineering"}</b><span>{completed} of {taskMetrics.length} tasks completed</span></div>
              <div className="progress-track"><span style={{ width: `${completionRate}%` }} /></div>
              <strong>{completionRate}%</strong>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
