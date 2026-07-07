import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getProjectContext } from "@/modules/projects/active-project";
import { getCachedReportsData } from "@/modules/workspace-cache";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser();
  const { project } = await getProjectContext(user);
  if (!project) notFound();
  const { totalTasks, completed, completion, rcaCount, activeRcaCount, statusCounts, workload } =
    await getCachedReportsData(project.id);
  const maxStatus = Math.max(1, ...statusCounts.map(({ value }) => value));
  const maxWorkload = Math.max(1, ...workload.map(({ value }) => value));

  return (
    <main className="reports-page">
      <div className="reports-head">
        <div><Link href="/">← Dashboard</Link><p className="eyebrow">LIVE PROJECT ANALYTICS</p><h1>Reports</h1><p>Current delivery health for {project.name}.</p></div>
        <Link className="secondary" href="/tasks">Open task export →</Link>
      </div>
      <section className="report-kpis">
        <article><small>TOTAL TASKS</small><strong>{totalTasks}</strong><span>{totalTasks - completed} still open</span></article>
        <article><small>COMPLETION</small><strong>{completion}%</strong><span>{completed} delivered</span></article>
        <article><small>RCA VOLUME</small><strong>{rcaCount}</strong><span>{activeRcaCount} active</span></article>
        <article><small>TEAM MEMBERS</small><strong>{workload.length}</strong><span>with assigned work</span></article>
      </section>
      <div className="report-grid">
        <section className="panel report-card"><h2>Tasks by status</h2><p>Live distribution across the configured workflow.</p><div className="bar-chart">{statusCounts.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value / maxStatus * 100}%` }} /></i><strong>{item.value}</strong></div>)}</div></section>
        <section className="panel report-card"><h2>Open workload</h2><p>Incomplete tasks grouped by assignee.</p><div className="bar-chart workload-chart">{workload.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value / maxWorkload * 100}%` }} /></i><strong>{item.value}/{item.total}</strong></div>)}</div></section>
      </div>
    </main>
  );
}
