import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/modules/auth/session";
import { getProjectContext } from "@/modules/projects/active-project";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser();
  const { project } = await getProjectContext(user);
  if (!project) notFound();
  const [tasks, rcas] = await Promise.all([
    prisma.task.findMany({
      where: { projects: { some: { projectId: project.id } } },
      include: { assignee: true },
    }),
    prisma.rootCauseAnalysis.findMany({ where: { projectId: project.id } }),
  ]);

  const completed = tasks.filter(({ status }) => status === "DONE").length;
  const completion = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const statusCounts = [...new Set(tasks.map(({ status }) => status))].map((status) => ({
    label: status,
    value: tasks.filter((task) => task.status === status).length,
  }));
  const assignees = [...new Set(tasks.map(({ assigneeId }) => assigneeId).filter(Boolean))];
  const workload = assignees.map((assigneeId) => {
    const assigned = tasks.filter((task) => task.assigneeId === assigneeId);
    return {
      label: assigned[0]?.assignee?.name ?? "Unassigned",
      value: assigned.filter(({ status }) => status !== "DONE").length,
      total: assigned.length,
    };
  }).sort((a, b) => b.value - a.value);
  const maxStatus = Math.max(1, ...statusCounts.map(({ value }) => value));
  const maxWorkload = Math.max(1, ...workload.map(({ value }) => value));

  return (
    <main className="reports-page">
      <div className="reports-head">
        <div><Link href="/">← Dashboard</Link><p className="eyebrow">LIVE PROJECT ANALYTICS</p><h1>Reports</h1><p>Current delivery health for {project.name}.</p></div>
        <Link className="secondary" href="/tasks">Open task export →</Link>
      </div>
      <section className="report-kpis">
        <article><small>TOTAL TASKS</small><strong>{tasks.length}</strong><span>{tasks.length - completed} still open</span></article>
        <article><small>COMPLETION</small><strong>{completion}%</strong><span>{completed} delivered</span></article>
        <article><small>RCA VOLUME</small><strong>{rcas.length}</strong><span>{rcas.filter(({ state }) => state !== "CLOSED").length} active</span></article>
        <article><small>TEAM MEMBERS</small><strong>{workload.length}</strong><span>with assigned work</span></article>
      </section>
      <div className="report-grid">
        <section className="panel report-card"><h2>Tasks by status</h2><p>Live distribution across the configured workflow.</p><div className="bar-chart">{statusCounts.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value / maxStatus * 100}%` }} /></i><strong>{item.value}</strong></div>)}</div></section>
        <section className="panel report-card"><h2>Open workload</h2><p>Incomplete tasks grouped by assignee.</p><div className="bar-chart workload-chart">{workload.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value / maxWorkload * 100}%` }} /></i><strong>{item.value}/{item.total}</strong></div>)}</div></section>
      </div>
    </main>
  );
}
