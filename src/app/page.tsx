import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { requireUser } from "@/modules/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const tasks = [
  { key: "TF-142", title: "Harden refresh-token rotation", project: "Platform", tone: "purple", due: "Today", people: ["SA", "NK"] },
  { key: "TF-138", title: "Add RCA review audit trail", project: "Reliability", tone: "teal", due: "8 Jul", people: ["MP"] },
  { key: "TF-127", title: "Improve task dependency warnings", project: "Core app", tone: "blue", due: "10 Jul", people: ["JR", "SA"] },
];

const activity = [
  { initials: "NK", text: "moved TF-142 to In review", time: "12 min ago", color: "#6d5ce7" },
  { initials: "MP", text: "submitted an RCA review", time: "38 min ago", color: "#0d9488" },
  { initials: "JR", text: "assigned you to TF-127", time: "1 hr ago", color: "#2563eb" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    check: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    alert: "M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01",
    chart: "M4 19V9m6 10V5m6 14v-7m5 7H2",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.9m-1-12a4 4 0 0 1 0 7.8",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 3.6-.2-.1a1.8 1.8 0 0 0-2 .2l-.5.3a1.7 1.7 0 0 0-1.2 1.5v.2H9.6v-.2A1.7 1.7 0 0 0 8.5 21l-.6-.3a1.8 1.8 0 0 0-2-.2l-.1.1L3.7 17l.1-.1a1.7 1.7 0 0 0 .3-1.9l-.3-.6a1.7 1.7 0 0 0-1.5-.9H2V9.3h.3a1.7 1.7 0 0 0 1.5-1l.3-.5a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-3.6.1.1a1.8 1.8 0 0 0 2 .2l.6-.3A1.7 1.7 0 0 0 9.6.7V.5h4.2v.2a1.7 1.7 0 0 0 1.2 1.5l.5.3a1.8 1.8 0 0 0 2-.2l.2-.1 2.1 3.6-.1.1a1.7 1.7 0 0 0-.3 1.9l.3.5a1.7 1.7 0 0 0 1.5 1h.3v4.2h-.3a1.7 1.7 0 0 0-1.5.9z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default async function Home() {
  const user = await requireUser();
  const firstName = user.name.split(/\s+/)[0];
  const userInitials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const role = user.systemRole === "ADMIN"
    ? "Administrator"
    : user.memberships[0]?.role === "PROJECT_MANAGER"
      ? "Project Manager"
      : "Member";
  const project = user.memberships[0]?.project;
  const [taskMetrics, pendingReviews] = await Promise.all([
    prisma.task.findMany({
      where: project ? { projects: { some: { projectId: project.id } } } : {},
      select: { status: true, dueAt: true },
    }),
    prisma.reviewAssignment.count({
      where: { reviewerId: user.id, status: "ASSIGNED" },
    }),
  ]);
  const unreadNotifications = await prisma.notification.count({ where: { recipientId: user.id, readAt: null } });
  const completed = taskMetrics.filter((task) => task.status === "DONE").length;
  const open = taskMetrics.length - completed;
  const overdue = taskMetrics.filter((task) => task.status !== "DONE" && task.dueAt && task.dueAt < new Date()).length;
  const completionRate = taskMetrics.length ? Math.round((completed / taskMetrics.length) * 100) : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">T</span><span>TeamFlow</span></div>
        <div className="project-switcher">
          <span className="project-logo">E</span>
          <span><small>Workspace</small>Engineering</span>
          <b>⌄</b>
        </div>
        <nav aria-label="Primary navigation">
          <Link className="active" href="/"><Icon name="grid" />Dashboard</Link>
          <Link href="/tasks"><Icon name="check" />Tasks<span className="nav-count">12</span></Link>
          <Link href="/rcas"><Icon name="alert" />Root cause analyses<span className="nav-count">1</span></Link>
          <Link href="/reports"><Icon name="chart" />Reports</Link>
        </nav>
        <div className="sidebar-bottom">
          <a href="#"><Icon name="users" />People</a>
          <Link href="/settings"><Icon name="settings" />Project settings</Link>
          <div className="user-card"><span className="avatar">{userInitials}</span><span><b>{user.name}</b><small>{role}</small></span><form action={logoutAction}><button type="submit" aria-label="Sign out">↪</button></form></div>
        </div>
      </aside>

      <main className="main">
        <header>
          <button className="mobile-menu" aria-label="Open navigation">☰</button>
          <div className="search">⌕ <span>Search tasks, projects, or people</span><kbd>⌘ K</kbd></div>
          <ThemeToggle />
          <Link className="icon-button notification-button notification-link" href="/notifications" aria-label={`${unreadNotifications} unread notifications`}>♢{unreadNotifications > 0 && <span className="dot" />}</Link>
          <button className="create">＋ Create</button>
        </header>

        <div className="content">
          <div className="welcome">
            <div><p className="eyebrow">SUNDAY, 5 JULY</p><h1>Good afternoon, {firstName}.</h1><p>Here&apos;s what&apos;s moving across your team today.</p></div>
            <button className="secondary">View my work <span>→</span></button>
          </div>

          <section className="metrics" aria-label="Project summary">
            <article><span className="metric-icon violet"><Icon name="check" /></span><div><p>Open tasks</p><strong>{open}</strong><small>Live project total</small></div></article>
            <article><span className="metric-icon coral"><Icon name="alert" /></span><div><p>Overdue</p><strong>{overdue}</strong><small>Needs attention</small></div></article>
            <article><span className="metric-icon teal"><Icon name="chart" /></span><div><p>Completion rate</p><strong>{completionRate}%</strong><small>{completed} of {taskMetrics.length} completed</small></div></article>
            <article><span className="metric-icon amber">✓</span><div><p>RCA reviews</p><strong>{pendingReviews}</strong><small>Awaiting your review</small></div></article>
          </section>

          <div className="dashboard-grid">
            <section className="panel focus-panel">
              <div className="panel-title"><div><h2>Your focus</h2><p>Tasks that need your attention</p></div><a href="#">View all <span>→</span></a></div>
              <div className="task-list">
                {tasks.map((task) => (
                  <article className="task" key={task.key}>
                    <span className={`task-status ${task.tone}`} />
                    <div className="task-body"><div><span className="task-key">{task.key}</span><h3>{task.title}</h3></div><div className="task-meta"><span>{task.project}</span><i /><span className={task.due === "Today" ? "urgent" : ""}>◷ {task.due}</span></div></div>
                    <div className="people">{task.people.map((person) => <span key={person}>{person}</span>)}</div>
                    <button aria-label={`More options for ${task.key}`}>•••</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel activity-panel">
              <div className="panel-title"><div><h2>Recent activity</h2><p>Across your projects</p></div><button aria-label="Activity options">•••</button></div>
              <div className="activity-list">
                {activity.map((item) => (
                  <article key={item.text}><span className="avatar" style={{ background: item.color }}>{item.initials}</span><div><p>{item.text}</p><small>{item.time}</small></div></article>
                ))}
              </div>
              <a className="activity-link" href="#">See all activity <span>→</span></a>
            </section>
          </div>

          <section className="panel progress-panel">
            <div className="panel-title"><div><h2>Project progress</h2><p>Delivery health for active projects</p></div><select aria-label="Reporting period"><option>This sprint</option></select></div>
            <div className="progress-row"><div className="project-badge indigo">E</div><div className="progress-copy"><b>{project?.name ?? "Engineering"}</b><span>{completed} of {taskMetrics.length} tasks completed</span></div><div className="progress-track"><span style={{ width: `${completionRate}%` }} /></div><strong>{completionRate}%</strong></div>
          </section>
        </div>
      </main>
    </div>
  );
}
